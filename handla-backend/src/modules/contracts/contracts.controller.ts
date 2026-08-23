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

import { Throttle } from '@nestjs/throttler';

import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { ContractsQueryDto } from './dto/contracts-query.dto';
import { ManagePublicLinkDto } from '../../common/public-token/dto/manage-public-link.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { OwnedResource } from '../../common/decorators/owned-resource.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard, Public } from '../../common/guards/jwt.guard';
import { OwnershipGuard } from '../../common/guards/ownership.guard';
import { UserRole } from '../../common/enums';
import { User } from '../auth/entities/user.entity';

@ApiTags('erp-contracts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('erp/contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  // ── GET /erp/contracts/public/:id ──────────────────────────────────────
  // Public read-only contract projection used by the QR-code flow on the
  // contract PDF. Declared BEFORE `:id` so the two-segment path matches
  // first (Nest evaluates handlers in declaration order).
  @Get('public/:id')
  @Public()
  @ApiOperation({
    summary:
      'Public read-only contract view (no auth). Used by the printed QR code on the PDF.',
  })
  @ApiResponse({ status: 200, description: 'Sanitized contract payload' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async findOnePublic(@Param('id', ParseUUIDPipe) id: string) {
    const contract = await this.contractsService.findOnePublic(id);
    return { message: 'Public contract retrieved', data: { contract } };
  }

  // ── GET /erp/contracts/public/token/:token ─────────────────────────────
  // INFO-01 — SECURE public read via opaque capability token. Declared before
  // `:id`. Invalid → 404 (no existence oracle), revoked/expired → 410 Gone.
  @Get('public/token/:token')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary:
      'Public read-only contract view via capability token (no auth). Preferred over the legacy raw-id route.',
  })
  @ApiResponse({ status: 200, description: 'Sanitized contract payload' })
  @ApiResponse({ status: 404, description: 'Invalid or unknown token' })
  @ApiResponse({ status: 410, description: 'Token revoked or expired' })
  @ApiParam({ name: 'token', type: String })
  async findOnePublicByToken(@Param('token') token: string) {
    const contract = await this.contractsService.findOnePublicByToken(token);
    return { message: 'Public contract retrieved', data: { contract } };
  }

  // ── Public-link management (INFO-01 Phase 7) ──────────────────────────
  @Post(':id/public-link')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Generate a public capability link for a contract (ADMIN/owning EMPLOYEE)' })
  @ApiResponse({ status: 201, description: 'Public link metadata' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async generatePublicLink(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ManagePublicLinkDto,
    @CurrentUser() user: User,
  ) {
    return this.contractsService.generatePublicLink(id, dto, user);
  }

  @Post(':id/public-link/rotate')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Rotate (regenerate) the public link; old token stops working immediately' })
  @ApiResponse({ status: 201, description: 'New public link metadata' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async rotatePublicLink(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ManagePublicLinkDto,
    @CurrentUser() user: User,
  ) {
    return this.contractsService.rotatePublicLink(id, dto, user);
  }

  @Delete(':id/public-link')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Revoke the public link; it stops working immediately' })
  @ApiResponse({ status: 200, description: 'Revoked link metadata' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async revokePublicLink(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.contractsService.revokePublicLink(id, user);
  }

  @Patch(':id/public-link')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Set / change / clear the public link expiry' })
  @ApiResponse({ status: 200, description: 'Updated link metadata' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async setPublicLinkExpiry(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ManagePublicLinkDto,
    @CurrentUser() user: User,
  ) {
    return this.contractsService.setPublicLinkExpiry(id, dto, user);
  }

  // ── GET /erp/contracts ──────────────────────────────────────────────────
  @Get()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE, UserRole.CLIENT)
  @ApiOperation({ summary: 'List all contracts (role-scoped)' })
  @ApiResponse({ status: 200, description: 'Paginated contracts list' })
  async findAll(
    @Query() query: ContractsQueryDto,
    @CurrentUser() user: User,
  ) {
    const result = await this.contractsService.findAll(user, query);
    return { message: 'Contracts retrieved', data: result };
  }

  // ── GET /erp/contracts/:id ──────────────────────────────────────────────
  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE, UserRole.CLIENT)
  @ApiOperation({ summary: 'Get a single contract by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Contract found' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    const contract = await this.contractsService.findOne(id, user);
    return { message: 'Contract retrieved', data: { contract } };
  }

  // ── POST /erp/contracts ─────────────────────────────────────────────────
  @Post()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Create a new DRAFT contract' })
  @ApiResponse({ status: 201, description: 'Contract created' })
  async create(
    @Body() dto: CreateContractDto,
    @CurrentUser() user: User,
  ) {
    const contract = await this.contractsService.create(dto, user);
    return { message: 'Contract created', data: { contract } };
  }

  // ── PATCH /erp/contracts/:id ────────────────────────────────────────────
  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @OwnedResource()
  @UseGuards(OwnershipGuard)
  @ApiOperation({ summary: 'Update a DRAFT contract (title/body only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Contract updated' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContractDto,
    @CurrentUser() user: User,
  ) {
    const contract = await this.contractsService.update(id, dto, user);
    return { message: 'Contract updated', data: { contract } };
  }

  // ── DELETE /erp/contracts/:id ───────────────────────────────────────────
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a DRAFT contract (ADMIN only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Contract deleted' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    await this.contractsService.remove(id, user);
  }

  // ── POST /erp/contracts/:id/send ────────────────────────────────────────
  @Post(':id/send')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @OwnedResource()
  @UseGuards(OwnershipGuard)
  @ApiOperation({ summary: 'Send a DRAFT contract to the client (DRAFT → SENT)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Contract sent to client' })
  async sendToClient(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    const contract = await this.contractsService.sendToClient(id, user);
    return { message: 'Contract sent to client', data: { contract } };
  }

  // ── POST /erp/contracts/:id/accept ──────────────────────────────────────
  @Post(':id/accept')
  @Roles(UserRole.CLIENT)
  @ApiOperation({ summary: 'Accept (sign) a contract — CLIENT only (SENT → SIGNED)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Contract signed' })
  async acceptContract(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    const contract = await this.contractsService.acceptContract(id, user);
    return { message: 'Contract accepted and signed', data: { contract } };
  }

  // ── POST /erp/contracts/:id/reject ──────────────────────────────────────
  @Post(':id/reject')
  @Roles(UserRole.CLIENT)
  @ApiOperation({ summary: 'Reject a contract — CLIENT only (SENT → REJECTED)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Contract rejected' })
  async rejectContract(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    const contract = await this.contractsService.rejectContract(id, user);
    return { message: 'Contract rejected', data: { contract } };
  }

  // ── GET /erp/contracts/:id/pdf-url ──────────────────────────────────────
  @Get(':id/pdf-url')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE, UserRole.CLIENT)
  @ApiOperation({ summary: 'Get a presigned URL for the contract HTML document' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Presigned URL returned' })
  async getPdfUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    const url = await this.contractsService.getPdfSignedUrl(id, user);
    return { message: 'Document URL retrieved', data: { url } };
  }
}
