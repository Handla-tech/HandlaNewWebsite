import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
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

import { QuotationsService } from './quotations.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { QuotationsQueryDto } from './dto/quotations-query.dto';
import { RejectQuotationDto } from './dto/reject-quotation.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard, Public } from '../../common/guards/jwt.guard';
import { UserRole } from '../../common/enums';
import { User } from '../auth/entities/user.entity';

/**
 * QUO-1 — QuotationsController
 *
 * Back-office quotation management (ADMIN/EMPLOYEE) + CLIENT read of their own,
 * plus PUBLIC (no-auth) accept/reject via a non-guessable publicToken so a
 * lead/client can respond from an emailed link without logging in.
 */
@ApiTags('erp-quotations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('quotations')
export class QuotationsController {
  constructor(private readonly quotationsService: QuotationsService) {}

  // ─── PUBLIC token routes (declared first, no auth) ────────────────────────

  // GET /quotations/public/:token — sanitized view for the emailed link.
  @Get('public/:token')
  @Public()
  @ApiOperation({ summary: 'Public read-only quotation view (no auth, by token)' })
  @ApiResponse({ status: 200, description: 'Sanitized quotation payload' })
  @ApiResponse({ status: 404, description: 'Quotation not found' })
  @ApiParam({ name: 'token', type: String })
  async findByPublicToken(@Param('token') token: string) {
    return this.quotationsService.findByPublicToken(token);
  }

  // POST /quotations/public/:token/accept — lead/client accepts via link.
  @Post('public/:token/accept')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Public accept a quotation via token (SENT → ACCEPTED)' })
  @ApiResponse({ status: 200, description: 'Quotation accepted' })
  @ApiResponse({ status: 422, description: 'Quotation not in SENT state' })
  @ApiParam({ name: 'token', type: String })
  async acceptByToken(@Param('token') token: string) {
    const q = await this.quotationsService.acceptByToken(token);
    return { id: q.id, quoteNumber: q.quoteNumber, status: q.status };
  }

  // POST /quotations/public/:token/reject — lead/client rejects via link.
  @Post('public/:token/reject')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Public reject a quotation via token (SENT → REJECTED)' })
  @ApiResponse({ status: 200, description: 'Quotation rejected' })
  @ApiResponse({ status: 422, description: 'Quotation not in SENT state' })
  @ApiParam({ name: 'token', type: String })
  async rejectByToken(
    @Param('token') token: string,
    @Body() dto: RejectQuotationDto,
  ) {
    const q = await this.quotationsService.rejectByToken(token, dto?.reason);
    return { id: q.id, quoteNumber: q.quoteNumber, status: q.status };
  }

  // ─── Authenticated CRUD ───────────────────────────────────────────────────

  // GET /quotations
  @Get()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE, UserRole.CLIENT)
  @ApiOperation({ summary: 'List quotations (role-scoped)' })
  @ApiResponse({ status: 200, description: 'Paginated quotations list' })
  async findAll(@Query() query: QuotationsQueryDto, @CurrentUser() user: User) {
    return this.quotationsService.findAll(user, query);
  }

  // GET /quotations/:id
  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE, UserRole.CLIENT)
  @ApiOperation({ summary: 'Get single quotation with line items' })
  @ApiResponse({ status: 200, description: 'Quotation detail' })
  @ApiResponse({ status: 404, description: 'Quotation not found' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.quotationsService.findOne(id, user);
  }

  // POST /quotations
  @Post()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Create a new quotation with line items (DRAFT)' })
  @ApiResponse({ status: 201, description: 'Quotation created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async create(@Body() dto: CreateQuotationDto, @CurrentUser() user: User) {
    return this.quotationsService.create(dto, user);
  }

  // PATCH /quotations/:id
  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Update quotation (DRAFT only, owner/admin)' })
  @ApiResponse({ status: 200, description: 'Quotation updated' })
  @ApiResponse({ status: 422, description: 'Cannot update non-DRAFT quotation' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateQuotationDto,
    @CurrentUser() user: User,
  ) {
    return this.quotationsService.update(id, dto, user);
  }

  // DELETE /quotations/:id
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete quotation (ADMIN, not CONVERTED)' })
  @ApiResponse({ status: 204, description: 'Quotation deleted' })
  @ApiResponse({ status: 422, description: 'Cannot delete a CONVERTED quotation' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.quotationsService.remove(id, user);
  }

  // POST /quotations/:id/send
  @Post(':id/send')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send quotation to client (DRAFT → SENT)' })
  @ApiResponse({ status: 200, description: 'Quotation sent' })
  @ApiResponse({ status: 422, description: 'Quotation not in DRAFT state' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async send(@Param('id') id: string, @CurrentUser() user: User) {
    return this.quotationsService.send(id, user);
  }

  // POST /quotations/:id/accept — staff-side accept
  @Post(':id/accept')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE, UserRole.CLIENT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept quotation (SENT → ACCEPTED)' })
  @ApiResponse({ status: 200, description: 'Quotation accepted' })
  @ApiResponse({ status: 422, description: 'Quotation not in SENT state' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async accept(@Param('id') id: string, @CurrentUser() user: User) {
    return this.quotationsService.accept(id, user);
  }

  // POST /quotations/:id/reject — staff-side reject
  @Post(':id/reject')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE, UserRole.CLIENT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject quotation (SENT → REJECTED)' })
  @ApiResponse({ status: 200, description: 'Quotation rejected' })
  @ApiResponse({ status: 422, description: 'Quotation not in SENT state' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectQuotationDto,
    @CurrentUser() user: User,
  ) {
    return this.quotationsService.reject(id, user, dto?.reason);
  }

  // POST /quotations/:id/convert — ACCEPTED → CONVERTED (+ draft invoice/contract)
  @Post(':id/convert')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Convert accepted quotation to a draft Contract + draft Invoice',
  })
  @ApiResponse({ status: 200, description: 'Quotation converted' })
  @ApiResponse({ status: 422, description: 'Quotation not in ACCEPTED state' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async convert(@Param('id') id: string, @CurrentUser() user: User) {
    return this.quotationsService.convert(id, user);
  }

  // POST /quotations/recalculate-expired — manual scheduler trigger (ADMIN)
  @Post('recalculate-expired')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually trigger expiry recalculation (ADMIN)' })
  @ApiResponse({ status: 200, description: 'Count of newly-expired quotations' })
  async recalculateExpired() {
    const count = await this.quotationsService.recalculateExpiredStatus();
    return { updated: count };
  }
}
