import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { AiConfig } from '../../../config/ai.config';
import { ChatService } from '../../chat/chat.service';
import { Conversation } from '../../chat/entities/conversation.entity';
import { Message } from '../../chat/entities/message.entity';
import { User } from '../../auth/entities/user.entity';
import {
  MessageOrigin,
  UserRole,
  AiIntent,
} from '../../../common/enums';

import { AiService } from './ai.service';
import { PromptService } from './prompt.service';
import { ConversationContextService } from './conversation-context.service';
import { LeadExtractionService } from './lead-extraction.service';
import { AiStateService } from './ai-state.service';
import { KnowledgeService } from './knowledge.service';

/**
 * Callback the orchestrator uses to push the AI reply back through the EXISTING
 * chat gateway (no parallel delivery pipeline). The ChatGateway registers this.
 */
export type BroadcastFn = (conversationId: string, message: Message) => void;

export interface HandleResult {
  handled: boolean;
  reason?: string;
  aiMessage?: Message;
}

/**
 * The AI orchestrator. NestJS is the workflow controller here:
 *   1. gate on takeover / role / config / idempotency
 *   2. build bounded context
 *   3. ONE model call → validate structured output
 *   4. merge lead state, persist, and emit ONE reply via the existing gateway
 *
 * It is invoked by ChatGateway AFTER a customer message has been saved. It must
 * never throw into the chat flow — all failures degrade gracefully.
 */
