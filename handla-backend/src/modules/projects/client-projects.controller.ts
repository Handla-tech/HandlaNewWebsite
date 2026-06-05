import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
  ApiParam,
} from '@nestjs/swagger';

import { ProjectsService } from './projects.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { UserRole } from '../../common/enums';
import { User } from '../auth/entities/user.entity';

/**
 * ERP-4 — Nested route: GET /api/erp/clients/:clientId/projects
 *
 * Returns all projects for a specific client.
 * Registered in ProjectsModule so ProjectsService can be injected without
 * creating a cross-module circular dependency.
 */
@ApiTags('erp-projects')
@ApiCookieAuth()
@Controller('erp/clients/:clientId/projects')
export class ClientProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE, UserRole.CLIENT)
  @ApiOperation({ summary: 'List all projects for a specific client' })
  @ApiParam({ name: 'clientId', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Projects for the client' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  async findByClient(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @CurrentUser() user: User,
  ) {
    const projects = await this.projectsService.findByClient(clientId, user);
    return { message: 'Client projects retrieved', data: { projects } };
  }
}
