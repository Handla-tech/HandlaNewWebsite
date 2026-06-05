import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

import { ExpenseType } from '../../../common/enums';
import { Invoice } from '../../invoices/entities/invoice.entity';
import { User } from '../../auth/entities/user.entity';

/**
 * ERP-8 — Expense entity
 *
 * Represents a single bookkeeping entry (income or expense).
 *
 * invoice_id is set only for auto-generated income entries created when an
 * invoice is marked as paid (via ExpensesService.createFromPaidInvoice).
 * Manual entries always have invoice_id = null.
 *
 * invoice-linked entries are read-only: they cannot be updated or deleted
 * through the API (enforced in ExpensesService).
 */
// Indexes on type and expense_date — added by migration 1716825600000-InitialSchema.
// Declared as @Index so synchronize:true does NOT try to drop them.
@Index('idx_expenses_type', ['type'])
@Index('idx_expenses_date', ['expenseDate'])
@Entity('expenses')
export class Expense {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: ExpenseType })
  type: ExpenseType;

  @Column({ type: 'varchar', length: 100 })
  category: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'expense_date', type: 'date' })
  expenseDate: string;

  // ─── FK: invoice (nullable — only set for auto-income entries) ──────────────

  @Column({ name: 'invoice_id', type: 'varchar', length: 36, nullable: true })
  @Index('idx_expenses_invoice_id')
  invoiceId: string | null;

  @ManyToOne(() => Invoice, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice | null;

  // ─── FK: owner (employee/admin who created the entry) ──────────────────────

  @Column({ name: 'owner_id', type: 'varchar', length: 36, nullable: true })
  @Index('idx_expenses_owner_id')
  ownerId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'owner_id' })
  owner: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
