# Final production-facing validation — Handla only (Phase 10)

Safe, bounded, non-disruptive validation of the **live** Handla application and
its intended interfaces only (`handla.tech`, `www.handla.tech`, `api.handla.tech`).
No other VPS tenant was touched. Production health was confirmed **before and
after** (all 4 handla containers `healthy`; `/api/health` → 200 throughout).

**Method:** read-only HTTP probes + one **bounded** 25-request auth burst (well
under any DoS threshold). No brute force, no destructive input, no scanning of
other tenants.

---

## Results

| # | Control | Check | Result | Verdict |
|---|---|---|---|---|
| A | Frontend headers (live) | `https://handla.tech/en` | 200; X-Frame-Options **DENY**, HSTS preload, Permissions-Policy, Referrer-Policy, nosniff, CSP present | ✅ LIVE |
| B | API headers (live) | `https://api.handla.tech` | HSTS, nosniff, X-Frame-Options, CSP, **no X-Powered-By**, CORS origin-locked | ✅ LIVE |
| C | TLS | `handla.tech:443` | **TLSv1.3**, valid Let's Encrypt cert (expires 2026-11-13, ~81d) | ✅ LIVE |
| D | AuthN (no token) | `/api/users`, `/auth/me`, `/erp/invoices`, `/chat/conversations` | **401** | ✅ LIVE |
| E | AuthN (garbage token) | `/api/users`, `/auth/me` | **401** (not 500) | ✅ LIVE |
| F | Health | `/api/health` | 200 | ✅ LIVE |
| G | Input validation | `POST /auth/signin` bad types + extra field / non-JSON | **400** (whitelist enforced) | ✅ LIVE |
| H | Public-doc token (forged) | `/api/erp/invoices/public/token/<forged>` ×3, quotations ×2 | **404** (never 200) | ✅ LIVE |
| I | Legacy public-by-ID | `/api/erp/invoices/public/<id>` | **400** (no data leak; see note) | ✅ LIVE (pre-Phase-2) |
| J | Rate limiting | bounded 25× `POST /auth/signin` | 4× 401 then **21× 429** (aggressive auth throttle) | ✅ LIVE |
| K | CORS | forbidden `Origin: evil.example.com` | ACAO = `https://handla.tech` (NOT reflected, NOT `*`) | ✅ LIVE |
| L | Service isolation | public IP :3306 / :6379 / :3001 | **all refused** | ✅ LIVE |
| M | Exposed ports | public listeners | only **22, 80, 443** | ✅ LIVE |
| O | Realtime auth | Socket.IO chat gateway | unauthenticated sockets **disconnected** (`authenticateSocket` + `disconnect(true)`, proven by gateway tests); Engine.IO transport `sid` grants no access | ✅ LIVE-VERIFIED (code+tests) |
| P | Storage isolation | `handla-uploads` S3 bucket root | **403** (no public listing) | ✅ LIVE |
| Q | Path traversal / probes | `/etc/passwd`, `/.env`, `/.git/config` | **404** (no leak) | ✅ LIVE |

## Notes / precision

- **Legacy public-by-ID (I):** currently returns **400** (input validation),
  not a `200` data leak. The Phase 2 change that *fully disables* these links is
  on the **unmerged** `security/legacy-public-links-disable` branch, so live
  behaviour reflects the pre-Phase-2 state — but even so, no document data is
  exposed via this path today.
- **Live CSP still pre-Phase-6:** the frontend serves the **static**
  `script-src 'self' 'unsafe-inline'` CSP and the API serves the pre-Phase-6
  helmet CSP (`img-src … https:`, `style-src 'unsafe-inline'`). This **confirms**
  the Phase 6 nonce-based / tightened CSP is **NOT yet deployed** (branch
  unmerged). All other security headers are already live.
- **Rate-limit TTL:** the auth throttle window is longer than the 15s re-test
  window (per-IP) — expected and healthy; it self-clears on TTL.

## Items NOT live-verified (require operator credentials)

- **Authenticated-user authorization depth** (role separation ADMIN vs CLIENT,
  cross-tenant record access, ownership guard on real records) could not be
  exercised end-to-end without valid production login credentials. The controls
  are present and unit-tested (RolesGuard, OwnershipGuard, per-record checks in
  the chat gateway), but a **live** authenticated authZ walkthrough is marked
  **NOT LIVE VERIFIED** rather than guessed. See OPERATOR-ACTIONS section K.

## Conclusion

Every control testable without operator credentials **behaves according to the
implemented design**. No data leakage, no unauthenticated access, no exposed
internal service, minimal public port surface, working rate limiting, correct
CORS, private storage. Production remained healthy throughout.
