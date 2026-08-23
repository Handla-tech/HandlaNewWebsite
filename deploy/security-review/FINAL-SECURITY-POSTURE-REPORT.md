# HANDLA FINAL SECURITY POSTURE REPORT

_Review date: 2026-08-23 · Read-only posture review · No production changes made._
_Reviewer roles: Principal AppSec / Cloud Security / DevSecOps / Production Reliability._
_Production SHA reviewed: `faa2de6` (== origin/main), CI+Deploy = success._

## Executive Summary

Handla's production system is **production-hardened**. Across application,
authentication, authorization, API, files/S3, database, cache, CI/CD, host,
Docker, and reverse-proxy boundaries, all previously-completed controls were
re-verified live and by the 406-test security suite (25/25 suites pass).

- **No HIGH or CRITICAL blockers remain.**
- **No rollback or emergency action is required.**
- Remaining items are LOW/MEDIUM residuals, all either already **accepted**
  (documented transitional risk) or **optional hardening** — none block
  production operation.

Verdict: **B — HANDLA HARDENED WITH ACCEPTED RESIDUAL RISK.**

## Security Scorecard

| Domain | Score /10 | Status |
|---|---:|---|
| Application Security | 9 | ✅ |
| Authentication | 9 | ✅ |
| Authorization/BOLA | 9 | ✅ |
| API Security | 9 | ✅ |
| Files/S3 | 9 | ✅ |
| MySQL | 8 | ✅ |
| Redis | 8 | ✅ |
| CI/CD | 9 | ✅ |
| Host/SSH | 9 | ✅ |
| Docker | 9 | ✅ |
| Traefik/TLS | 8 | ✅ |
| Secrets | 8 | ✅ |
| Dependencies | 9 | ✅ |
| Backup/Recovery | 6 | ⚠️ |
| Monitoring | 5 | ⚠️ |

**Overall: 8.3/10**

## Major Controls Completed (verified this review)

- **App/API:** PT-01/02/04 fixed; SSRF guard blocks `169.254.169.254` &
  `127.0.0.1:6379` (live test); XSS/JSON-LD escaping; deny-by-default authz;
  no-store on sensitive paths; strict CSP, HSTS preload, `X-Frame DENY`,
  `nosniff`, no `X-Powered-By`/`Server` banner; enumeration-resistant login
  (uniform 404). 406/406 security tests pass.
