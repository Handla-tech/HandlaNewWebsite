import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { UserRole } from '../../common/enums';

/**
 * ANL-2 — AnalyticsController (/api/erp/analytics)
 *
 * Dashboard aggregations for the self-hosted tracker. Back-office only
 * (ADMIN/EMPLOYEE). All endpoints accept ?site, ?from&to (default last 30 days),
 * ?interval and ?limit.
 */
@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
@Controller('erp/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Pageviews, visitors, sessions, bounce rate, views/session' })
  @ApiResponse({ status: 200, description: 'Overview KPIs' })
  overview(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.overview(query);
  }

  @Get('timeseries')
  @ApiOperation({ summary: 'Pageviews / visitors / sessions over time (hour|day|month)' })
  @ApiResponse({ status: 200, description: 'Time-bucketed series' })
  timeseries(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.timeseries(query);
  }

  @Get('top-pages')
  @ApiOperation({ summary: 'Most-viewed paths' })
  @ApiResponse({ status: 200, description: 'Top pages' })
  topPages(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.topPages(query);
  }

  @Get('top-referrers')
  @ApiOperation({ summary: 'Top referrer hosts' })
  @ApiResponse({ status: 200, description: 'Top referrers' })
  topReferrers(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.topReferrers(query);
  }

  @Get('devices')
  @ApiOperation({ summary: 'Device-type breakdown' })
  @ApiResponse({ status: 200, description: 'Devices' })
  devices(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.deviceBreakdown(query);
  }

  @Get('browsers')
  @ApiOperation({ summary: 'Browser breakdown' })
  @ApiResponse({ status: 200, description: 'Browsers' })
  browsers(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.browserBreakdown(query);
  }

  @Get('countries')
  @ApiOperation({ summary: 'Country breakdown (best-effort from Accept-Language)' })
  @ApiResponse({ status: 200, description: 'Countries' })
  countries(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.countryBreakdown(query);
  }

  @Get('top-events')
  @ApiOperation({ summary: 'Top custom events by name' })
  @ApiResponse({ status: 200, description: 'Top events' })
  topEvents(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.topEvents(query);
  }
}
