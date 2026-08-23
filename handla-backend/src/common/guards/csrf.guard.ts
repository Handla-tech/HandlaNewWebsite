import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Opt-out marker for the CSRF guard. Apply `@SkipCsrf()` to a handler/controller
 * that must accept cross-origin cookie-authenticated state changes for a
 * deliberate, reviewed reason. Prefer NOT using it — the guard already exempts
 * safe methods, non-cookie (Bearer / server-to-server) auth, and OAuth
 * top-level navigations, so almost nothing legitimate needs this escape hatch.
 */
export const SKIP_CSRF_KEY = 'skipCsrf';
export const SkipCsrf = () => SetMetadata(SKIP_CSRF_KEY, true);

/**
 * PT-04 — CSRF protection via strict Origin/Referer validation.
 *
 * ── Why this is needed ──────────────────────────────────────────────────────
 * Handla authenticates browsers with an httpOnly `access_token` cookie. Because
 * the frontend (`handla.tech`) and the API (`api.handla.tech`) are different
 * sub-origins, that cookie MUST be `SameSite=None; Secure` (verified in
 * AuthController.setCookies) — `Lax`/`Strict` would be dropped on the legitimate
 * cross-site XHR and break login. `SameSite=None` cannot be downgraded without
 * breaking cross-subdomain auth, so it stays.
 *
 * The cost of `SameSite=None` is that the browser also attaches the cookie to
 * cross-site requests initiated by a malicious page — i.e. classic CSRF. CORS
 * does NOT stop this: CORS restricts who may READ the response, not who may SEND
 * a state-changing "simple" request. So we need an explicit CSRF control.
 *
 * ── What this guard does ────────────────────────────────────────────────────
 * For COOKIE-AUTHENTICATED, STATE-CHANGING requests (POST/PUT/PATCH/DELETE) it
 * verifies the request originated from an approved Handla origin, using the
 * forgeable-only-by-the-browser `Origin` header (falling back to `Referer`).
 *
 * ── Deliberate exemptions (so legitimate flows never break) ─────────────────
 *  1. Safe methods (GET/HEAD/OPTIONS) — never state-changing; also lets the
 *     Google OAuth callback (a top-level GET navigation with no Origin) through.
 *  2. Requests NOT authenticated by cookie. If there is no auth cookie the
 *     request cannot be a cookie-riding CSRF: a cross-site attacker cannot set
 *     an `Authorization: Bearer …` header, and server-to-server / API-token
 *     callers use Bearer (or an internal shared secret), never the cookie. This
 *     keeps non-browser trusted integrations working.
 *  3. `@SkipCsrf()` handlers (reviewed, explicit opt-out).
 *
 * ── Missing-Origin policy (explicit, not blanket) ──────────────────────────
 * A cookie-authenticated state-changing request that presents NEITHER a usable
 * `Origin` NOR `Referer` is rejected: real browsers attach `Origin` to
 * cross-site (SameSite=None) sends, so a cookie-auth write with no origin
 * evidence is treated as untrusted. `Origin: null` is likewise rejected
 * (sandboxed iframe / some cross-site form posts). Non-browser callers, which
 * legitimately omit Origin, are already exempt by rule (2) because they do not
 * use the cookie.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly logger = new Logger(CsrfGuard.name);
  private readonly isProd: boolean;
  private readonly allowedOrigins: Set<string>;

  private static readonly PROTECTED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
  // Cookies whose presence means "this request is authenticated by cookie".
  private static readonly AUTH_COOKIES = ['access_token', 'refresh_token'];

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {
    this.isProd = (this.configService.get<string>('NODE_ENV') || 'development') === 'production';
    this.allowedOrigins = this.buildAllowedOrigins();
  }

  /**
   * Build the approved-origin allow-list.
   *   - Production first-party origins are always allowed.
   *   - Additional origins come from CSRF_ALLOWED_ORIGINS (comma-separated) and
   *     FRONTEND_URL / SOCKET_CORS_ORIGIN so the deployed frontend is covered.
   *   - Localhost dev origins are added ONLY outside production.
   */
  private buildAllowedOrigins(): Set<string> {
    const origins = new Set<string>();

    // Genuine first-party production origins.
    const PROD_ORIGINS = ['https://handla.tech', 'https://www.handla.tech'];
    for (const o of PROD_ORIGINS) origins.add(o);

    const addFrom = (raw?: string | null) => {
      if (!raw) return;
      for (const part of raw.split(',')) {
        const norm = this.normalizeOrigin(part.trim());
        if (norm) origins.add(norm);
      }
    };
    addFrom(this.configService.get<string>('CSRF_ALLOWED_ORIGINS'));
    addFrom(this.configService.get<string>('auth.frontendUrl'));
    addFrom(this.configService.get<string>('FRONTEND_URL'));
    addFrom(this.configService.get<string>('SOCKET_CORS_ORIGIN'));

    if (!this.isProd) {
      // Dev convenience: Next.js may pick any local port.
      for (let p = 3000; p <= 3010; p++) origins.add(`http://localhost:${p}`);
    }

    return origins;
  }

  /** Reduce a URL/origin string to its scheme://host[:port] form, or null. */
  private normalizeOrigin(value: string | undefined | null): string | null {
    if (!value) return null;
    if (value === 'null') return null;
    try {
      const u = new URL(value);
      return u.origin;
    } catch {
      return null;
    }
  }

  canActivate(context: ExecutionContext): boolean {
    // Non-HTTP contexts (e.g. WebSocket) are handled by their own transport
    // guards; this guard only applies to HTTP.
    if (context.getType() !== 'http') return true;

    const req = context.switchToHttp().getRequest<Request>();
    const method = (req.method || 'GET').toUpperCase();

    // 1. Safe methods are never state-changing.
    if (!CsrfGuard.PROTECTED_METHODS.has(method)) return true;

    // 3. Explicit, reviewed opt-out.
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    // 2. Only cookie-authenticated requests can be CSRF victims. A request with
    //    no auth cookie cannot be a cookie-riding forgery (an attacker cannot
    //    set Authorization cross-site; server-to-server uses Bearer/secret).
    const cookies = (req.cookies || {}) as Record<string, string>;
    const isCookieAuthed = CsrfGuard.AUTH_COOKIES.some((c) => !!cookies[c]);
    if (!isCookieAuthed) return true;

    // Validate Origin, then Referer as fallback.
    const originHeader = this.headerValue(req.headers['origin']);
    const refererHeader = this.headerValue(req.headers['referer']);

    // Explicit missing-origin policy: a cookie-auth write with no origin
    // evidence at all is untrusted (real browsers send Origin on SameSite=None
    // cross-site sends). `Origin: null` is likewise untrusted.
    const candidate =
      this.normalizeOrigin(originHeader) ?? this.normalizeOrigin(refererHeader);

    if (!candidate) {
      this.logger.warn(
        `CSRF: rejected ${method} ${req.originalUrl || req.url} — missing/invalid Origin & Referer on a cookie-authenticated request (origin=${String(originHeader)})`,
      );
      throw new ForbiddenException('CSRF validation failed: request origin could not be verified');
    }

    if (!this.allowedOrigins.has(candidate)) {
      this.logger.warn(
        `CSRF: rejected ${method} ${req.originalUrl || req.url} — origin ${candidate} is not approved`,
      );
      throw new ForbiddenException('CSRF validation failed: request origin is not allowed');
    }

    return true;
  }

  private headerValue(h: string | string[] | undefined): string | undefined {
    if (Array.isArray(h)) return h[0];
    return h;
  }
}
