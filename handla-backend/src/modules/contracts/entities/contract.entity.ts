import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ContractStatus } from '../../../common/enums';
import { Client } from '../../clients/entities/client.entity';
import { User } from '../../auth/entities/user.entity';

/**
 * ERP-6 — Contract entity.
 *
 * A Contract is tied to a Client (CASCADE on delete).
 * Owner is the EMPLOYEE who created/manages it (SET NULL on delete).
 *
 * Status flow:
 *   DRAFT → SENT (via sendToClient)
 *   SENT  → SIGNED (via acceptContract — CLIENT action)
 *   SENT  → REJECTED (via rejectContract — CLIENT action)
 *
 * PDF strategy:
 *   On signing, an HTML file is generated from the contract body via Handlebars
 *   (already installed) and uploaded to S3. The s3Key and pdfUrl are stored here.
 *   Using HTML-as-document avoids adding binary PDF libraries — see ERP-6.4.
 */
@Entity('contracts')
export class Contract {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ─── Title & body ──────────────────────────────────────────────────────────
  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  // ─── Structured contract details (added 2026-06) ────────────────────────────
  // Optional JSON blob holding the full structured form: client info, project
  // scope, payment milestones, warranty, IP, NDA, hosting flags, termination
  // terms, signatures, etc. When non-null, `body` is auto-generated from this
  // payload by the service so the HTML template + PDF flow keep working.
  // See ContractDetailsDto in dto/ for the shape.
  @Column({ name: 'details', type: 'json', nullable: true, default: null })
  details: Record<string, any> | null;

  // ─── FK: Client (CASCADE) ──────────────────────────────────────────────────
  @Column({ name: 'client_id', type: 'varchar', length: 36 })
  @Index('idx_contracts_client_id')
  clientId: string;

  @ManyToOne(() => Client, { onDelete: 'CASCADE', nullable: false, eager: false })
  @JoinColumn({ name: 'client_id' })
  client: Client;

  // ─── FK: Owner EMPLOYEE (SET NULL) ────────────────────────────────────────
  @Column({ name: 'owner_id', type: 'varchar', length: 36, nullable: true })
  @Index('idx_contracts_owner_id')
  ownerId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true, eager: false })
  @JoinColumn({ name: 'owner_id' })
  owner: User | null;

  // ─── Status ────────────────────────────────────────────────────────────────
  @Column({ type: 'enum', enum: ContractStatus, default: ContractStatus.DRAFT })
  @Index('idx_contracts_status')
  status: ContractStatus;

  // ─── Lifecycle timestamps ──────────────────────────────────────────────────
  @Column({ name: 'sent_at', type: 'datetime', nullable: true })
  sentAt: Date | null;

  @Column({ name: 'signed_at', type: 'datetime', nullable: true })
  signedAt: Date | null;

  // ─── S3 document ──────────────────────────────────────────────────────────
  @Column({ name: 's3_key', type: 'varchar', length: 2048, nullable: true })
  s3Key: string | null;

  @Column({ name: 'pdf_url', type: 'varchar', length: 2048, nullable: true })
  pdfUrl: string | null;

  // ─── Audit timestamps ─────────────────────────────────────────────────────
  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;
}
