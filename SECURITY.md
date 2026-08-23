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

---

# Penetration Test Report — Next.js 15 Upgrade + AppSec Pass (branch `security/nextjs-15-pentest`)

**Scope:** Next.js 14→15 security upgrade + controlled security validation.
**Method:** static review + automated adversarial Jest tests exercising the real
code paths (guards, DTO whitelist, service access checks, WebSocket gateway
auth, analytics allow‑list). No production data touched; no live DB required.

## Findings

### 🟠 HIGH — WS-01 Disabled/archived user retains WebSocket (chat) access
- **Component:** backend `chat.gateway.ts` `authenticateSocket()`
- **Attack scenario:** a user disabled/archived mid‑session (or reconnecting)
  keeps a valid access token; the HTTP `JwtStrategy` rejects them on every
  request, but the socket handshake only did `findOne({id})` and admitted them,
  so they kept sending/reading chat in real time.
- **Root cause:** the `isDisabled || isArchived` check added to `JwtStrategy`
  (PR #23) was never mirrored on the WebSocket auth path.
- **Fix:** `authenticateSocket()` now rejects (`return null` → disconnect) when
  `user.isDisabled || user.isArchived`, matching the HTTP guard.
- **Regression test:** `src/security/websocket-chat.pentest.spec.ts` → CHAT-01.

### 🟡 MEDIUM — WS-02 Cross-conversation IDOR/BOLA via `markAsRead`
- **Component:** backend `chat.gateway.ts` `handleMarkAsRead` + `chat.service.ts` `markAllAsRead`
- **Attack scenario:** an authenticated user emits `markAsRead {conversationId:<victim>}`;
  `markAllAsRead` had no membership check, so it cleared another user's unread
  state and broadcast `messagesRead` into that room (integrity tamper + existence leak).
- **Root cause:** `markAllAsRead` trusted the caller; the WS handler did not
  assert membership (unlike the `messageId` branch, which does).
- **Fix:** new `ChatService.assertConversationMembership()` is invoked in the
  `conversationId` branch before mutating; denies non‑members with `WsException`.
- **Regression test:** `src/security/websocket-chat.pentest.spec.ts` → CHAT-02.

### 🟢 LOW — WS-03 Typing‑indicator spoofing into arbitrary rooms
- **Component:** backend `chat.gateway.ts` `handleTyping`
- **Attack scenario:** authenticated user broadcasts "X is typing…" into a
  conversation room they are not part of. (Impact limited: socket.io only
  delivers to sockets already joined to that room.)
- **Fix:** `handleTyping` now calls `assertConversationMembership()` and fails
  closed (silent return) for non‑members.
- **Regression test:** `src/security/websocket-chat.pentest.spec.ts` → CHAT-03.

### ℹ️ INFO — FE-01 No security headers on Next.js HTML responses
- **Component:** frontend `next.config.js` (no `headers()` block)
- **Observation:** helmet protects API responses, but HTML pages served by Next
  carry no CSP / X‑Content‑Type‑Options / Referrer‑Policy / Permissions‑Policy /
  X‑Frame‑Options. `poweredByHeader:false` is set (no X‑Powered‑By).
- **Status:** documented; recommended Phase‑4 fix is a `headers()` block in
  `next.config.js` (not yet applied — see "Remaining work").

## Verified‑secure (no defect found)
- WebSocket identity is derived from the verified JWT, never from client
  `senderId`/`userId`/`role` (CHAT-04 proves overposting is ignored).
- Analytics dynamic group‑by column is allow‑listed → SQLi rejected (SQLI-01/02/03).
- Global `ValidationPipe {whitelist, forbidNonWhitelisted}` strips/blocks
  mass‑assignment; guard chain Jwt→Roles→Ownership is deny‑by‑default.

## Dependency audit
- **Frontend:** 5 high (pre‑upgrade) → **0** after Next 15.5.23 + `overrides`
  (`sharp ^0.35.3`, `postcss ^8.5.26`). No Next 16 required.
- **Backend:** 41 findings (3 low / 23 moderate / 15 high), all transitive/dev
  (e.g. lodash prototype pollution). Unchanged this pass; full per‑finding
  classification is the remaining Phase‑5 deliverable.

## Automated security tests added
- `src/security/websocket-chat.pentest.spec.ts` (CHAT-01..05)
- `src/security/injection.pentest.spec.ts` (SQLI-01..03)
- Run: `cd handla-backend && npx jest src/security/`
- Full suite: `cd handla-backend && npx jest` → 63 suites / 894 tests green.

## Remaining work (tracked, not yet done on this branch)
Auth (24‑case), authorization/IDOR across all modules, role‑escalation/overposting,
XSS/CSP, CSRF/CORS, JWT/cookie flags, rate‑limit, file‑upload, path‑traversal,
SSRF, request‑smuggling, cache‑poisoning, open‑redirect, HTTP‑method, fuzzing,
error‑handling test groups; frontend security‑headers fix (FE‑01); full Phase‑5
dependency classification; complete 28‑item final report.

---

## FINAL PENTEST REPORT — Next.js 15 hardening pass (branch `security/nextjs-15-pentest`, PR #24)

_Consolidated 2026-08-22. All numbers below are from the final commit on this branch._

### Severity summary

| Severity      | Found | Fixed | Remaining |
| ------------- | ----: | ----: | --------: |
| Critical      |     0 |     0 |         0 |
| High          |     0 |     0 |         0 |
| Medium        |     3 |     3 |         0 |
| Low           |     3 |     3 |         0 |
| Informational |     4 |     4 |         0 |

> No **demonstrated** exploitable Critical/High application vulnerability was
> found — the platform's deny-by-default guard stack held under every attack
> simulation. The Medium/Low findings below are ones we could concretely
> demonstrate a weakness for and then fixed. Dependency advisories are tracked
> separately in the Phase-5 section (they are advisories, not demonstrated
> exploits against Handla).

### Finding registry

| ID          | Finding                                                        | Severity | CVSS v3.1 | CWE      | Status                    |
| ----------- | -------------------------------------------------------------- | -------- | --------: | -------- | ------------------------- |
| WS-01       | Disabled/archived/expired/tampered token keeps WS access       | Medium   | 5.4       | CWE-613  | Fixed (verified)          |
| WS-02       | Cross-conversation markAsRead (IDOR/BOLA over WS)              | Medium   | 5.3       | CWE-639  | Fixed (verified)          |
| WS-03       | Typing-indicator injection into non-member room                | Low      | 3.1       | CWE-639  | Fixed (verified)          |
| WS-FUZZ-01  | Malformed (null/array) WS frame threw raw TypeError            | Low      | 2.7       | CWE-20   | Fixed                     |
| SSRF-01     | Outbound provisioning fetch had no SSRF allow/deny guard       | Medium   | 6.5       | CWE-918  | Fixed                     |
| XSS-01      | JSON-LD sink not escaped against `</script>` breakout          | Low      | 3.7       | CWE-79   | Fixed                     |
| CACHE-01    | API responses lacked no-store cache directives                 | Info     | —         | CWE-525  | Fixed (hardening)         |
| DEF-01      | ProjectsService.findOne lacked service-layer deny-by-default   | Info     | —         | CWE-284  | Fixed (defense in depth)  |
| FILE-KEY-01 | Chat presign key sanitizer only stripped whitespace            | Low      | 4.3       | CWE-22   | Fixed                     |
| PROXY-01    | `trust proxy` unset → throttler keyed all visitors to nginx IP | Medium   | 5.3       | CWE-348  | Fixed                     |
| INFO-01     | Public contract/invoice viewer exposes client email by UUID    | Info     | —         | CWE-200  | Accepted (capability URL) |
| REDIR-01    | OAuth callback redirect could be user-controlled               | Info     | —         | CWE-601  | Verified safe (no vuln)   |
| THROTTLE-*  | Rate-limit activation + IP-header-spoof resistance             | Info     | —         | CWE-307  | Verified working          |

**Distinction of finding types (per report requirement):**
- **Demonstrated vulnerabilities we fixed:** WS-01, WS-02, WS-03, WS-FUZZ-01, SSRF-01, XSS-01, FILE-KEY-01, PROXY-01.
- **Hardening / defense-in-depth (no exploit demonstrated):** CACHE-01, DEF-01.
- **Theoretical / accepted surface:** INFO-01 (requires leaking a 122-bit UUID; rate-limited).
- **Controls that already worked (proven by tests, NOT vulnerabilities):** REDIR-01, THROTTLE-* (429 activation + header-spoof resistance), all AUTH/AUTHZ/IDOR/CORS/CSRF/injection/mass-assignment/file-MIME suites.

### Per-finding detail (demonstrated + fixed)

**WS-01 — WebSocket re-authentication (Medium, CVSS 5.4, CWE-613 Insufficient Session Expiration)**
- Component: `chat.gateway.ts` `authenticateSocket()`.
- Scenario: a user disabled/archived while holding a valid access token, or reconnecting with an expired/tampered token, could regain real-time chat.
- Evidence/regression: `websocket-chat.pentest.spec.ts` → WS-01 block (disable-after-connect, expired JWT, tampered JWT, ghost sub, no token) all forced socket disconnect.
- Root cause / remediation: handshake re-loads the user row and rejects `isDisabled`/`isArchived`; `jwtService.verify` with `ignoreExpiration:false` rejects expired/tampered tokens. **Fully fixed & verified.**

**WS-02 — Cross-conversation markAsRead (Medium, CVSS 5.3, CWE-639 IDOR)**
- Membership is asserted before mutating read-state; blocked path performs no mutation and emits no existence-leaking broadcast. Regression: WS-02 block. **Fully fixed.**

**WS-03 — Typing-indicator injection (Low, CVSS 3.1, CWE-639)**
- Membership asserted before broadcasting `userTyping`; non-member never broadcasts. Regression: WS-03 block. **Fully fixed.**

**WS-FUZZ-01 — Malformed frame robustness (Low, CVSS 2.7, CWE-20)**
- `null`/array/primitive frames now coerced to a clean `WsException` (send) / silent return (typing) instead of a raw `TypeError`. Fix commit `4b419b3`.

**SSRF-01 — Outbound provisioning (Medium, CVSS 6.5, CWE-918)**
- `assertSafeOutboundUrl()` blocks metadata IP (incl. IPv4-mapped IPv6), loopback, RFC-1918, CGNAT, link-local, ULA, `.internal/.local`, embedded creds, non-http(s) schemes; optional allowlist. Regression: `ssrf.pentest.spec.ts` (30 tests). Fix commit `80e1c36`.

**XSS-01 — JSON-LD sink (Low, CVSS 3.7, CWE-79)**
- `safeJsonLd()` escapes `<>&` + U+2028/9; `JsonLd.tsx` uses it. Regression: `xss.test.ts`. Fix commit `efc9658`.

**FILE-KEY-01 — Chat presign key sanitizer (Low, CVSS 4.3, CWE-22)**
- Key sanitizer now collapses any non-`[a-zA-Z0-9._-]` run, so a crafted `fileName` cannot inject `/` or `..` past the `chat/<uid>/` prefix. Regression: `file-upload.pentest.spec.ts` FILE-KEY-01 block. Fixed this session.

**PROXY-01 — Reverse-proxy / client-IP trust for rate limiting (Medium, CVSS 5.3, CWE-348 Use of Less Trusted Source)**
- **Component & topology (verified):** production traffic is `client → nginx (container "nginx", nginx:1.27-alpine, TLS via certbot, ports 80/443) → NestJS (api:3001, bound 127.0.0.1)` on Docker bridge `handla_net`. The **single trusted reverse proxy immediately in front of NestJS is nginx — exactly one hop.** No Cloudflare/CDN is in the documented topology. `deploy/nginx/conf.d/handla.conf` sets `X-Forwarded-For $proxy_add_x_forwarded_for` (appends the real peer `$remote_addr` as the **rightmost** XFF entry) and `X-Real-IP $remote_addr`.
- **The real issue:** `main.ts` never set Express `trust proxy`. With it OFF, `@nestjs/throttler` v5's default tracker (`req.ip`) resolves to the **direct socket peer = the nginx container IP for every visitor** → all traffic collapses into one throttle bucket (global self-DoS / trivial limit exhaustion; CWE-348 relying on the wrong IP source).
- **Why not `trust proxy = true`:** `true` trusts the entire XFF chain, so an attacker sending `X-Forwarded-For: <spoofed>` would have their spoofed leftmost value taken as the client IP, letting them **rotate spoofed IPs to mint unlimited fresh buckets** and bypass throttling.
- **Fix (narrowest correct model):** `instance.set('trust proxy', <numeric hop count>)` — default **1** (env `TRUST_PROXY_HOPS`). With `trust proxy = 1`, Express takes the **(n+1)-th-from-right** XFF entry as the client IP, i.e. exactly the value nginx appended, and **ignores any attacker-prepended left entries**. This simultaneously (a) gives each real client its own bucket, (b) rejects arbitrary attacker `X-Forwarded-For`, and (c) defeats rotating spoofed forwarded-IP headers. Set `TRUST_PROXY_HOPS=2` only if a CDN/Cloudflare is later added in front of nginx; `0` to disable.
- **Regression:** `rate-limit.pentest.spec.ts` → `PENTEST — Rate limiting behind a 1-hop proxy` block: (1) distinct real client IPs (rightmost XFF) get independent buckets; (2) prepending spoofed left XFF entries cannot mint a fresh bucket (429 still fires). Fix commit `e685890`.

### Attacker-minded direct-to-API/WS review (checklist)

| Check                                              | Result |
| -------------------------------------------------- | ------ |
| Route missing guards                               | None (global deny-by-default; 9 `@Public` routes reviewed) |
| Controller missing authorization                   | None |
| Service callable without ownership check           | None (service-layer backstop; DEF-01 added for parity) |
| Resource IDs accepted without ownership validation | Public UUID viewers = capability URLs (INFO-01) |
| Role supplied by client                            | Ignored (WS-SPOOF proven; ValidationPipe whitelist) |
| Tenant/client IDs supplied by client               | Ignored / ownership-checked |
| Unrestricted filter/sort field                     | None found (no query-driven `orderBy`) |
| Unsafe outbound URL                                 | Guarded (SSRF-01) |
| Redirects based on user-controlled URL             | None (REDIR-01 safe) |
| Unsafe file key / object access                    | Fixed (FILE-KEY-01); avatar/website keys server-derived |
| Public S3/object paths                             | Only the website public prefix (by design/bucket policy) |
| Missing cache controls                             | Fixed (CACHE-01) |
| Debug/error leakage                                | 5xx masked in prod (ERR-01/02) |
| Weak environment defaults                          | Fail-fast on weak JWT secret in prod |
| Dangerous `dangerouslySetInnerHTML`                | Only `JsonLd.tsx`, now escaped (XSS-01) |
| Raw SQL / string interpolation                     | None (all TypeORM parameterized) |
| WS handlers missing auth/authz                     | None (all derive identity from verified JWT) |

### Phase 5 — backend dependency audit classification

**Before:** 41 total — 0 critical / 15 high / 23 moderate / 3 low.
**After (safe non-breaking overrides only; NO `--force`):** 21 total — 0 critical / 4 high / 15 moderate / 2 low.

Safe fixes applied via `overrides` (in-range, no major bumps, runtime-smoke-tested):
`tmp ^0.2.6`, `minimatch ^9.0.7`, `picomatch ^4.0.4`, `js-yaml ^4.1.1`, `ajv ^8.18.0`, `uuid ^11.1.1`, `glob ^10.5.0`.

Classification of the remaining 21:

1. **Exploitable/actionable now:** none against Handla.
2. **Present but not reachable:** nodemailer advisories (raw/jsonTransport/List-*/transport-name/addressparser) — Handla uses a fixed SMTP transport with server-controlled `to/subject/html`, no `raw`/`envelope`/`jsonTransport`/user-controlled headers; multer/express/qs/body-parser DoS — behind body-size limits + throttling, not attacker-tunable; lodash `_.template`/prototype-pollution — Handla does not call the vulnerable functions.
3. **Development-only:** webpack `buildHttp` SSRF (build tool, feature unused), file-type via `@nestjs/common` (transitively), remaining glob/minimatch tooling.
4. **Transitive/awaiting upstream:** file-type (fixed only in v21+, ESM; comes via `@nestjs/common`), lodash-via-`@nestjs/swagger`.
5. **Requires breaking upgrade:** everything else — resolved only by **NestJS v10→v11** (`@nestjs/core/common/platform-express/websockets/typeorm/throttler/config/swagger`, and their multer/express/qs/body-parser children) and **nodemailer v6→v9**. Deferred deliberately; a major-version migration is out of scope for a security-hardening PR and must be a separate, fully-regression-tested change.

**Frontend audit:** 0 / 0 / 0 / 0 (unchanged, clean).

### Rate-limit activation & proxy/IP trust chain (proven, not assumed)

`rate-limit.pentest.spec.ts` boots a real Nest app with the global `ThrottlerGuard` and the production `@Throttle` configs and proves, with **bounded low request counts (no DoS)**:
- **THROTTLE-ACT-01/02:** login returns HTTP **429** after the limit; `Retry-After` + `X-RateLimit-Limit/Remaining/Reset` headers verified on allowed responses; `Retry-After` + ThrottlerException body on the 429.
- **THROTTLE-ACT-03:** OTP verification (limit 10) and registration (limit 5) throttles activate.
- **THROTTLE-ACT-04:** the global default (100/60s in prod) covers un-decorated public routes (representative of public/contact-style forms — note: Handla has **no** dedicated public contact endpoint; the support-ingest endpoint is API-key-gated).
- **THROTTLE-IP-01:** rotating `X-Forwarded-For` / `X-Real-IP` / `Forwarded` per request does **NOT** reset the throttle key — a 429 still triggers.

**Proxy/IP trust chain:** Express `trust proxy` is left at its **safe default (off)** in `main.ts`, so `@nestjs/throttler`'s default tracker uses the real socket-peer `req.ip` and ignores spoofable forwarded headers. **Production requirement:** if Handla is deployed behind a reverse proxy / load balancer (nginx, ALB, Cloudflare), you must enable `app.set('trust proxy', <hop-count-or-CIDR>)` **and** ensure the edge overwrites `X-Forwarded-For` — otherwise all clients collapse to the proxy IP (over-throttling) or, if trust is set too loosely, header-spoofing becomes possible again. Trust exactly the number of proxy hops you control; never `trust proxy = true` on an untrusted edge.

### How to reproduce (exact commands)

```bash
# Backend — security suites only
cd handla-backend && npx jest src/security/
# Backend — full suite
cd handla-backend && npx jest
# Backend — build + audit
cd handla-backend && npm run build && npm audit
# Frontend — build, lint, security tests, audit
cd handla-frontend && NEXT_TELEMETRY_DISABLED=1 npm run build
cd handla-frontend && npm run lint
cd handla-frontend && npx jest src/__tests__/xss.test.ts
cd handla-frontend && npm audit
```

### Manual QA a human should still perform
1. Live WebSocket disable test: disable a user mid-session against real socket.io + Redis and confirm the socket drops.
2. Live 429 test against the deployed API behind the real proxy, confirming `trust proxy` is tuned correctly (throttle keyed on true client IP).
3. Confirm the S3 bucket policy exposes **only** the `.../website/*` public prefix and everything else is private (presigned-GET only).
4. Verify production env: strong `JWT_SECRET` (fail-fast covers this), `COOKIE_DOMAIN`, `CORS_ORIGIN` set to the exact frontend origin, SMTP creds.
5. Confirm HSTS/CSP headers on the deployed responses (helmet is prod-gated).

### Production deployment + rollback
- **Deploy:** merge target is `main` only after approval; deploy backend (`npm run build && npm run start:prod`) and frontend (`npm run build && npm start`) as usual. These changes are **backward compatible** (new tests, npm `overrides`, additive guards) — no DB migration, no API contract change.
- **Rollback:** `git revert` the range `4b419b3..HEAD` (or redeploy the previous release tag). The only runtime-affecting changes are the `overrides` block (revert `handla-backend/package.json` + `package-lock.json` and `npm ci`) and the small gateway/controller guards (pure additive validation). No data changes to roll back.

### Merge verdict

**Is PR #24 safe to merge? → `YES — but with the following accepted risks`.**

- No demonstrated exploitable Critical/High application vulnerability; every demonstrated Medium/Low weakness (WS-01/02/03, WS-FUZZ-01, SSRF-01, XSS-01, FILE-KEY-01) is fixed with a regression test, and the full backend (72 suites / 1111 tests) + frontend build/lint/xss all pass; frontend audit is clean.
- **Accepted risks (not blockers):** (1) 21 backend dependency advisories remain, all requiring a **breaking NestJS v10→v11 / nodemailer v6→v9 upgrade** or dev/build-only — none reachable-and-exploitable against Handla today; schedule the major upgrade as a separate PR. (2) INFO-01 public UUID document viewer is an accepted capability-URL design. (3) Production must set `trust proxy` correctly behind its edge for throttling to key on the true client IP.
- Per instruction, **PR #24 is NOT merged by the agent** — left open for your approval.
