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

import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksQueryDto } from './dto/tasks-query.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { OwnedResource } from '../../common/decorators/owned-resource.decorator';
import { UserRole } from '../../common/enums';
import { User } from '../auth/entities/user.entity';

@ApiTags('erp-tasks')
@ApiCookieAuth()
@Controller('erp/tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  // ─── GET /api/erp/tasks ───────────────────────────────────────────────────────
  @Get()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'List tasks — role-scoped (ADMIN sees all, EMPLOYEE sees own+assigned)' })
  @ApiQuery({ name: 'page',          required: false, type: Number })
  @ApiQuery({ name: 'limit',         required: false, type: Number })
  @ApiQuery({ name: 'projectId',     required: false, type: String })
  @ApiQuery({ name: 'status',        required: false, enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'DELAYED'] })
  @ApiQuery({ name: 'assigneeId',    required: false, type: String })
  @ApiQuery({ name: 'ownerId',       required: false, type: String })
  @ApiQuery({ name: 'search',        required: false, type: String })
  @ApiQuery({ name: 'includeDelayed',required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Paginated task list' })
  @ApiResponse({ status: 403, description: 'ADMIN or EMPLOYEE role required' })
  async findAll(@Query() query: TasksQueryDto, @CurrentUser() user: User) {
    const result = await this.tasksService.findAll(user, query);
    return { message: 'Tasks retrieved', data: result };
  }

  // ─── GET /api/erp/tasks/:id ───────────────────────────────────────────────────
  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE, UserRole.CLIENT)
  @ApiOperation({ summary: 'Get a single task — CLIENT can read tasks in their projects' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Task found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    const task = await this.tasksService.findOne(id, user);
    return { message: 'Task retrieved', data: { task } };
  }

  // ─── POST /api/erp/tasks ──────────────────────────────────────────────────────
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Create a new task under a project' })
  @ApiResponse({ status: 201, description: 'Task created' })
  @ApiResponse({ status: 400, description: 'EMPLOYEE does not own the target project or invalid assigneeId' })
  @ApiResponse({ status: 404, description: 'Project or assignee not found' })
  async create(@Body() dto: CreateTaskDto, @CurrentUser() user: User) {
    const task = await this.tasksService.create(dto, user);
    return { message: 'Task created', data: { task } };
  }

  // ─── PATCH /api/erp/tasks/:id ─────────────────────────────────────────────────
  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @OwnedResource()
  @ApiOperation({ summary: 'Update a task (EMPLOYEE: own or assigned tasks only)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Task updated' })
  @ApiResponse({ status: 403, description: 'EMPLOYEE does not own/is not assigned to this task' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: User,
  ) {
    const task = await this.tasksService.update(id, dto, user);
    return { message: 'Task updated', data: { task } };
  }

  // ─── DELETE /api/erp/tasks/:id ────────────────────────────────────────────────
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a task (ADMIN only)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Task deleted' })
  @ApiResponse({ status: 403, description: 'ADMIN role required' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    await this.tasksService.remove(id, user);
    return { message: 'Task deleted' };
  }

  // ─── POST /api/erp/tasks/recalculate-delayed ──────────────────────────────────
  @Post('recalculate-delayed')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Manually trigger delayed-status recalculation (ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Recalculation complete; returns count of tasks updated' })
  @ApiResponse({ status: 403, description: 'ADMIN role required' })
  async recalculateDelayed() {
    const count = await this.tasksService.recalculateDelayedStatus();
    return { message: `Delayed recalculation complete`, data: { updatedCount: count } };
  }
}
