import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SaasProvisioningLog } from '../entities/saas-provisioning-log.entity';
import { SaasTenant } from '../entities/saas-tenant.entity';
import { SaasProduct } from '../entities/saas-product.entity';
import { SaasSubscription } from '../entities/saas-subscription.entity';
import { SaasPlan } from '../entities/saas-plan.entity';
import { TenantsService } from './tenants.service';
import { ProvisionerRegistry } from '../provisioners/provisioner.registry';
import { ProvisionContext, ProvisionResult } from '../provisioners/product-provisioner.interface';
import { ProvisioningAction, ProvisioningStatus } from '../../../common/enums';
import type { SaasConfig } from '../../../config/saas.config';

/**
 * SAAS-1 — Background provisioning worker.
 *
 * Polls for QUEUED provisioning jobs and runs them against the product's
 * adapter (resolved via the registry). Uses plain setInterval (no new deps,
 * matching the existing scheduler pattern). Each job:
 *   - is claimed by flipping QUEUED → RUNNING (single-worker; maxWorkers=1 safe)
 *   - is retried up to cfg.maxAttempts using the SAME requestId (idempotent)
 *   - on success/failure applies the tenant state via TenantsService
 *
 * The worker is fully non-blocking to the request path — admin actions only
 * enqueue; this worker performs the actual product calls.
 */
@Injectable()
export class ProvisioningWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(ProvisioningWorker.name);
  private readonly cfg: SaasConfig;
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(SaasProvisioningLog) private readonly logRepo: Repository<SaasProvisioningLog>,
    @InjectRepository(SaasTenant) private readonly tenantRepo: Repository<SaasTenant>,
    @InjectRepository(SaasProduct) private readonly productRepo: Repository<SaasProduct>,
    @InjectRepository(SaasSubscription) private readonly subRepo: Repository<SaasSubscription>,
    @InjectRepository(SaasPlan) private readonly planRepo: Repository<SaasPlan>,
    private readonly tenantsService: TenantsService,
    private readonly registry: ProvisionerRegistry,
  ) {
    this.cfg = this.configService.get<SaasConfig>('saas')!;
  }

  onApplicationBootstrap(): void {
    // Skip auto-run under tests (jest sets NODE_ENV=test); can be driven manually.
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.tick(), this.cfg.workerIntervalMs);
    this.logger.log(`ProvisioningWorker started (every ${this.cfg.workerIntervalMs}ms)`);
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** One polling pass. Public so tests can drive it deterministically. */
  async tick(): Promise<void> {
    if (this.running) return; // no overlap
    this.running = true;
    try {
      const jobs = await this.logRepo.find({
        where: { status: ProvisioningStatus.QUEUED },
        order: { createdAt: 'ASC' },
        take: 10,
      });
      for (const job of jobs) {
        await this.runJob(job.id);
      }
    } catch (e) {
      this.logger.error(`worker tick failed: ${(e as Error)?.message}`);
    } finally {
      this.running = false;
    }
  }

  /** Execute a single job by id (retry-safe, idempotent via requestId). */
  async runJob(jobId: string): Promise<void> {
    const job = await this.logRepo.findOne({ where: { id: jobId } });
    if (!job || job.status !== ProvisioningStatus.QUEUED) return;

    // Claim the job.
    job.status = ProvisioningStatus.RUNNING;
    job.attempts += 1;
    job.startedAt = job.startedAt ?? new Date();
    await this.logRepo.save(job);

    const tenant = await this.tenantRepo.findOne({ where: { id: job.tenantId } });
    const product = tenant ? await this.productRepo.findOne({ where: { id: tenant.productId } }) : null;
    if (!tenant || !product) {
      job.status = ProvisioningStatus.FAILED;
      job.errorMessage = 'Tenant or product missing';
      job.finishedAt = new Date();
      await this.logRepo.save(job);
      return;
    }

    if (job.action === ProvisioningAction.PROVISION) {
      await this.tenantsService.markProvisioning(tenant);
    }

    // Resolve plan for context (current subscription plan).
    const sub = await this.subRepo.findOne({
      where: { tenantId: tenant.id },
      order: { createdAt: 'DESC' },
    });
    const plan = sub ? await this.planRepo.findOne({ where: { id: sub.planId } }) : null;

    const provisioner = this.registry.forProduct(product);
    const ctx: ProvisionContext = { product, tenant, plan, requestId: job.requestId };

    let result: ProvisionResult;
    try {
      result = await this.dispatch(provisioner, job.action, ctx);
    } catch (e) {
      result = { ok: false, error: (e as Error)?.message ?? 'unknown error' };
    }

    job.requestPayload = { action: job.action, slug: tenant.slug };
    job.responsePayload = (result.raw as Record<string, unknown>) ?? null;

    if (result.ok) {
      await this.tenantsService.applySuccess(
        tenant,
        job.action,
        result.externalTenantId ?? null,
        result.metadata ?? null,
      );
      job.status = ProvisioningStatus.SUCCEEDED;
      job.errorMessage = null;
      job.finishedAt = new Date();
      await this.logRepo.save(job);
      this.logger.log(`job ${job.action} for tenant ${tenant.slug} succeeded`);
      return;
    }

    // Failure: retry (re-queue with SAME requestId) or give up.
    if (job.attempts < this.cfg.maxAttempts) {
      job.status = ProvisioningStatus.QUEUED; // will be picked up again
      job.errorMessage = (result.error || 'failed').slice(0, 1024);
      await this.logRepo.save(job);
      this.logger.warn(
        `job ${job.action} for tenant ${tenant.slug} failed (attempt ${job.attempts}/${this.cfg.maxAttempts}) — will retry`,
      );
      return;
    }

    job.status = ProvisioningStatus.FAILED;
    job.errorMessage = (result.error || 'failed').slice(0, 1024);
    job.finishedAt = new Date();
    await this.logRepo.save(job);
    await this.tenantsService.applyFailure(tenant, result.error || 'provisioning failed');
    this.logger.error(`job ${job.action} for tenant ${tenant.slug} FAILED permanently`);
  }

  private dispatch(
    p: ReturnType<ProvisionerRegistry['forProduct']>,
    action: ProvisioningAction,
    ctx: ProvisionContext,
  ): Promise<ProvisionResult> {
    switch (action) {
      case ProvisioningAction.PROVISION:
        return p.provision(ctx);
      case ProvisioningAction.SUSPEND:
        return p.suspend(ctx);
      case ProvisioningAction.REACTIVATE:
        return p.reactivate(ctx);
      case ProvisioningAction.UPDATE_PLAN:
        return p.updatePlan(ctx);
      case ProvisioningAction.UPDATE_LIMITS:
        return p.updateLimits(ctx);
      case ProvisioningAction.ARCHIVE:
        return p.archive(ctx);
      default:
        return Promise.resolve({ ok: false, error: `Unknown action ${action}` });
    }
  }
}
