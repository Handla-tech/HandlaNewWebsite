import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

import {
  ProductProvisioner,
  ProvisionContext,
  ProvisionResult,
} from './product-provisioner.interface';

/**
 * SAAS-1 — In-process provisioner used for local development and tests, and as
 * a safe default for products whose real endpoint is not wired yet. It
 * simulates a successful, idempotent product that immediately returns an
 * external tenant id. Registered under the key "mock".
 */
@Injectable()
export class MockProductProvisioner implements ProductProvisioner {
  readonly key = 'mock';

  async provision(ctx: ProvisionContext): Promise<ProvisionResult> {
    // Deterministic-ish external id derived from the tenant so retries are stable.
    const externalTenantId =
      ctx.tenant.externalTenantId || `ext_${ctx.product.code}_${ctx.tenant.slug}_${randomUUID().slice(0, 8)}`;
    return {
      ok: true,
      externalTenantId,
      metadata: {
        provisioner: 'mock',
        dashboardUrl: `https://${ctx.tenant.slug}.${ctx.product.code}.handla.tech`,
      },
    };
  }

  async suspend(): Promise<ProvisionResult> {
    return { ok: true };
  }
  async reactivate(): Promise<ProvisionResult> {
    return { ok: true };
  }
  async updatePlan(): Promise<ProvisionResult> {
    return { ok: true };
  }
  async updateLimits(): Promise<ProvisionResult> {
    return { ok: true };
  }
  async archive(): Promise<ProvisionResult> {
    return { ok: true };
  }
}
