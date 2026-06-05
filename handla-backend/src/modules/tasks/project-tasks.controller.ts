import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
  ApiParam,
} from '@nestjs/swagger';

import { TasksService } from './tasks.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { UserRole } from '../../common/enums';
import { User } from '../auth/entities/user.entity';

/**
 * Handles: GET /api/erp/projects/:projectId/tasks
 *
 * Registered in TasksModule (not ProjectsModule) to avoid a circular
 * module dependency between ProjectsModule and TasksModule.
 * ProjectsModule → ProjectsService; TasksModule → TasksService + ProjectsService.
 * Keeping this controller in TasksModule is the cleanest dependency boundary.
 */
@ApiTags('erp-tasks')
@ApiCookieAuth()
@Controller('erp/projects/:projectId/tasks')
export class ProjectTasksController {
  constructor(private readonly tasksService: TasksService) {}

  // ─── GET /api/erp/projects/:projectId/tasks ───────────────────────────────────
  @Get()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE, UserRole.CLIENT)
  @ApiOperation({ summary: 'List tasks for a specific project' })
  @ApiParam({ name: 'projectId', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Task list for the project' })
  @ApiResponse({ status: 403, description: 'Access denied — EMPLOYEE does not own project, or CLIENT not linked' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async findByProject(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: User,
  ) {
    const tasks = await this.tasksService.findByProject(projectId, user);
    return { message: 'Project tasks retrieved', data: { tasks } };
  }
}
