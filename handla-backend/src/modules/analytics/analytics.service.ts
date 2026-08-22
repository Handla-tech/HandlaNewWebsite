import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { createHash } from 'crypto';

import { AnalyticsEvent } from './entities/analytics-event.entity';
import { AnalyticsEventType } from '../../common/enums';
import { CollectEventDto } from './dto/collect-event.dto';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

export interface CollectContext {
  ip?: string;
  userAgent?: string;
  acceptLanguage?: string;
}

/** Daily-rotating salt so visitor hashes cannot be correlated across days (privacy). */
function daySalt(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(AnalyticsEvent)
    private readonly eventRepo: Repository<AnalyticsEvent>,
  ) {}

  // ════════════════════════════════════════════════════════════════════════════
  //  Ingest
  // ════════════════════════════════════════════════════════════════════════════
  async record(dto: CollectEventDto, ctx: CollectContext): Promise<{ ok: true }> {
    const ua = ctx.userAgent ?? '';
    const path = this.normalizePath(dto.url);
    const referrerHost = this.parseHost(dto.referrer);
    const device = this.deviceType(ua, dto.screenWidth);
    const { browser, os } = this.parseUa(ua);
    const language = (dto.language ?? ctx.acceptLanguage ?? '').slice(0, 10) || null;
    const country = this.deriveCountry(ctx.acceptLanguage);

    // Anonymous, rotating visitor hash: sha256(ip + ua + site + daySalt).
    const visitorId = createHash('sha256')
      .update(`${ctx.ip ?? ''}|${ua}|${dto.site ?? 'default'}|${daySalt()}`)
      .digest('hex')
      .slice(0, 32);
    // Session hash rotates the same day but is coarser (30-min windows).
    const halfHour = Math.floor(Date.now() / (30 * 60_000));
    const sessionId = createHash('sha256')
      .update(`${visitorId}|${halfHour}`)
      .digest('hex')
      .slice(0, 32);

    const event = this.eventRepo.create({
      site: (dto.site ?? 'default').slice(0, 100),
      type: dto.type ?? AnalyticsEventType.PAGEVIEW,
      eventName: dto.type === AnalyticsEventType.EVENT ? dto.eventName ?? null : null,
      url: dto.url ?? null,
      path,
      referrer: dto.referrer ?? null,
      referrerHost,
      title: dto.title ?? null,
      visitorId,
      sessionId,
      deviceType: device,
      browser,
      os,
      country,
      language,
      meta: dto.meta ?? null,
    });
    await this.eventRepo.save(event);
    return { ok: true };
  }

  // ─── parsing helpers ─────────────────────────────────────────────────────────
  normalizePath(url?: string | null): string | null {
    if (!url) return null;
    try {
      const u = new URL(url);
      return u.pathname || '/';
    } catch {
      // Not an absolute URL — treat as a bare path, strip query/hash.
      return url.split('?')[0].split('#')[0] || '/';
    }
  }

  parseHost(referrer?: string | null): string | null {
    if (!referrer) return 'direct';
    try {
      return new URL(referrer).hostname || 'direct';
    } catch {
      return 'direct';
    }
  }

  deviceType(ua: string, screenWidth?: number): string {
    const s = ua.toLowerCase();
    if (/ipad|tablet|playbook|silk/.test(s)) return 'tablet';
    if (/mobi|iphone|android.*mobile|phone/.test(s)) return 'mobile';
    if (typeof screenWidth === 'number' && screenWidth > 0) {
      if (screenWidth < 768) return 'mobile';
      if (screenWidth < 1024) return 'tablet';
    }
    return 'desktop';
  }

  parseUa(ua: string): { browser: string | null; os: string | null } {
    const s = ua.toLowerCase();
    let browser: string | null = null;
    if (s.includes('edg/')) browser = 'Edge';
    else if (s.includes('opr/') || s.includes('opera')) browser = 'Opera';
    else if (s.includes('chrome/')) browser = 'Chrome';
    else if (s.includes('firefox/')) browser = 'Firefox';
    else if (s.includes('safari/')) browser = 'Safari';

    let os: string | null = null;
    if (s.includes('windows')) os = 'Windows';
    else if (s.includes('mac os') || s.includes('macintosh')) os = 'macOS';
    else if (s.includes('android')) os = 'Android';
    else if (s.includes('iphone') || s.includes('ipad') || s.includes('ios')) os = 'iOS';
    else if (s.includes('linux')) os = 'Linux';

    return { browser, os };
  }

  /** Best-effort country from the Accept-Language region subtag (no GeoIP dep). */
  deriveCountry(acceptLanguage?: string): string | null {
    if (!acceptLanguage) return null;
    const first = acceptLanguage.split(',')[0]?.trim();
    const region = first?.split('-')[1];
    return region ? region.slice(0, 2).toUpperCase() : null;
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  Dashboard aggregations
  // ════════════════════════════════════════════════════════════════════════════
  private resolveRange(query: AnalyticsQueryDto): { from: Date; to: Date } {
    const to = query.to ? new Date(`${query.to}T23:59:59`) : new Date();
    const from = query.from
      ? new Date(`${query.from}T00:00:00`)
      : new Date(to.getTime() - 30 * 86_400_000);
    return { from, to };
  }

  private baseWhere(query: AnalyticsQueryDto): Record<string, any> {
    const { from, to } = this.resolveRange(query);
    const where: Record<string, any> = { createdAt: Between(from, to) };
    if (query.site) where.site = query.site;
    return where;
  }

  async overview(query: AnalyticsQueryDto): Promise<any> {
    const { from, to } = this.resolveRange(query);
    const qb = this.eventRepo
      .createQueryBuilder('e')
      .where('e.created_at BETWEEN :from AND :to', { from, to });
    if (query.site) qb.andWhere('e.site = :site', { site: query.site });

    const pageviews = await qb
      .clone()
      .andWhere('e.type = :t', { t: AnalyticsEventType.PAGEVIEW })
      .getCount();
    const events = await qb
      .clone()
      .andWhere('e.type = :t', { t: AnalyticsEventType.EVENT })
      .getCount();

    const uniqueVisitorsRow = await qb
      .clone()
      .select('COUNT(DISTINCT e.visitor_id)', 'n')
      .getRawOne<{ n: string }>();
    const sessionsRow = await qb
      .clone()
      .select('COUNT(DISTINCT e.session_id)', 'n')
      .getRawOne<{ n: string }>();

    const uniqueVisitors = parseInt(uniqueVisitorsRow?.n ?? '0', 10) || 0;
    const sessions = parseInt(sessionsRow?.n ?? '0', 10) || 0;

    // Bounce rate: sessions with exactly one pageview.
    const singleViewRow = await this.eventRepo
      .createQueryBuilder('e')
      .select('e.session_id', 'sid')
      .where('e.created_at BETWEEN :from AND :to', { from, to })
      .andWhere('e.type = :t', { t: AnalyticsEventType.PAGEVIEW })
      .andWhere(query.site ? 'e.site = :site' : '1=1', query.site ? { site: query.site } : {})
      .groupBy('e.session_id')
      .having('COUNT(e.id) = 1')
      .getRawMany();
    const bounces = singleViewRow.length;
    const bounceRate = sessions > 0 ? Math.round((bounces / sessions) * 1000) / 10 : 0;
    const viewsPerSession = sessions > 0 ? Math.round((pageviews / sessions) * 100) / 100 : 0;

    return {
      report: 'overview',
      range: { from, to },
      site: query.site ?? null,
      pageviews,
      events,
      uniqueVisitors,
      sessions,
      bounceRate,
      viewsPerSession,
    };
  }

  async timeseries(query: AnalyticsQueryDto): Promise<any> {
    const { from, to } = this.resolveRange(query);
    const interval = query.interval ?? 'day';
    const fmt =
      interval === 'hour' ? '%Y-%m-%d %H:00' : interval === 'month' ? '%Y-%m' : '%Y-%m-%d';

    const qb = this.eventRepo
      .createQueryBuilder('e')
      .select(`DATE_FORMAT(e.created_at, '${fmt}')`, 'bucket')
      .addSelect('COUNT(CASE WHEN e.type = :pv THEN 1 END)', 'pageviews')
      .addSelect('COUNT(DISTINCT e.visitor_id)', 'visitors')
      .addSelect('COUNT(DISTINCT e.session_id)', 'sessions')
      .where('e.created_at BETWEEN :from AND :to', { from, to })
      .setParameter('pv', AnalyticsEventType.PAGEVIEW)
      .groupBy('bucket')
      .orderBy('bucket', 'ASC');
    if (query.site) qb.andWhere('e.site = :site', { site: query.site });

    const rows = await qb.getRawMany<{
      bucket: string;
      pageviews: string;
      visitors: string;
      sessions: string;
    }>();

    return {
      report: 'timeseries',
      interval,
      range: { from, to },
      series: rows.map((r) => ({
        bucket: r.bucket,
        pageviews: parseInt(r.pageviews, 10) || 0,
        visitors: parseInt(r.visitors, 10) || 0,
        sessions: parseInt(r.sessions, 10) || 0,
      })),
    };
  }

  /**
   * Columns that topBy() is allowed to group by. This is a strict allow-list
   * of known, safe entity column names. Even though every current caller
   * passes a hard-coded literal, `column` is interpolated straight into the
   * SQL (TypeORM cannot parameterize identifiers), so validating it here is a
   * defence-in-depth guard against a future caller accidentally forwarding
   * user input and opening a SQL-injection hole.
   */
  private static readonly TOP_BY_COLUMNS = new Set<string>([
    'path',
    'referrer_host',
    'device_type',
    'browser',
    'country',
    'event_name',
  ]);

  /** Generic "top N by a dimension" helper. */
  private async topBy(
    query: AnalyticsQueryDto,
    column: string,
    label: string,
    onlyPageviews = true,
  ): Promise<any> {
    if (!AnalyticsService.TOP_BY_COLUMNS.has(column)) {
      // Never interpolate an unrecognised identifier into SQL.
      throw new Error(`topBy: disallowed column "${column}"`);
    }
    const { from, to } = this.resolveRange(query);
    const qb = this.eventRepo
      .createQueryBuilder('e')
      .select(`e.${column}`, 'key')
      .addSelect('COUNT(e.id)', 'count')
      .addSelect('COUNT(DISTINCT e.visitor_id)', 'visitors')
      .where('e.created_at BETWEEN :from AND :to', { from, to })
      .andWhere(`e.${column} IS NOT NULL`)
      .groupBy(`e.${column}`)
      .orderBy('count', 'DESC')
      .limit(query.limit ?? 10);
    if (onlyPageviews) qb.andWhere('e.type = :t', { t: AnalyticsEventType.PAGEVIEW });
    if (query.site) qb.andWhere('e.site = :site', { site: query.site });

    const rows = await qb.getRawMany<{ key: string; count: string; visitors: string }>();
    return {
      report: label,
      range: { from, to },
      rows: rows.map((r) => ({
        key: r.key,
        count: parseInt(r.count, 10) || 0,
        visitors: parseInt(r.visitors, 10) || 0,
      })),
    };
  }

  topPages(query: AnalyticsQueryDto) {
    return this.topBy(query, 'path', 'top_pages', true);
  }

  topReferrers(query: AnalyticsQueryDto) {
    return this.topBy(query, 'referrer_host', 'top_referrers', true);
  }

  deviceBreakdown(query: AnalyticsQueryDto) {
    return this.topBy(query, 'device_type', 'devices', true);
  }

  browserBreakdown(query: AnalyticsQueryDto) {
    return this.topBy(query, 'browser', 'browsers', true);
  }

  countryBreakdown(query: AnalyticsQueryDto) {
    return this.topBy(query, 'country', 'countries', true);
  }

  /** Top custom events (type=EVENT) by name. */
  topEvents(query: AnalyticsQueryDto) {
    return this.topBy(query, 'event_name', 'top_events', false);
  }
}
