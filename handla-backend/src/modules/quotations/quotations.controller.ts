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

import { QuotationsService } from './quotations.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { QuotationsQueryDto } from './dto/quotations-query.dto';
import { RejectQuotationDto } from './dto/reject-quotation.dto';
import { ManagePublicLinkDto } from '../../common/public-token/dto/manage-public-link.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard, Public } from '../../common/guards/jwt.guard';
import { UserRole } from '../../common/enums';
import { User } from '../auth/entities/user.entity';

@ApiTags('erp-quotations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('erp/quotations')
export class QuotationsController {
  constructor(private readonly quotationsService: QuotationsService) {}

  // ── PUBLIC token routes (no auth) ─────────────────────────────────────
  // Declared BEFORE `:id` so the two-segment path is matched first.

  // Unified INFO-01 token route (/public/token/:token) — preferred going forward.
  @Get('public/token/:token')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary: 'Public read-only quotation view via capability token (no auth). Preferred route.',
  })
  @ApiResponse({ status: 200, description: 'Sanitized quotation payload' })
  @ApiResponse({ status: 404, description: 'Invalid or unknown token' })
  @ApiResponse({ status: 410, description: 'Token revoked or expired' })
  @ApiParam({ name: 'token', type: String })
  async findByPublicTokenV2(@Param('token') token: string) {
    return this.quotationsService.findByPublicToken(token);
  }

  @Post('public/token/:token/accept')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Client accepts a quotation via capability token (SENT → ACCEPTED)' })
  @ApiResponse({ status: 200, description: 'Quotation accepted' })
  @ApiResponse({ status: 410, description: 'Token revoked or expired' })
  @ApiResponse({ status: 422, description: 'Not in SENT state' })
  @ApiParam({ name: 'token', type: String })
  async acceptByTokenV2(@Param('token') token: string) {
    const q = await this.quotationsService.acceptByToken(token);
    return { id: q.id, quoteNumber: q.quoteNumber, status: q.status };
  }

  @Post('public/token/:token/reject')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Client rejects a quotation via capability token (SENT → REJECTED)' })
  @ApiResponse({ status: 200, description: 'Quotation rejected' })
  @ApiResponse({ status: 410, description: 'Token revoked or expired' })
  @ApiResponse({ status: 422, description: 'Not in SENT state' })
  @ApiParam({ name: 'token', type: String })
  async rejectByTokenV2(
    @Param('token') token: string,
    @Body() dto: RejectQuotationDto,
  ) {
    const q = await this.quotationsService.rejectByToken(token, dto?.reason);
    return { id: q.id, quoteNumber: q.quoteNumber, status: q.status };
  }

  // Legacy /public/:token routes (kept for links already in circulation). These
  // now ALSO run full lifecycle validation via the service, so a revoked/expired
  // token fails here identically to the unified route.
  @Get('public/:token')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary: 'Public read-only quotation view (no auth). Used by the accept/reject link.',
  })
  @ApiResponse({ status: 200, description: 'Sanitized quotation payload' })
  @ApiResponse({ status: 404, description: 'Quotation not found' })
  @ApiResponse({ status: 410, description: 'Token revoked or expired' })
  @ApiParam({ name: 'token', type: String })
  async findByPublicToken(@Param('token') token: string) {
    return this.quotationsService.findByPublicToken(token);
  }

  @Post('public/:token/accept')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Client accepts a quotation via public link (SENT → ACCEPTED)' })
  @ApiResponse({ status: 200, description: 'Quotation accepted' })
  @ApiResponse({ status: 410, description: 'Token revoked or expired' })
  @ApiResponse({ status: 422, description: 'Not in SENT state' })
  @ApiParam({ name: 'token', type: String })
  async acceptByToken(@Param('token') token: string) {
    const q = await this.quotationsService.acceptByToken(token);
    return { id: q.id, quoteNumber: q.quoteNumber, status: q.status };
  }

  @Post('public/:token/reject')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Client rejects a quotation via public link (SENT → REJECTED)' })
  @ApiResponse({ status: 200, description: 'Quotation rejected' })
  @ApiResponse({ status: 410, description: 'Token revoked or expired' })
  @ApiResponse({ status: 422, description: 'Not in SENT state' })
  @ApiParam({ name: 'token', type: String })
  async rejectByToken(
    @Param('token') token: string,
    @Body() dto: RejectQuotationDto,
  ) {
    const q = await this.quotationsService.rejectByToken(token, dto?.reason);
    return { id: q.id, quoteNumber: q.quoteNumber, status: q.status };
  }

  // ── Public-link management (INFO-01 Phase 7) ──────────────────────────
  @Post(':id/public-link')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Generate a public capability link for a quotation (ADMIN/owning EMPLOYEE)' })
  @ApiResponse({ status: 201, description: 'Public link metadata' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async generatePublicLink(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ManagePublicLinkDto,
    @CurrentUser() user: User,
  ) {
    return this.quotationsService.generatePublicLink(id, dto, user);
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
    return this.quotationsService.rotatePublicLink(id, dto, user);
  }

  @Delete(':id/public-link')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Revoke the public link; view + accept/reject stop working immediately' })
  @ApiResponse({ status: 200, description: 'Revoked link metadata' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async revokePublicLink(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.quotationsService.revokePublicLink(id, user);
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
    return this.quotationsService.setPublicLinkExpiry(id, dto, user);
  }

  // ── POST /erp/quotations/recalculate-expired (ADMIN) ──────────────────
  // Declared before `:id` routes to avoid path collision on the literal segment.
  @Post('recalculate-expired')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Manually trigger expiry recalculation (ADMIN)' })
  @ApiResponse({ status: 200, description: 'Count of newly-expired quotations' })
  async recalculateExpired() {
    const count = await this.quotationsService.recalculateExpiredStatus();
    return { updated: count };
  }

  // ── GET /erp/quotations ───────────────────────────────────────────────
  @Get()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE, UserRole.CLIENT)
  @ApiOperation({ summary: 'List quotations (role-scoped)' })
  @ApiResponse({ status: 200, description: 'Paginated quotations list' })
  async findAll(@Query() query: QuotationsQueryDto, @CurrentUser() user: User) {
    return this.quotationsService.findAll(user, query);
  }

  // ── GET /erp/quotations/:id ───────────────────────────────────────────
  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE, UserRole.CLIENT)
  @ApiOperation({ summary: 'Get single quotation with line items' })
  @ApiResponse({ status: 200, description: 'Quotation detail' })
  @ApiResponse({ status: 404, description: 'Quotation not found' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.quotationsService.findOne(id, user);
  }

  // ── POST /erp/quotations ──────────────────────────────────────────────
  @Post()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Create a new quotation with line items (DRAFT)' })
  @ApiResponse({ status: 201, description: 'Quotation created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async create(@Body() dto: CreateQuotationDto, @CurrentUser() user: User) {
    return this.quotationsService.create(dto, user);
  }

  // ── PATCH /erp/quotations/:id ─────────────────────────────────────────
  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Update quotation (DRAFT only, owner/admin)' })
  @ApiResponse({ status: 200, description: 'Quotation updated' })
  @ApiResponse({ status: 422, description: 'Cannot update non-DRAFT quotation' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuotationDto,
    @CurrentUser() user: User,
  ) {
    return this.quotationsService.update(id, dto, user);
  }

  // ── DELETE /erp/quotations/:id ────────────────────────────────────────
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete quotation (ADMIN, non-CONVERTED only)' })
  @ApiResponse({ status: 204, description: 'Quotation deleted' })
  @ApiResponse({ status: 422, description: 'Cannot delete a CONVERTED quotation' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.quotationsService.remove(id, user);
  }

  // ── POST /erp/quotations/:id/send ─────────────────────────────────────
  @Post(':id/send')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send quotation to client (DRAFT → SENT)' })
  @ApiResponse({ status: 200, description: 'Quotation sent' })
  @ApiResponse({ status: 422, description: 'Not in DRAFT state' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async send(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.quotationsService.send(id, user);
  }

  // ── POST /erp/quotations/:id/accept ───────────────────────────────────
  @Post(':id/accept')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE, UserRole.CLIENT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept quotation (SENT → ACCEPTED)' })
  @ApiResponse({ status: 200, description: 'Quotation accepted' })
  @ApiResponse({ status: 422, description: 'Not in SENT state' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async accept(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.quotationsService.accept(id, user);
  }

  // ── POST /erp/quotations/:id/reject ───────────────────────────────────
  @Post(':id/reject')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE, UserRole.CLIENT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject quotation (SENT → REJECTED)' })
  @ApiResponse({ status: 200, description: 'Quotation rejected' })
  @ApiResponse({ status: 422, description: 'Not in SENT state' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectQuotationDto,
    @CurrentUser() user: User,
  ) {
    return this.quotationsService.reject(id, user, dto?.reason);
  }

  // ── POST /erp/quotations/:id/convert ──────────────────────────────────
  @Post(':id/convert')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Convert accepted quotation → draft Invoice + draft Contract (ACCEPTED → CONVERTED)',
  })
  @ApiResponse({ status: 200, description: 'Quotation converted' })
  @ApiResponse({ status: 422, description: 'Not in ACCEPTED state' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async convert(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.quotationsService.convert(id, user);
  }
}
