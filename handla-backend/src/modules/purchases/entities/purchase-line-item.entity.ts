import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Purchase } from './purchase.entity';

/**
 * PUR-1 — PurchaseLineItem. line_total stored as immutable snapshot.
 */
@Entity('purchase_line_items')
export class PurchaseLineItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'purchase_id', type: 'varchar', length: 36 })
  @Index('idx_purchase_line_items_purchase_id')
  purchaseId: string;

  @ManyToOne(() => Purchase, (purchase) => purchase.lineItems, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'purchase_id' })
  purchase: Purchase;

  @Column({ type: 'varchar', length: 500 })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 1 })
  quantity: number;

  @Column({ name: 'unit_price', type: 'decimal', precision: 12, scale: 2, default: 0 })
  unitPrice: number;

  @Column({ name: 'line_total', type: 'decimal', precision: 12, scale: 2 })
  lineTotal: number;

  @Column({ name: 'sort_order', type: 'smallint', default: 0 })
  sortOrder: number;
}
