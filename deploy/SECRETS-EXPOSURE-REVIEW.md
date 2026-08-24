# Secrets & credential exposure review (Phase 8)

Review-only audit for accidentally-exposed credentials across the repository,
git history, deployment configuration, service units, host config, and logs.

**Rule honoured:** no discovered credential value is printed here. Findings
report only **type · location · status · rotation-needed**.

**Result: NO exposed secrets found. No rotation required by this review.**

---

## 1. Repository (tracked files)

| Check | Result |
|---|---|
| Real `.env` / `.pem` / `.key` / `id_rsa` files tracked in git | **None** (only `*.env.example` templates) |
| `.gitignore` covers `.env`, `.env.*`, `*.env` (allows only `*.env.example`) | ✅ correct |
| Tracked example files (`.env.example`, `handla-backend/.env.example`, `handla-backend/.env.production.example`, `handla-frontend/.env.local.example`) | **All values are placeholders** (`__GENERATE…__`, `__YOUR…__`, `__SET_…__`, etc.) |
| Real AWS/JWT/OpenAI secret **formats** (`AKIA…`, `sk-…`, `eyJ…`, `-----BEGIN … PRIVATE KEY-----`) in tracked files | **0 matches** |
| Hardcoded secrets in source (`*.ts/js/json/yml`, excl. tests/examples) | **0 matches** |

## 2. Git history (all refs)

| Check | Result |
|---|---|
| Any `.env` / private-key file **ever** added in history | **None** |
| Real-secret **formats** across scanned history commits | **0 hits** |

→ No secret was committed and later removed; history is clean.

## 3. Application secret handling (code)

| Item | Location | Status |
|---|---|---|
| JWT dev fallback (`dev_secret_change_in_prod`) | `handla-backend/src/config/jwt.config.ts` | Present as a **dev-only** default, but **cannot reach production**: `main.ts` bootstrap **fail-fast guard** refuses to start in prod if `JWT_SECRET`/`JWT_REFRESH_SECRET` is missing, equals the fallback, or is `<32` chars. ✅ |
| Production JWT/DB/AWS/Redis secrets | container env (verified live) | All **set**, strong (`JWT_SECRET`/`JWT_REFRESH_SECRET` = 64, `AWS_SECRET_ACCESS_KEY` = 40, `REDIS_PASSWORD` = 40, `DATABASE_PASSWORD` = 15), **not** the dev fallback. ✅ |

## 4. Deployment / CI configuration

| Item | Result |
|---|---|
| `.github/workflows/deploy.yml` | References `${{ secrets.* }}` only; no hardcoded secrets (single hit was a documentation echo line). ✅ |
| Deploy scripts (`deploy/**`, `*.sh`) | No embedded secret literals. ✅ |
| All tracked `docker-compose*.yml` | Secrets referenced via `${ENV}`; no inline literals. ✅ |

## 5. Host configuration & service units (Handla only)

| Item | Location | Status |
|---|---|---|
| Handla systemd units (`handla-monitor*`, `handla-backup*`) | `/etc/systemd/system/` | No secrets in `Environment=` lines. ✅ |
| Real `.env` files on host | `/opt/handla-production/.env`, `…/handla-backend/.env` | **perm 600, root-owned**. ✅ (`.example` files are 644 placeholders) |
| Monitor alert credential | `/etc/handla-monitor/alert.conf` | **perm 600, root-only**. ✅ (currently `ALERT_CHANNEL=none` — no external channel wired yet; see OPERATOR-ACTIONS A/B) |
| Backup credentials (DB / rclone / age) | `/etc/handla-backup/backup.conf`, `/etc/handla-backup/rclone.conf` | Read from **root-only (600)** config files, NOT embedded in the script. Backups are `mysqldump → gzip → age-encrypt → sha256 → rclone` (encrypted at rest, off-host). ✅ |

## 6. Runtime logs

| Log | Secret-format hits |
|---|---|
| `handla_api` (last 2000 lines) | **0** |
| `handla_mysql` (last 500) | **0** password echoes |
| `handla_redis` (last 500) | **0** password echoes |

---

## Rotation assessment

**No rotation is required as a result of this review** — no credential was found
exposed in the repo, git history, CI, host config, or logs.

Routine (calendar-based) rotation of JWT/DB/AWS/Redis secrets remains good
hygiene but is an operator decision, not a response to an exposure. Recorded as
a LOW, optional operator item (OPERATOR-ACTIONS section I) — **not** triggered by
any finding here.
