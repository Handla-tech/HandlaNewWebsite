import { SaasProduct } from '../entities/saas-product.entity';
import { SaasTenant } from '../entities/saas-tenant.entity';
import { SaasPlan } from '../entities/saas-plan.entity';

/**
 * SAAS-1 — Context passed to a provisioner for every operation. Carries the
 * idempotency key so adapters (and the products they call) can dedupe.
 */
export interface ProvisionContext {
  product: SaasProduct;
  tenant: SaasTenant;
  plan?: SaasPlan | null;
  /** Idempotency key — the SAME value is reused across retries of one job. */
  requestId: string;
}

/**
 * Normalised result every provisioner returns. `externalTenantId` and
 * `metadata` are only meaningful for PROVISION. Adapters must NEVER return raw
 * DB credentials — Handla stores none.
 */
export interface ProvisionResult {
  ok: boolean;
  externalTenantId?: string | null;
  metadata?: Record<string, unknown> | null;
  /** Human-readable error when ok=false. */
  error?: string;
  /** Raw-ish response echoed into the provisioning log for debugging. */
  raw?: Record<string, unknown> | null;
}

/**
 * The adapter/strategy interface each product's provisioning is expressed
 * through. Implementations are keyed in the ProvisionerRegistry by
 * SaasProduct.provisioner so there is NO product-specific branching anywhere
 * in the services.
 *
 * All operations MUST be idempotent and retry-safe.
 */
export interface ProductProvisioner {
  /** The registry key this provisioner is registered under (e.g. "http"). */
  readonly key: string;

  /** Create the tenant on the product; returns the product's external id. */
  provision(ctx: ProvisionContext): Promise<ProvisionResult>;

  /** Non-destructively disable the tenant (reactivatable). */
  suspend(ctx: ProvisionContext): Promise<ProvisionResult>;

  /** Re-enable a previously suspended tenant. */
  reactivate(ctx: ProvisionContext): Promise<ProvisionResult>;

  /** Switch the tenant to a different plan. */
  updatePlan(ctx: ProvisionContext): Promise<ProvisionResult>;

  /** Push new limits/entitlements to the product for the tenant. */
  updateLimits(ctx: ProvisionContext): Promise<ProvisionResult>;

  /** Archive/retire the tenant (retention handled product-side). */
  archive(ctx: ProvisionContext): Promise<ProvisionResult>;
}