@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);
  private readonly cfg: AiConfig;

  /** In-process guard against concurrent handling of the same conversation. */
  private readonly inFlight = new Set<string>();

  private broadcast: BroadcastFn | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly chatService: ChatService,
    private readonly aiService: AiService,
    private readonly promptService: PromptService,
    private readonly contextService: ConversationContextService,
    private readonly leadService: LeadExtractionService,
    private readonly stateService: AiStateService,
    private readonly knowledgeService: KnowledgeService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {
    this.cfg = this.configService.get<AiConfig>('ai')!;
  }

  /** Called once by ChatGateway to wire the delivery channel. */
  registerBroadcast(fn: BroadcastFn): void {
    this.broadcast = fn;
  }

  /**
   * Entry point invoked from the chat flow after a message is persisted.
   * `senderUser` is the author of the just-saved message.
   */
  async handleIncomingMessage(params: {
    conversation: Conversation;
    senderUser: User;
    message: Message;
  }): Promise<HandleResult> {
    try {
      return await this.handleInner(params);
    } catch (err) {
      // Never let the assistant break the chat pipeline.
      this.logger.error(`AI handling failed: ${(err as Error)?.message}`, (err as Error)?.stack);
      return { handled: false, reason: 'error' };
    }
  }

  private async handleInner(params: {
    conversation: Conversation;
    senderUser: User;
    message: Message;
  }): Promise<HandleResult> {
    const { conversation, senderUser, message } = params;

    // ── Gate 0: assistant configured & enabled ────────────────────────────────
    if (!this.aiService.isConfigured()) {
      return { handled: false, reason: 'not-configured' };
    }

    // ── Gate 1: only react to customer (CLIENT/LEAD) turns ─────────────────────
    const isCustomer = senderUser.role === UserRole.CLIENT || senderUser.role === UserRole.LEAD;
    if (this.cfg.replyToClientsOnly && !isCustomer) {
      return { handled: false, reason: 'not-customer' };
    }

    // Ignore our own AI/SYSTEM/staff-authored messages defensively.
    if (message.origin === MessageOrigin.AI || message.origin === MessageOrigin.SYSTEM) {
      return { handled: false, reason: 'ai-authored' };
    }
    if (!message.content || !message.content.trim()) {
      return { handled: false, reason: 'no-text' };
    }

    // ── Gate 2: concurrency guard (no double replies) ──────────────────────────
    if (this.inFlight.has(conversation.id)) {
      return { handled: false, reason: 'in-flight' };
    }
    this.inFlight.add(conversation.id);
    try {
      const state = await this.stateService.getOrCreate(conversation.id);

      // ── Gate 3: human takeover — bot is muted ────────────────────────────────
      if (!this.stateService.isBotActive(state)) {
        return { handled: false, reason: 'human-takeover' };
      }

      // ── Gate 4: idempotency — already handled this message ───────────────────
      if (state.lastHandledMessageId === message.id) {
        return { handled: false, reason: 'already-handled' };
      }

      // ── Build context, ONE model call, validate ──────────────────────────────
      const ctx = await this.contextService.build(conversation.id, state, message.content);
      const messages = [
        { role: 'system' as const, content: this.promptService.buildSystemPrompt() },
        { role: 'user' as const, content: this.promptService.buildUserPrompt(ctx) },
      ];

      const raw = await this.aiService.complete(messages);
      const validation = this.aiService.validate(raw);

      if (!validation.ok || !validation.value) {
        this.logger.warn(`AI output invalid (${validation.error}) — sending graceful fallback.`);
        return this.deliverFallback(conversation, state, message);
      }

      const ai = validation.value;

      // ── Merge authoritative lead state (NestJS owns the truth) ───────────────
      const merged = this.leadService.merge(state.leadData, ai);

      // ── Persist the AI reply through the EXISTING chat pipeline ──────────────
      const aiUser = await this.resolveAiSenderId(conversation);
      const aiMessage = await this.chatService.saveMessage(
        conversation.id,
        aiUser,
        ai.reply,
        undefined,
        MessageOrigin.AI,
      );

      // ── Update sidecar state (idempotency marker + lead + escalation) ────────
      state.leadData = merged.leadData;
      state.missingFields = merged.missingFields;
      state.leadStatus = merged.leadStatus;
      state.lastHandledMessageId = message.id;
      state.aiMessageCount = (state.aiMessageCount ?? 0) + 1;
      state.runningSummary = this.contextService.rollSummary(
        state.runningSummary,
        message.content,
        ai.reply,
      );
      if (ai.needs_human || ai.intent === AiIntent.HANDOFF_REQUEST) {
        state.needsHuman = true;
        state.escalationReason = ai.escalation_reason || 'Customer requested a human';
      }
      await this.stateService.save(state);

      // ── Deliver via existing gateway broadcast ───────────────────────────────
      this.emit(conversation.id, aiMessage);

      return { handled: true, aiMessage };
    } finally {
      this.inFlight.delete(conversation.id);
    }
  }

  /** Graceful, KB-agnostic fallback when the model fails or returns garbage. */
  private async deliverFallback(
    conversation: Conversation,
    state: import('../entities/conversation-ai-state.entity').ConversationAiState,
    message: Message,
  ): Promise<HandleResult> {
    const text =
      "I'm sorry — I'm having trouble answering that right now. I've flagged this so a member of our team can follow up with you shortly.";
    const aiUser = await this.resolveAiSenderId(conversation);
    const aiMessage = await this.chatService.saveMessage(
      conversation.id,
      aiUser,
      text,
      undefined,
      MessageOrigin.SYSTEM,
    );

    // Flag for human follow-up and mark idempotency so we don't loop.
    state.needsHuman = true;
    state.escalationReason = 'AI fallback (model unavailable/invalid output)';
    state.lastHandledMessageId = message.id;
    await this.stateService.save(state);

    this.emit(conversation.id, aiMessage);
    return { handled: true, reason: 'fallback', aiMessage };
  }

  /**
   * The AI messages are authored as the conversation's admin so they satisfy
   * the existing participant/access checks and render on the correct side.
   * Origin=AI is what actually distinguishes them in the UI.
   */
  private async resolveAiSenderId(conversation: Conversation): Promise<string> {
    if (conversation.adminId) return conversation.adminId;
    const admin = await this.chatService.findDefaultAdmin();
    return admin?.id ?? conversation.adminId;
  }

  private emit(conversationId: string, message: Message): void {
    if (this.broadcast) {
      this.broadcast(conversationId, message);
    } else {
      this.logger.warn('No broadcast fn registered — AI reply saved but not pushed in real time.');
    }
  }
}
