# Handla Redis Production Hardening

**Date:** 2026-08-23 (UTC)
**Host:** srv1642049 · **App path:** /opt/handla · **Engine:** Redis 7.4.10 (`redis:7-alpine`, container `handla_redis`)
**Scope:** Add authentication and remove the unauthenticated access path to Redis without breaking the Bull email queue or the application.
**No secrets/passwords are recorded in this document.**

---

## 1. Before → After

| Aspect | Before | After |
|---|---|---|
| Authentication | **None** — `default` user `on nopass +@all ~* &*` | ACL user `handla_app` (password) + `default` user **disabled** |
| Unauthenticated access | Full read/write/admin for anyone who reached the port | `NOAUTH Authentication required` for every command |
| Application user | (used `default`) | dedicated `handla_app`, `+@all ~* &*` minus dangerous admin commands |
| Dangerous commands | All allowed | `FLUSHALL/FLUSHDB/CONFIG/SHUTDOWN/DEBUG/MODULE/ACL/CLUSTER/REPLICAOF/SLAVEOF/FAILOVER/SAVE/BGSAVE/BGREWRITEAOF/SWAPDB/RESET/MIGRATE/RESTORE` denied |
| Network | private bridge, no host port (unchanged) | private bridge, no host port (unchanged) |
| Persistence | RDB (`save 60 1`), AOF off, volume `redis_data` | unchanged |

## 2. Authentication model

- **Dedicated ACL user:** `handla_app` (username set via `REDIS_USERNAME`, default `handla_app`).
- **Password:** strong 40-char random secret, injected via `REDIS_PASSWORD` env only. Never committed, never printed.
- **ACL rule:** `on >…  ~* &* +@all <deny-list>` — full key space (`~*`) and pub/sub channels (`&*`), all command categories EXCEPT an explicit deny-list of administrative/destructive commands the app never needs.
- **default user:** `off nopass ~* &* -@all` — completely disabled; there is **no** unauthenticated path.

### Why `+@all` minus a deny-list (authentication isolation, not per-command least privilege)
Redis is a **dedicated single-purpose instance** used only by the Handla Bull email queue.
Bull (v4.16.5 on ioredis 5.11.1) requires a wide and version-dependent command set:
strings/lists/sets/sorted-sets/hashes, blocking ops (`BRPOPLPUSH`, `BZPOPMIN`),
pub/sub (`SUBSCRIBE`/`PUBLISH`), transactions (`MULTI`/`EXEC`), Lua scripting
(`EVAL`/`EVALSHA`/`SCRIPT`), `CLIENT`, `INFO`, key expiry, and `SCAN`. Proving a tight
per-command allow-list stays correct across Bull upgrades is fragile and risks silent
queue breakage. Per the hardening policy, the accepted model here is **authentication
isolation**: a dedicated, password-authenticated user on a private, dedicated instance,
with the built-in unauthenticated user disabled — hardened further by denying the
administrative/destructive commands Bull provably never uses (verified by testing).

## 3. Dangerous-command deny-list (Phase 17)

Denied for `handla_app` (tested → `NOPERM`): `FLUSHALL`, `FLUSHDB`, `SWAPDB`, `CONFIG`,
`SHUTDOWN`, `DEBUG`, `MODULE`, `ACL`, `CLUSTER`, `REPLICAOF`, `SLAVEOF`, `FAILOVER`,
`SAVE`, `BGSAVE`, `BGREWRITEAOF`, `RESET`, `MIGRATE`, `RESTORE`.

RDB persistence is unaffected: background saves are driven by the server's `--save 60 1`
directive, not by any client `SAVE` call, so denying `SAVE`/`BGSAVE` to the app is safe.

## 4. Persistence & recovery (Phases 12 / 21)

- **RDB** enabled (`save 60 1`) → `dump.rdb` on the `redis_data` Docker volume. **AOF disabled.**
- The queue is effectively **near-ephemeral operational state**: at hardening time it held only
  Bull housekeeping keys (`bull:email:id`, `bull:email:stalled-check`) and no pending jobs.
  Email jobs are short-lived (enqueue → send → remove).
- **Container recreation:** data survives via the volume; even a volume loss would only drop
  transient queue state (no durable business data lives in Redis — the system of record is MySQL).
- **Recovery model:** no new backup architecture introduced. If Redis data were lost, Bull
  re-initialises its queue keys automatically on next boot; in-flight email jobs (if any) would be
  the only loss. This is acceptable for the current usage and was left as-is.

## 5. Network model (Phases 2 / 18)

- Redis publishes **no host port** (`6379/tcp → null`); no host process listens on 6379.
- Redis is attached **only** to the private bridge `handla_handla_net` (172.16.5.3); it is **not**
  on Traefik's `proxy` network, so the reverse proxy cannot reach it.
