import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';
import { randomUUID } from 'crypto';

import { SaasTenant } from '../entities/saas-tenant.entity';
import { SaasSubscription } from '../entities/saas-subscription.entity';
import { SaasTenantDomain } from '../entities/saas-tenant-domain.entity';
import { SaasProvisioningLog } from '../entities/saas-provisioning-log.entity';
import { SaasProduct } from '../entities/saas-product.entity';
import { SaasPlan } from '../entities/saas-plan.entity';
import { Client } from '../../clients/entities/client.entity';

import {
  CreateTenantDto,
  TenantsQueryDto,
  ChangePlanDto,
  ProvisioningCallbackDto,
} from '../dto/tenant.dto';
import {
  TenantStatus,
  SubscriptionStatus,
  BillingInterval,
  ProvisioningAction,
  ProvisioningStatus,
} from '../../../common/enums';
import type { SaasConfig } from '../../../config/saas.config';
import { assertTransition, allowedNext } from './tenant-lifecycle';

/**
 * SAAS-1 — Tenant lifecycle + subscription orchestration.
 *
 * Handla is the workflow controller: it validates transitions, enqueues
 * idempotent provisioning jobs (QUEUED logs) for a background worker to run,
 * and records the product-returned external id. It never stores product DB
 * credentials. All management is ADMIN-only (enforced at the controller).
 */
