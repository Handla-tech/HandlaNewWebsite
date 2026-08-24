# Final code & dependency security review (Phase 9)

Ran the existing project builds, tests, dependency audits, and a security-control
presence review. **No unrelated upgrades or refactors were introduced.**

## Builds

| Project | Command | Result |
|---|---|---|
| Backend | `npm run build` (`nest build`) | ✅ exit 0 |
| Frontend | `npm run lint` | ✅ exit 0 (pre-existing `no-explicit-any` + 1 unused-var **warnings** only, no errors) |

## Tests

| Project | Result |
|---|---|
| Backend (`jest`) | ✅ **1275 passed / 1275**, 82 suites |
| Frontend (`jest`) | ✅ **40 passed / 40**, 4 suites |

## Dependency audits (`npm audit`)

| Project | prod (`--omit=dev`) | all (incl dev) | Verdict |
|---|---|---|---|
| Backend | 0 vulns | 0 vulns | ✅ clean |
| Frontend | 0 vulns | 0 vulns | ✅ clean |
| Mobile (`handla-mobile`, Expo/React-Native) | — | **20 (9 high, 11 moderate)** | ⚠️ **out of production scope** — see below |

### Mobile finding (out of production web scope)

`handla-mobile` is an **Expo / React-Native** app, **not** part of the deployed
Handla production VPS surface. Its high-severity advisories are all in the
**build-time toolchain**, not runtime:

- `image-size` — DoS via infinite loop in ICNS / JXL / HEIF parsers.
- `postcss` — XSS via unescaped `</style>`, path traversal / arbitrary `.map`
  file disclosure via attacker-controlled `sourceMappingURL`.

These execute only during local bundling/build, so they do not affect the
production website or API. Fixing them would require Expo/RN toolchain upgrades
that are **outside this phase's "no unrelated upgrades" rule**. Recorded as a
LOW, optional operator item (OPERATOR-ACTIONS section J).

## Key framework versions (supply-chain relevant)

| Package | Version | Note |
|---|---|---|
| `next` | `15.5.23` | ✅ ≥ 15.2.3 (past the CVE-2025 middleware-auth-bypass fix) |
| `@nestjs/core` | `^11.2.1` | current major |
| `typeorm` | `^0.3.17` | parameterized queries throughout |
| `bull` | `^4.12.0` | Redis queue |
| `helmet` | `^7.1.0` | security headers |
| `bcrypt` | `^5.1.1` | password hashing |
| `axios` | `^1.16.1` | — |
| `socket.io-client` | `^4.8.3` | — |

## Security-control presence review (code)

All core controls confirmed present in `handla-backend/src`:

- **AuthN:** global `JwtAuthGuard` (`APP_GUARD`), `SocketJwtGuard` for WebSocket.
- **AuthZ:** `RolesGuard` + `@Roles`, `OwnershipGuard` for per-record access.
- **Rate limiting:** `ThrottlerModule` / `ThrottlerGuard`.
- **Transport/headers:** `helmet` + origin-restricted `enableCors` in `main.ts`.
- **Input validation:** global `ValidationPipe({ whitelist:true,
  forbidNonWhitelisted:true, transform:true })` — rejects unknown properties.
- **Public documents:** `PublicTokenService` capability-token model.
- **Prod boot safety:** fail-fast guard rejects weak/missing JWT secrets.

**SQL injection check:** the only raw-query sites (`reset.ts` dev reset,
`main.ts` self-heal ALTER) use **env-derived DB names / a hardcoded internal
column list + parameterized (`?`) lookups** — not user input. No injectable
raw query found.

## Drift since previous phases

No regressions. All suites green; audits clean (web). The Phase 3/6 changes
(migrator split gating, nonce CSP) live on their own unmerged branches and were
independently verified in their phases; this review is against `origin/main`.

## Verdict

**Web production code & dependencies: clean and green.** Only out-of-scope item
is the mobile toolchain audit (LOW, optional, non-production).
