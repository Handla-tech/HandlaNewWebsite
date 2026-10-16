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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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
import { SubmitClientTaskDto } from './dto/submit-client-task.dto';
import { TasksQueryDto } from './dto/tasks-query.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { OwnedResource } from '../../common/decorators/owned-resource.decorator';
import { UserRole } from '../../common/enums';
import { User } from '../auth/entities/user.entity';

import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('erp-tasks')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
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

  // ─── GET /api/erp/tasks/assignable-staff ──────────────────────────────────────
  // Declared BEFORE the `:id` route so "assignable-staff" isn't captured as an id.
  // ADMIN + EMPLOYEE: employees may create/assign tasks but cannot hit the
  // ADMIN-only /users list, so this gives them the assignee picker options.
  @Get('assignable-staff')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'List staff (ADMIN+EMPLOYEE) assignable to a task' })
  @ApiResponse({ status: 200, description: 'Assignable staff list' })
  @ApiResponse({ status: 403, description: 'ADMIN or EMPLOYEE role required' })
  async findAssignableStaff() {
    const staff = await this.tasksService.findAssignableStaff();
    return { message: 'Assignable staff retrieved', data: { staff } };
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

  // ─── POST /api/erp/tasks/:id/attachments/upload ──────────────────────────────
  // CLIENT uploads an attachment file directly for their client-directed task.
  @Post(':id/attachments/upload')
  @Roles(UserRole.CLIENT)
  @ApiOperation({ summary: 'CLIENT uploads a file attachment for a client-directed task' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 201, description: 'Attachment uploaded' })
  @ApiResponse({ status: 400, description: 'Invalid file or type' })
  @ApiResponse({ status: 403, description: 'Not the client this task belongs to or task not assigned to client' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    }),
  )
  async uploadTaskAttachment(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
  ) {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('File is missing or empty');
    }
    const result = await this.tasksService.uploadAttachment(id, file, user);
    return { message: 'Attachment uploaded', data: result };
  }

  // ─── PATCH /api/erp/tasks/:id/submit ──────────────────────────────────────────
  // CLIENT fulfils a client-directed task: attach uploaded files + mark done.
  // Not @OwnedResource() — that guard is for staff ownership; client access is
  // enforced inside the service (project must belong to the calling client).
  @Patch(':id/submit')
  @Roles(UserRole.CLIENT)
  @ApiOperation({ summary: 'CLIENT submits a client-directed task (upload files, mark complete)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Task submitted and marked completed' })
  @ApiResponse({ status: 400, description: 'Upload required but no files attached' })
  @ApiResponse({ status: 403, description: 'Not the client this task belongs to' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async submitClientTask(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitClientTaskDto,
    @CurrentUser() user: User,
  ) {
    const task = await this.tasksService.submitClientTask(id, dto, user);
    return { message: 'Task submitted', data: { task } };
  }

  // ─── GET /api/erp/tasks/:id/attachments/download ──────────────────────────────
  // Authorized download URL generation for task attachments.
  @Get(':id/attachments/download')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE, UserRole.CLIENT)
  @ApiOperation({ summary: 'Generate a short-lived presigned download URL for a task attachment' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Signed download URL generated' })
  @ApiResponse({ status: 400, description: 'Invalid or missing attachment key' })
  @ApiResponse({ status: 403, description: 'Access denied to task or attachment' })
  @ApiResponse({ status: 404, description: 'Task or attachment not found' })
  async getAttachmentDownloadUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('key') key: string,
    @CurrentUser() user: User,
  ) {
    if (!key) {
      throw new BadRequestException('Attachment key query parameter is required');
    }
    const downloadUrl = await this.tasksService.getSignedAttachmentUrl(id, key, user);
    return { message: 'Download URL generated', data: { downloadUrl } };
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
