import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Supplier } from './entities/supplier.entity';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SuppliersQueryDto } from './dto/suppliers-query.dto';
import { ResourceNotFoundException } from '../../utils/exceptions';

export interface PaginatedSuppliers {
  suppliers: Supplier[];
  total: number;
  page: number;
  pages: number;
}

/**
 * PUR-1 — SuppliersService (ADMIN/EMPLOYEE managed vendor list).
 */
@Injectable()
export class SuppliersService {
  private readonly logger = new Logger(SuppliersService.name);

  constructor(
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,
  ) {}

  async findAll(query: SuppliersQueryDto): Promise<PaginatedSuppliers> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));

    const qb = this.supplierRepo
      .createQueryBuilder('s')
      .orderBy('s.name', 'ASC');

    if (query.search) {
      qb.andWhere('(s.name LIKE :q OR s.company LIKE :q OR s.email LIKE :q)', {
        q: `%${query.search}%`,
      });
    }
    if (query.isActive === 'true') qb.andWhere('s.is_active = :a', { a: true });
    if (query.isActive === 'false') qb.andWhere('s.is_active = :a', { a: false });

    const [suppliers, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { suppliers, total, page, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string): Promise<Supplier> {
    const supplier = await this.supplierRepo.findOne({ where: { id } });
    if (!supplier) throw new ResourceNotFoundException('Supplier', id);
    return supplier;
  }

  async create(dto: CreateSupplierDto): Promise<Supplier> {
    const supplier = this.supplierRepo.create({
      name: dto.name,
      company: dto.company ?? null,
      email: dto.email ?? null,
      phone: dto.phone ?? null,
      taxId: dto.taxId ?? null,
      address: dto.address ?? null,
      notes: dto.notes ?? null,
      isActive: dto.isActive ?? true,
    });
    const saved = await this.supplierRepo.save(supplier);
    this.logger.log(`Supplier created: ${saved.id} (${saved.name})`);
    return saved;
  }

  async update(id: string, dto: UpdateSupplierDto): Promise<Supplier> {
    const supplier = await this.findOne(id);
    if (dto.name !== undefined) supplier.name = dto.name;
    if (dto.company !== undefined) supplier.company = dto.company ?? null;
    if (dto.email !== undefined) supplier.email = dto.email ?? null;
    if (dto.phone !== undefined) supplier.phone = dto.phone ?? null;
    if (dto.taxId !== undefined) supplier.taxId = dto.taxId ?? null;
    if (dto.address !== undefined) supplier.address = dto.address ?? null;
    if (dto.notes !== undefined) supplier.notes = dto.notes ?? null;
    if (dto.isActive !== undefined) supplier.isActive = dto.isActive;
    return this.supplierRepo.save(supplier);
  }

  async remove(id: string): Promise<void> {
    const supplier = await this.findOne(id);
    await this.supplierRepo.remove(supplier);
    this.logger.log(`Supplier deleted: ${id}`);
  }
}
