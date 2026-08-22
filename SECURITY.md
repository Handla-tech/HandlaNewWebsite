# Handla — Security Overview & Audit

_Last reviewed: 2026-08-22_

This document records the security posture of the Handla platform, the results
of a full code + dependency audit, the hardening applied, and the remaining
recommendations. It is meant to be kept up to date as the platform evolves.

---

## 1. What is already in place (verified)

The platform was found to have a strong, defence-in-depth security baseline.
The following controls were confirmed by reading the code, not assumed:

### Application / API (NestJS — `handla-backend`)
- **Global authentication.** `JwtAuthGuard` is registered as a global guard;
  every route is protected by default and must explicitly opt out with
  `@Public()`. JWTs are read from an **httpOnly cookie** first (not
  `localStorage`), which removes the token from the reach of XSS.
- **Role + ownership authorization.** `RolesGuard` (`@Roles(...)`) and
  `OwnershipGuard` (`@OwnedResource()`) enforce ADMIN / EMPLOYEE / CLIENT / LEAD
  boundaries, with a service-layer ownership backstop.
- **Strict input validation.** The global `ValidationPipe` runs with
  `whitelist: true` + `forbidNonWhitelisted: true`, so unknown properties are
  rejected — this closes **mass-assignment** attacks. All request bodies are
  typed DTOs with `class-validator` decorators.
- **Password security.** Passwords hashed with **bcrypt, cost factor 12**
  (OWASP baseline), centralised in `security.constants.ts`.
- **No user enumeration.** Login returns a single generic
  `InvalidCredentialsException` whether the email or the password is wrong.
- **Email-verified OTP flow + Google OAuth** with an anti-CSRF `state` cookie.
  The user row is only created after the OTP is confirmed.
- **Rate limiting.** Global `ThrottlerModule` + tight per-endpoint
  `@Throttle()` limits on the auth routes (e.g. 5 login attempts / minute).
- **HTTP hardening (helmet).** In production: Content-Security-Policy,
  HSTS (1 year, includeSubDomains, preload), `frameAncestors 'none'`
  (clickjacking), `objectSrc 'none'`, `referrerPolicy: no-referrer`,
  `x-powered-by` disabled.
- **CORS allow-list** (credentialed) — explicit origin in production, localhost
  range only in development.
- **Body-size limit** (1 MB default) to blunt large-payload DoS.
- **No secret / stack-trace leakage.** `AllExceptionsFilter` logs the full
  error server-side but returns a generic `Internal server error` for any 5xx
  in production, and never echoes ORM/driver text or the machine-readable error
  taxonomy for server faults.
- **Fail-fast on insecure config.** In production the app **refuses to boot** if
  `JWT_SECRET` / `JWT_REFRESH_SECRET` are missing, still the dev fallback, or
  shorter than 32 characters.
- **SQL injection.** All data access goes through TypeORM with **parameterized
  queries / bound parameters**. The single raw `.query()` in the codebase is
  parameterized (`?` placeholders).
- **Safe file uploads.** Avatar/image uploads use S3 **presigned URLs** whose
  `contentType` is constrained by a DTO regex to `image/(jpeg|png|webp|gif)` —
  a presigned URL cannot be used to upload HTML/scripts/executables.

### Secrets / repo hygiene
- No `.env`, private keys, or credentials are committed. `.gitignore` covers
  `.env*` (only `*.env.example` templates are tracked).
- No hardcoded AWS keys, private keys, or inline passwords in source.

---

## 2. Hardening applied in this pass

| # | Area | Change |
|---|------|--------|
| 1 | **Session invalidation** | `JwtStrategy.validate()` now rejects `isDisabled` / `isArchived` users on **every request**, not just at login. Previously a disabled user kept access until their existing access token expired. Disable/archive now takes effect immediately. |
| 2 | **SQL injection (latent)** | `AnalyticsService.topBy()` interpolates a column name into SQL (identifiers can't be parameterized). All current callers pass hard-coded literals, but the method now validates `column` against a strict allow-list (`TOP_BY_COLUMNS`) so a future caller can never forward user input into the query. |
| 3 | **Dependencies** | Ran non-breaking `npm audit fix` on both apps. Backend 45 → 41 findings; frontend 14 → 5 findings. All changes are lock-file only (no semver-major bumps), so no behavioural change. |

---

## 3. Remaining recommendations (require testing / decisions)

These were intentionally **not** auto-applied because they are breaking changes
that need a proper test cycle.

### HIGH — Upgrade Next.js (frontend) from 14.2.x → latest 15.x
The 5 remaining frontend high-severity advisories are all in **Next.js core**
(SSRF via image `remotePatterns`, request smuggling in rewrites, cache
poisoning, CSP-nonce XSS, RSC DoS). They are **not fixable on the 14.2.x line**
(14.2.35 is already the latest 14.2 patch); they require moving to Next 15+.
Because the site uses the App Router, i18n, middleware and image optimization,
this upgrade should be done on a branch with a full manual QA pass (routing,
locale redirects, `/erp` auth, image loading, SSR) before merging.

**Interim mitigations already reducing exposure:** the app runs behind Traefik
(TLS), `images.remotePatterns` is restricted to the S3 bucket host, and the API
enforces its own auth — several of the advisories require configurations Handla
does not use.

### MODERATE — Backend transitive advisories
The remaining backend findings are transitive (e.g. `uuid` via `bull`/`gaxios`,
a `typeorm` migration-generate advisory that only affects the dev CLI, not
runtime). Address by bumping the parent packages (`@nestjs/typeorm`, `bull`,
google libs) on a branch and running the backend test suite.

### LOW — Housekeeping
- Pre-existing **type errors in `*.spec.ts` test fixtures** (outdated `User` /
  `Contract` shapes, removed `ConversationStatus.RESOLVED`). They do **not**
  affect the production build (nest build excludes specs) but should be fixed so
  `tsc --noEmit` is clean for CI.
- Consider a short **refresh-token rotation / revocation list** if you want
  logout to invalidate refresh tokens server-side (today logout clears the
  cookies client-side; the disabled/archived check in #1 already covers the
  account-lockout case).

---

## 4. Operational checklist (deploy-time)

- [ ] `JWT_SECRET` and `JWT_REFRESH_SECRET` are unique, random, ≥32 chars in
      production (the app refuses to boot otherwise).
- [ ] `SAAS_INTERNAL_CALLBACK_SECRET` is set (provisioning callbacks fail-closed
      without it).
- [ ] `COOKIE_DOMAIN` set to the shared parent domain (`.handla.tech`) so the
      session cookie works across apex + subdomains.
- [ ] `NODE_ENV=production` (enables CSP, HSTS, secure cookies, error masking).
- [ ] TLS terminated at Traefik; HSTS is served by the API.
- [ ] Re-run `npm audit` before each release and schedule the Next.js 15 upgrade.
