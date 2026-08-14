import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';

import { SaasProduct } from '../entities/saas-product.entity';
import { CreateProductDto, UpdateProductDto } from '../dto/product.dto';

/**
 * SAAS-1 — CRUD for the products Handla manages. ADMIN-only (enforced at the
 * controller). The outbound provisioning key is accepted in plaintext but only
 * a SHA-256 hash is persisted (for display/verification); the live key used at
 * call time comes from env (see SaasConfig.outboundKeys).
 */
@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(SaasProduct)
    private readonly repo: Repository<SaasProduct>,
  ) {}

  async create(dto: CreateProductDto): Promise<SaasProduct> {
    const existing = await this.repo.findOne({ where: { code: dto.code } });
    if (existing) throw new ConflictException(`Product code "${dto.code}" already exists`);

    const product = this.repo.create({
      code: dto.code,
      name: dto.name,
      description: dto.description ?? null,
      subdomainZone: dto.subdomainZone ?? null,
      provisioner: dto.provisioner ?? 'http',
      provisioningBaseUrl: dto.provisioningBaseUrl ?? null,
      provisioningKeyHash: dto.provisioningKey ? this.hash(dto.provisioningKey) : null,
      isActive: dto.isActive ?? true,
    });
    return this.repo.save(product);
  }

  async findAll(): Promise<SaasProduct[]> {
    return this.repo.find({ order: { createdAt: 'ASC' } });
  }

  async findOne(id: string): Promise<SaasProduct> {
    const product = await this.repo.findOne({ where: { id } });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product;
  }

  async findByCode(code: string): Promise<SaasProduct | null> {
    return this.repo.findOne({ where: { code } });
  }

  async update(id: string, dto: UpdateProductDto): Promise<SaasProduct> {
    const product = await this.findOne(id);
    Object.assign(product, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.subdomainZone !== undefined && { subdomainZone: dto.subdomainZone }),
      ...(dto.provisioner !== undefined && { provisioner: dto.provisioner }),
      ...(dto.provisioningBaseUrl !== undefined && { provisioningBaseUrl: dto.provisioningBaseUrl }),
      ...(dto.provisioningKey !== undefined && {
        provisioningKeyHash: dto.provisioningKey ? this.hash(dto.provisioningKey) : null,
      }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    });
    return this.repo.save(product);
  }

  async remove(id: string): Promise<void> {
    const product = await this.findOne(id);
    await this.repo.remove(product);
  }

  private hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }
}
