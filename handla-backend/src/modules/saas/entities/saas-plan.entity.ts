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
import { SaasProduct } from './saas-product.entity';

/**
 * SAAS-1 — A pricing/entitlement plan offered for a product.
 *
 * `limits` and `entitlements` are JSON so plans can evolve per product without
 * schema churn. These are forwarded to the product at provision/update time;
 * Handla does not interpret their meaning (product-owned semantics).
 */
@Index('idx_saas_plans_product', ['productId'])
@Index('uq_saas_plans_product_code', ['productId', 'code'], { unique: true })
@Entity('saas_plans')
export class SaasPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'product_id', type: 'varchar', length: 36 })
  productId: string;

  @ManyToOne(() => SaasProduct, (p) => p.plans, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'product_id' })
  product: SaasProduct;

  /** Machine code unique within the product, e.g. "starter", "pro". */
  @Column({ type: 'varchar', length: 64 })
  code: string;

  @Column({ type: 'varchar', length: 128 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** Monthly price (optional; currency is per-record, may be null). */
  @Column({ name: 'price_monthly', type: 'decimal', precision: 12, scale: 2, nullable: true })
  priceMonthly: string | null;

  @Column({ name: 'price_yearly', type: 'decimal', precision: 12, scale: 2, nullable: true })
  priceYearly: string | null;

  @Column({ type: 'varchar', length: 8, nullable: true })
  currency: string | null;

  /**
   * Hard limits (e.g. { seats: 10, storage_gb: 50 }). Product-defined shape.
   */
  @Column({ type: 'json', nullable: true })
  limits: Record<string, unknown> | null;

  /**
   * Feature flags/entitlements (e.g. { api_access: true, sso: false }).
   */
  @Column({ type: 'json', nullable: true })
  entitlements: Record<string, unknown> | null;

  /** Trial length in days for tenants created on this plan (0 = none). */
  @Column({ name: 'trial_days', type: 'int', default: 0 })
  trialDays: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;
}
