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
import { SubscriptionStatus, BillingInterval } from '../../../common/enums';
import { SaasTenant } from './saas-tenant.entity';
import { SaasPlan } from './saas-plan.entity';

/**
 * SAAS-1 — A tenant's subscription. State is tracked SEPARATELY from the tenant
 * lifecycle: a tenant can be ACTIVE while its subscription is PAST_DUE, etc.
 */
@Index('idx_saas_subscriptions_tenant', ['tenantId'])
@Index('idx_saas_subscriptions_status', ['status'])
@Entity('saas_subscriptions')
export class SaasSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'varchar', length: 36 })
  tenantId: string;

  @ManyToOne(() => SaasTenant, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: SaasTenant;

  @Column({ name: 'plan_id', type: 'varchar', length: 36 })
  planId: string;

  @ManyToOne(() => SaasPlan, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'plan_id' })
  plan: SaasPlan;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.TRIAL,
  })
  status: SubscriptionStatus;

  @Column({
    name: 'billing_interval',
    type: 'enum',
    enum: BillingInterval,
    default: BillingInterval.MONTHLY,
  })
  billingInterval: BillingInterval;

  @Column({ name: 'trial_ends_at', type: 'datetime', nullable: true })
  trialEndsAt: Date | null;

  @Column({ name: 'current_period_start', type: 'datetime', nullable: true })
  currentPeriodStart: Date | null;

  @Column({ name: 'current_period_end', type: 'datetime', nullable: true })
  currentPeriodEnd: Date | null;

  @Column({ name: 'cancelled_at', type: 'datetime', nullable: true })
  cancelledAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;
}
