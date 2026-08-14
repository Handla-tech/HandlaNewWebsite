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

import { WebsiteProjectService } from './website-project.service';
import { CreateWebsiteProjectDto } from './dto/create-website-project.dto';
import { UpdateWebsiteProjectDto } from './dto/update-website-project.dto';
import { WebsiteProjectQueryDto } from './dto/website-project-query.dto';
import { JwtAuthGuard, Public } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { UserRole } from '../../common/enums';
import { User } from '../auth/entities/user.entity';

@ApiTags('website-content')
@Controller('website/projects')
export class WebsiteProjectController {
  constructor(private readonly service: WebsiteProjectService) {}

  // ─── GET /api/website/projects  (PUBLIC) ─────────────────────────────────────
  @Public()
  @Get()
  @ApiOperation({ summary: 'List website portfolio projects (public, paginated, featured filter)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'featured', required: false, type: Boolean })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Paginated website projects' })
  async findAll(@Query() query: WebsiteProjectQueryDto) {
    const result = await this.service.findAll(query);
    return { message: 'Website projects retrieved', data: result };
  }

  // ─── GET /api/website/projects/:id  (PUBLIC) ─────────────────────────────────
  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a single website project by ID (public)' })
  @ApiResponse({ status: 200, description: 'Website project found' })
  @ApiResponse({ status: 404, description: 'Website project not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const project = await this.service.findOne(id);
    return { message: 'Website project retrieved', data: { project } };
  }

  // ─── POST /api/website/projects  (ADMIN only) ────────────────────────────────
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Create a website project (ADMIN only)' })
  @ApiResponse({ status: 201, description: 'Website project created' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  async create(@Body() dto: CreateWebsiteProjectDto, @CurrentUser() user: User) {
    const project = await this.service.create(dto, user.id);
    return { message: 'Website project created', data: { project } };
  }

  // ─── PATCH /api/website/projects/:id  (ADMIN only) ───────────────────────────
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Update a website project (ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Website project updated' })
  @ApiResponse({ status: 404, description: 'Website project not found' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateWebsiteProjectDto) {
    const project = await this.service.update(id, dto);
    return { message: 'Website project updated', data: { project } };
  }

  // ─── DELETE /api/website/projects/:id  (ADMIN only) ──────────────────────────
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Delete a website project (ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Website project deleted' })
  @ApiResponse({ status: 404, description: 'Website project not found' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.service.remove(id);
    return { message: 'Website project deleted' };
  }
}
