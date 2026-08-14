import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { AiControlMode, LeadStatus } from '../../../common/enums';

/**
 * Per-conversation AI orchestration state.
 *
 * This is a SIDECAR row keyed by the existing `conversations.id` — the chat
 * module is untouched. One row per conversation, created lazily the first time
 * the assistant is engaged.
 */
@Index('uq_ai_state_conversation', ['conversationId'], { unique: true })
@Entity('ai_conversation_state')
export class ConversationAiState {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** FK (logical) to conversations.id — kept loose to avoid touching chat. */
  @Column({ name: 'conversation_id', type: 'varchar', length: 36 })
  conversationId: string;

  /**
   * Who is driving the conversation. HUMAN = a staff member took over and the
   * bot is muted; AI = the assistant auto-replies.
   */
  @Column({
    name: 'control_mode',
    type: 'enum',
    enum: AiControlMode,
    default: AiControlMode.AI,
  })
  controlMode: AiControlMode;

  /** Staff user id who took over (for the takeover audit trail). */
  @Column({ name: 'taken_over_by', type: 'varchar', length: 36, nullable: true, default: null })
  takenOverBy: string | null;

  @Column({ name: 'taken_over_at', type: 'datetime', nullable: true, default: null })
  takenOverAt: Date | null;

  /** Assistant flagged that a human should step in (needs_human=true). */
  @Column({ name: 'needs_human', type: 'boolean', default: false })
  needsHuman: boolean;

  /** Why escalation was requested (from the AI's structured output). */
  @Column({ name: 'escalation_reason', type: 'varchar', length: 512, nullable: true, default: null })
  escalationReason: string | null;

  // ─── Lead qualification state ───────────────────────────────────────────────

  @Column({
    name: 'lead_status',
    type: 'enum',
    enum: LeadStatus,
    default: LeadStatus.NEW,
  })
  leadStatus: LeadStatus;

  /**
   * Structured lead data accumulated across turns (name, company, product,
   * budget, timeline, contact, use case...). Stored as JSON so the shape can
   * evolve without a migration.
   */
  @Column({ name: 'lead_data', type: 'json', nullable: true })
  leadData: Record<string, unknown> | null;

  /** Fields still missing before the lead is QUALIFIED. */
  @Column({ name: 'missing_fields', type: 'json', nullable: true })
  missingFields: string[] | null;

  /**
   * Rolling running summary of the conversation so far — lets us keep the
   * prompt short (summary + recent window) instead of replaying every message.
   */
  @Column({ name: 'running_summary', type: 'text', nullable: true })
  runningSummary: string | null;

  /**
   * Idempotency guard: the id of the last CLIENT message the orchestrator has
   * already produced a reply for. Prevents double replies on retries / races.
   */
  @Column({ name: 'last_handled_message_id', type: 'varchar', length: 36, nullable: true, default: null })
  lastHandledMessageId: string | null;

  /** Total AI completions produced for this conversation (cost visibility). */
  @Column({ name: 'ai_message_count', type: 'int', default: 0 })
  aiMessageCount: number;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;
}
