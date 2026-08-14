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
import { TenantStatus } from '../../../common/enums';
import { SaasProduct } from './saas-product.entity';
import { Client } from '../../clients/entities/client.entity';

/**
 * SAAS-1 — A tenant: one instance of a product provisioned for a client.
 *
 * Handla is the Control Plane record. The product owns the actual tenant
 * database; Handla stores ONLY the product-returned `externalTenantId` and
 * opaque `metadata` (connection info is NEVER stored here — no raw DB creds).
 */
@Index('idx_saas_tenants_status', ['status'])
@Index('idx_saas_tenants_client', ['clientId'])
@Index('idx_saas_tenants_product', ['productId'])
// A client gets at most one tenant per (product, slug).
@Index('uq_saas_tenants_product_slug', ['productId', 'slug'], { unique: true })
@Entity('saas_tenants')
export class SaasTenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'client_id', type: 'varchar', length: 36 })
  clientId: string;

  @ManyToOne(() => Client, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column({ name: 'product_id', type: 'varchar', length: 36 })
  productId: string;

  @ManyToOne(() => SaasProduct, (p) => p.tenants, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'product_id' })
  product: SaasProduct;

  /** URL-safe subdomain label, e.g. "acme" → acme.mudar.handla.tech. */
  @Column({ type: 'varchar', length: 100 })
  slug: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({
    type: 'enum',
    enum: TenantStatus,
    default: TenantStatus.PENDING,
  })
  status: TenantStatus;

  /**
   * The product's own identifier for this tenant, returned by provisioning.
   * Null until the product confirms. This is the ONLY cross-system handle.
   */
  @Column({ name: 'external_tenant_id', type: 'varchar', length: 255, nullable: true })
  externalTenantId: string | null;

  /**
   * Opaque product-returned metadata (e.g. region, dashboard URL). Never DB creds.
   */
  @Column({ type: 'json', nullable: true })
  metadata: Record<string, unknown> | null;

  /** Last provisioning failure reason (surfaced in the admin UI). */
  @Column({ name: 'last_error', type: 'varchar', length: 1024, nullable: true })
  lastError: string | null;

  /** When the tenant was archived (retention clock start). */
  @Column({ name: 'archived_at', type: 'datetime', nullable: true })
  archivedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;

  @OneToMany('SaasTenantDomain', 'tenant')
  domains: any[];

  @OneToMany('SaasProvisioningLog', 'tenant')
  provisioningLogs: any[];
}
