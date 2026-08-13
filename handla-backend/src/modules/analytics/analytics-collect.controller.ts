import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';

import { AnalyticsService } from './analytics.service';
import { CollectEventDto } from './dto/collect-event.dto';
import { Public } from '../../common/guards/jwt.guard';

/**
 * ANL-1 — AnalyticsCollectController (/api/analytics)
 *
 * Public ingest for the self-hosted tracking script. No auth (`@Public()`):
 * hits come from arbitrary visitors' browsers. The server derives the visitor
 * hash, device, referrer host, and coarse country from the request — the client
 * cannot set those.
 *
 * NOTE: cross-origin beacons require the tracked origin to be permitted by the
 * app-level CORS config (SOCKET_CORS_ORIGIN). Same-origin embedding works out
 * of the box.
 */
@ApiTags('analytics-collect')
@Controller('analytics')
export class AnalyticsCollectController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('collect')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Ingest a pageview / custom event from the tracking script' })
  @ApiResponse({ status: 204, description: 'Event recorded (no body)' })
  async collect(@Body() dto: CollectEventDto, @Req() req: Request): Promise<void> {
    await this.analyticsService.record(dto, {
      ip: this.clientIp(req),
      userAgent: req.headers['user-agent'],
      acceptLanguage: req.headers['accept-language'],
    });
  }

  // GET pixel fallback for environments that block POST beacons.
  @Get('collect')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Pixel/GET fallback ingest (query params mirror the POST body)' })
  @ApiResponse({ status: 204, description: 'Event recorded (no body)' })
  async collectGet(@Body() _body: unknown, @Req() req: Request): Promise<void> {
    const q = req.query as Record<string, string>;
    await this.analyticsService.record(
      {
        site: q.site,
        type: q.type as any,
        eventName: q.eventName,
        url: q.url,
        referrer: q.referrer,
        title: q.title,
        language: q.language,
        screenWidth: q.screenWidth ? Number(q.screenWidth) : undefined,
      },
      {
        ip: this.clientIp(req),
        userAgent: req.headers['user-agent'],
        acceptLanguage: req.headers['accept-language'],
      },
    );
  }

  private clientIp(req: Request): string | undefined {
    const fwd = req.headers['x-forwarded-for'];
    if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
    if (Array.isArray(fwd) && fwd.length) return fwd[0];
    return req.ip || req.socket?.remoteAddress || undefined;
  }
}
