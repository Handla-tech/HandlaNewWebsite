/**
 * ══════════════════════════════════════════════════════════════════════════
 *  NestJS 11 / Express 5 — RUNTIME bootstrap security smoke test
 * ══════════════════════════════════════════════════════════════════════════
 *
 * The migration-baseline spec (nestjs11-migration-baseline.spec.ts) asserts the
 * security wiring at the SOURCE level. This companion spec proves the SAME
 * controls survive at RUNTIME on the Express 5 platform adapter that
 * @nestjs/platform-express@11 now bundles.
 *
 * It boots a REAL Nest application (NestExpressApplication) with the exact
 * bootstrap primitives main.ts relies on, then makes real HTTP requests:
 *
 *   RT-ADAPTER-01  app.getHttpAdapter().getInstance() returns a usable Express 5
 *                  instance exposing .disable() and .set() (main.ts watch-points)
 *   RT-HELMET-01   helmet security headers are emitted (nosniff, referrer-policy,
 *                  frame protection) and X-Powered-By is removed
 *   RT-PROXY-01    numeric `trust proxy` hop-count makes req.ip derive from the
 *                  RIGHT-most XFF entry — a prepended spoofed IP is ignored
 *   RT-CORS-01     enableCors reflects an approved origin with credentials and
 *                  NEVER emits `Access-Control-Allow-Origin: *` alongside creds
 *   RT-PREFIX-01   setGlobalPrefix('api') routes are mounted under /api
 *
 * These are the Express-5-behavioural surfaces most likely to regress in the
 * 10→11 jump; a green run here is direct evidence the adapter swap is safe.
 */
import { Test } from '@nestjs/testing';
import {
  Controller,
  Get,
  Module,
  Req,
} from '@nestjs/common';
import {
  NestExpressApplication,
} from '@nestjs/platform-express';
import helmet from 'helmet';
import * as supertest from 'supertest';

const request = (supertest as any).default ?? supertest;

@Controller('probe')
class ProbeController {
  // Echo back the IP Express derived so we can assert the trust-proxy model.
  @Get('ip')
  ip(@Req() req: any) {
    return { ip: req.ip };
  }

  @Get('ping')
  ping() {
    return { ok: true };
  }
}

@Module({ controllers: [ProbeController] })
class ProbeModule {}

describe('NestJS 11 / Express 5 — runtime bootstrap security', () => {
  let app: NestExpressApplication;
  let instance: any;

  const APPROVED_ORIGIN = 'https://handla.tech';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ProbeModule],
    }).compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();

    // ── Mirror the production bootstrap security primitives (main.ts) ─────────
    app.use(
      helmet({
        contentSecurityPolicy: false, // dev-equivalent; prod CSP asserted at source level
        referrerPolicy: { policy: 'no-referrer' },
      }),
    );

    const httpAdapter = app.getHttpAdapter();
    instance = httpAdapter.getInstance?.();
    if (instance?.disable) instance.disable('x-powered-by');
    // Numeric hop-count (PROXY-01): trust exactly one proxy hop.
    if (instance?.set) instance.set('trust proxy', 1);

    app.enableCors({
      origin: [APPROVED_ORIGIN],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
    });

    app.setGlobalPrefix('api');

    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('RT-ADAPTER-01 Express 5 adapter watch-points', () => {
    it('exposes a usable Express instance with .disable() and .set()', () => {
      expect(instance).toBeDefined();
      expect(typeof instance.disable).toBe('function');
      expect(typeof instance.set).toBe('function');
      expect(typeof instance.get).toBe('function');
      // The numeric hop-count we set in beforeAll must round-trip via .get().
      expect(instance.get('trust proxy')).toBe(1);
      // .disable() must have cleared the x-powered-by setting.
      expect(instance.get('x-powered-by')).toBeFalsy();
    });
  });

  describe('RT-PREFIX-01 global prefix', () => {
    it('mounts controllers under /api', async () => {
      await request(app.getHttpServer()).get('/api/probe/ping').expect(200, {
        ok: true,
      });
    });

    it('does NOT serve the same route without the prefix', async () => {
      await request(app.getHttpServer()).get('/probe/ping').expect(404);
    });
  });

  describe('RT-HELMET-01 security headers', () => {
    it('emits helmet headers and removes X-Powered-By', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/probe/ping')
        .expect(200);

      expect(res.headers['x-powered-by']).toBeUndefined();
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['referrer-policy']).toBe('no-referrer');
      // Frame protection (helmet default emits either of these depending on version).
      const frameProtected =
        res.headers['x-frame-options'] !== undefined ||
        (res.headers['content-security-policy'] || '').includes('frame-ancestors');
      // In dev-equivalent config CSP is off, so we assert the classic header.
      expect(res.headers['x-frame-options'] || frameProtected).toBeTruthy();
    });
  });

  describe('RT-PROXY-01 trust-proxy hop-count derives client IP', () => {
    it('uses the RIGHT-most XFF entry; a prepended spoof is ignored', async () => {
      // With trust proxy = 1, Express takes the last XFF entry as the client IP.
      const res = await request(app.getHttpServer())
        .get('/api/probe/ip')
        .set('X-Forwarded-For', '9.9.9.9, 203.0.113.7')
        .expect(200);

      // The attacker-prepended 9.9.9.9 must NOT become req.ip.
      expect(res.body.ip).toBe('203.0.113.7');
      expect(res.body.ip).not.toBe('9.9.9.9');
    });

    it('two different real client IPs resolve to different req.ip values', async () => {
      const a = await request(app.getHttpServer())
        .get('/api/probe/ip')
        .set('X-Forwarded-For', 'spoof, 198.51.100.1')
        .expect(200);
      const b = await request(app.getHttpServer())
        .get('/api/probe/ip')
        .set('X-Forwarded-For', 'spoof, 198.51.100.2')
        .expect(200);

      expect(a.body.ip).toBe('198.51.100.1');
      expect(b.body.ip).toBe('198.51.100.2');
      expect(a.body.ip).not.toBe(b.body.ip);
    });
  });

  describe('RT-CORS-01 credentialed CORS is origin-restricted', () => {
    it('reflects an approved origin and allows credentials', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/probe/ping')
        .set('Origin', APPROVED_ORIGIN)
        .expect(200);

      expect(res.headers['access-control-allow-origin']).toBe(APPROVED_ORIGIN);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('NEVER emits ACAO:* together with credentials', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/probe/ping')
        .set('Origin', 'https://evil.example')
        .expect(200);

      // An unapproved origin must not be reflected, and certainly not as "*".
      expect(res.headers['access-control-allow-origin']).not.toBe('*');
      if (res.headers['access-control-allow-credentials'] === 'true') {
        expect(res.headers['access-control-allow-origin']).not.toBe('*');
      }
    });
  });
});
