import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Ticket } from './ticket.entity';
import { User } from '../../auth/entities/user.entity';

/**
 * SUP-1 — TicketReply entity.
 *
 * A threaded message on a ticket. `isInternal` marks staff-only notes that are
 * never surfaced to the CLIENT. `authorId` is null for replies ingested via a
 * client API key (no authenticated user).
 */
@Entity('ticket_replies')
export class TicketReply {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ─── FK: Ticket (CASCADE) ──────────────────────────────────────────────────
  @Column({ name: 'ticket_id', type: 'varchar', length: 36 })
  @Index('idx_ticket_replies_ticket_id')
  ticketId: string;

  @ManyToOne(() => Ticket, (ticket) => ticket.replies, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'ticket_id' })
  ticket: Ticket;

  // ─── FK: Author (staff or client user; null for API replies) ───────────────
  @Column({ name: 'author_id', type: 'varchar', length: 36, nullable: true })
  authorId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'author_id' })
  author: User | null;

  /** Denormalized author display name (survives user deletion / API replies). */
  @Column({ name: 'author_name', type: 'varchar', length: 255, nullable: true })
  authorName: string | null;

  @Column({ type: 'text' })
  body: string;

  /** Staff-only note — hidden from CLIENT-facing views. */
  @Column({ name: 'is_internal', type: 'boolean', default: false })
  isInternal: boolean;

  @Column({ type: 'json', nullable: true })
  attachments: Array<{ url: string; name?: string }> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
