import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Invoice } from './invoice.entity';

/**
 * ERP-7 — InvoiceLineItem entity.
 *
 * Each invoice has 1..N line items (CASCADE delete from invoice).
 * line_total is stored (not computed at query time) for immutability:
 * if unit_price changes on the product later, the invoice total
 * must reflect the price at time of invoicing.
 */
@Entity('invoice_line_items')
export class InvoiceLineItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ─── FK: Invoice (CASCADE) ─────────────────────────────────────────────────
  @Column({ name: 'invoice_id', type: 'varchar', length: 36 })
  @Index('idx_invoice_line_items_invoice_id')
  invoiceId: string;

  @ManyToOne(() => Invoice, (invoice) => invoice.lineItems, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  // ─── Line item fields ──────────────────────────────────────────────────────
  @Column({ type: 'varchar', length: 500 })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 1 })
  quantity: number;

  @Column({ name: 'unit_price', type: 'decimal', precision: 12, scale: 2, default: 0 })
  unitPrice: number;

  /** Stored computed value: quantity × unitPrice (immutable snapshot) */
  @Column({ name: 'line_total', type: 'decimal', precision: 12, scale: 2 })
  lineTotal: number;

  @Column({ name: 'sort_order', type: 'smallint', default: 0 })
  sortOrder: number;
}
