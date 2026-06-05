import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Testimonial } from './entities/testimonial.entity';
import { CreateTestimonialDto } from './dto/create-testimonial.dto';
import { UpdateTestimonialDto } from './dto/update-testimonial.dto';
import { TestimonialQueryDto } from './dto/testimonial-query.dto';
import { ResourceNotFoundException } from '../../utils/exceptions';

export interface PaginatedTestimonials {
  testimonials: Testimonial[];
  total: number;
  page: number;
  pages: number;
}

@Injectable()
export class TestimonialService {
  private readonly logger = new Logger(TestimonialService.name);

  constructor(
    @InjectRepository(Testimonial)
    private readonly testimonialRepo: Repository<Testimonial>,
  ) {}

  // ─── Create ───────────────────────────────────────────────────────────────────
  async create(dto: CreateTestimonialDto, adminId: string): Promise<Testimonial> {
    const testimonial = this.testimonialRepo.create({
      clientName: dto.clientName,
      clientCompany: dto.clientCompany ?? null,
      content: dto.content,
      imageUrl: dto.imageUrl ?? null,
      rating: dto.rating,
      createdByAdminId: adminId,
    });

    const saved = await this.testimonialRepo.save(testimonial);
    this.logger.log(
      `Testimonial created by admin=${adminId}: "${dto.clientName}" (rating ${dto.rating}/5)`,
    );
    return saved;
  }

  // ─── Find All (public, paginated, newest first) ───────────────────────────────
  async findAll(query: TestimonialQueryDto): Promise<PaginatedTestimonials> {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const [testimonials, total] = await this.testimonialRepo.findAndCount({
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      testimonials,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  // ─── Find One (public) ────────────────────────────────────────────────────────
  async findOne(id: string): Promise<Testimonial> {
    const testimonial = await this.testimonialRepo.findOne({
      where: { id },
    });

    if (!testimonial) {
      throw new ResourceNotFoundException('Testimonial', id);
    }

    return testimonial;
  }

  // ─── Update (admin only) ──────────────────────────────────────────────────────
  async update(id: string, dto: UpdateTestimonialDto): Promise<Testimonial> {
    const testimonial = await this.findOne(id); // throws if not found

    // Apply only the fields that were provided
    if (dto.clientName !== undefined) testimonial.clientName = dto.clientName;
    if (dto.clientCompany !== undefined) testimonial.clientCompany = dto.clientCompany ?? null;
    if (dto.content !== undefined) testimonial.content = dto.content;
    if (dto.imageUrl !== undefined) testimonial.imageUrl = dto.imageUrl ?? null;
    if (dto.rating !== undefined) testimonial.rating = dto.rating;

    const updated = await this.testimonialRepo.save(testimonial);
    this.logger.log(`Testimonial ${id} updated`);
    return updated;
  }

  // ─── Delete (admin only) ──────────────────────────────────────────────────────
  async remove(id: string): Promise<void> {
    const testimonial = await this.findOne(id); // throws if not found
    await this.testimonialRepo.remove(testimonial);
    this.logger.log(`Testimonial ${id} deleted`);
  }
}
