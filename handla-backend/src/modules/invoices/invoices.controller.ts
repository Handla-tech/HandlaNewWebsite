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

import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { MarkPaidDto } from './dto/mark-paid.dto';
import { InvoicesQueryDto } from './dto/invoices-query.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { OwnedResource } from '../../common/decorators/owned-resource.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard, Public } from '../../common/guards/jwt.guard';
import { OwnershipGuard } from '../../common/guards/ownership.guard';
import { UserRole } from '../../common/enums';
import { User } from '../auth/entities/user.entity';

@ApiTags('erp-invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('erp/invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  // ── GET /erp/invoices/public/:id ──────────────────────────────────────
  // Public read-only invoice projection used by the QR-code flow.
  // Declared BEFORE `:id` so the two-segment path is matched first.
  @Get('public/:id')
  @Public()
  @ApiOperation({
    summary:
      'Public read-only invoice view (no auth). Used by the printed QR code on the PDF.',
  })
  @ApiResponse({ status: 200, description: 'Sanitized invoice payload' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async findOnePublic(@Param('id', ParseUUIDPipe) id: string) {
    return this.invoicesService.findOnePublic(id);
  }

  // ── GET /erp/invoices ──────────────────────────────────────────────────
  @Get()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE, UserRole.CLIENT)
  @ApiOperation({ summary: 'List all invoices (role-scoped)' })
  @ApiResponse({ status: 200, description: 'Paginated invoices list' })
  async findAll(@Query() query: InvoicesQueryDto, @CurrentUser() user: User) {
    return this.invoicesService.findAll(user, query);
  }

  // ── GET /erp/invoices/:id ─────────────────────────────────────────────
  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE, UserRole.CLIENT)
  @ApiOperation({ summary: 'Get single invoice with line items' })
  @ApiResponse({ status: 200, description: 'Invoice detail' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.invoicesService.findOne(id, user);
  }

  // ── POST /erp/invoices ────────────────────────────────────────────────
  @Post()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Create a new invoice with line items' })
  @ApiResponse({ status: 201, description: 'Invoice created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async create(@Body() dto: CreateInvoiceDto, @CurrentUser() user: User) {
    return this.invoicesService.create(dto, user);
  }

  // ── PATCH /erp/invoices/:id ───────────────────────────────────────────
  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @OwnedResource()
  @UseGuards(OwnershipGuard)
  @ApiOperation({ summary: 'Update invoice (UNPAID only, owner/admin)' })
  @ApiResponse({ status: 200, description: 'Invoice updated' })
  @ApiResponse({ status: 422, description: 'Cannot update non-UNPAID invoice' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInvoiceDto,
    @CurrentUser() user: User,
  ) {
    return this.invoicesService.update(id, dto, user);
  }

  // ── DELETE /erp/invoices/:id ──────────────────────────────────────────
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete invoice (ADMIN, UNPAID only)' })
  @ApiResponse({ status: 204, description: 'Invoice deleted' })
  @ApiResponse({ status: 422, description: 'Cannot delete non-UNPAID invoice' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.invoicesService.remove(id, user);
  }

  // ── POST /erp/invoices/:id/mark-paid ─────────────────────────────────
  @Post(':id/mark-paid')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @OwnedResource()
  @UseGuards(OwnershipGuard)
  @ApiOperation({ summary: 'Mark invoice as paid (UNPAID/OVERDUE → PAID)' })
  @ApiResponse({ status: 200, description: 'Invoice marked as paid' })
  @ApiResponse({ status: 422, description: 'Already paid or invalid state' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async markAsPaid(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkPaidDto,
    @CurrentUser() user: User,
  ) {
    return this.invoicesService.markAsPaid(id, dto, user);
  }

  // ── POST /erp/invoices/:id/submit-payment ─────────────────────────────
  // CLIENT submits payment proof — notifies admin/owner; does NOT auto-mark paid.
  @Post(':id/submit-payment')
  @Roles(UserRole.CLIENT)
  @ApiOperation({ summary: 'CLIENT submits payment proof (proofUrl + optional partial amount)' })
  @ApiResponse({ status: 200, description: 'Payment proof submitted' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async submitPaymentProof(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { proofUrl?: string; partialAmount?: number; notes?: string },
    @CurrentUser() user: User,
  ) {
    return this.invoicesService.submitPaymentProof(id, dto, user);
  }

  // ── POST /erp/invoices/recalculate-overdue ────────────────────────────
  @Post('recalculate-overdue')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Manually trigger overdue status recalculation (ADMIN)' })
  @ApiResponse({ status: 200, description: 'Count of newly-overdue invoices' })
  async recalculateOverdue(@CurrentUser() user: User) {
    const count = await this.invoicesService.recalculateOverdueStatus();
    return { updated: count };
  }
}
