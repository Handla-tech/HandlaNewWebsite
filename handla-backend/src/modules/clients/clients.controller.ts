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

import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ClientsQueryDto } from './dto/clients-query.dto';
import { AssignOwnerDto } from './dto/assign-owner.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { OwnedResource } from '../../common/decorators/owned-resource.decorator';
import { UserRole } from '../../common/enums';
import { User } from '../auth/entities/user.entity';

@ApiTags('erp-clients')
@ApiCookieAuth()
@Controller('erp/clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  // ─── GET /api/erp/clients/me ─────────────────────────────────────────────────
  /** CLIENT retrieves their own client record (required for Projects/Contracts/Invoices). */
  @Get('me')
  @Roles(UserRole.CLIENT)
  @ApiOperation({ summary: 'Get the calling CLIENT user\'s own client record' })
  @ApiResponse({ status: 200, description: 'Client record found' })
  @ApiResponse({ status: 404, description: 'No client record for this user' })
  async findMyRecord(@CurrentUser() user: User) {
    const client = await this.clientsService.findByUserId(user.id);
    return { message: 'Client record retrieved', data: { client } };
  }

  // ─── GET /api/erp/clients ─────────────────────────────────────────────────────
  @Get()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'List clients — role-scoped (ADMIN sees all, EMPLOYEE sees own)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: ['ACTIVE', 'INACTIVE', 'CHURNED'] })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'ownerId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Paginated client list' })
  @ApiResponse({ status: 403, description: 'ADMIN or EMPLOYEE role required' })
  async findAll(@Query() query: ClientsQueryDto, @CurrentUser() user: User) {
    const result = await this.clientsService.findAll(user, query);
    return { message: 'Clients retrieved', data: result };
  }

  // ─── GET /api/erp/clients/:id ─────────────────────────────────────────────────
  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Get a single client with full details' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Client found' })
  @ApiResponse({ status: 403, description: 'EMPLOYEE does not own this client' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    const client = await this.clientsService.findOne(id, user);
    return { message: 'Client retrieved', data: { client } };
  }

  // ─── POST /api/erp/clients ────────────────────────────────────────────────────
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Create a Client record for an existing CLIENT-role user' })
  @ApiResponse({ status: 201, description: 'Client record created' })
  @ApiResponse({
    status: 400,
    description: 'Target user is not CLIENT role or already has a Client record',
  })
  @ApiResponse({ status: 404, description: 'Target user not found' })
  async create(@Body() dto: CreateClientDto, @CurrentUser() user: User) {
    const client = await this.clientsService.create(dto, user);
    return { message: 'Client created', data: { client } };
  }

  // ─── PATCH /api/erp/clients/:id ───────────────────────────────────────────────
  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @OwnedResource()
  @ApiOperation({ summary: 'Update a client record (EMPLOYEE: own only)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Client updated' })
  @ApiResponse({ status: 403, description: 'EMPLOYEE does not own this client' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClientDto,
    @CurrentUser() user: User,
  ) {
    const client = await this.clientsService.update(id, dto, user);
    return { message: 'Client updated', data: { client } };
  }

  // ─── DELETE /api/erp/clients/:id ─────────────────────────────────────────────
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a client record (ADMIN only)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Client deleted' })
  @ApiResponse({ status: 403, description: 'ADMIN role required' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    await this.clientsService.remove(id, user);
    return { message: 'Client deleted' };
  }

  // ─── PATCH /api/erp/clients/:id/assign-owner ──────────────────────────────────
  @Patch(':id/assign-owner')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Reassign the owning EMPLOYEE for a client (ADMIN only)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Owner reassigned; conversations updated' })
  @ApiResponse({ status: 400, description: 'New owner is not an EMPLOYEE' })
  @ApiResponse({ status: 404, description: 'Client or new owner not found' })
  async assignOwner(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignOwnerDto,
    @CurrentUser() user: User,
  ) {
    const client = await this.clientsService.assignOwner(id, dto.newOwnerId, user);
    return { message: 'Client owner assigned', data: { client } };
  }
}
