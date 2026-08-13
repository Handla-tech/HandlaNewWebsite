import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Quotation } from './quotation.entity';

@Entity('quotation_line_items')
export class QuotationLineItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'quotation_id', type: 'varchar', length: 36 })
  @Index('idx_quotation_line_items_quotation_id')
  quotationId: string;

  @ManyToOne(() => Quotation, (q) => q.lineItems, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'quotation_id' })
  quotation: Quotation;

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
