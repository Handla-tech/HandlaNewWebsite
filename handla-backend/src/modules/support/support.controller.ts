import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';

import { SupportService } from './support.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { CreateReplyDto } from './dto/create-reply.dto';
import { TicketsQueryDto } from './dto/tickets-query.dto';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { UserRole } from '../../common/enums';
import { User } from '../auth/entities/user.entity';

/**
 * SUP — SupportController (/erp/support)
 *
 * Authenticated, role-scoped ticketing:
 *   - ADMIN / EMPLOYEE: full management (list all in-scope, update, assign,
 *     status, delete, per-client API keys, stats).
 *   - CLIENT: read own tickets, create tickets, reply. Internal notes hidden.
 */
@ApiTags('support')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('erp/support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  // ── GET /erp/support/stats (staff) ────────────────────────────────────
  @Get('stats')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Ticket stats for the support dashboard' })
  @ApiResponse({ status: 200, description: 'Counts by status/priority + SLA breaches' })
  async stats(@CurrentUser() user: User) {
    return this.supportService.getStats(user);
  }

  // ════════════════════════════════════════════════════════════════════
  //  API-key management (staff) — declared before :id routes
  // ════════════════════════════════════════════════════════════════════

  @Post('api-keys')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Create a per-client API key (plaintext returned ONCE)' })
  @ApiResponse({ status: 201, description: 'API key created' })
  async createApiKey(@Body() dto: CreateApiKeyDto, @CurrentUser() user: User) {
    const { apiKey, plaintextKey } = await this.supportService.createApiKey(
      dto.clientId,
      dto.label,
      user,
    );
    return {
      id: apiKey.id,
      clientId: apiKey.clientId,
      label: apiKey.label,
      prefix: apiKey.prefix,
      isActive: apiKey.isActive,
      createdAt: apiKey.createdAt,
      // Shown only at creation time — cannot be retrieved again.
      key: plaintextKey,
    };
  }

  @Get('api-keys')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'List API keys for a client (?clientId=)' })
  @ApiResponse({ status: 200, description: 'API keys (no plaintext)' })
  async listApiKeys(@Query('clientId') clientId: string, @CurrentUser() user: User) {
    return this.supportService.listApiKeys(clientId, user);
  }

  @Delete('api-keys/:id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke an API key (deactivate)' })
  @ApiResponse({ status: 200, description: 'API key revoked' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async revokeApiKey(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    const key = await this.supportService.revokeApiKey(id, user);
    return { id: key.id, isActive: key.isActive };
  }

  // ════════════════════════════════════════════════════════════════════
  //  Tickets
  // ════════════════════════════════════════════════════════════════════

  @Get()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE, UserRole.CLIENT)
  @ApiOperation({ summary: 'List tickets (role-scoped)' })
  @ApiResponse({ status: 200, description: 'Paginated tickets list' })
  async findAll(@Query() query: TicketsQueryDto, @CurrentUser() user: User) {
    return this.supportService.findAll(user, query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE, UserRole.CLIENT)
  @ApiOperation({ summary: 'Get a ticket with its (visible) replies' })
  @ApiResponse({ status: 200, description: 'Ticket detail' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.supportService.findOne(id, user);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE, UserRole.CLIENT)
  @ApiOperation({ summary: 'Create a ticket (staff for any owned client; client for self)' })
  @ApiResponse({ status: 201, description: 'Ticket created' })
  async create(@Body() dto: CreateTicketDto, @CurrentUser() user: User) {
    return this.supportService.create(dto, user);
  }

  @Post(':id/replies')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE, UserRole.CLIENT)
  @ApiOperation({ summary: 'Add a reply (staff can flag internal)' })
  @ApiResponse({ status: 201, description: 'Reply added, ticket returned' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async addReply(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateReplyDto,
    @CurrentUser() user: User,
  ) {
    return this.supportService.addReply(id, dto, user);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Update ticket (reclassify / assign / status) — staff only' })
  @ApiResponse({ status: 200, description: 'Ticket updated' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketDto,
    @CurrentUser() user: User,
  ) {
    return this.supportService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a ticket (ADMIN only)' })
  @ApiResponse({ status: 204, description: 'Ticket deleted' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.supportService.remove(id, user);
  }
}
