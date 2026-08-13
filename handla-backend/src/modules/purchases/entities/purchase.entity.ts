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
import { PurchaseStatus, PurchasePaymentStatus } from '../../../common/enums';
import { Supplier } from '../../suppliers/entities/supplier.entity';
import { User } from '../../auth/entities/user.entity';
import { PurchaseLineItem } from './purchase-line-item.entity';

/**
 * PUR-1 — Purchase (Purchase Order / Bill) entity — the A-P mirror of Invoice.
 *
 * Lifecycle:
 *   status:        DRAFT → ORDERED → RECEIVED (or CANCELLED)
 *   paymentStatus: UNPAID → PAID (markAsPaid) ; UNPAID → OVERDUE (scheduler)
 *
 * When marked PAID, PurchasesService auto-creates an EXPENSE entry which in
 * turn posts an OUT row to the accounting ledger.
 *
 * Number format: PO-YYYY-NNNN
 */
@Entity('purchases')
export class Purchase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'purchase_number', type: 'varchar', length: 50, unique: true })
  purchaseNumber: string;

  // ─── FK: Supplier (CASCADE) ───────────────────────────────────────────────
  @Column({ name: 'supplier_id', type: 'varchar', length: 36 })
  @Index('idx_purchases_supplier_id')
  supplierId: string;

  @ManyToOne(() => Supplier, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  // ─── FK: Owner (SET NULL) ─────────────────────────────────────────────────
  @Column({ name: 'owner_id', type: 'varchar', length: 36, nullable: true })
  @Index('idx_purchases_owner_id')
  ownerId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'owner_id' })
  owner: User | null;

  // ─── Status ───────────────────────────────────────────────────────────────
  @Column({ type: 'enum', enum: PurchaseStatus, default: PurchaseStatus.DRAFT })
  @Index('idx_purchases_status')
  status: PurchaseStatus;

  @Column({
    name: 'payment_status',
    type: 'enum',
    enum: PurchasePaymentStatus,
    default: PurchasePaymentStatus.UNPAID,
  })
  @Index('idx_purchases_payment_status')
  paymentStatus: PurchasePaymentStatus;

  // ─── Financial ────────────────────────────────────────────────────────────
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  subtotal: number;

  @Column({ name: 'tax_rate', type: 'decimal', precision: 5, scale: 2, default: 0 })
  taxRate: number;

  @Column({ name: 'tax_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  taxAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  total: number;

  // Currency is optional (multi-country vendors)
  @Column({ type: 'varchar', length: 3, nullable: true })
  currency: string | null;

  // ─── Which expense account this purchase books to (Chart of Accounts code) ─
  @Column({ name: 'account_code', type: 'varchar', length: 20, nullable: true })
  accountCode: string | null;

  // ─── Dates ────────────────────────────────────────────────────────────────
  @Column({ name: 'order_date', type: 'date', nullable: true })
  orderDate: string | null;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  @Index('idx_purchases_due_date')
  dueDate: string | null;

  @Column({ name: 'paid_at', type: 'datetime', nullable: true })
  paidAt: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  // ─── Relations ────────────────────────────────────────────────────────────
  @OneToMany(() => PurchaseLineItem, (item) => item.purchase, {
    cascade: true,
    eager: false,
  })
  lineItems: PurchaseLineItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