@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);
  private readonly cfg: SaasConfig;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(SaasTenant) private readonly tenantRepo: Repository<SaasTenant>,
    @InjectRepository(SaasSubscription) private readonly subRepo: Repository<SaasSubscription>,
    @InjectRepository(SaasTenantDomain) private readonly domainRepo: Repository<SaasTenantDomain>,
    @InjectRepository(SaasProvisioningLog) private readonly logRepo: Repository<SaasProvisioningLog>,
    @InjectRepository(SaasProduct) private readonly productRepo: Repository<SaasProduct>,
    @InjectRepository(SaasPlan) private readonly planRepo: Repository<SaasPlan>,
    @InjectRepository(Client) private readonly clientRepo: Repository<Client>,
  ) {
    this.cfg = this.configService.get<SaasConfig>('saas')!;
  }

  // ─── Create (admin-only provisioning; NO public self-service) ────────────────
  async create(dto: CreateTenantDto, triggeredBy?: string): Promise<SaasTenant> {
    const client = await this.clientRepo.findOne({ where: { id: dto.clientId } });
    if (!client) throw new NotFoundException(`Client ${dto.clientId} not found`);

    const product = await this.productRepo.findOne({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException(`Product ${dto.productId} not found`);
    if (!product.isActive) throw new BadRequestException(`Product ${product.code} is not active`);

    const plan = await this.planRepo.findOne({ where: { id: dto.planId } });
    if (!plan) throw new NotFoundException(`Plan ${dto.planId} not found`);
    if (plan.productId !== product.id) {
      throw new BadRequestException('Plan does not belong to the selected product');
    }

    const slug = this.normaliseSlug(dto.slug || dto.name);
    if (!slug) throw new BadRequestException('Could not derive a valid slug');

    // Create the tenant in PENDING.
    let tenant = this.tenantRepo.create({
      clientId: client.id,
      productId: product.id,
      slug,
      name: dto.name,
      status: TenantStatus.PENDING,
    });
    try {
      tenant = await this.tenantRepo.save(tenant);
    } catch (err) {
      if (err instanceof QueryFailedError && this.isDup(err)) {
        throw new ConflictException(
          `A tenant with slug "${slug}" already exists for product ${product.code}`,
        );
      }
      throw err;
    }

    // Seed the primary system subdomain.
    const zone = product.subdomainZone || `${product.code}.${this.cfg.rootZone}`;
    await this.domainRepo.save(
      this.domainRepo.create({
        tenantId: tenant.id,
        domain: `${slug}.${zone}`,
        isPrimary: true,
        isVerified: true,
      }),
    );

    // Seed the subscription (TRIAL if the plan has trial days, else ACTIVE).
    const now = new Date();
    const trialEndsAt =
      plan.trialDays > 0 ? new Date(now.getTime() + plan.trialDays * 86400000) : null;
    await this.subRepo.save(
      this.subRepo.create({
        tenantId: tenant.id,
        planId: plan.id,
        status: trialEndsAt ? SubscriptionStatus.TRIAL : SubscriptionStatus.ACTIVE,
        billingInterval: dto.billingInterval ?? BillingInterval.MONTHLY,
        trialEndsAt,
        currentPeriodStart: now,
      }),
    );

    // Enqueue the provisioning job for the background worker.
    await this.enqueueJob(tenant, ProvisioningAction.PROVISION, triggeredBy);

    return this.findOne(tenant.id);
  }

  // ─── Queries ─────────────────────────────────────────────────────────────────
  async findAll(query: TenantsQueryDto = {}) {
    const { page = 1, limit = 20, status, productId, clientId, search } = query;
    const skip = (page - 1) * limit;

    const qb = this.tenantRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.product', 'product')
      .leftJoinAndSelect('t.client', 'client')
      .orderBy('t.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (status) qb.andWhere('t.status = :status', { status });
    if (productId) qb.andWhere('t.productId = :productId', { productId });
    if (clientId) qb.andWhere('t.clientId = :clientId', { clientId });
    if (search) {
      qb.andWhere('(t.name LIKE :s OR t.slug LIKE :s)', { s: `%${search}%` });
    }

    const [tenants, total] = await qb.getManyAndCount();
    return { tenants, total, page, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string): Promise<SaasTenant> {
    const tenant = await this.tenantRepo.findOne({
      where: { id },
      relations: ['product', 'client', 'domains'],
    });
    if (!tenant) throw new NotFoundException(`Tenant ${id} not found`);
    return tenant;
  }

  async getDetail(id: string) {
    const tenant = await this.findOne(id);
    const subscription = await this.subRepo.findOne({
      where: { tenantId: id },
      relations: ['plan'],
      order: { createdAt: 'DESC' },
    });
    const logs = await this.logRepo.find({
      where: { tenantId: id },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    const nextStates = allowedNext(tenant.status);
    return { tenant, subscription, logs, nextStates };
  }

  // ─── Lifecycle actions (enqueue jobs; worker performs the product call) ──────
  async suspend(id: string, triggeredBy?: string): Promise<SaasTenant> {
    const tenant = await this.findOne(id);
    assertTransition(tenant.status, TenantStatus.SUSPENDED);
    await this.enqueueJob(tenant, ProvisioningAction.SUSPEND, triggeredBy);
    return this.findOne(id);
  }

  async reactivate(id: string, triggeredBy?: string): Promise<SaasTenant> {
    const tenant = await this.findOne(id);
    assertTransition(tenant.status, TenantStatus.ACTIVE);
    await this.enqueueJob(tenant, ProvisioningAction.REACTIVATE, triggeredBy);
    return this.findOne(id);
  }

  async archive(id: string, triggeredBy?: string): Promise<SaasTenant> {
    const tenant = await this.findOne(id);
    assertTransition(tenant.status, TenantStatus.ARCHIVED);
    await this.enqueueJob(tenant, ProvisioningAction.ARCHIVE, triggeredBy);
    return this.findOne(id);
  }

  async retry(id: string, triggeredBy?: string): Promise<SaasTenant> {
    const tenant = await this.findOne(id);
    if (tenant.status !== TenantStatus.FAILED) {
      throw new BadRequestException('Only FAILED tenants can be retried');
    }
    await this.enqueueJob(tenant, ProvisioningAction.PROVISION, triggeredBy);
    return this.findOne(id);
  }

  async changePlan(id: string, dto: ChangePlanDto, triggeredBy?: string): Promise<SaasTenant> {
    const tenant = await this.findOne(id);
    const plan = await this.planRepo.findOne({ where: { id: dto.planId } });
    if (!plan) throw new NotFoundException(`Plan ${dto.planId} not found`);
    if (plan.productId !== tenant.productId) {
      throw new BadRequestException('Plan does not belong to this tenant’s product');
    }

    // Update the subscription's plan immediately; push to the product async.
    const sub = await this.subRepo.findOne({
      where: { tenantId: id },
      order: { createdAt: 'DESC' },
    });
    if (sub) {
      sub.planId = plan.id;
      await this.subRepo.save(sub);
    }
    await this.enqueueJob(tenant, ProvisioningAction.UPDATE_PLAN, triggeredBy);
    return this.findOne(id);
  }

  // ─── Provisioning callback (product → Handla) ────────────────────────────────
  async handleCallback(dto: ProvisioningCallbackDto): Promise<{ ok: true }> {
    const log = await this.logRepo.findOne({ where: { requestId: dto.requestId } });
    if (!log) throw new NotFoundException(`No provisioning job for requestId ${dto.requestId}`);

    const tenant = await this.tenantRepo.findOne({ where: { id: log.tenantId } });
    if (!tenant) throw new NotFoundException(`Tenant ${log.tenantId} not found`);

    const succeeded = dto.status?.toLowerCase() === 'succeeded';
    if (succeeded) {
      await this.applySuccess(tenant, log.action, dto.externalTenantId ?? null, dto.metadata ?? null);
      log.status = ProvisioningStatus.SUCCEEDED;
      log.responsePayload = { via: 'callback', externalTenantId: dto.externalTenantId ?? null };
    } else {
      await this.applyFailure(tenant, dto.error || 'Reported failed via callback');
      log.status = ProvisioningStatus.FAILED;
      log.errorMessage = (dto.error || 'failed').slice(0, 1024);
    }
    log.finishedAt = new Date();
    await this.logRepo.save(log);
    return { ok: true };
  }

  // ─── State application used by BOTH the worker and callbacks ──────────────────
  async applySuccess(
    tenant: SaasTenant,
    action: ProvisioningAction,
    externalTenantId: string | null,
    metadata: Record<string, unknown> | null,
  ): Promise<void> {
    switch (action) {
      case ProvisioningAction.PROVISION:
        tenant.status = TenantStatus.ACTIVE;
        if (externalTenantId) tenant.externalTenantId = externalTenantId;
        if (metadata) tenant.metadata = metadata;
        tenant.lastError = null;
        break;
      case ProvisioningAction.SUSPEND:
        tenant.status = TenantStatus.SUSPENDED;
        break;
      case ProvisioningAction.REACTIVATE:
        tenant.status = TenantStatus.ACTIVE;
        break;
      case ProvisioningAction.ARCHIVE:
        tenant.status = TenantStatus.ARCHIVED;
        tenant.archivedAt = new Date();
        break;
      case ProvisioningAction.UPDATE_PLAN:
      case ProvisioningAction.UPDATE_LIMITS:
        // No lifecycle change; metadata may refresh.
        if (metadata) tenant.metadata = { ...(tenant.metadata ?? {}), ...metadata };
        break;
    }
    await this.tenantRepo.save(tenant);
  }

  async applyFailure(tenant: SaasTenant, error: string): Promise<void> {
    // Only provisioning-type failures flip the tenant to FAILED; suspend/plan
    // failures leave the tenant in its prior state but record the error.
    tenant.lastError = error.slice(0, 1024);
    if (tenant.status === TenantStatus.PENDING || tenant.status === TenantStatus.PROVISIONING) {
      tenant.status = TenantStatus.FAILED;
    }
    await this.tenantRepo.save(tenant);
  }

  async markProvisioning(tenant: SaasTenant): Promise<void> {
    if (tenant.status === TenantStatus.PENDING || tenant.status === TenantStatus.FAILED) {
      tenant.status = TenantStatus.PROVISIONING;
      await this.tenantRepo.save(tenant);
    }
  }

  // ─── Job queue helpers (used by worker) ──────────────────────────────────────
  private async enqueueJob(
    tenant: SaasTenant,
    action: ProvisioningAction,
    triggeredBy?: string,
  ): Promise<SaasProvisioningLog> {
    const log = this.logRepo.create({
      tenantId: tenant.id,
      action,
      status: ProvisioningStatus.QUEUED,
      requestId: randomUUID(),
      attempts: 0,
      triggeredBy: triggeredBy ?? null,
    });
    return this.logRepo.save(log);
  }

  // ─── Utils ────────────────────────────────────────────────────────────────────
  private normaliseSlug(input: string): string {
    return (input || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 63);
  }

  private isDup(err: QueryFailedError): boolean {
    const e = err as any;
    const code = e.code ?? e.driverError?.code;
    const errno = e.errno ?? e.driverError?.errno;
    return code === 'ER_DUP_ENTRY' || errno === 1062;
  }
}
