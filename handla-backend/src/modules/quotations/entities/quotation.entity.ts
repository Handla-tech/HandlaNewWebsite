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
import { QuotationStatus } from '../../../common/enums';
import { Client } from '../../clients/entities/client.entity';
import { User } from '../../auth/entities/user.entity';
import { QuotationLineItem } from './quotation-line-item.entity';

/**
 * QUO-1 — Quotation (Estimate) entity.
 *
 * Lifecycle:
 *   DRAFT → SENT (send)
 *   SENT  → ACCEPTED (public accept via token, or staff)
 *   SENT  → REJECTED (public reject via token, or staff)
 *   SENT  → EXPIRED (scheduler, past validUntil)
 *   ACCEPTED → CONVERTED (convert → draft Contract + draft Invoice)
 *
 * Public accept/reject uses a dedicated, non-guessable `publicToken` (separate
 * from the row id), exposed at /api/quotations/public/:token.
 *
 * Number format: QUO-YYYY-NNNN
 */
@Entity('quotations')
export class Quotation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'quote_number', type: 'varchar', length: 50, unique: true })
  quoteNumber: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  // ─── Public token for accept/reject link (INFO-01) ──────────────────────────
  // Opaque, high-entropy capability token — independent of the row id. Used by
  // the public /public/token/:token read + accept/reject routes.
  @Column({ name: 'public_token', type: 'varchar', length: 64, unique: true })
  @Index('idx_quotations_public_token')
  publicToken: string;

  // ─── Public token lifecycle (INFO-01) ───────────────────────────────────────
  /** When the current token expires. NULL = never expires (permanent link). */
  @Column({ name: 'public_token_expires_at', type: 'datetime', nullable: true })
  publicTokenExpiresAt: Date | null;

  /** When the current token was explicitly revoked. NULL = not revoked. */
  @Column({ name: 'public_token_revoked_at', type: 'datetime', nullable: true })
  publicTokenRevokedAt: Date | null;

  /** When the current token was generated / last rotated (audit). */
  @Column({ name: 'public_token_created_at', type: 'datetime', nullable: true })
  publicTokenCreatedAt: Date | null;

  // ─── FK: Client (CASCADE) ──────────────────────────────────────────────────
  @Column({ name: 'client_id', type: 'varchar', length: 36 })
  @Index('idx_quotations_client_id')
  clientId: string;

  @ManyToOne(() => Client, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'client_id' })
  client: Client;

  // ─── FK: Owner (SET NULL) ──────────────────────────────────────────────────
  @Column({ name: 'owner_id', type: 'varchar', length: 36, nullable: true })
  @Index('idx_quotations_owner_id')
  ownerId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'owner_id' })
  owner: User | null;

  // ─── Status ────────────────────────────────────────────────────────────────
  @Column({ type: 'enum', enum: QuotationStatus, default: QuotationStatus.DRAFT })
  @Index('idx_quotations_status')
  status: QuotationStatus;

  // ─── Financial ─────────────────────────────────────────────────────────────
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  subtotal: number;

  @Column({ name: 'tax_rate', type: 'decimal', precision: 5, scale: 2, default: 0 })
  taxRate: number;

  @Column({ name: 'tax_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  taxAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  total: number;

  @Column({ type: 'varchar', length: 3, nullable: true })
  currency: string | null;

  // ─── Dates ─────────────────────────────────────────────────────────────────
  @Column({ name: 'valid_until', type: 'date', nullable: true })
  @Index('idx_quotations_valid_until')
  validUntil: string | null;

  @Column({ name: 'sent_at', type: 'datetime', nullable: true })
  sentAt: Date | null;

  @Column({ name: 'accepted_at', type: 'datetime', nullable: true })
  acceptedAt: Date | null;

  @Column({ name: 'rejected_at', type: 'datetime', nullable: true })
  rejectedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  // ─── Conversion links ──────────────────────────────────────────────────────
  @Column({ name: 'converted_contract_id', type: 'varchar', length: 36, nullable: true })
  convertedContractId: string | null;

  @Column({ name: 'converted_invoice_id', type: 'varchar', length: 36, nullable: true })
  convertedInvoiceId: string | null;

  // ─── Relations ─────────────────────────────────────────────────────────────
  @OneToMany(() => QuotationLineItem, (item) => item.quotation, {
    cascade: true,
    eager: false,
  })
  lineItems: QuotationLineItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
