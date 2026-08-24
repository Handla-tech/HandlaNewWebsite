# HANDLA — Operator Actions Required

This file records every task in the security-hardening program that requires
**manual operator intervention** (credentials, console/account access, customer
impact decisions, PR merges, or production env changes the agent must not make
unilaterally). Autonomous work continues around these; nothing here blocks
independent phases unless explicitly marked **BLOCKING**.

**No secret values are ever recorded here — only the *type* of secret and where it goes.**

Legend: 🔴 CRITICAL/BLOCKING · 🟠 HIGH · 🟡 MEDIUM · 🟢 LOW/OPTIONAL

---

## 🔴 A. Configure external monitoring alert channel  (Phase: Monitoring)
- **Status:** OPERATOR ACTION REQUIRED (BLOCKING for "Monitoring = A" verdict; NON-BLOCKING for other phases)
- **Why:** `handla-monitor`/`handla-alert` are live on production and write alerts
  locally (spool + journald), but `ALERT_CHANNEL=none`, so **no alert currently
  leaves the VPS**. If the VPS degrades, no one is notified off-host.
- **Exact action (choose ONE channel):**
  1. `sudoedit /etc/handla-monitor/alert.conf` (file is root:root 0600).
  2. Set `ALERT_CHANNEL=telegram` (or `slack` / `smtp`) and fill the matching secret(s):
     - **Telegram:** `TELEGRAM_BOT_TOKEN=…`, `TELEGRAM_CHAT_ID=…`
       (create a bot via @BotFather; get chat id via @userinfobot).
     - **Slack:** `SLACK_WEBHOOK_URL=…` (Incoming Webhook).
     - **SMTP:** `ALERT_EMAIL_TO=…`, `ALERT_EMAIL_FROM=…` (needs working `mail`/`sendmail`).
  3. Keep file mode 0600. Do NOT commit the file to git.
- **Verification afterward (must be done):**
  ```
  sudo handla-alert INFO test manual "external delivery test"
  sudo tail -2 /var/lib/handla-monitor/alerts.log     # expect external=delivered(...)
  ```
  If it shows `external=failed(...)` or `misconfigured(...)`, fix creds and retry.
- **Security warning:** Never paste the token into chat, logs, or a committed file.
  Rotate immediately if it is ever exposed.

## 🔴 B. Configure an independent OFF-VPS uptime monitor  (Phase: Monitoring)
- **Status:** OPERATOR ACTION REQUIRED (BLOCKING for "Monitoring = A"; NON-BLOCKING otherwise)
- **Why:** A monitor running *on* the VPS cannot detect a total VPS/network/power
  outage. An external watcher is required so full outage is noticed.
- **Exact action:** Create a free/basic account on an external uptime service
  (UptimeRobot, Healthchecks.io, BetterStack, Pingdom, etc.) and add HTTP checks:
  - `https://handla.tech/` — expect 200/301/302/308.
  - `https://api.handla.tech/api/health` — expect HTTP 200 (JSON `status:ok`).
  - Notification target = the same ops contact as (A).
  - Recommended interval ≤ 5 min.
- **Verification afterward:** Trigger a test notification from the provider; confirm
  it reaches the ops contact. Optionally pause one check briefly to confirm a down
  alert fires (then re-enable).
- **Security warning:** Use only the two public health URLs; do not expose internal
  ports or admin paths to the external monitor.

## 🟡 C. Deploy legacy-public-links secure default  (Phase: Legacy public links)
- **Status:** OPERATOR ACTION REQUIRED (NON-BLOCKING) — merge + deploy gated.
- **Why:** Branch `security/legacy-public-links-disable` flips the code default of
  `PUBLIC_DOC_LEGACY_ID_LINKS` to **false** (secure-by-default: legacy raw-UUID
  public routes → 404; only capability tokens grant public access). Verified safe:
  production has **0 invoices / 0 contracts / 0 quotations**, so **no circulating
  link is affected**. The change only takes effect once the branch is merged and
  the API is redeployed.
- **Exact action:**
  1. Review & merge PR for `security/legacy-public-links-disable` into `main`.
  2. Redeploy `handla_api` (normal deploy path).
  3. (No env change needed — the secure default is now in code. To *temporarily
     re-enable* legacy routes you would set `PUBLIC_DOC_LEGACY_ID_LINKS=true`.)
- **Verification afterward:**
  ```
  # after deploy, legacy raw-id must 404 (there is no data, so use any UUID):
  curl -s -o /dev/null -w '%{http_code}\n' \
    https://api.handla.tech/erp/invoices/public/00000000-0000-4000-8000-000000000000
  # expect 404
  ```
- **Security warning:** Do not set `PUBLIC_DOC_LEGACY_ID_LINKS=true` in production
  unless you are knowingly restoring pre-token legacy links; it re-opens the
  enumerable raw-UUID surface.

