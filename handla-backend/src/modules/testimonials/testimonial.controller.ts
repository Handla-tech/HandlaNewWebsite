import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth, ApiQuery } from '@nestjs/swagger';

import { TestimonialService } from './testimonial.service';
import { CreateTestimonialDto } from './dto/create-testimonial.dto';
import { UpdateTestimonialDto } from './dto/update-testimonial.dto';
import { TestimonialQueryDto } from './dto/testimonial-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Public } from '../../common/guards/jwt.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { UserRole } from '../../common/enums';
import { User } from '../auth/entities/user.entity';

@ApiTags('testimonials')
@Controller('testimonials')
export class TestimonialController {
  constructor(private readonly testimonialService: TestimonialService) {}

  // ─── GET /api/testimonials  (PUBLIC) ─────────────────────────────────────────
  @Public()
  @Get()
  @ApiOperation({ summary: 'List all testimonials (public, paginated, newest first)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Paginated testimonials' })
  async findAll(@Query() query: TestimonialQueryDto) {
    const result = await this.testimonialService.findAll(query);
    return { message: 'Testimonials retrieved', data: result };
  }

  // ─── GET /api/testimonials/:id  (PUBLIC) ─────────────────────────────────────
  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a single testimonial by ID (public)' })
  @ApiResponse({ status: 200, description: 'Testimonial found' })
  @ApiResponse({ status: 404, description: 'Testimonial not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const testimonial = await this.testimonialService.findOne(id);
    return { message: 'Testimonial retrieved', data: { testimonial } };
  }

  // ─── POST /api/testimonials  (ADMIN only) ─────────────────────────────────────
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Create a new testimonial (ADMIN only)' })
  @ApiResponse({ status: 201, description: 'Testimonial created' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  async create(@Body() dto: CreateTestimonialDto, @CurrentUser() user: User) {
    const testimonial = await this.testimonialService.create(dto, user.id);
    return { message: 'Testimonial created', data: { testimonial } };
  }

  // ─── PATCH /api/testimonials/:id  (ADMIN only) ───────────────────────────────
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Update a testimonial (ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Testimonial updated' })
  @ApiResponse({ status: 404, description: 'Testimonial not found' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTestimonialDto) {
    const testimonial = await this.testimonialService.update(id, dto);
    return { message: 'Testimonial updated', data: { testimonial } };
  }

  // ─── DELETE /api/testimonials/:id  (ADMIN only) ──────────────────────────────
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Delete a testimonial (ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Testimonial deleted' })
  @ApiResponse({ status: 404, description: 'Testimonial not found' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.testimonialService.remove(id);
    return { message: 'Testimonial deleted' };
  }
}
