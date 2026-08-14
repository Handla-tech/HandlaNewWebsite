import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';

import { ConversationAiState } from '../entities/conversation-ai-state.entity';
import { AiControlMode, LeadStatus } from '../../../common/enums';

function isDuplicateKeyError(err: unknown): boolean {
  if (!err) return false;
  const e = err as { code?: string; errno?: number; driverError?: { code?: string; errno?: number } };
  const code = e.code ?? e.driverError?.code;
  const errno = e.errno ?? e.driverError?.errno;
  return code === 'ER_DUP_ENTRY' || errno === 1062;
}

/**
 * Owns the lifecycle of the per-conversation AI sidecar row
 * (ConversationAiState): lazy creation, takeover/return, and idempotent
 * bookkeeping. Kept separate from the orchestrator so the takeover admin
 * endpoints and the chat hook share one consistent state authority.
 */
@Injectable()
export class AiStateService {
  private readonly logger = new Logger(AiStateService.name);

  constructor(
    @InjectRepository(ConversationAiState)
    private readonly stateRepo: Repository<ConversationAiState>,
  ) {}

  /** Return the state row if it exists (no side effects). */
  async find(conversationId: string): Promise<ConversationAiState | null> {
    return this.stateRepo.findOne({ where: { conversationId } });
  }

  /**
   * Race-safe get-or-create for the (conversationId) sidecar row, mirroring the
   * pattern used by ChatService.createOrGetConversation.
   */
  async getOrCreate(conversationId: string): Promise<ConversationAiState> {
    const existing = await this.stateRepo.findOne({ where: { conversationId } });
    if (existing) return existing;

    const row = this.stateRepo.create({
      conversationId,
      controlMode: AiControlMode.AI,
      leadStatus: LeadStatus.NEW,
    });
    try {
      return await this.stateRepo.save(row);
    } catch (err) {
      if (err instanceof QueryFailedError && isDuplicateKeyError(err)) {
        const winner = await this.stateRepo.findOne({ where: { conversationId } });
        if (winner) return winner;
      }
      throw err;
    }
  }

  async save(state: ConversationAiState): Promise<ConversationAiState> {
    return this.stateRepo.save(state);
  }

  /** A human agent takes over: mute the bot immediately. */
  async takeOver(conversationId: string, staffUserId: string, note?: string): Promise<ConversationAiState> {
    const state = await this.getOrCreate(conversationId);
    state.controlMode = AiControlMode.HUMAN;
    state.takenOverBy = staffUserId;
    state.takenOverAt = new Date();
    // Escalation is considered resolved once a human is on it.
    state.needsHuman = false;
    if (note) state.escalationReason = note.slice(0, 512);
    return this.stateRepo.save(state);
  }

  /** Hand control back to the assistant (safe return-to-AI). */
  async returnToAi(conversationId: string): Promise<ConversationAiState> {
    const state = await this.getOrCreate(conversationId);
    state.controlMode = AiControlMode.AI;
    state.takenOverBy = null;
    state.takenOverAt = null;
    state.needsHuman = false;
    state.escalationReason = null;
    return this.stateRepo.save(state);
  }

  /** True when the bot is allowed to auto-reply. */
  isBotActive(state: ConversationAiState): boolean {
    return state.controlMode === AiControlMode.AI;
  }
}