- `protected-mode no` + `bind * -::*` are retained **intentionally**: inside the container Redis must
  accept connections from the API container over the private bridge, so binding only to loopback
  would break the app. Security is enforced by **(a) no host port publication, (b) private Docker
  network isolation, and (c) mandatory ACL authentication** — not by bind/protected-mode.
- Firewall (UFW 22/80/443 only) left unchanged — already correct.

## 6. Persistent configuration (Phase 8)

- `deploy/redis/redis-entrypoint.sh` (mounted read-only into the container) regenerates
  `/data/users.acl` from `REDIS_PASSWORD`/`REDIS_USERNAME` **on every boot**, then starts
  `redis-server --aclfile /data/users.acl --save 60 1 --loglevel warning`.
- This means: the ACL survives container recreation, a rotated password takes effect on the next
  recreate, and **no secret is baked into the image or committed to git**.
- The entrypoint **refuses to start** if `REDIS_PASSWORD` is unset (fail-closed — never falls back
  to an open Redis).
- Redis ACL files do not allow comment lines; the generated file therefore contains only `user`
  directives.

## 7. Application wiring (Phase 9)

- `handla-backend/src/modules/email/email.module.ts` (BullModule) passes optional
  `REDIS_USERNAME`/`REDIS_PASSWORD` to ioredis. Backward-compatible: when unset (local dev
  against an open Redis) behaviour is unchanged.
- `docker-compose.yml` injects `REDIS_USERNAME`/`REDIS_PASSWORD` into both the `redis` and `api`
  services and authenticates the redis healthcheck as `handla_app`.
- `deploy/deploy.traefik.sh` propagates `REDIS_USERNAME`/`REDIS_PASSWORD` from
  `handla-backend/.env` into the generated root `./.env` for Compose interpolation.

## 8. Secret handling (Phase 6)

- The password lives only in: production `handla-backend/.env` (mode 600) and a root-only backup at
  `/root/handla-deploy-key/redis-handla_app.secret` (mode 600).
- Never printed to the transcript, never committed, never in logs (healthcheck references the env
  var, not the literal value).

## 9. Verification summary

- Unauthenticated `PING`/`GET` → `NOAUTH`. `default` user AUTH → rejected.
- Authenticated `handla_app` `PING` → `PONG`; all 4 live app connections are `user=handla_app`.
- Bull end-to-end (enqueue → blocking dequeue → Lua → complete) verified twice (before and after a
  full Redis container recreation).
- Endpoints `/api/health`, `/en`, `/ar` → 200. All containers healthy.
- Config persistence proven by `--force-recreate` (auth + default-off survived).

## 10. Admin access note

There is intentionally **no** standing admin user (default is off; `handla_app` cannot run
admin commands). For rare operational needs, a root/Docker operator can add a temporary admin
user at runtime, e.g.:
```
docker exec handla_redis redis-cli --user handla_app -a "$REDIS_PASSWORD" ...   # app-scope only
# or add a throwaway admin, then remove it:
# docker exec handla_redis redis-cli ACL SETUSER opsadmin on '>...' '~*' '&*' +@all   (requires an
# existing admin; otherwise add REDIS_ADMIN_* handling to the entrypoint before deploy)
```
RDB persistence needs no admin (server-driven via `--save`).

## 11. Residual risk

1. `handla_app` holds `+@all` (minus admin) on `~*` — broad within this dedicated instance
   (authentication isolation, not per-command least privilege). Mitigated: dedicated single-purpose
   Redis, private network, no host port, admin commands denied.
2. App↔Redis traffic is plaintext on the private bridge (no TLS). Mitigated: single host, private
   bridge only, no public path. TLS not forced (low marginal benefit, breakage risk).
3. `protected-mode no` retained for container networking (see §5) — safe because of no host port +
   private network + mandatory auth.
4. No standing admin user (see §10) — a deliberate trade-off favouring security.

## 12. Rollback

Artifacts (VPS, `/root/handla-deploy-key/`, no secrets in git):
- `redis-config-baseline_<ts>.txt` — pre-hardening config snapshot.
- `redis-handla_app.secret` — the app password (mode 600).
- `backend-env.bak.<ts>` — pre-change backup of `handla-backend/.env`.

To roll back to the previous (open) Redis, if ever required:
1. Restore the redis service block in `docker-compose.yml` to
   `command: redis-server --save 60 1 --loglevel warning` (remove the custom entrypoint + env +
   authed healthcheck).
2. Restore `handla-backend/.env` from `backend-env.bak.<ts>` (removes `REDIS_*`), or leave the vars
   (harmless — the app only sends auth when the server requires it).
3. Recreate redis: `docker compose -f docker-compose.yml -f deploy/docker-compose.traefik.yml up -d --force-recreate redis`.
4. The API auto-reconnects; restart it only if needed: `docker compose ... up -d --force-recreate api`.
**Do NOT delete the `redis_data` volume during rollback.**