---
## D. Apply MySQL runtime/migrator user split in production 🟡 (NON-BLOCKING)

> **STATUS: ✅ DEPLOYED & LIVE-VERIFIED.** The split is applied in production.
> **Canonical identities:**
> - **Runtime:** `handla_runtime` — DML only (SELECT/INSERT/UPDATE/DELETE).
> - **Migrations:** `handla_migrator` — schema-scoped DDL/DML, no GRANT OPTION.
> - **Legacy:** `handla@%` — **DEPRECATED, scheduled for removal.** Zero live and
>   zero cumulative connections since cutover; safe to drop after fallback cleanup.
>
> **Executable fallbacks to the legacy `handla` user have been REMOVED** (branch
> `security/mysql-legacy-user-cleanup`): `docker-compose.yml` and all three deploy
> scripts now **require** an explicit `DATABASE_USER` and fail clearly if it is
> missing — they no longer silently substitute `DATABASE_USER=handla`.
>
> **Remaining operator step (final):** drop the legacy user once satisfied:
> `DROP USER 'handla'@'%';`  (take a `SHOW GRANTS` snapshot first). Not done here.

- **Phase:** 3 — MySQL runtime/migrator user split
- **Why:** The single app DB user currently holds DDL+DML. Code now supports a
  DML-only runtime identity + a DDL migrator identity so the running API can
  never `CREATE/ALTER/DROP`. Applying it requires creating two DB users with
  operator-chosen secrets and a coordinated env/redeploy — an operator step.
- **BLOCKING?** NON-BLOCKING. The code falls back to the current single user
  when `DATABASE_MIGRATION_USER` is unset, so production is unaffected until you
  choose to apply this. No production change was made by this phase.
- **Exact steps:**
  1. Verified backup FIRST (schema + grants):
     `docker exec -e MYSQL_PWD=<root_pw> handla_mysql mysqldump -uroot handla_db > /root/handla_db_pre_split_$(date +%F).sql`
     `docker exec -e MYSQL_PWD=<root_pw> handla_mysql mysql -uroot -N -e "SHOW GRANTS FOR 'handla'@'%'" > /root/handla_grants_pre_split_$(date +%F).txt`
  2. Generate two strong secrets on the VPS (do NOT display/commit them) and the
     render+apply helper will consume them from env WITHOUT echoing:
     ```
     export MYSQL_ROOT_PASSWORD='<root_pw>'                 # not echoed
     export RUNTIME_PW="$(openssl rand -base64 30)"
     export MIGRATOR_PW="$(openssl rand -base64 30)"
     # Optional dry-run first (prints SQL with passwords MASKED, applies nothing):
     DRY_RUN=1 deploy/mysql/render-and-apply.sh
     # Apply for real (idempotent; re-runnable):
     deploy/mysql/render-and-apply.sh
     ```
     (The helper renders `deploy/mysql/runtime-migrator-split.sql`; you may also
     render it manually with `sed` — see the header of that file.)
  3. Set deployed env (compose/secret store) — values from the shell above:
     `DATABASE_USER=handla_runtime`, `DATABASE_PASSWORD=<RUNTIME_PW>`,
     `DATABASE_MIGRATION_USER=handla_migrator`, `DATABASE_MIGRATION_PASSWORD=<MIGRATOR_PW>`
  4. Redeploy `handla_api`.
  5. (Optional, after verification) drop the legacy combined user:
     `DROP USER 'handla'@'%';`
- **Verification after:** API health = 200; runtime CRUD works; migrations run
  clean (idempotent) under migrator; runtime `CREATE/ALTER/DROP` denied
  (expected); existing data unchanged. In the container logs you should see
  "Runtime schema self-heal skipped in production". Confirm grants:
  `SHOW GRANTS FOR 'handla_runtime'@'%';` → only SELECT/INSERT/UPDATE/DELETE.
- **Pre-verified in an isolated throwaway MySQL 8.0 (not production):** all 23
  migrations ran under the migrator identity; runtime user passed 4/4 DML tests
  and was correctly DENIED on 6/6 DDL tests (CREATE/ALTER/DROP/INDEX/TRUNCATE/GRANT);
  provisioning + migrations are idempotent on re-run.
- **Security warnings:** Never grant `GRANT OPTION` or global `*.*` privileges to
  either identity. Keep `root@localhost` admin/recovery only. Do not commit real
  secrets. `RUNTIME_SCHEMA_SELFHEAL=true` is recovery-only — leave it unset.
- **Merge required:** merge branch `security/mysql-runtime-migrator-split` before
  deploying (code changes to data-source.ts / main.ts / entrypoint.sh).

---
*(Further operator actions are appended by later phases below.)*

---
## E. Deploy Redis command ALLOW-LIST (Phase 4) 🟡 (NON-BLOCKING)

