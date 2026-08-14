import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  ProductProvisioner,
  ProvisionContext,
  ProvisionResult,
} from './product-provisioner.interface';
import { ProvisioningAction } from '../../../common/enums';
import type { SaasConfig } from '../../../config/saas.config';

/**
 * SAAS-1 — Default provisioner that talks to a product's service-to-service
 * provisioning API over HTTP (native fetch — no SDK/native dep).
 *
 * Contract with products:
 *   POST   {baseUrl}/internal/tenants                      (PROVISION)
 *   POST   {baseUrl}/internal/tenants/{ext}/suspend        (SUSPEND)
 *   POST   {baseUrl}/internal/tenants/{ext}/reactivate     (REACTIVATE)
 *   PATCH  {baseUrl}/internal/tenants/{ext}/plan           (UPDATE_PLAN)
 *   PATCH  {baseUrl}/internal/tenants/{ext}/limits         (UPDATE_LIMITS)
 *   DELETE {baseUrl}/internal/tenants/{ext}                (ARCHIVE)
 *
 * Every request carries:
 *   Authorization: Bearer <outbound product key>   (from env; never persisted raw)
 *   Idempotency-Key: <requestId>                    (retry-safe on both sides)
 *
 * Handla stores ONLY the returned external_tenant_id + opaque metadata.
 */
@Injectable()
export class HttpProductProvisioner implements ProductProvisioner {
  readonly key = 'http';
  private readonly logger = new Logger(HttpProductProvisioner.name);
  private readonly cfg: SaasConfig;

  constructor(private readonly configService: ConfigService) {
    this.cfg = this.configService.get<SaasConfig>('saas')!;
  }

  provision(ctx: ProvisionContext): Promise<ProvisionResult> {
    return this.call(ctx, ProvisioningAction.PROVISION, 'POST', '/internal/tenants', {
      request_id: ctx.requestId,
      slug: ctx.tenant.slug,
      name: ctx.tenant.name,
      plan: ctx.plan
        ? { code: ctx.plan.code, limits: ctx.plan.limits, entitlements: ctx.plan.entitlements }
        : null,
    });
  }

  suspend(ctx: ProvisionContext): Promise<ProvisionResult> {
    return this.call(
      ctx,
      ProvisioningAction.SUSPEND,
      'POST',
      `/internal/tenants/${this.ext(ctx)}/suspend`,
      { request_id: ctx.requestId },
    );
  }

  reactivate(ctx: ProvisionContext): Promise<ProvisionResult> {
    return this.call(
      ctx,
      ProvisioningAction.REACTIVATE,
      'POST',
      `/internal/tenants/${this.ext(ctx)}/reactivate`,
      { request_id: ctx.requestId },
    );
  }

  updatePlan(ctx: ProvisionContext): Promise<ProvisionResult> {
    return this.call(
      ctx,
      ProvisioningAction.UPDATE_PLAN,
      'PATCH',
      `/internal/tenants/${this.ext(ctx)}/plan`,
      { request_id: ctx.requestId, plan: ctx.plan ? { code: ctx.plan.code } : null },
    );
  }

  updateLimits(ctx: ProvisionContext): Promise<ProvisionResult> {
    return this.call(
      ctx,
      ProvisioningAction.UPDATE_LIMITS,
      'PATCH',
      `/internal/tenants/${this.ext(ctx)}/limits`,
      {
        request_id: ctx.requestId,
        limits: ctx.plan?.limits ?? null,
        entitlements: ctx.plan?.entitlements ?? null,
      },
    );
  }

  archive(ctx: ProvisionContext): Promise<ProvisionResult> {
    return this.call(
      ctx,
      ProvisioningAction.ARCHIVE,
      'DELETE',
      `/internal/tenants/${this.ext(ctx)}`,
      { request_id: ctx.requestId },
    );
  }

  // ─── internals ──────────────────────────────────────────────────────────────

  private ext(ctx: ProvisionContext): string {
    return encodeURIComponent(ctx.tenant.externalTenantId ?? ctx.tenant.id);
  }

  private async call(
    ctx: ProvisionContext,
    action: ProvisioningAction,
    method: 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body: Record<string, unknown>,
  ): Promise<ProvisionResult> {
    const base = ctx.product.provisioningBaseUrl?.replace(/\/+$/, '');
    if (!base) {
      return { ok: false, error: `Product ${ctx.product.code} has no provisioningBaseUrl` };
    }

    // Outbound key resolved from env by product code (never stored in DB raw).
    const outboundKey = this.cfg.outboundKeys[ctx.product.code] || this.cfg.defaultOutboundKey;
    if (!outboundKey) {
      return {
        ok: false,
        error: `No outbound provisioning key configured for product ${ctx.product.code}`,
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs);
    const url = `${base}${path}`;

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${outboundKey}`,
          'Idempotency-Key': ctx.requestId,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        const err = (raw?.error as string) || `HTTP ${res.status}`;
        this.logger.warn(`${action} ${url} failed: ${err}`);
        return { ok: false, error: err, raw };
      }

      return {
        ok: true,
        externalTenantId:
          (raw?.external_tenant_id as string) ?? (raw?.tenant_id as string) ?? null,
        metadata: (raw?.metadata as Record<string, unknown>) ?? null,
        raw,
      };
    } catch (e) {
      const msg = (e as Error)?.name === 'AbortError' ? 'timeout' : (e as Error)?.message;
      this.logger.warn(`${action} ${url} threw: ${msg}`);
      return { ok: false, error: msg };
    } finally {
      clearTimeout(timer);
    }
  }
}