- **Files/S3:** private bucket (root list & random key both 403 live);
  presigned URLs (15-min expiry); chat file namespace/BOLA guard ("arbitrary
  in-bucket key rejected, never signs"); CSP allows only the exact S3 origin.
- **AuthN/Z:** httpOnly cookies, `SameSite=None; Secure` + dedicated CSRF
  guard; JWT; roles + ownership guards; disabled/archived accounts blocked.
- **MySQL:** no `root@%`, no anon/test users, `local_infile OFF`, app user
  scoped to `handla_db.*` with NO GRANT OPTION, 3306 not published.
- **Redis:** unauth `NOAUTH`, default user off, `handla_app` ACL, FLUSHALL/
  CONFIG/DEBUG/ACL denied (NOPERM), 6379 not published, Bull queue healthy.
- **CI/CD + Host:** password SSH off; UFW deny-default, only 22/80/443 open;
  CI deploys as non-root `handla-deploy` (not in docker group) via a single
  root-owned fixed sudo wrapper (branch/dir hard-coded, no args/env); trusted
  root-owned checkout; no old Handla root CI key.
- **Docker/Traefik:** `docker.sock root:docker 660`; socket proxy is SOLE
  consumer; Traefik has NO socket mount, uses `tcp://docker-socket-proxy:2375`;
  proxy `cap_drop ALL` + `no-new-privileges`, internal-only net, no host port;
  handla containers cannot resolve/reach the proxy; no Docker TCP API.
- **Dependencies:** backend & frontend `npm audit = 0/0`.

## Residual Risk Register

| # | Risk | Severity | Status | Recommendation |
|---|---|---|---|---|
| 1 | `PUBLIC_DOC_LEGACY_ID_LINKS` effectively `true` (unset → default) — legacy raw-UUID doc links still viewable | MEDIUM | ACCEPT (transitional) | Monitor legacy usage; flip to `false` once tokens backfilled |
| 2 | MySQL app user has DDL (CREATE/DROP/ALTER) because runtime+migrator share one account | LOW | ACCEPT / OPTIONAL | Split a DDL-only migrator user from a DML runtime user |
| 3 | Redis ACL is `+@all` minus deny-list; `KEYS *` still allowed to app user | LOW | MONITOR / OPTIONAL | Move to explicit allow-list; deny `KEYS` |
| 4 | MySQL & Redis traffic plaintext over same-host Docker bridge | LOW | ACCEPT | TLS only if threat model requires host-internal encryption |
| 5 | `root@localhost` MySQL admin account retained | LOW | ACCEPT | Needed for local admin/backup |
| 6 | Traefik metadata read surface via proxy (`CONTAINERS/NETWORKS/EVENTS/INFO`) | LOW | ACCEPT | Required for provider discovery; read-only |
| 7 | Traefik container itself lacks `no-new-privileges` + `cap_drop` | LOW | OPTIONAL HARDENING | Add to shared `tameerhome` compose (separately approved) |
| 8 | Shared VPS hosts unrelated projects (homy, tameerhome) | LOW | ACCEPT | Cross-project blast radius inherent to shared host |
| 9 | Root key-based SSH recovery retained (`permitrootlogin without-password`) + duplicate `handla-sandbox-deploy` key line | LOW | ACCEPT / housekeeping | Keep recovery; de-dupe redundant key entry |
| 10 | Backups are on-host only (single point of failure) | MEDIUM | REQUIRES ACTION (30d) | Add off-host/off-site backup copy + restore test |
| 11 | No centralized logging / alerting; 4xx logged at error level (noise) | MEDIUM | OPTIONAL HARDENING | Add basic alerting (auth failures, 5xx spikes, restart loops) |
| 12 | CSP `script-src` allows `'unsafe-inline'` (Next.js) | LOW | ACCEPT | Nonce/hash-based CSP if framework allows |

## Public Attack Surface

Only publicly reachable services (UFW deny-default; host listeners confirmed):

| Port | Service | Exposure |
|---|---|---|
| 22/tcp | SSH (key-only, no password) | public |
| 80/tcp | HTTP → Traefik (redirects to HTTPS) | public |
| 443/tcp | HTTPS → Traefik | public |

Confirmed NOT public: 3000, 3001 (127.0.0.1 only), 3306, 33060, 6379, 2375,
2376, socket-proxy, Traefik dashboard (basicauth, via 443 only). No Docker TCP API.

## Dependency State

- **Backend `npm audit`: 0 vulnerabilities** (prod & incl-dev)
- **Frontend `npm audit`: 0 vulnerabilities**
- Runtime: Docker 29.4.3 · Compose v5.1.3 · Traefik v2.11.52 · MySQL 8.0.46 ·
  Redis 7.4.10 · Node 20.20.2 · NestJS ^11.2.1 · Express 5 · Nodemailer ^9.0.5 ·
  Next 15.5.23. No current advisory affects deployed versions; newer releases
  are maintenance-only.

## Production Health

- Containers: handla_api/web/mysql/redis all **healthy, RestartCount=0**
  (clean single deploy of `faa2de6`, no crash loops); Traefik, socket-proxy,
  and shared (homy/tameerhome) containers all Up.
- Endpoints: `handla.tech/en`=200, `/ar`=200, `api.handla.tech/api/health`=200.
- Logs (24h): 0 NOAUTH/WRONGPASS, 0 MySQL access-denied, 0 sustained Traefik
  errors. All "errors" traced to benign 4xx (audit probes) + prior transient
  fail-closed reconnect test. Log rotation `json-file 10m×3` on all containers.

## Deployment Trust Chain (verified)

```
GitHub Actions ("CI + Deploy", success)
  → SSH as handla-deploy   (non-root; FATAL-guard aborts if root; NOT in docker group)
    → sudo /usr/local/sbin/handla-production-deploy   (root:root 0755; NOPASSWD; ONE command, no args/env; !setenv, fixed secure_path)
      → root-owned trusted checkout /opt/handla-production  (root:root 755; branch=main hard-coded)
        → Docker   (deploy user gets 'permission denied' on docker.sock directly)
          → Traefik → docker-socket-proxy (read-only allow-list, internal net)
```

## Database / Redis State

- **MySQL:** `handla@%` (scoped, no GRANT OPTION, has DDL — residual #2),
  `root@localhost` only; no `root@%`, no anon/test; `local_infile OFF`;
  3306 unpublished; pre-migration & pre-hardening `.sql.gz` backups present.
- **Redis:** unauth NOAUTH; default user disabled; `handla_app` authenticated;
  destructive/admin commands denied (NOPERM); Bull queue keys present/healthy;
  AOF off / RDB on (accepted tradeoff); 6379 unpublished.

## What Still Prevents 10/10

1. Backups on-host only — no verified off-host copy/restore drill (#10).
2. No centralized logging/alerting; error-level noise from normal 4xx (#11).
3. Legacy public-doc raw-UUID links still enabled during transition (#1).
4. MySQL runtime user retains DDL; Redis ACL broad (`+@all` minus deny) (#2,#3).
5. Traefik container itself not yet `no-new-privileges`/`cap_drop` (#7).
6. Shared VPS + retained root SSH recovery = inherent blast-radius (#8,#9).
7. Plaintext intra-host DB/Redis bridge; CSP `unsafe-inline` (#4,#12).

None are exploitable-as-is; all are defense-in-depth / operational-maturity gaps.

## Recommendations

**NOW (blockers):** None. No high/critical action required.

**NEXT 30 DAYS:**
- Add an **off-host backup** copy + one documented restore test (#10).
- Add **basic alerting**: auth-failure spikes, 5xx rate, container restart
  loops, Traefik provider errors (#11).
- **Monitor legacy public-doc link** usage; plan the `PUBLIC_DOC_LEGACY_ID_LINKS=false` cutover once tokens are backfilled (#1).
- Establish a **dependency update cadence** (monthly audit + patch review).

**OPTIONAL / LATER:**
- Split MySQL DDL migrator user from DML runtime user (#2).
- Tighten Redis ACL to explicit allow-list; deny `KEYS` (#3).
- Apply `no-new-privileges` + `cap_drop` to the Traefik container (#7).
- Redis/MySQL TLS on the bridge if threat model warrants (#4).
- De-duplicate the redundant root `authorized_keys` entry (#9).
- Move CSP toward nonce/hash-based `script-src` (#12).

## Final Verdict

**B — HANDLA HARDENED WITH ACCEPTED RESIDUAL RISK**

No high/critical blocker remains; production is hardened and healthy. Residual
items are LOW/MEDIUM and are either accepted transitional risk or optional
hardening. No rollback or immediate implementation is required.
