import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { ReportsService } from './reports.service';
import { ReportQueryDto } from './dto/report-query.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { UserRole } from '../../common/enums';

/**
 * REP — ReportsController (/erp/reports)
 *
 * Read-only financial + operational reports. Back-office only (ADMIN/EMPLOYEE).
 * All endpoints accept an optional ?from&to date range (defaults to the current
 * calendar year), ?clientId filter, and ?groupBy for periodized series.
 */
@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
@Controller('erp/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // ─── Financial ───────────────────────────────────────────────────────

  @Get('profit-loss')
  @ApiOperation({ summary: 'Profit & Loss (income vs expense from the ledger)' })
  @ApiResponse({ status: 200, description: 'P&L grouped by currency' })
  profitLoss(@Query() query: ReportQueryDto) {
    return this.reportsService.profitAndLoss(query);
  }

  @Get('cash-flow')
  @ApiOperation({ summary: 'Cash flow (ledger inflow vs outflow, periodized)' })
  @ApiResponse({ status: 200, description: 'Cash-flow series + totals by currency' })
  cashFlow(@Query() query: ReportQueryDto) {
    return this.reportsService.cashFlow(query);
  }

  @Get('tax-summary')
  @ApiOperation({ summary: 'Tax summary (output tax on invoices vs input tax on purchases)' })
  @ApiResponse({ status: 200, description: 'Tax payable grouped by currency' })
  taxSummary(@Query() query: ReportQueryDto) {
    return this.reportsService.taxSummary(query);
  }

  @Get('ar-aging')
  @ApiOperation({ summary: 'Accounts Receivable aging (unpaid/overdue invoices)' })
  @ApiResponse({ status: 200, description: 'AR buckets + detail by currency' })
  arAging(@Query() query: ReportQueryDto) {
    return this.reportsService.arAging(query);
  }

  @Get('ap-aging')
  @ApiOperation({ summary: 'Accounts Payable aging (unpaid/overdue purchases)' })
  @ApiResponse({ status: 200, description: 'AP buckets + detail by currency' })
  apAging(@Query() query: ReportQueryDto) {
    return this.reportsService.apAging(query);
  }

  // ─── Operational ──────────────────────────────────────────────────────

  @Get('revenue-by-client')
  @ApiOperation({ summary: 'Revenue by client (paid invoices in range)' })
  @ApiResponse({ status: 200, description: 'Revenue rows per client + currency' })
  revenueByClient(@Query() query: ReportQueryDto) {
    return this.reportsService.revenueByClient(query);
  }

  @Get('projects-status')
  @ApiOperation({ summary: 'Projects grouped by status' })
  @ApiResponse({ status: 200, description: 'Project counts by status' })
  projectsStatus(@Query() query: ReportQueryDto) {
    return this.reportsService.projectsStatus(query);
  }

  @Get('support-stats')
  @ApiOperation({ summary: 'Support ticket statistics (volume, SLA, resolution time)' })
  @ApiResponse({ status: 200, description: 'Ticket stats for the range' })
  supportStats(@Query() query: ReportQueryDto) {
    return this.reportsService.supportStats(query);
  }
}
