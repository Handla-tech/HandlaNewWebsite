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
import { SaasTenant } from './saas-tenant.entity';

/**
 * SAAS-1 — A domain routed to a tenant.
 *
 * The primary/system domain is the product subdomain
 * (<slug>.<product>.handla.tech). Custom domains can be added later and
 * verified out-of-band (isVerified flag).
 */
@Index('idx_saas_tenant_domains_tenant', ['tenantId'])
@Entity('saas_tenant_domains')
export class SaasTenantDomain {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'varchar', length: 36 })
  tenantId: string;

  @ManyToOne(() => SaasTenant, (t) => t.domains, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: SaasTenant;

  /** Full hostname, e.g. "acme.mudar.handla.tech" or "app.acme.com". */
  @Column({ type: 'varchar', length: 255, unique: true })
  @Index('idx_saas_tenant_domains_domain', { unique: true })
  domain: string;

  /** true = Handla-managed product subdomain; false = customer custom domain. */
  @Column({ name: 'is_primary', type: 'boolean', default: false })
  isPrimary: boolean;

  @Column({ name: 'is_verified', type: 'boolean', default: false })
  isVerified: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;
}
