import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { WebsiteProject } from './entities/website-project.entity';
import { CreateWebsiteProjectDto } from './dto/create-website-project.dto';
import { UpdateWebsiteProjectDto } from './dto/update-website-project.dto';
import { WebsiteProjectQueryDto } from './dto/website-project-query.dto';
import { ResourceNotFoundException } from '../../utils/exceptions';

export interface PaginatedWebsiteProjects {
  projects: WebsiteProject[];
  total: number;
  page: number;
  pages: number;
}

@Injectable()
export class WebsiteProjectService {
  private readonly logger = new Logger(WebsiteProjectService.name);

  constructor(
    @InjectRepository(WebsiteProject)
    private readonly repo: Repository<WebsiteProject>,
  ) {}

  // ─── Create ───────────────────────────────────────────────────────────────────
  async create(dto: CreateWebsiteProjectDto, adminId: string): Promise<WebsiteProject> {
    const project = this.repo.create({
      title: dto.title,
      titleAr: dto.titleAr ?? null,
      clientName: dto.clientName ?? null,
      summary: dto.summary ?? null,
      summaryAr: dto.summaryAr ?? null,
      description: dto.description,
      descriptionAr: dto.descriptionAr ?? null,
      category: dto.category ?? null,
      categoryAr: dto.categoryAr ?? null,
      imageUrl: dto.imageUrl ?? null,
      projectUrl: dto.projectUrl ?? null,
      tags: dto.tags ?? null,
      featured: dto.featured ?? false,
      sortOrder: dto.sortOrder ?? 0,
      createdByAdminId: adminId,
    });

    const saved = await this.repo.save(project);
    this.logger.log(`Website project created by admin=${adminId}: "${dto.title}"`);
    return saved;
  }

  // ─── Find All (public, paginated) ─────────────────────────────────────────────
  // Ordered by sortOrder ASC then newest first. Supports featured / category filters.
  async findAll(query: WebsiteProjectQueryDto): Promise<PaginatedWebsiteProjects> {
    const { page = 1, limit = 12, featured, category } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (featured !== undefined) where.featured = featured;
    if (category) where.category = category;

    const [projects, total] = await this.repo.findAndCount({
      where,
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      projects,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  // ─── Find One (public) ────────────────────────────────────────────────────────
  async findOne(id: string): Promise<WebsiteProject> {
    const project = await this.repo.findOne({ where: { id } });
    if (!project) {
      throw new ResourceNotFoundException('WebsiteProject', id);
    }
    return project;
  }

  // ─── Update (admin only) ──────────────────────────────────────────────────────
  async update(id: string, dto: UpdateWebsiteProjectDto): Promise<WebsiteProject> {
    const project = await this.findOne(id); // throws if not found

    if (dto.title !== undefined) project.title = dto.title;
    if (dto.titleAr !== undefined) project.titleAr = dto.titleAr ?? null;
    if (dto.clientName !== undefined) project.clientName = dto.clientName ?? null;
    if (dto.summary !== undefined) project.summary = dto.summary ?? null;
    if (dto.summaryAr !== undefined) project.summaryAr = dto.summaryAr ?? null;
    if (dto.description !== undefined) project.description = dto.description;
    if (dto.descriptionAr !== undefined) project.descriptionAr = dto.descriptionAr ?? null;
    if (dto.category !== undefined) project.category = dto.category ?? null;
    if (dto.categoryAr !== undefined) project.categoryAr = dto.categoryAr ?? null;
    if (dto.imageUrl !== undefined) project.imageUrl = dto.imageUrl ?? null;
    if (dto.projectUrl !== undefined) project.projectUrl = dto.projectUrl ?? null;
    if (dto.tags !== undefined) project.tags = dto.tags ?? null;
    if (dto.featured !== undefined) project.featured = dto.featured;
    if (dto.sortOrder !== undefined) project.sortOrder = dto.sortOrder;

    const updated = await this.repo.save(project);
    this.logger.log(`Website project ${id} updated`);
    return updated;
  }

  // ─── Delete (admin only) ──────────────────────────────────────────────────────
  async remove(id: string): Promise<void> {
    const project = await this.findOne(id); // throws if not found
    await this.repo.remove(project);
    this.logger.log(`Website project ${id} deleted`);
  }
}
