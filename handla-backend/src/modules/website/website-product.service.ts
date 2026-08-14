import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { WebsiteProduct } from './entities/website-product.entity';
import { CreateWebsiteProductDto } from './dto/create-website-product.dto';
import { UpdateWebsiteProductDto } from './dto/update-website-product.dto';
import { WebsiteProductQueryDto } from './dto/website-product-query.dto';
import { ResourceNotFoundException } from '../../utils/exceptions';

export interface PaginatedWebsiteProducts {
  products: WebsiteProduct[];
  total: number;
  page: number;
  pages: number;
}

@Injectable()
export class WebsiteProductService {
  private readonly logger = new Logger(WebsiteProductService.name);

  constructor(
    @InjectRepository(WebsiteProduct)
    private readonly repo: Repository<WebsiteProduct>,
  ) {}

  // ─── Create ───────────────────────────────────────────────────────────────────
  async create(dto: CreateWebsiteProductDto, adminId: string): Promise<WebsiteProduct> {
    const product = this.repo.create({
      name: dto.name,
      tagline: dto.tagline ?? null,
      description: dto.description,
      category: dto.category ?? null,
      imageUrl: dto.imageUrl ?? null,
      productUrl: dto.productUrl ?? null,
      price: dto.price ?? null,
      features: dto.features ?? null,
      featured: dto.featured ?? false,
      sortOrder: dto.sortOrder ?? 0,
      createdByAdminId: adminId,
    });

    const saved = await this.repo.save(product);
    this.logger.log(`Website product created by admin=${adminId}: "${dto.name}"`);
    return saved;
  }

  // ─── Find All (public, paginated) ─────────────────────────────────────────────
  async findAll(query: WebsiteProductQueryDto): Promise<PaginatedWebsiteProducts> {
    const { page = 1, limit = 12, featured, category } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (featured !== undefined) where.featured = featured;
    if (category) where.category = category;

    const [products, total] = await this.repo.findAndCount({
      where,
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      products,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  // ─── Find One (public) ────────────────────────────────────────────────────────
  async findOne(id: string): Promise<WebsiteProduct> {
    const product = await this.repo.findOne({ where: { id } });
    if (!product) {
      throw new ResourceNotFoundException('WebsiteProduct', id);
    }
    return product;
  }

  // ─── Update (admin only) ──────────────────────────────────────────────────────
  async update(id: string, dto: UpdateWebsiteProductDto): Promise<WebsiteProduct> {
    const product = await this.findOne(id); // throws if not found

    if (dto.name !== undefined) product.name = dto.name;
    if (dto.tagline !== undefined) product.tagline = dto.tagline ?? null;
    if (dto.description !== undefined) product.description = dto.description;
    if (dto.category !== undefined) product.category = dto.category ?? null;
    if (dto.imageUrl !== undefined) product.imageUrl = dto.imageUrl ?? null;
    if (dto.productUrl !== undefined) product.productUrl = dto.productUrl ?? null;
    if (dto.price !== undefined) product.price = dto.price ?? null;
    if (dto.features !== undefined) product.features = dto.features ?? null;
    if (dto.featured !== undefined) product.featured = dto.featured;
    if (dto.sortOrder !== undefined) product.sortOrder = dto.sortOrder;

    const updated = await this.repo.save(product);
    this.logger.log(`Website product ${id} updated`);
    return updated;
  }

  // ─── Delete (admin only) ──────────────────────────────────────────────────────
  async remove(id: string): Promise<void> {
    const product = await this.findOne(id); // throws if not found
    await this.repo.remove(product);
    this.logger.log(`Website product ${id} deleted`);
  }
}
