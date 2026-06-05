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
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { ReassignOwnershipDto } from './dto/reassign-ownership.dto';
import { UsersQueryDto } from './dto/users-query.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { UserRole } from '../../common/enums';
import { User } from '../auth/entities/user.entity';

@ApiTags('users')
@ApiCookieAuth()
@Roles(UserRole.ADMIN) // all endpoints in this controller require ADMIN
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ─── GET /api/users ──────────────────────────────────────────────────────────
  @Get()
  @ApiOperation({
    summary: 'List all users — paginated, filterable by role and search (ADMIN only)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'role', required: false, enum: UserRole })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Paginated user list' })
  @ApiResponse({ status: 403, description: 'ADMIN role required' })
  async findAll(@Query() query: UsersQueryDto) {
    const result = await this.usersService.findAll(query);
    return { message: 'Users retrieved', data: result };
  }

  // ─── GET /api/users/:id ──────────────────────────────────────────────────────
  @Get(':id')
  @ApiOperation({ summary: 'Get a single user by ID (ADMIN only)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'User found' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 403, description: 'ADMIN role required' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.usersService.findOne(id);
    return { message: 'User retrieved', data: { user } };
  }

  // ─── POST /api/users ─────────────────────────────────────────────────────────
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a user with an explicit role (ADMIN only)' })
  @ApiResponse({ status: 201, description: 'User created; welcome email queued' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  @ApiResponse({ status: 403, description: 'ADMIN role required' })
  async createUser(@Body() dto: CreateUserDto) {
    const user = await this.usersService.createUser(dto);
    return { message: 'User created', data: { user } };
  }

  // ─── PATCH /api/users/:id ────────────────────────────────────────────────────
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a user name and/or email (ADMIN only)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'User updated' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    const user = await this.usersService.updateUser(id, dto);
    return { message: 'User updated', data: { user } };
  }

  // ─── PATCH /api/users/:id/reset-password ─────────────────────────────────────
  @Patch(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset a user password (ADMIN only)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Password reset' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetPasswordDto,
  ) {
    await this.usersService.resetPassword(id, dto.newPassword);
    return { message: 'Password reset successfully' };
  }

  // ─── PATCH /api/users/:id/role ───────────────────────────────────────────────
  @Patch(':id/role')
  @ApiOperation({ summary: "Change a user's role (ADMIN only)" })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Role updated' })
  @ApiResponse({ status: 400, description: 'Invalid role transition (e.g. ADMIN demotion)' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 403, description: 'ADMIN role required' })
  async updateRole(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserRoleDto) {
    const user = await this.usersService.updateRole(id, dto);
    return { message: 'User role updated', data: { user } };
  }

  // ─── PATCH /api/users/:leadId/promote ────────────────────────────────────────
  @Patch(':leadId/promote')
  @ApiOperation({ summary: 'Promote a LEAD user to CLIENT (ADMIN only)' })
  @ApiParam({ name: 'leadId', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Lead promoted to Client' })
  @ApiResponse({ status: 400, description: 'User is not a LEAD' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 403, description: 'ADMIN role required' })
  async promoteLead(
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @CurrentUser() actingAdmin: User,
  ) {
    const user = await this.usersService.promoteLeadToClient(leadId, actingAdmin);
    return { message: 'Lead promoted to Client', data: { user } };
  }

  // ─── PATCH /api/users/:fromId/reassign/:toId ─────────────────────────────────
  @Patch(':fromId/reassign/:toId')
  @ApiOperation({
    summary: 'Bulk-reassign all owned ERP records from one EMPLOYEE to another (ADMIN only)',
  })
  @ApiParam({
    name: 'fromId',
    type: String,
    format: 'uuid',
    description: 'Current owner (EMPLOYEE)',
  })
  @ApiParam({
    name: 'toId',
    type: String,
    format: 'uuid',
    description: 'New owner (must be EMPLOYEE)',
  })
  @ApiResponse({ status: 200, description: 'Ownership reassigned; returns per-table counts' })
  @ApiResponse({ status: 400, description: 'New owner is not an EMPLOYEE' })
  @ApiResponse({ status: 404, description: 'Current or new owner not found' })
  @ApiResponse({ status: 403, description: 'ADMIN role required' })
  async reassignOwnership(
    @Param('fromId', ParseUUIDPipe) fromId: string,
    @Param('toId', ParseUUIDPipe) toId: string,
  ) {
    const result = await this.usersService.reassignOwnership(fromId, toId);
    return { message: 'Ownership reassigned', data: result };
  }

  // ─── PATCH /api/users/:id/archive ────────────────────────────────────────────
  /**
   * Soft-archive a user. Preserves all related records (invoices, projects,
   * clients, conversations, etc.). The user is hidden from normal lists but
   * accessible via GET /users?isArchived=true.
   * Archived users cannot log in.
   */
  @Patch(':id/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-archive a user — preserves all records (ADMIN only)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'User archived' })
  @ApiResponse({ status: 403, description: 'Cannot archive your own account' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async archiveUser(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actingAdmin: User) {
    if (id === actingAdmin.id) {
      throw new ForbiddenException('You cannot archive your own account');
    }
    const user = await this.usersService.archiveUser(id);
    return { message: 'User archived', data: { user } };
  }

  // ─── PATCH /api/users/:id/unarchive ──────────────────────────────────────────
  @Patch(':id/unarchive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore an archived user back to active status (ADMIN only)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'User unarchived' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async unarchiveUser(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.usersService.unarchiveUser(id);
    return { message: 'User restored from archive', data: { user } };
  }

  // ─── PATCH /api/users/:id/disable ────────────────────────────────────────────
  /**
   * Disable a user account so they cannot log in.
   * The user and all their records remain fully intact.
   */
  @Patch(':id/disable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable a user — blocks login without deleting (ADMIN only)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'User disabled' })
  @ApiResponse({ status: 403, description: 'Cannot disable your own account' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async disableUser(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actingAdmin: User) {
    if (id === actingAdmin.id) {
      throw new ForbiddenException('You cannot disable your own account');
    }
    const user = await this.usersService.disableUser(id);
    return { message: 'User disabled', data: { user } };
  }

  // ─── PATCH /api/users/:id/enable ─────────────────────────────────────────────
  @Patch(':id/enable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Re-enable a previously disabled user account (ADMIN only)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'User enabled' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async enableUser(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.usersService.enableUser(id);
    return { message: 'User enabled', data: { user } };
  }

  // ─── DELETE /api/users/:id ───────────────────────────────────────────────────
  /**
   * Hard-delete a user.
   * An ADMIN cannot delete themselves — enforced here (not in service) so the
   * service remains testable without a @CurrentUser() dependency.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hard-delete a user by ID (ADMIN only); cannot delete self' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'User deleted' })
  @ApiResponse({ status: 403, description: 'Cannot delete your own account' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async deleteUser(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actingAdmin: User) {
    if (id === actingAdmin.id) {
      throw new ForbiddenException('You cannot delete your own account');
    }
    await this.usersService.deleteUser(id);
    return { message: 'User deleted' };
  }
}
