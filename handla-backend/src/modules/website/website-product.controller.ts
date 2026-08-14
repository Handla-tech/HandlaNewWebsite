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

import { WebsiteProductService } from './website-product.service';
import { CreateWebsiteProductDto } from './dto/create-website-product.dto';
import { UpdateWebsiteProductDto } from './dto/update-website-product.dto';
import { WebsiteProductQueryDto } from './dto/website-product-query.dto';
import { JwtAuthGuard, Public } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { UserRole } from '../../common/enums';
import { User } from '../auth/entities/user.entity';

@ApiTags('website-content')
@Controller('website/products')
export class WebsiteProductController {
  constructor(private readonly service: WebsiteProductService) {}

  // ─── GET /api/website/products  (PUBLIC) ─────────────────────────────────────
  @Public()
  @Get()
  @ApiOperation({ summary: 'List website products (public, paginated, featured filter)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'featured', required: false, type: Boolean })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Paginated website products' })
  async findAll(@Query() query: WebsiteProductQueryDto) {
    const result = await this.service.findAll(query);
    return { message: 'Website products retrieved', data: result };
  }

  // ─── GET /api/website/products/:id  (PUBLIC) ─────────────────────────────────
  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a single website product by ID (public)' })
  @ApiResponse({ status: 200, description: 'Website product found' })
  @ApiResponse({ status: 404, description: 'Website product not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const product = await this.service.findOne(id);
    return { message: 'Website product retrieved', data: { product } };
  }

  // ─── POST /api/website/products  (ADMIN only) ────────────────────────────────
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Create a website product (ADMIN only)' })
  @ApiResponse({ status: 201, description: 'Website product created' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  async create(@Body() dto: CreateWebsiteProductDto, @CurrentUser() user: User) {
    const product = await this.service.create(dto, user.id);
    return { message: 'Website product created', data: { product } };
  }

  // ─── PATCH /api/website/products/:id  (ADMIN only) ───────────────────────────
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Update a website product (ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Website product updated' })
  @ApiResponse({ status: 404, description: 'Website product not found' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateWebsiteProductDto) {
    const product = await this.service.update(id, dto);
    return { message: 'Website product updated', data: { product } };
  }

  // ─── DELETE /api/website/products/:id  (ADMIN only) ──────────────────────────
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Delete a website product (ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Website product deleted' })
  @ApiResponse({ status: 404, description: 'Website product not found' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.service.remove(id);
    return { message: 'Website product deleted' };
  }
}
