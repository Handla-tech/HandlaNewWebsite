import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { LedgerDirection, LedgerSourceType } from '../../../common/enums';
import { Account } from './account.entity';
import { Client } from '../../clients/entities/client.entity';
import { User } from '../../auth/entities/user.entity';

/**
 * ACC-1 — LedgerEntry (unified transaction ledger).
 *
 * A single, append-mostly table where EVERY money movement in the business is
 * recorded, regardless of which module generated it:
 *   - paid Invoice   → IN  entry (INCOME account, linked to client)
 *   - Expense        → OUT entry (EXPENSE account)
 *   - paid Purchase  → OUT entry (EXPENSE / A-P account, linked to supplier)
 *   - manual entry   → IN/OUT (any account)
 *
 * Idempotency: (sourceType, sourceId) is UNIQUE for non-MANUAL entries so a
 * document can only ever post one ledger row. MANUAL entries have sourceId=id.
 *
 * The per-client statement is just: SELECT * WHERE client_id = ? ORDER BY date.
 */
@Entity('ledger_entries')
@Unique('uq_ledger_source', ['sourceType', 'sourceId'])
export class LedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'entry_date', type: 'date' })
  @Index('idx_ledger_entry_date')
  entryDate: string;

  // ─── Account (category) ───────────────────────────────────────────────────
  @Column({ name: 'account_id', type: 'varchar', length: 36 })
  @Index('idx_ledger_account_id')
  accountId: string;

  @ManyToOne(() => Account, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'account_id' })
  account: Account;

  // ─── Optional client association (for per-client ledger) ───────────────────
  @Column({ name: 'client_id', type: 'varchar', length: 36, nullable: true })
  @Index('idx_ledger_client_id')
  clientId: string | null;

  @ManyToOne(() => Client, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'client_id' })
  client: Client | null;

  // ─── Direction & amount ────────────────────────────────────────────────────
  @Column({ type: 'enum', enum: LedgerDirection })
  @Index('idx_ledger_direction')
  direction: LedgerDirection;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 3, nullable: true })
  currency: string | null;

  // ─── Source tracing ────────────────────────────────────────────────────────
  @Column({ name: 'source_type', type: 'enum', enum: LedgerSourceType })
  @Index('idx_ledger_source_type')
  sourceType: LedgerSourceType;

  // For MANUAL entries this equals the entry's own id; otherwise the origin doc id.
  @Column({ name: 'source_id', type: 'varchar', length: 64 })
  sourceId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  // ─── Owner (who created / triggered it) ────────────────────────────────────
  @Column({ name: 'owner_id', type: 'varchar', length: 36, nullable: true })
  ownerId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'owner_id' })
  owner: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
