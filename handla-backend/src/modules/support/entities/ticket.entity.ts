import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import {
  TicketStatus,
  TicketPriority,
  TicketCategory,
  TicketSource,
} from '../../../common/enums';
import { Client } from '../../clients/entities/client.entity';
import { Project } from '../../projects/entities/project.entity';
import { User } from '../../auth/entities/user.entity';
import { TicketReply } from './ticket-reply.entity';

/**
 * SUP-1 — Ticket entity.
 *
 * A support ticket raised by / on behalf of a Client, optionally tied to a
 * Project, and optionally assigned to a staff member (assignee).
 *
 * Lifecycle:
 *   OPEN → IN_PROGRESS → WAITING_CUSTOMER → RESOLVED → CLOSED
 *   (transitions are relaxed; any staff status change is allowed, we only
 *    stamp firstRespondedAt / resolvedAt / closedAt as milestones)
 *
 * Sources:
 *   WEB  — created from the ERP/client UI
 *   API  — created via a per-client API key (external platform integration)
 *   EMAIL — reserved for future inbound-email ingestion
 *
 * SLA (kept simple): on creation we compute firstResponseDueAt and
 * resolveDueAt from the priority. `isSlaBreached` is derived at read time.
 *
 * Number format: TKT-YYYY-NNNN
 */
@Entity('tickets')
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'ticket_number', type: 'varchar', length: 50, unique: true })
  ticketNumber: string;

  @Column({ type: 'varchar', length: 255 })
  subject: string;

  @Column({ type: 'text' })
  description: string;

  // ─── FK: Client (CASCADE) ──────────────────────────────────────────────────
  @Column({ name: 'client_id', type: 'varchar', length: 36 })
  @Index('idx_tickets_client_id')
  clientId: string;

  @ManyToOne(() => Client, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'client_id' })
  client: Client;

  // ─── FK: Project (SET NULL, optional) ──────────────────────────────────────
  @Column({ name: 'project_id', type: 'varchar', length: 36, nullable: true })
  @Index('idx_tickets_project_id')
  projectId: string | null;

  @ManyToOne(() => Project, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'project_id' })
  project: Project | null;

  // ─── FK: Assignee (staff, SET NULL, optional) ──────────────────────────────
  @Column({ name: 'assignee_id', type: 'varchar', length: 36, nullable: true })
  @Index('idx_tickets_assignee_id')
  assigneeId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'assignee_id' })
  assignee: User | null;

  // ─── FK: Reporter (the user who opened it; null for pure-API tickets) ───────
  @Column({ name: 'reporter_id', type: 'varchar', length: 36, nullable: true })
  reporterId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'reporter_id' })
  reporter: User | null;

  // ─── Classification ────────────────────────────────────────────────────────
  @Column({ type: 'enum', enum: TicketStatus, default: TicketStatus.OPEN })
  @Index('idx_tickets_status')
  status: TicketStatus;

  @Column({ type: 'enum', enum: TicketPriority, default: TicketPriority.MEDIUM })
  @Index('idx_tickets_priority')
  priority: TicketPriority;

  @Column({ type: 'enum', enum: TicketCategory, default: TicketCategory.QUESTION })
  category: TicketCategory;

  @Column({ type: 'enum', enum: TicketSource, default: TicketSource.WEB })
  source: TicketSource;

  // ─── Attachments (array of { url, name? }) ─────────────────────────────────
  @Column({ type: 'json', nullable: true })
  attachments: Array<{ url: string; name?: string }> | null;

  // ─── SLA / milestone timestamps ────────────────────────────────────────────
  @Column({ name: 'first_response_due_at', type: 'datetime', nullable: true })
  firstResponseDueAt: Date | null;

  @Column({ name: 'resolve_due_at', type: 'datetime', nullable: true })
  resolveDueAt: Date | null;

  @Column({ name: 'first_responded_at', type: 'datetime', nullable: true })
  firstRespondedAt: Date | null;

  @Column({ name: 'resolved_at', type: 'datetime', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'closed_at', type: 'datetime', nullable: true })
  closedAt: Date | null;

  // ─── Relations ─────────────────────────────────────────────────────────────
  @OneToMany(() => TicketReply, (reply) => reply.ticket, { cascade: false })
  replies: TicketReply[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
