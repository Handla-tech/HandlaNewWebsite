import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AnalyticsEvent } from './entities/analytics-event.entity';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsCollectController } from './analytics-collect.controller';

/**
 * ANL — AnalyticsModule
 *
 * Self-hosted, GA-style tracker: a public collect endpoint (/api/analytics/
 * collect) that the tracking script beacons to, plus back-office dashboard
 * aggregations (/api/erp/analytics/*). Self-contained — no cross-module deps.
 */
@Module({
  imports: [TypeOrmModule.forFeature([AnalyticsEvent])],
  controllers: [AnalyticsController, AnalyticsCollectController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
