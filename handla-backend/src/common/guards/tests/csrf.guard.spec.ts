import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';

import { CsrfGuard, SKIP_CSRF_KEY } from '../csrf.guard';

/**
 * PT-04 regression — CSRF protection via Origin/Referer validation.
 *
 * These tests exercise the guard's ACTUAL request-handling behavior (not merely
 * that a decorator/guard is wired up): approved vs attacker origins, the
 * missing/null-Origin policy, cookie-auth vs Bearer/non-browser callers, safe
 * methods, and the login/logout/refresh/OAuth flows.
 */
describe('CsrfGuard (PT-04)', () => {
  const APPROVED = 'https://handla.tech';
  const ATTACKER = 'https://evil.example.com';

  // Config: production so localhost dev origins are NOT auto-allowed.
  const makeConfig = (extra: Record<string, string> = {}) =>
    ({
      get: (k: string) =>
        ({
          NODE_ENV: 'production',
          'auth.frontendUrl': 'https://handla.tech',
          ...extra,
        } as Record<string, string>)[k],
    } as unknown as ConfigService);

  const makeReflector = (skip = false) =>
    ({ getAllAndOverride: jest.fn().mockReturnValue(skip) } as unknown as Reflector);

  // Build an HTTP ExecutionContext with the given request shape.
  const ctxFor = (req: {
    method: string;
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
  }): ExecutionContext =>
    ({
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({ url: '/api/x', originalUrl: '/api/x', headers: {}, cookies: {}, ...req }),
      }),
      getHandler: () => undefined,
      getClass: () => undefined,
    } as unknown as ExecutionContext);

  const guard = (skip = false, config = makeConfig()) =>
    new CsrfGuard(makeReflector(skip), config);

  const COOKIE = { access_token: 'jwt.abc' };

  // ── Approved origin succeeds ────────────────────────────────────────────────
  it('allows a cookie-auth POST from the approved Handla origin', () => {
    const ctx = ctxFor({ method: 'POST', headers: { origin: APPROVED }, cookies: COOKIE });
    expect(guard().canActivate(ctx)).toBe(true);
  });

  it('allows www.handla.tech (first-party) too', () => {
    const ctx = ctxFor({ method: 'POST', headers: { origin: 'https://www.handla.tech' }, cookies: COOKIE });
    expect(guard().canActivate(ctx)).toBe(true);
  });

  it('allows PATCH and DELETE from the approved origin', () => {
    for (const method of ['PATCH', 'DELETE', 'PUT']) {
      const ctx = ctxFor({ method, headers: { origin: APPROVED }, cookies: COOKIE });
      expect(guard().canActivate(ctx)).toBe(true);
    }
  });

  it('validates via Referer when Origin is absent (approved)', () => {
    const ctx = ctxFor({
      method: 'POST',
      headers: { referer: 'https://handla.tech/dashboard/chat' },
      cookies: COOKIE,
    });
    expect(guard().canActivate(ctx)).toBe(true);
  });

  // ── Attacker / disallowed origins rejected ──────────────────────────────────
  it('rejects a cookie-auth POST from an unapproved (attacker) origin', () => {
    const ctx = ctxFor({ method: 'POST', headers: { origin: ATTACKER }, cookies: COOKIE });
    expect(() => guard().canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('rejects Origin: null for a cookie-auth write (sandboxed iframe / cross-site form)', () => {
    const ctx = ctxFor({ method: 'POST', headers: { origin: 'null' }, cookies: COOKIE });
    expect(() => guard().canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('rejects a cookie-auth write with NO Origin and NO Referer (missing-origin policy)', () => {
    const ctx = ctxFor({ method: 'POST', headers: {}, cookies: COOKIE });
    expect(() => guard().canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('rejects a simple cross-site form POST (attacker origin, cookie present)', () => {
    // A classic CSRF: attacker page auto-submits a form; browser attaches the
    // SameSite=None cookie AND an Origin header of the attacker site.
    const ctx = ctxFor({
      method: 'POST',
      headers: { origin: ATTACKER, 'content-type': 'application/x-www-form-urlencoded' },
      cookies: COOKIE,
    });
    expect(() => guard().canActivate(ctx)).toThrow(ForbiddenException);
  });

  // ── Non-browser / non-cookie callers are exempt ─────────────────────────────
  it('allows a Bearer/API POST with NO auth cookie even without an Origin (server-to-server)', () => {
    const ctx = ctxFor({
      method: 'POST',
      headers: { authorization: 'Bearer server.token' },
      cookies: {},
    });
    expect(guard().canActivate(ctx)).toBe(true);
  });

  it('does NOT block a non-cookie request even from an attacker-looking origin', () => {
    // No auth cookie → cannot be a cookie-riding CSRF → not this guard's concern.
    const ctx = ctxFor({ method: 'POST', headers: { origin: ATTACKER }, cookies: {} });
    expect(guard().canActivate(ctx)).toBe(true);
  });

  // ── Safe methods never blocked (incl. OAuth callback GET) ───────────────────
  it('allows GET/HEAD/OPTIONS regardless of origin (OAuth callback is a GET navigation)', () => {
    for (const method of ['GET', 'HEAD', 'OPTIONS']) {
      const ctx = ctxFor({ method, headers: { origin: ATTACKER }, cookies: COOKIE });
      expect(guard().canActivate(ctx)).toBe(true);
    }
  });

  it('allows the Google OAuth callback (top-level GET, no Origin, cookie may be present)', () => {
    const ctx = ctxFor({ method: 'GET', headers: {}, cookies: { g_oauth_state: 's' } });
    expect(guard().canActivate(ctx)).toBe(true);
  });

  // ── Legitimate auth flows keep working ──────────────────────────────────────
  it('allows login POST from Handla origin BEFORE any auth cookie exists', () => {
    // Login request has no auth cookie yet → exempt by the non-cookie rule,
    // and even with a cookie it carries the approved Origin.
    const ctx = ctxFor({ method: 'POST', headers: { origin: APPROVED }, cookies: {} });
    expect(guard().canActivate(ctx)).toBe(true);
  });

  it('allows logout POST from Handla origin (cookie present, approved origin)', () => {
    const ctx = ctxFor({ method: 'POST', headers: { origin: APPROVED }, cookies: COOKIE });
    expect(guard().canActivate(ctx)).toBe(true);
  });

  it('allows refresh POST from Handla origin (refresh_token cookie present)', () => {
    const ctx = ctxFor({
      method: 'POST',
      headers: { origin: APPROVED },
      cookies: { refresh_token: 'r.abc' },
    });
    expect(guard().canActivate(ctx)).toBe(true);
  });

  it('rejects a refresh POST replayed from an attacker origin', () => {
    const ctx = ctxFor({
      method: 'POST',
      headers: { origin: ATTACKER },
      cookies: { refresh_token: 'r.abc' },
    });
    expect(() => guard().canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('allows a legitimate JSON POST from the Handla frontend', () => {
    const ctx = ctxFor({
      method: 'POST',
      headers: { origin: APPROVED, 'content-type': 'application/json' },
      cookies: COOKIE,
    });
    expect(guard().canActivate(ctx)).toBe(true);
  });

  // ── @SkipCsrf opt-out ───────────────────────────────────────────────────────
  it('honors @SkipCsrf() to bypass the check for a reviewed handler', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(true) } as unknown as Reflector;
    const g = new CsrfGuard(reflector, makeConfig());
    const ctx = ctxFor({ method: 'POST', headers: { origin: ATTACKER }, cookies: COOKIE });
    expect(g.canActivate(ctx)).toBe(true);
    expect((reflector as any).getAllAndOverride).toHaveBeenCalledWith(SKIP_CSRF_KEY, expect.anything());
  });

  // ── Dev vs prod origin policy ───────────────────────────────────────────────
  it('allows localhost dev origins ONLY outside production', () => {
    const devGuard = new CsrfGuard(makeReflector(), makeConfig({ NODE_ENV: 'development' } as any));
    const ctx = ctxFor({ method: 'POST', headers: { origin: 'http://localhost:3000' }, cookies: COOKIE });
    expect(devGuard.canActivate(ctx)).toBe(true);

    const prodGuard = guard(); // production
    const ctxProd = ctxFor({ method: 'POST', headers: { origin: 'http://localhost:3000' }, cookies: COOKIE });
    expect(() => prodGuard.canActivate(ctxProd)).toThrow(ForbiddenException);
  });

  it('honors CSRF_ALLOWED_ORIGINS additions', () => {
    const g = new CsrfGuard(
      makeReflector(),
      makeConfig({ CSRF_ALLOWED_ORIGINS: 'https://app.handla.tech,https://admin.handla.tech' } as any),
    );
    const ctx = ctxFor({ method: 'POST', headers: { origin: 'https://app.handla.tech' }, cookies: COOKIE });
    expect(g.canActivate(ctx)).toBe(true);
  });

  // ── Non-HTTP contexts are ignored ───────────────────────────────────────────
  it('ignores non-HTTP (e.g. WebSocket) execution contexts', () => {
    const wsCtx = { getType: () => 'ws' } as unknown as ExecutionContext;
    expect(guard().canActivate(wsCtx)).toBe(true);
  });
});
