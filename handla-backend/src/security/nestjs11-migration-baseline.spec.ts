/**
 * ══════════════════════════════════════════════════════════════════════════
 *  NESTJS 11 MIGRATION — SECURITY BASELINE  (pin invariants across the upgrade)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * This suite records the security-relevant architectural invariants that the
 * NestJS 10 → 11 (and Express 4 → 5) migration MUST preserve. It is written to
 * pass on the pre-upgrade baseline and to keep passing after the upgrade — if
 * the framework bump silently changes any of these, the suite fails.
 *
 * It intentionally asserts on SOURCE-LEVEL invariants (route patterns, global
 * guard ordering, validation-pipe options, trust-proxy model) that do not
 * require booting Redis/MySQL, so it is deterministic in CI.
 */
import * as fs from 'fs';
import * as path from 'path';

const SRC = path.join(__dirname, '..');

function read(rel: string): string {
  return fs.readFileSync(path.join(SRC, rel), 'utf8');
}

/** Recursively collect every .ts controller/source file under src. */
function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) acc.push(full);
  }
  return acc;
}

describe('NestJS 11 migration — security baseline invariants', () => {
  // ── Express 5 routing: no incompatible route patterns ─────────────────────
  describe('Express 5 route-pattern compatibility', () => {
    const allSrc = walk(SRC);

    // Express 5 / path-to-regexp v6+ dropped: bare "*" wildcards, unnamed
    // wildcards, and ":param?" optional params in favour of "{*name}" / "{:p}".
    // Handla must use ONLY named params (":id") and static segments.
    const ROUTE_DECORATOR =
      /@(Get|Post|Put|Patch|Delete|All|Options|Head|Search)\(\s*(['"`])([^'"`]*)\2/g;

    it('no controller route uses a bare/unnamed wildcard, optional param, or inline regex', () => {
      const offenders: string[] = [];
      for (const file of allSrc) {
        const content = fs.readFileSync(file, 'utf8');
        let m: RegExpExecArray | null;
        while ((m = ROUTE_DECORATOR.exec(content)) !== null) {
          const pattern = m[3];
          // Disallowed in Express 5 without the new brace syntax:
          //   *  (bare wildcard)   ?  (optional)   (  )  [ ]  +  (regex-ish)
          if (/[*?()+\[\]]/.test(pattern)) {
            offenders.push(`${path.relative(SRC, file)} → "${pattern}"`);
          }
        }
      }
      expect(offenders).toEqual([]);
    });
  });

  // ── No custom Express middleware via MiddlewareConsumer ───────────────────
  describe('middleware model', () => {
    it('does not rely on MiddlewareConsumer.forRoutes/exclude route strings', () => {
      // All cross-cutting concerns are global guards/interceptors/filters
      // (framework-level), which are unaffected by Express 5 route matching.
      const offenders: string[] = [];
      for (const file of walk(SRC)) {
        const content = fs.readFileSync(file, 'utf8');
        if (/implements\s+NestMiddleware|MiddlewareConsumer/.test(content)) {
          offenders.push(path.relative(SRC, file));
        }
      }
      expect(offenders).toEqual([]);
    });
  });

  // ── Global guard ordering (PT-04 depends on CSRF running first) ───────────
  describe('global guard ordering (main.ts)', () => {
    const main = read('main.ts');

    it('registers guards in the exact order Csrf → Jwt → Roles → Ownership', () => {
      const order = ['CsrfGuard', 'JwtAuthGuard', 'RolesGuard', 'OwnershipGuard'];
      const idx = order.map((g) => main.indexOf(`new ${g}(`));
      // all present
      idx.forEach((i, n) => expect(i).toBeGreaterThan(-1) /* ${order[n]} present */);
      // strictly increasing (CSRF first)
      for (let i = 1; i < idx.length; i++) {
        expect(idx[i]).toBeGreaterThan(idx[i - 1]);
      }
    });

    it('keeps the numeric trust-proxy (hop-count) anti-spoof model (PROXY-01)', () => {
      expect(main).toContain("instance.set('trust proxy'");
      expect(main).toContain('TRUST_PROXY_HOPS');
      // Must NOT flip to the unsafe "trust proxy = true" blanket trust.
      expect(main).not.toMatch(/trust proxy'\s*,\s*true/);
    });

    it('mounts Swagger only outside production', () => {
      expect(main).toMatch(/nodeEnv\s*!==\s*'production'[\s\S]*SwaggerModule\.setup/);
    });

    it('disables the x-powered-by fingerprint header', () => {
      expect(main).toContain("disable('x-powered-by')");
    });
  });

  // ── ValidationPipe mass-assignment protections ────────────────────────────
  describe('global ValidationPipe (mass-assignment protection)', () => {
    const pipe = read('common/pipes/validation.pipe.ts');
    it('keeps whitelist + forbidNonWhitelisted + transform', () => {
      expect(pipe).toContain('whitelist: true');
      expect(pipe).toContain('forbidNonWhitelisted: true');
      expect(pipe).toContain('transform: true');
    });
  });

  // ── Throttler config uses the modern (v5/v6) throttlers[] array API ───────
  describe('throttler configuration', () => {
    const appModule = read('app.module.ts');
    it('uses throttlers[] array form compatible with @nestjs/throttler v6', () => {
      expect(appModule).toContain('throttlers: [');
      expect(appModule).toContain('ThrottlerGuard');
      expect(appModule).toContain('APP_GUARD');
    });
  });

  // ── Exception filter production 5xx masking ───────────────────────────────
  describe('AllExceptionsFilter', () => {
    const filter = read('common/filters/http-exception.filter.ts');
    it('masks 5xx detail in production (no stack/SQL/secret leakage)', () => {
      expect(filter).toContain("'Internal server error'");
      expect(filter).toMatch(/isProd\s*&&\s*status\s*>=\s*HttpStatus\.INTERNAL_SERVER_ERROR/);
    });
  });
});