- **Phase:** 4 — Redis ACL allow-list
- **Why:** `deploy/redis/redis-entrypoint.sh` now grants `handla_app` an explicit
  category allow-list (default-deny) instead of `+@all` minus a deny-list. ~99
  admin/stream/geo/bitmap/function commands (and any future dangerous command)
  are now denied by default; the destructive subset is also explicitly re-denied.
- **BLOCKING?** NON-BLOCKING. No production change made by this phase — it takes
  effect only when the branch is merged and `handla_redis` is recreated.
- **Exact steps:** merge `security/redis-acl-allowlist`; recreate `handla_redis`
  (entrypoint regenerates the ACL file from `REDIS_PASSWORD` on boot — no secret
  change needed).
- **Verification after:** API `/api/health`=200; send a test email (queue works);
  `docker exec handla_redis redis-cli -u redis://handla_app:<pw>@127.0.0.1:6379 flushall`
  → must return `NOPERM`. Bull queue processes normally.
- **Pre-verified (throwaway Redis 7.4, production untouched):** full Bull 4.16.5 /
  ioredis 5.11.1 lifecycle (enqueue → process → fail+retry/backoff → getJobCounts
  → pause/resume → clean) ran with 0 permission errors; 15/15 dangerous commands
  correctly DENIED (flushall/flushdb/config/shutdown/acl/cluster/save/bgsave/
  module/replicaof/swapdb/migrate/debug/bgrewriteaof/failover).
- **Rollback:** revert the entrypoint to the previous `+@all` line and recreate.

## F. Container hardening — HANDLA services + SHARED Traefik (Phase 5)

### F1. Apply HANDLA container hardening overlay 🟡 (NON-BLOCKING)
- **Phase:** 5 — container hardening (HANDLA-owned services)
- **Why:** `deploy/docker-compose.hardening.yml` adds `no-new-privileges:true`
  and `cap_drop: ALL` (with minimal per-service `cap_add`) to the four services
  HANDLA owns (mysql, redis, api, web). api/web are non-root Node → zero caps;
  mysql/redis get only CHOWN/SETUID/SETGID/DAC_OVERRIDE(+FOWNER for mysql).
- **BLOCKING?** NON-BLOCKING. No production change made by this phase; effective
  only when the overlay is included in the deploy command and containers recreate.
- **Exact steps:** add the overlay to the deploy command, e.g.
  `docker compose -f docker-compose.yml -f deploy/docker-compose.traefik.yml -f deploy/docker-compose.hardening.yml up -d`
  (or wire it into `deploy/deploy.traefik.sh`).
- **Verification after:** all four containers `healthy`; API `/api/health`=200;
  `docker inspect handla_api --format '{{.HostConfig.SecurityOpt}} {{.HostConfig.CapDrop}}'`
  shows `[no-new-privileges:true] [ALL]`.
- **Pre-verified in isolation (production untouched):** mysql:8.0 and
  redis:7-alpine (with HANDLA's custom ACL entrypoint) both start HEALTHY under
  `cap_drop: ALL` + the minimal cap set + `no-new-privileges`; ACL file written
  correctly; `NoNewPrivs: 1` confirmed in-kernel. api/web need no caps (non-root).

### F2. Harden the SHARED Traefik container 🟠 (BLOCKING for "Traefik hardened" — requires Traefik OWNER)
- **Phase:** 5 — container hardening (shared reverse proxy)
- **Why:** The `traefik` container is currently `no-new-privileges` OFF,
  `cap_drop` empty, `read_only` false. It should run with
  `no-new-privileges:true`, `cap_drop: ALL` + only `NET_BIND_SERVICE`, and a
  read-only rootfs (keeping `/certs` writable + a `/tmp` tmpfs).
- **BLOCKING / OWNERSHIP:** HANDLA **cannot** apply this. The container is owned
  by the **`tameerhome`** compose project (`/opt/tameerhome/docker-compose.yml`)
  and fronts multiple unrelated tenants. Per the multi-tenant safety rule, HANDLA
  must not edit another tenant's compose. This must be done by the Traefik/VPS
  owner.
- **Exact action:** merge the keys from `deploy/traefik-hardening.recommended.yml`
  into the `traefik` service in `/opt/tameerhome/docker-compose.yml`, then
  `cd /opt/tameerhome && docker compose up -d traefik`.
- **Verification after:** every tenant host still serves 200/redirect with a
  valid cert; ACME still renews (no acme write errors in `docker logs traefik`);
  `docker inspect traefik` shows the hardening flags. Full checklist is in the
  recommended file. Roll back by removing the four keys and recreating.
- **Security warning:** do NOT make `/certs` read-only (acme.json is written
  there). Test against ALL tenants, not just handla.tech, before considering done.
