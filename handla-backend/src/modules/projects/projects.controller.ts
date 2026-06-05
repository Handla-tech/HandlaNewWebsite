import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsQueryDto } from './dto/projects-query.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { OwnedResource } from '../../common/decorators/owned-resource.decorator';
import { UserRole } from '../../common/enums';
import { User } from '../auth/entities/user.entity';

@ApiTags('erp-projects')
@ApiCookieAuth()
@Controller('erp/projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  // ─── GET /api/erp/projects ────────────────────────────────────────────────────
  @Get()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'List projects — role-scoped (ADMIN sees all, EMPLOYEE sees own)' })
  @ApiQuery({ name: 'page',     required: false, type: Number })
  @ApiQuery({ name: 'limit',    required: false, type: Number })
  @ApiQuery({ name: 'clientId', required: false, type: String })
  @ApiQuery({ name: 'status',   required: false, enum: ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'] })
  @ApiQuery({ name: 'ownerId',  required: false, type: String })
  @ApiQuery({ name: 'search',   required: false, type: String })
  @ApiResponse({ status: 200, description: 'Paginated project list' })
  @ApiResponse({ status: 403, description: 'ADMIN or EMPLOYEE role required' })
  async findAll(@Query() query: ProjectsQueryDto, @CurrentUser() user: User) {
    const result = await this.projectsService.findAll(user, query);
    return { message: 'Projects retrieved', data: result };
  }

  // ─── GET /api/erp/projects/my ─────────────────────────────────────────────────
  // MUST be declared BEFORE `:id` route to avoid being matched as a UUID param.
  @Get('my')
  @Roles(UserRole.CLIENT)
  @ApiOperation({ summary: 'List projects assigned to the authenticated CLIENT' })
  @ApiResponse({ status: 200, description: 'Projects for this client' })
  @ApiResponse({ status: 404, description: 'No client record found for this user' })
  async findMine(@CurrentUser() user: User) {
    const projects = await this.projectsService.findByUserId(user.id);
    return { message: 'Projects retrieved', data: { projects } };
  }

  // ─── GET /api/erp/projects/:id ────────────────────────────────────────────────
  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE, UserRole.CLIENT)
  @ApiOperation({ summary: 'Get a single project with full details' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Project found' })
  @ApiResponse({ status: 403, description: 'Access denied — ownership mismatch or CLIENT not linked' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    const project = await this.projectsService.findOne(id, user);
    return { message: 'Project retrieved', data: { project } };
  }

  // ─── POST /api/erp/projects ───────────────────────────────────────────────────
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Create a new project under a client' })
  @ApiResponse({ status: 201, description: 'Project created' })
  @ApiResponse({ status: 400, description: 'EMPLOYEE does not own the target client' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  async create(@Body() dto: CreateProjectDto, @CurrentUser() user: User) {
    const project = await this.projectsService.create(dto, user);
    return { message: 'Project created', data: { project } };
  }

  // ─── PATCH /api/erp/projects/:id ─────────────────────────────────────────────
  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @OwnedResource()
  @ApiOperation({ summary: 'Update a project (EMPLOYEE: own only)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Project updated' })
  @ApiResponse({ status: 403, description: 'EMPLOYEE does not own this project' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: User,
  ) {
    const project = await this.projectsService.update(id, dto, user);
    return { message: 'Project updated', data: { project } };
  }

  // ─── DELETE /api/erp/projects/:id ────────────────────────────────────────────
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a project (ADMIN only)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Project deleted' })
  @ApiResponse({ status: 403, description: 'ADMIN role required' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    await this.projectsService.remove(id, user);
    return { message: 'Project deleted' };
  }
}
