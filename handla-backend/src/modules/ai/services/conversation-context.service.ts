import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { AiConfig } from '../../../config/ai.config';
import { Message } from '../../chat/entities/message.entity';
import { ConversationAiState } from '../entities/conversation-ai-state.entity';
import { KnowledgeService } from './knowledge.service';
import { PromptContext } from './prompt.service';
import { MessageOrigin, UserRole } from '../../../common/enums';

/**
 * Assembles the bounded context passed to the model on each turn:
 *   running summary  (compressed history)
 * + recent window    (verbatim last N messages)
 * + KB snippets      (grounding, retrieved for the latest customer message)
 * + lead state       (accumulated structured data)
 *
 * Keeping history compressed is the primary cost-control lever: we send a
 * short summary + a fixed recent window instead of the whole transcript.
 */
@Injectable()
export class ConversationContextService {
  private readonly cfg: AiConfig;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    private readonly knowledgeService: KnowledgeService,
  ) {
    this.cfg = this.configService.get<AiConfig>('ai')!;
  }

  async build(
    conversationId: string,
    state: ConversationAiState,
    latestCustomerMessage: string,
  ): Promise<PromptContext> {
    const window = this.cfg.recentMessageWindow;

    // Pull the most recent messages (newest first), then re-order oldest→newest.
    const rows = await this.messageRepo.find({
      where: { conversationId },
      relations: ['sender'],
      order: { createdAt: 'DESC' },
      take: window,
    });
    const ordered = rows.reverse();

    const recent = ordered
      .filter((m) => !!m.content)
      .map((m) => ({
        role: this.roleOf(m),
        text: m.content as string,
      }));

    const knowledge = await this.knowledgeService.retrieve(
      latestCustomerMessage,
      this.cfg.maxKbSnippets,
    );

    return {
      runningSummary: state.runningSummary,
      recent,
      knowledge,
      leadData: state.leadData,
      leadStatus: state.leadStatus,
      latestCustomerMessage,
    };
  }

  /**
   * Very cheap extractive "summary": keeps the tail of the previous summary +
   * a compressed line for the latest exchange. Deterministic and free (no LLM
   * call), which keeps us at the 1-message → 1-AI-call budget.
   */
  rollSummary(
    previous: string | null,
    customerText: string,
    assistantReply: string,
  ): string {
    const line = `- customer: ${this.clip(customerText)} | assistant: ${this.clip(assistantReply)}`;
    const combined = [previous ?? '', line].filter(Boolean).join('\n');
    // Cap the summary length so it never bloats the prompt.
    const lines = combined.split('\n');
    const maxLines = 20;
    return lines.slice(-maxLines).join('\n');
  }

  private roleOf(m: Message): 'customer' | 'assistant' | 'staff' {
    // Prefer explicit origin; fall back to sender role for legacy rows.
    if (m.origin === MessageOrigin.AI || m.origin === MessageOrigin.SYSTEM) return 'assistant';
    if (m.origin === MessageOrigin.STAFF) return 'staff';
    if (m.origin === MessageOrigin.CLIENT) return 'customer';

    const role = m.sender?.role;
    if (role === UserRole.ADMIN || role === UserRole.EMPLOYEE) return 'staff';
    return 'customer';
  }

  private clip(text: string, max = 160): string {
    const t = (text || '').replace(/\s+/g, ' ').trim();
    return t.length > max ? t.slice(0, max) + '…' : t;
  }
}
