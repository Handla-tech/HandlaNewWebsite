import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SaasPlan } from '../entities/saas-plan.entity';
import { SaasProduct } from '../entities/saas-product.entity';
import { CreatePlanDto, UpdatePlanDto } from '../dto/plan.dto';

/**
 * SAAS-1 — CRUD for product plans (limits/entitlements). ADMIN-only.
 * `limits`/`entitlements` are opaque JSON forwarded to the product; Handla does
 * not interpret them.
 */
@Injectable()
export class PlansService {
  constructor(
    @InjectRepository(SaasPlan)
    private readonly repo: Repository<SaasPlan>,
    @InjectRepository(SaasProduct)
    private readonly productRepo: Repository<SaasProduct>,
  ) {}

  async create(productId: string, dto: CreatePlanDto): Promise<SaasPlan> {
    const product = await this.productRepo.findOne({ where: { id: productId } });
    if (!product) throw new NotFoundException(`Product ${productId} not found`);

    const dup = await this.repo.findOne({ where: { productId, code: dto.code } });
    if (dup) throw new ConflictException(`Plan code "${dto.code}" already exists for this product`);

    const plan = this.repo.create({
      productId,
      code: dto.code,
      name: dto.name,
      description: dto.description ?? null,
      priceMonthly: dto.priceMonthly ?? null,
      priceYearly: dto.priceYearly ?? null,
      currency: dto.currency ?? null,
      limits: dto.limits ?? null,
      entitlements: dto.entitlements ?? null,
      trialDays: dto.trialDays ?? 0,
      isActive: dto.isActive ?? true,
    });
    return this.repo.save(plan);
  }

  async findAllForProduct(productId: string): Promise<SaasPlan[]> {
    return this.repo.find({ where: { productId }, order: { createdAt: 'ASC' } });
  }

  async findOne(id: string): Promise<SaasPlan> {
    const plan = await this.repo.findOne({ where: { id } });
    if (!plan) throw new NotFoundException(`Plan ${id} not found`);
    return plan;
  }

  async update(id: string, dto: UpdatePlanDto): Promise<SaasPlan> {
    const plan = await this.findOne(id);
    Object.assign(plan, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.priceMonthly !== undefined && { priceMonthly: dto.priceMonthly }),
      ...(dto.priceYearly !== undefined && { priceYearly: dto.priceYearly }),
      ...(dto.currency !== undefined && { currency: dto.currency }),
      ...(dto.limits !== undefined && { limits: dto.limits }),
      ...(dto.entitlements !== undefined && { entitlements: dto.entitlements }),
      ...(dto.trialDays !== undefined && { trialDays: dto.trialDays }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    });
    return this.repo.save(plan);
  }

  async remove(id: string): Promise<void> {
    const plan = await this.findOne(id);
    await this.repo.remove(plan);
  }
}
