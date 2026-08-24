# HANDLA — Security Final Posture

Consolidated posture after Phases 1–11. **origin/main = faa2de6 (unchanged).**
All security branches are **pushed but UNMERGED**, so their changes are **NOT
active in production** unless explicitly noted as already-applied live-safe ops.

## Completed phases
1–6 (prior): monitoring/alerting, legacy-public-links disable, MySQL user split,
Redis allow-list, Traefik/container hardening, CSP tightening.
7 SSH housekeeping · 8 Secrets review · 9 Code/dependency review ·
10 Production validation · 11 This posture doc.

## Branch / commit references (origin/main = faa2de6)
| Branch | SHA | Active in prod? |
|---|---|---|
| security/monitoring-alerting | 46b2a54 | NO (unmerged) |
| security/legacy-public-links-disable | b810a75 | NO (unmerged) |
| security/mysql-runtime-migrator-split | 5985383 | NO (unmerged) |
| security/redis-acl-allowlist | a794d47 | NO (unmerged) |
| security/traefik-container-hardening | d0fb3dc | NO (unmerged) |
| security/csp-tightening | 53585f6 | NO (unmerged) |
| security/offsite-backup-dr | 3ca1611 | NO (unmerged) |
| security/ssh-secrets-housekeeping | 9db7951 | doc only; dedupe applied live-safe |
| security/secrets-exposure-review | f94efcb | doc only (review) |
| security/final-code-dependency-review | 9cab64c | doc only (review) |
| security/final-production-validation | 18a6c0f | doc only (validation) |

## Status by category
- **Application:** LIVE headers (HSTS/nosniff/X-Frame/CSP, no X-Powered-By), JWT
  authN (401), whitelist ValidationPipe (400), rate limiting (429), origin-locked
  CORS, private public-doc tokens (forged→404), prod secret fail-fast. Tightened
  CSP + full legacy-link disable await merge.
- **Infrastructure:** only 22/80/443 public; mysql/redis/api refused on public IP;
  API bound 127.0.0.1:3001. TLSv1.3, valid LE cert (exp 2026-11-13). Container/
  Traefik hardening awaits merge; Traefik is SHARED (owner action, OPERATOR §F2).
- **Database (MySQL):** internal-only, healthy. Runtime/migrator user split awaits
  merge+apply (OPERATOR §D).
- **Redis:** internal-only, healthy. Command allow-list awaits merge+apply (§E).
- **Deployment:** dedicated least-privilege deploy account (single sudoers wrapper,
  no shell/wildcard); password SSH disabled; root pubkey-only. Duplicate key
  removed live-safe (backup kept).
- **Backup/restore:** age-encrypted off-host backups; DR/off-site improvements on
  unmerged offsite-backup-dr branch.
- **Monitoring:** external alert channel + independent off-VPS uptime monitor are
  BLOCKING operator actions (OPERATOR §A/§B); monitoring-alerting branch unmerged.
- **Dependency:** backend build ✅ + 1275/1275 tests; frontend lint ✅ + 40/40;
  npm audit 0 vulns (backend & frontend, prod+dev). Mobile 20 findings = build-time
  toolchain only, NOT deployed (OPERATOR §J1).

## Remaining operator actions (see OPERATOR-ACTIONS.md A–K)
🔴 A monitoring alert channel · 🔴 B off-VPS uptime monitor · 🟠 F2 Traefik owner
hardening · 🟡 C legacy links deploy · 🟡 D MySQL user split · 🟡 E Redis allow-list ·
🟡 K authenticated authZ live walkthrough · 🟢 F1/G/H/I/J1 optional hygiene.
Plus: **merge + deploy the 7 code/config branches** (no auto-merge performed).

## Accepted residual risks
- Tightened CSP / full legacy-link disable / DB split / Redis allow-list / container
  hardening not yet live (mitigated: current controls already deny leaks/anon access).
- Authenticated authZ depth NOT LIVE VERIFIED (present + unit-tested; needs creds).
- Mobile toolchain vulns (out of production web scope).

## Items NOT yet active because branches are unmerged
All 7 change branches above (monitoring, legacy-links, mysql-split, redis-acl,
traefik/container, csp, offsite-backup). Verified live: prod still serves the
pre-Phase-6 CSP and pre-Phase-2 legacy behaviour — confirming none are deployed.
