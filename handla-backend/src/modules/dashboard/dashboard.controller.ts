import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { DashboardService, DashboardStats, FinancialChartMonth } from './dashboard.service';
import { Roles }       from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard }   from '../../common/guards/roles.guard';
import { UserRole }     from '../../common/enums';
import { User }         from '../auth/entities/user.entity';

@ApiTags('erp-dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('erp/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  // ── GET /api/erp/dashboard/stats ──────────────────────────────────────────

  @Get('stats')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Get role-aware ERP dashboard stats' })
  @ApiResponse({ status: 200, description: 'Aggregated dashboard statistics' })
  async getStats(@CurrentUser() user: User): Promise<DashboardStats> {
    return this.dashboardService.getStats(user);
  }

  // ── GET /api/erp/dashboard/financial-chart ────────────────────────────────

  @Get('financial-chart')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Get last 6 months income vs expenses for chart' })
  @ApiResponse({ status: 200, description: 'Monthly financial chart data' })
  async getFinancialChart(@CurrentUser() user: User): Promise<FinancialChartMonth[]> {
    return this.dashboardService.getFinancialChart(user);
  }
}
