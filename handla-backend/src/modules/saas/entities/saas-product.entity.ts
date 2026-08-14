import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';

/**
 * SAAS-1 — A product Handla manages (Mudar / Matjari / Manara).
 *
 * Handla is the Control Plane: it stores how to REACH each product's
 * provisioning API but NEVER stores product database credentials. Each product
 * owns its own databases, migrations, seeders and initial-admin bootstrapping.
 */
@Entity('saas_products')
export class SaasProduct {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Stable machine code, e.g. "mudar". Drives the subdomain + provisioner registry. */
  @Column({ type: 'varchar', length: 64, unique: true })
  @Index('idx_saas_products_code', { unique: true })
  code: string;

  @Column({ type: 'varchar', length: 128 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /**
   * Base subdomain zone for tenants of this product, e.g. "mudar.handla.tech".
   * Tenant subdomains are formed as "<slug>.<subdomainZone>".
   */
  @Column({ name: 'subdomain_zone', type: 'varchar', length: 255, nullable: true })
  subdomainZone: string | null;

  /**
   * Provisioner strategy key. Defaults to the product `code` but can point at a
   * shared adapter (e.g. "http") — resolved by the ProvisionerRegistry.
   */
  @Column({ name: 'provisioner', type: 'varchar', length: 64, default: 'http' })
  provisioner: string;

  /**
   * Base URL of the product's internal provisioning API, e.g.
   * "https://provision.mudar.internal". Handla POSTs /internal/tenants here.
   */
  @Column({ name: 'provisioning_base_url', type: 'varchar', length: 512, nullable: true })
  provisioningBaseUrl: string | null;

  /**
   * SHA-256 hash of the OUTBOUND service-to-service API key Handla presents to
   * the product. The plaintext is set once via env/secret, never persisted raw.
   * (Nullable so a product can be registered before its key is issued.)
   */
  @Column({ name: 'provisioning_key_hash', type: 'varchar', length: 64, nullable: true })
  provisioningKeyHash: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;

  @OneToMany('SaasPlan', 'product')
  plans: any[];

  @OneToMany('SaasTenant', 'product')
  tenants: any[];
}
