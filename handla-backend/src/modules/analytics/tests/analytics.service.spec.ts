import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AnalyticsService } from '../analytics.service';
import { AnalyticsEvent } from '../entities/analytics-event.entity';
import { AnalyticsEventType } from '../../../common/enums';

function buildQb(overrides: Record<string, any> = {}) {
  const qb: any = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    having: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    clone: jest.fn(),
    getCount: jest.fn().mockResolvedValue(0),
    getRawOne: jest.fn().mockResolvedValue({ n: '0' }),
    getRawMany: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
  qb.clone.mockReturnValue(qb);
  return qb;
}

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let repo: any;

  beforeEach(async () => {
    repo = {
      create: jest.fn((x) => x),
      save: jest.fn((x) => Promise.resolve({ id: 'e-1', ...x })),
      createQueryBuilder: jest.fn(() => buildQb()),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getRepositoryToken(AnalyticsEvent), useValue: repo },
      ],
    }).compile();
    service = module.get(AnalyticsService);
  });

  describe('normalizePath', () => {
    it('extracts pathname from an absolute URL', () => {
      expect(service.normalizePath('https://x.com/pricing?ref=a#top')).toBe('/pricing');
    });
    it('strips query/hash from a bare path', () => {
      expect(service.normalizePath('/blog/post?x=1#h')).toBe('/blog/post');
    });
    it('returns null for empty', () => {
      expect(service.normalizePath(null)).toBeNull();
    });
  });

  describe('parseHost', () => {
    it('returns the referrer hostname', () => {
      expect(service.parseHost('https://www.google.com/search')).toBe('www.google.com');
    });
    it('returns "direct" when no referrer', () => {
      expect(service.parseHost(null)).toBe('direct');
      expect(service.parseHost('not-a-url')).toBe('direct');
    });
  });

  describe('deviceType', () => {
    it('detects mobile from UA', () => {
      expect(service.deviceType('Mozilla/5.0 (iPhone; CPU iPhone OS) Mobile/15E148')).toBe('mobile');
    });
    it('detects tablet from UA', () => {
      expect(service.deviceType('Mozilla/5.0 (iPad; CPU OS 13_2 like Mac OS X)')).toBe('tablet');
    });
    it('falls back to screen width', () => {
      expect(service.deviceType('', 500)).toBe('mobile');
      expect(service.deviceType('', 800)).toBe('tablet');
      expect(service.deviceType('', 1500)).toBe('desktop');
    });
  });

  describe('parseUa', () => {
    it('detects Chrome on Windows', () => {
      const r = service.parseUa(
        'mozilla/5.0 (windows nt 10.0) applewebkit/537.36 chrome/120.0 safari/537.36',
      );
      expect(r.browser).toBe('Chrome');
      expect(r.os).toBe('Windows');
    });
    it('detects Edge over Chrome', () => {
      const r = service.parseUa('chrome/120 edg/120');
      expect(r.browser).toBe('Edge');
    });
  });

  describe('deriveCountry', () => {
    it('extracts region subtag', () => {
      expect(service.deriveCountry('en-US,en;q=0.9')).toBe('US');
    });
    it('returns null with no region', () => {
      expect(service.deriveCountry('en')).toBeNull();
      expect(service.deriveCountry(undefined)).toBeNull();
    });
  });

  describe('record', () => {
    it('derives path/host/device/visitor and persists a pageview', async () => {
      await service.record(
        {
          site: 'marketing',
          type: AnalyticsEventType.PAGEVIEW,
          url: 'https://handla.tech/pricing?utm=x',
          referrer: 'https://www.google.com/',
        },
        { ip: '1.2.3.4', userAgent: 'iPhone Mobile', acceptLanguage: 'en-US,en' },
      );
      const saved = repo.create.mock.calls[0][0];
      expect(saved.path).toBe('/pricing');
      expect(saved.referrerHost).toBe('www.google.com');
      expect(saved.deviceType).toBe('mobile');
      expect(saved.country).toBe('US');
      expect(saved.visitorId).toHaveLength(32);
      expect(saved.sessionId).toHaveLength(32);
      expect(saved.eventName).toBeNull();
      expect(repo.save).toHaveBeenCalled();
    });

    it('keeps eventName only for EVENT type', async () => {
      await service.record(
        { type: AnalyticsEventType.EVENT, eventName: 'signup', url: '/x' },
        { ip: '9.9.9.9', userAgent: 'desktop' },
      );
      const saved = repo.create.mock.calls[0][0];
      expect(saved.type).toBe(AnalyticsEventType.EVENT);
      expect(saved.eventName).toBe('signup');
    });

    it('gives the same visitor hash for identical ip+ua+site within a day', async () => {
      const ctx = { ip: '5.5.5.5', userAgent: 'ua-x' };
      await service.record({ site: 's', url: '/a' }, ctx);
      await service.record({ site: 's', url: '/b' }, ctx);
      const v1 = repo.create.mock.calls[0][0].visitorId;
      const v2 = repo.create.mock.calls[1][0].visitorId;
      expect(v1).toBe(v2);
    });
  });

  describe('overview', () => {
    it('computes bounce rate and views/session from counts', async () => {
      // pageviews=10, events=2, visitors=4, sessions=5, singleViewSessions=2
      const qb = buildQb();
      qb.getCount = jest.fn().mockResolvedValueOnce(10).mockResolvedValueOnce(2);
      qb.getRawOne = jest
        .fn()
        .mockResolvedValueOnce({ n: '4' }) // unique visitors
        .mockResolvedValueOnce({ n: '5' }); // sessions
      // the bounce query is a separate createQueryBuilder call
      repo.createQueryBuilder
        .mockReturnValueOnce(qb) // main qb
        .mockReturnValueOnce(buildQb({ getRawMany: jest.fn().mockResolvedValue([{ sid: 'a' }, { sid: 'b' }]) }));

      const result = await service.overview({});
      expect(result.pageviews).toBe(10);
      expect(result.events).toBe(2);
      expect(result.uniqueVisitors).toBe(4);
      expect(result.sessions).toBe(5);
      expect(result.bounceRate).toBe(40); // 2/5
      expect(result.viewsPerSession).toBe(2); // 10/5
    });
  });

  describe('topPages', () => {
    it('maps grouped rows', async () => {
      repo.createQueryBuilder.mockReturnValue(
        buildQb({
          getRawMany: jest.fn().mockResolvedValue([
            { key: '/', count: '100', visitors: '40' },
            { key: '/pricing', count: '30', visitors: '20' },
          ]),
        }),
      );
      const result = await service.topPages({});
      expect(result.report).toBe('top_pages');
      expect(result.rows[0]).toEqual({ key: '/', count: 100, visitors: 40 });
    });
  });

  describe('timeseries', () => {
    it('returns bucketed counts', async () => {
      repo.createQueryBuilder.mockReturnValue(
        buildQb({
          getRawMany: jest.fn().mockResolvedValue([
            { bucket: '2026-01-01', pageviews: '5', visitors: '3', sessions: '4' },
          ]),
        }),
      );
      const result = await service.timeseries({ interval: 'day' });
      expect(result.interval).toBe('day');
      expect(result.series[0]).toEqual({
        bucket: '2026-01-01',
        pageviews: 5,
        visitors: 3,
        sessions: 4,
      });
    });
  });
});
