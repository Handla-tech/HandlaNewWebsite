# HANDLA Production Monitoring & Alerting

Lightweight, host-side monitoring for the HANDLA production VPS (`srv1642049`).
No Prometheus/Grafana/Loki/ELK, no agents, no containers, no new public ports,
no Docker socket mounted anywhere. Pure root-owned bash + systemd timers reading
existing signals (journald, `docker` CLI, health endpoints, openssl, backup marker).

## Architecture
- `/usr/local/sbin/handla-monitor` (root:root 0750) — runs checks, applies
  dedup/cooldown/recovery, dispatches via `handla-alert`. Invoked by
  `handla-monitor.timer` every 5 min (`Persistent=true`, `RandomizedDelaySec=20`).
- `/usr/local/sbin/handla-alert` (root:root 0750) — central sanitized dispatcher.
  ALWAYS writes local spool `/var/lib/handla-monitor/alerts.log` + journald
  (`logger -t handla-alert`); optionally delivers to ONE external channel.
- State: `/var/lib/handla-monitor/state/` (root 0700), one file per dedup key.
- Config: `/etc/handla-monitor/monitor.conf` (0644, thresholds, no secrets) and
  `/etc/handla-monitor/alert.conf` (0600, external channel + secrets).

## Alert sources, thresholds, severities
| Subsystem | Signal | WARN | CRIT |
|---|---|---|---|
| disk / inode | `df -P` | 80% | 90% |
| memory | `/proc/meminfo` (no swap) | 85% | 95% |
| load | `/proc/loadavg` / cores | 1.5 (5m) | 2.5 (15m) |
| docker | `docker inspect` state/health/restarts | — | absent/not-running/unhealthy/restart-loop(≥5) |
| http | curl local+public health | — | 3 consecutive failures |
| http 5xx | Traefik logs (HANDLA `:3000/:3001` only) | 10/6m | 40/6m |
| backup | timer/marker/meta | — | stale >30h / timer down / non-AWS remote |
| mysql | container env creds → `SELECT 1` | conns ≥80% | not connectable |
| redis | ACL user → PING/INFO/Bull | mem ≥85%, bull≥10 | PING fail, bull≥50 |
| tls | openssl x509 enddate | ≤21d | ≤7d |
| ssh | journald/auth.log | ≥20 fails/h | ≥80 fails/h |

Severities: `INFO | WARNING | CRITICAL | RECOVERY`.

## Deduplication & recovery
State file per key: `<severity> <first_epoch> <last_sent_epoch>`. An alert is
sent only on (a) transition into alarm, (b) severity change, or (c) after
`REMIND_MIN` (360 min) still in alarm. A `RECOVERY` is sent once when a key
clears. This prevents alert storms.

## Schedules / unit names
- `handla-monitor.timer` → `handla-monitor.service` (every 5 min).
- `handla-monitor-summary.timer` → `handla-monitor-summary.service` (daily 07:00 UTC, LOCAL only).
- `handla-monitor-alert@.service` — OnFailure wrapper; wire into critical units
  with `OnFailure=handla-monitor-alert@%n.service` (e.g. handla-backup.service).

## External alert destination (REQUIRED — operator action)
Alerts reach OUTSIDE the VPS only when `alert.conf` has a real channel. Until then
`ALERT_CHANNEL=none` → alerts are LOCAL-ONLY (spool+journald). To enable:
1. `sudoedit /etc/handla-monitor/alert.conf` (0600).
2. Set `ALERT_CHANNEL=telegram|slack|smtp` and fill the matching secrets.
3. Test: `handla-alert INFO test manual "external test"` → expect
   `external=delivered(...)`.
See `alert.conf.example`. **Also recommended:** an independent off-VPS uptime
monitor (UptimeRobot/Healthchecks.io/etc.) for `https://handla.tech` and
`https://api.handla.tech/api/health` — a local monitor cannot detect total VPS
outage. This requires an operator account and is NOT auto-configured.

## Operations
- Run one check now: `handla-monitor <disk|memory|docker|http|backup|mysql|redis|tls|ssh|all>`
- Dry-run (print, don't dispatch): `HANDLA_MONITOR_DRYRUN=1 handla-monitor all`
- Self-test logic: `handla-monitor --selftest`
- Silence one alert temporarily: `rm /var/lib/handla-monitor/state/<key>` (re-fires
  next cycle if still bad) or `systemctl stop handla-monitor.timer` (re-enable after!).
- Rotate alert creds: edit `alert.conf`, then re-test as above.
- Verify backup monitoring: `handla-monitor backup` (silent = healthy).

## Security properties
No new public ports; no dashboard; no Docker socket exposure; scripts root-owned
0750 (not writable by deploy/app users); secrets only in `alert.conf` (0600) and
never logged (only delivery *status*); alert messages sanitized (control + shell
metachars stripped, length-bounded 800) and treated as DATA (never eval'd);
systemd units hardened (`NoNewPrivileges`, `ProtectSystem=strict`,
`CapabilityBoundingSet=`, `RestrictAddressFamilies`, etc.).

## What is NOT monitored / residual risks
- Total VPS/network outage — needs the off-VPS uptime monitor above (OPERATOR ACTION).
- External alert delivery is UNVERIFIED until an operator supplies a channel.
- Non-HANDLA tenants on this shared host are intentionally out of scope.
- Application-level security events (login/CSRF/SSRF) are only monitored as far
  as existing logs expose them; deep audit logging is a later phase.
- MinIO stand-in (`handla-minio-offhost`) is TEST-only and not alerted on.
