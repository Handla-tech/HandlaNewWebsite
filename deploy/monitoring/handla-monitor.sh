#!/usr/bin/env bash
# =============================================================================
# handla-monitor  —  lightweight production monitoring for HANDLA
# =============================================================================
# INSTALLED AT (VPS):  /usr/local/sbin/handla-monitor   (root:root 0750)
# INVOKED BY:          systemd handla-monitor.timer (every 5 min)
#
# DESIGN
#   * Pure host-side POSIX-ish bash. No agents, no containers, no open ports,
#     no Docker socket mounted anywhere. Reads existing signals only:
#       journald, /var/log/auth.log, root `docker` CLI, the API /api/health
#       endpoint, openssl (TLS), and the backup last-success marker.
#   * SCOPE = HANDLA components ONLY. This host is shared with other tenants;
#     we never touch or alert on non-HANDLA containers.
#   * Stateful dedup/cooldown/recovery via /var/lib/handla-monitor/state/.
#   * Every alert goes through /usr/local/sbin/handla-alert (sanitized).
#
# EXIT CODES
#   0 always (a monitoring run should not itself "fail" the timer); individual
#   problems are surfaced as alerts, not as process failure. --selftest returns
#   nonzero on internal assertion failure (used by tests).
# =============================================================================

set -uo pipefail
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
umask 077

# ── configuration (overridable via /etc/handla-monitor/monitor.conf) ─────────
CONF="/etc/handla-monitor/monitor.conf"
ALERT_BIN="${ALERT_BIN:-/usr/local/sbin/handla-alert}"
STATE_DIR="${STATE_DIR:-/var/lib/handla-monitor}"
STATE="$STATE_DIR/state"

# HANDLA containers to watch (explicit allow-list; never other tenants)
HANDLA_CONTAINERS="${HANDLA_CONTAINERS:-handla_api handla_web handla_mysql handla_redis traefik docker-socket-proxy}"
# containers that must have a healthy Docker healthcheck
HANDLA_HEALTHCHECKED="${HANDLA_HEALTHCHECKED:-handla_api handla_web handla_mysql handla_redis}"

# thresholds
DISK_WARN="${DISK_WARN:-80}";      DISK_CRIT="${DISK_CRIT:-90}"
INODE_WARN="${INODE_WARN:-80}";    INODE_CRIT="${INODE_CRIT:-90}"
MEM_WARN="${MEM_WARN:-85}";        MEM_CRIT="${MEM_CRIT:-95}"
LOAD_WARN_RATIO="${LOAD_WARN_RATIO:-1.5}"   # load/core sustained (10m avg)
LOAD_CRIT_RATIO="${LOAD_CRIT_RATIO:-2.5}"   # load/core sustained (15m avg)
BACKUP_STALE_HOURS="${BACKUP_STALE_HOURS:-30}"
RESTART_LOOP_THRESHOLD="${RESTART_LOOP_THRESHOLD:-5}"   # restarts since last run
HTTP_FAIL_THRESHOLD="${HTTP_FAIL_THRESHOLD:-3}"         # consecutive failures
SSH_FAIL_WARN="${SSH_FAIL_WARN:-20}"                    # failed pw / window
SSH_FAIL_CRIT="${SSH_FAIL_CRIT:-80}"
HTTP5XX_WARN="${HTTP5XX_WARN:-10}"                      # 5xx in window
HTTP5XX_CRIT="${HTTP5XX_CRIT:-40}"
MYSQL_CONN_WARN_PCT="${MYSQL_CONN_WARN_PCT:-80}"        # % of max_connections
REDIS_MEM_WARN_PCT="${REDIS_MEM_WARN_PCT:-85}"          # % of maxmemory (if set)
TLS_WARN_DAYS="${TLS_WARN_DAYS:-21}";  TLS_CRIT_DAYS="${TLS_CRIT_DAYS:-7}"
COOLDOWN_MIN="${COOLDOWN_MIN:-45}"                      # re-alert suppression
REMIND_MIN="${REMIND_MIN:-360}"                         # remind after N min still-bad

# what to check by default; a single check can be run via: handla-monitor <check>
MYSQL_CONTAINER="${MYSQL_CONTAINER:-handla_mysql}"
REDIS_CONTAINER="${REDIS_CONTAINER:-handla_redis}"
API_HEALTH_URL="${API_HEALTH_URL:-http://127.0.0.1:3001/api/health}"
EXT_FRONTEND_URL="${EXT_FRONTEND_URL:-https://handla.tech/}"
EXT_API_URL="${EXT_API_URL:-https://api.handla.tech/api/health}"
TLS_DOMAINS="${TLS_DOMAINS:-handla.tech api.handla.tech}"

if [ -r "$CONF" ]; then set +u; source "$CONF" 2>/dev/null; set -u; fi

mkdir -p "$STATE" 2>/dev/null || true
chmod 700 "$STATE_DIR" "$STATE" 2>/dev/null || true

NOW_EPOCH="$(date -u +%s)"
DRY_RUN="${HANDLA_MONITOR_DRYRUN:-0}"   # 1 = print alerts instead of sending (tests)

log() { printf '%s [handla-monitor] %s\n' "$(date -u +%FT%TZ)" "$*"; }

# ─────────────────────────────────────────────────────────────────────────────
# DEDUP / COOLDOWN / RECOVERY ENGINE
# State file per dedup key: "<severity> <first_epoch> <last_sent_epoch>"
# raise KEY SEVERITY COMPONENT REASON  → sends on transition / severity change /
#                                        remind interval; else suppresses.
# clear KEY COMPONENT [REASON]        → if key was in alarm, sends RECOVERY once.
# ─────────────────────────────────────────────────────────────────────────────
_send() {  # _send SEVERITY COMPONENT KEY REASON...
  local sev="$1" comp="$2" key="$3"; shift 3; local reason="$*"
  if [ "$DRY_RUN" = "1" ]; then
    echo "ALERT ${sev} ${comp} ${key} :: ${reason}"
    return 0
  fi
  "$ALERT_BIN" "$sev" "$comp" "$key" "$reason" >/dev/null 2>&1 || \
    log "WARN: alert dispatch failed for key=$key"
}

_state_file() { printf '%s/%s' "$STATE" "$(printf '%s' "$1" | tr -c 'A-Za-z0-9._-' '_')"; }

raise() {  # raise KEY SEVERITY COMPONENT REASON...
  local key="$1" sev="$2" comp="$3"; shift 3; local reason="$*"
  local sf; sf="$(_state_file "$key")"
  local prev_sev="" first="$NOW_EPOCH" last_sent=0
  if [ -f "$sf" ]; then read -r prev_sev first last_sent < "$sf" 2>/dev/null; fi
  [ -n "$first" ] || first="$NOW_EPOCH"
  [ -n "$last_sent" ] || last_sent=0
  local age_min=$(( (NOW_EPOCH - last_sent) / 60 ))
  local do_send=0
  if [ -z "$prev_sev" ] || [ "$prev_sev" = "OK" ]; then
    do_send=1                                   # transition into alarm
  elif [ "$prev_sev" != "$sev" ]; then
    do_send=1                                   # severity changed
  elif [ "$age_min" -ge "$REMIND_MIN" ]; then
    do_send=1                                   # periodic reminder
  fi
  if [ "$do_send" = "1" ]; then
    _send "$sev" "$comp" "$key" "$reason"
    printf '%s %s %s\n' "$sev" "$first" "$NOW_EPOCH" > "$sf"
  else
    # keep first-seen + last_sent, only refresh severity marker
    printf '%s %s %s\n' "$sev" "$first" "$last_sent" > "$sf"
  fi
}

clear_key() {  # clear_key KEY COMPONENT [REASON...]
  local key="$1" comp="$2"; shift 2; local reason="${*:-condition cleared}"
  local sf; sf="$(_state_file "$key")"
  if [ -f "$sf" ]; then
    local prev_sev first last_sent; read -r prev_sev first last_sent < "$sf" 2>/dev/null
    if [ -n "$prev_sev" ] && [ "$prev_sev" != "OK" ] && [ "$prev_sev" != "RECOVERY" ]; then
      local dur_min=$(( (NOW_EPOCH - ${first:-$NOW_EPOCH}) / 60 ))
      _send RECOVERY "$comp" "$key" "$reason (was $prev_sev for ~${dur_min}m)"
    fi
    rm -f "$sf" 2>/dev/null || true
  fi
}

# small helper: numeric compare "a >= b" for floats
fge() { awk -v a="$1" -v b="$2" 'BEGIN{exit !(a+0>=b+0)}'; }

# ─────────────────────────────────────────────────────────────────────────────
# CHECK: disk / inodes  (Phase 7)
# ─────────────────────────────────────────────────────────────────────────────
check_disk() {
  local line pct mnt fs
  # only real block filesystems (skip tmpfs/overlay duplicates); root is what matters
  while read -r fs _ _ _ pct mnt; do
    pct="${pct%\%}"
    [[ "$pct" =~ ^[0-9]+$ ]] || continue
    local key="disk.$mnt"
    if [ "$pct" -ge "$DISK_CRIT" ]; then
      raise "$key" CRITICAL disk "Filesystem $mnt at ${pct}% (>= ${DISK_CRIT}% critical)"
    elif [ "$pct" -ge "$DISK_WARN" ]; then
      raise "$key" WARNING disk "Filesystem $mnt at ${pct}% (>= ${DISK_WARN}% warning)"
    else
      clear_key "$key" disk "Filesystem $mnt back to ${pct}%"
    fi
  done < <(df -P -x tmpfs -x devtmpfs -x overlay -x squashfs 2>/dev/null | awk 'NR>1{print $1,$2,$3,$4,$5,$6}')

  # inodes
  while read -r fs _ _ _ pct mnt; do
    pct="${pct%\%}"
    [[ "$pct" =~ ^[0-9]+$ ]] || continue
    local key="inode.$mnt"
    if [ "$pct" -ge "$INODE_CRIT" ]; then
      raise "$key" CRITICAL disk "Inodes on $mnt at ${pct}% (>= ${INODE_CRIT}% critical)"
    elif [ "$pct" -ge "$INODE_WARN" ]; then
      raise "$key" WARNING disk "Inodes on $mnt at ${pct}% (>= ${INODE_WARN}% warning)"
    else
      clear_key "$key" disk "Inodes on $mnt back to ${pct}%"
    fi
  done < <(df -P -i -x tmpfs -x devtmpfs -x overlay -x squashfs 2>/dev/null | awk 'NR>1{print $1,$2,$3,$4,$5,$6}')
}

# ─────────────────────────────────────────────────────────────────────────────
# CHECK: memory  (Phase 7) — no swap on this host, so mem pressure is serious
# ─────────────────────────────────────────────────────────────────────────────
check_memory() {
  local total avail usedpct
  total="$(awk '/^MemTotal:/{print $2}' /proc/meminfo)"
  avail="$(awk '/^MemAvailable:/{print $2}' /proc/meminfo)"
  [ -n "$total" ] && [ -n "$avail" ] && [ "$total" -gt 0 ] || return 0
  usedpct=$(( (total - avail) * 100 / total ))
  local key="mem.used"
  if [ "$usedpct" -ge "$MEM_CRIT" ]; then
    raise "$key" CRITICAL memory "Memory used ${usedpct}% (>= ${MEM_CRIT}% critical; no swap configured)"
  elif [ "$usedpct" -ge "$MEM_WARN" ]; then
    raise "$key" WARNING memory "Memory used ${usedpct}% (>= ${MEM_WARN}% warning; no swap configured)"
  else
    clear_key "$key" memory "Memory used back to ${usedpct}%"
  fi
  # swap pressure only if swap exists
  local swt swf
  swt="$(awk '/^SwapTotal:/{print $2}' /proc/meminfo)"; swf="$(awk '/^SwapFree:/{print $2}' /proc/meminfo)"
  if [ -n "$swt" ] && [ "$swt" -gt 0 ]; then
    local swused=$(( (swt - swf) * 100 / swt ))
    local sk="mem.swap"
    if [ "$swused" -ge 50 ]; then raise "$sk" WARNING memory "Swap used ${swused}%"
    else clear_key "$sk" memory "Swap used back to ${swused}%"; fi
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# CHECK: cpu / load  (Phase 7) — use sustained 5m/15m averages, not spikes
# ─────────────────────────────────────────────────────────────────────────────
check_load() {
  local cores l5 l15 r5 r15
  cores="$(nproc 2>/dev/null || echo 1)"; [ "$cores" -ge 1 ] || cores=1
  read -r _ l5 l15 _ < /proc/loadavg   # fields: 1m 5m 15m ...
  # /proc/loadavg is: 1m 5m 15m running/total lastpid -> we want $2=1m,$3=5m,$4=15m
  l5="$(awk '{print $2}' /proc/loadavg)"; l15="$(awk '{print $3}' /proc/loadavg)"
  r5="$(awk -v l="$l5" -v c="$cores" 'BEGIN{printf "%.2f", l/c}')"
  r15="$(awk -v l="$l15" -v c="$cores" 'BEGIN{printf "%.2f", l/c}')"
  local key="load"
  if fge "$r15" "$LOAD_CRIT_RATIO"; then
    raise "$key" CRITICAL cpu "Sustained load high: 15m load/core=${r15} (>= ${LOAD_CRIT_RATIO}); cores=${cores} l15=${l15}"
  elif fge "$r5" "$LOAD_WARN_RATIO"; then
    raise "$key" WARNING cpu "Elevated load: 5m load/core=${r5} (>= ${LOAD_WARN_RATIO}); cores=${cores} l5=${l5}"
  else
    clear_key "$key" cpu "Load normal (5m/core=${r5}, 15m/core=${r15})"
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# CHECK: docker containers  (Phase 8) — HANDLA scope only; host-side root CLI
# ─────────────────────────────────────────────────────────────────────────────
check_docker() {
  command -v docker >/dev/null 2>&1 || { raise "docker.daemon" CRITICAL docker "docker CLI unavailable on host"; return; }
  if ! docker info >/dev/null 2>&1; then
    raise "docker.daemon" CRITICAL docker "Docker daemon not responding to 'docker info'"
    return
  fi
  clear_key "docker.daemon" docker "Docker daemon responding"

  local c present state health restarts prev_restarts rf
  for c in $HANDLA_CONTAINERS; do
    present="$(docker ps -a --filter "name=^/${c}$" --format '{{.Names}}' 2>/dev/null)"
    if [ "$present" != "$c" ]; then
      raise "docker.$c.absent" CRITICAL docker "Expected HANDLA container '$c' is absent"
      continue
    fi
    clear_key "docker.$c.absent" docker "Container '$c' present"
    state="$(docker inspect -f '{{.State.Status}}' "$c" 2>/dev/null)"
    health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$c" 2>/dev/null)"
    restarts="$(docker inspect -f '{{.RestartCount}}' "$c" 2>/dev/null)"; [ -n "$restarts" ] || restarts=0

    # running state
    if [ "$state" != "running" ]; then
      raise "docker.$c.state" CRITICAL docker "Container '$c' state=$state (expected running)"
    else
      clear_key "docker.$c.state" docker "Container '$c' running"
    fi

    # health (only for containers that define a healthcheck)
    if [ "$health" = "unhealthy" ]; then
      raise "docker.$c.health" CRITICAL docker "Container '$c' healthcheck=unhealthy"
    elif [ "$health" = "healthy" ] || [ "$health" = "none" ] || [ "$health" = "starting" ]; then
      clear_key "docker.$c.health" docker "Container '$c' health=$health"
    fi

    # restart loop detection: compare restart count vs last observed
    rf="$STATE/restarts.$c"
    prev_restarts=0; [ -f "$rf" ] && prev_restarts="$(cat "$rf" 2>/dev/null)"
    [[ "$prev_restarts" =~ ^[0-9]+$ ]] || prev_restarts=0
    local delta=$(( restarts - prev_restarts ))
    if [ "$delta" -ge "$RESTART_LOOP_THRESHOLD" ]; then
      raise "docker.$c.restartloop" CRITICAL docker "Container '$c' restarted ${delta}x since last check (loop?)"
    elif [ "$delta" -eq 0 ]; then
      clear_key "docker.$c.restartloop" docker "Container '$c' restart count stable ($restarts)"
    fi
    printf '%s' "$restarts" > "$rf" 2>/dev/null || true
  done
}

# ─────────────────────────────────────────────────────────────────────────────
# CHECK: HTTP availability  (Phase 9) — local API + external site/API
# Counts CONSECUTIVE failures in state; alerts only after HTTP_FAIL_THRESHOLD.
# ─────────────────────────────────────────────────────────────────────────────
_http_probe() {  # _http_probe URL  -> prints "code|tlsverify" ; rc0 if reachable
  curl -sS -o /dev/null --max-time 12 \
       -w '%{http_code}|%{ssl_verify_result}' "$1" 2>/dev/null
}
_http_track() {  # _http_track KEY COMPONENT URL GOOD_REGEX DESC
  local key="$1" comp="$2" url="$3" good="$4" desc="$5"
  local cf="$STATE/httpfail.$(printf '%s' "$key" | tr -c 'A-Za-z0-9._-' '_')"
  local out code tls fails=0
  [ -f "$cf" ] && fails="$(cat "$cf" 2>/dev/null)"; [[ "$fails" =~ ^[0-9]+$ ]] || fails=0
  out="$(_http_probe "$url")"; code="${out%%|*}"; tls="${out##*|}"
  local ok=0
  if [[ "$code" =~ $good ]]; then
    # for HTTPS, require TLS verification success (0)
    if [[ "$url" == https://* ]] && [ "${tls:-1}" != "0" ]; then ok=0; else ok=1; fi
  fi
  if [ "$ok" = "1" ]; then
    printf '0' > "$cf"
    clear_key "$key" "$comp" "$desc reachable (HTTP $code)"
  else
    fails=$((fails+1)); printf '%s' "$fails" > "$cf"
    local reason="$desc failed check ${fails}x (HTTP ${code:-none}$([ "${tls:-0}" != 0 ] && echo ", tls_verify=$tls"))"
    if [ "$fails" -ge "$HTTP_FAIL_THRESHOLD" ]; then
      raise "$key" CRITICAL "$comp" "$reason (>= ${HTTP_FAIL_THRESHOLD} consecutive)"
    fi
    # below threshold: stay quiet (avoid single-transient spam)
  fi
}
check_http() {
  _http_track "http.api.local"  http "$API_HEALTH_URL"  '^(200)$'          "Local API /api/health"
  _http_track "http.api.ext"    http "$EXT_API_URL"     '^(200)$'          "Public API https://api.handla.tech/api/health"
  _http_track "http.web.ext"    http "$EXT_FRONTEND_URL" '^(200|301|302|308)$' "Public site https://handla.tech"
}

# ─────────────────────────────────────────────────────────────────────────────
# CHECK: HTTP error-rate from Traefik access logs  (Phase 10)
# Traefik is SHARED across tenants; we count 5xx only for HANDLA hostnames so
# we never alert on other tenants' errors. Window = entries since last run.
# ─────────────────────────────────────────────────────────────────────────────
check_http_errors() {
  command -v docker >/dev/null 2>&1 || return 0
  docker inspect traefik >/dev/null 2>&1 || return 0
  # Pull recent access lines; Traefik CLF has status as the field after the
  # quoted request. Restrict to HANDLA vhosts by referer/host heuristic is not
  # reliable in CLF, so we scope by the upstream server address labels we know:
  #   handla_api -> :3001 ; handla_web -> :3000. Those appear in the log line.
  local since window logs n5xx n401 n403
  since="${HTTP_ERR_WINDOW:-6m}"
  logs="$(docker logs --since "$since" traefik 2>&1 | grep -E ':300[01]"' 2>/dev/null)"
  # count HTTP status codes in the CLF (field 9 in standard combined format)
  n5xx="$(printf '%s\n' "$logs" | awk '{for(i=1;i<=NF;i++) if($i ~ /^5[0-9][0-9]$/){print;break}}' | wc -l)"
  n401="$(printf '%s\n' "$logs" | grep -c ' 401 ' 2>/dev/null)"
  n403="$(printf '%s\n' "$logs" | grep -c ' 403 ' 2>/dev/null)"
  [[ "$n5xx" =~ ^[0-9]+$ ]] || n5xx=0
  local key="http.5xx"
  if [ "$n5xx" -ge "$HTTP5XX_CRIT" ]; then
    raise "$key" CRITICAL http "HANDLA 5xx spike: ${n5xx} in last ${since} (>= ${HTTP5XX_CRIT})"
  elif [ "$n5xx" -ge "$HTTP5XX_WARN" ]; then
    raise "$key" WARNING http "HANDLA 5xx elevated: ${n5xx} in last ${since} (>= ${HTTP5XX_WARN})"
  else
    clear_key "$key" http "HANDLA 5xx normal (${n5xx} in last ${since})"
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# CHECK: backup freshness / integrity of state  (Phase 6) — HIGH PRIORITY
# ─────────────────────────────────────────────────────────────────────────────
check_backup() {
  local marker="/var/lib/handla-backup/last-success"
  local meta="/var/lib/handla-backup/last-success.meta"
  # timer must be enabled + present.
  # NB: capture to a var first — `cmd | grep -q` under `set -o pipefail` can
  # spuriously report failure when grep closes the pipe early (SIGPIPE on cmd).
  local unit_files; unit_files="$(systemctl list-unit-files 2>/dev/null)"
  if ! printf '%s\n' "$unit_files" | grep -q '^handla-backup\.timer'; then
    raise "backup.timer.missing" CRITICAL backup "handla-backup.timer not installed"
    return
  fi
  clear_key "backup.timer.missing" backup "handla-backup.timer installed"
  local ten="$(systemctl is-enabled handla-backup.timer 2>/dev/null)"
  local tac="$(systemctl is-active  handla-backup.timer 2>/dev/null)"
  if [ "$ten" != "enabled" ] || [ "$tac" != "active" ]; then
    raise "backup.timer.inactive" CRITICAL backup "handla-backup.timer not active/enabled (enabled=$ten active=$tac)"
  else
    clear_key "backup.timer.inactive" backup "handla-backup.timer active+enabled"
  fi
  # last service run must not be failed
  local res="$(systemctl show handla-backup.service -p Result --value 2>/dev/null)"
  if [ -n "$res" ] && [ "$res" != "success" ]; then
    raise "backup.service.failed" CRITICAL backup "Last handla-backup.service Result=$res"
  else
    clear_key "backup.service.failed" backup "Last handla-backup.service Result=success"
  fi
  # marker must exist + be fresh
  if [ ! -f "$marker" ]; then
    raise "backup.marker.missing" CRITICAL backup "Backup last-success marker missing ($marker)"
    return
  fi
  clear_key "backup.marker.missing" backup "Backup marker present"
  local mtime age_h
  mtime="$(stat -c %Y "$marker" 2>/dev/null)"; [ -n "$mtime" ] || mtime=0
  age_h=$(( (NOW_EPOCH - mtime) / 3600 ))
  if [ "$age_h" -ge "$BACKUP_STALE_HOURS" ]; then
    raise "backup.stale" CRITICAL backup "No successful backup for ${age_h}h (threshold ${BACKUP_STALE_HOURS}h)"
  else
    clear_key "backup.stale" backup "Backup fresh (${age_h}h old)"
  fi
  # remote must be AWS (no MinIO production fallback)
  if [ -f "$meta" ]; then
    if grep -q 'remote=handla-backups-aws:' "$meta" 2>/dev/null; then
      clear_key "backup.remote.wrong" backup "Backup remote is AWS"
    elif grep -qiE 'remote=.*(minio|handlabackup:)' "$meta" 2>/dev/null; then
      raise "backup.remote.wrong" CRITICAL backup "Latest backup used a non-AWS (MinIO/test) remote"
    fi
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# CHECK: MySQL  (Phase 13) — creds read from container env at runtime, never CLI
# ─────────────────────────────────────────────────────────────────────────────
check_mysql() {
  command -v docker >/dev/null 2>&1 || return 0
  docker inspect "$MYSQL_CONTAINER" >/dev/null 2>&1 || { raise "mysql.absent" CRITICAL mysql "MySQL container '$MYSQL_CONTAINER' absent"; return; }
  clear_key "mysql.absent" mysql "MySQL container present"
  local pw; pw="$(docker exec "$MYSQL_CONTAINER" printenv MYSQL_ROOT_PASSWORD 2>/dev/null)"
  if [ -z "$pw" ]; then
    raise "mysql.credread" WARNING mysql "Could not read MySQL admin credential from container env"
    return
  fi
  clear_key "mysql.credread" mysql "MySQL admin credential readable"
  # ping via authenticated SELECT (password via env, never argv)
  if ! docker exec -e MYSQL_PWD="$pw" "$MYSQL_CONTAINER" mysql -uroot -N -e "SELECT 1;" >/dev/null 2>&1; then
    raise "mysql.conn" CRITICAL mysql "MySQL not accepting authenticated connections"
    return
  fi
  clear_key "mysql.conn" mysql "MySQL accepting connections"
  # connection saturation
  local maxc curc pct
  maxc="$(docker exec -e MYSQL_PWD="$pw" "$MYSQL_CONTAINER" mysql -uroot -N -e "SELECT @@max_connections;" 2>/dev/null)"
  curc="$(docker exec -e MYSQL_PWD="$pw" "$MYSQL_CONTAINER" mysql -uroot -N -e "SELECT VARIABLE_VALUE FROM performance_schema.global_status WHERE VARIABLE_NAME='THREADS_CONNECTED';" 2>/dev/null)"
  if [[ "$maxc" =~ ^[0-9]+$ ]] && [[ "$curc" =~ ^[0-9]+$ ]] && [ "$maxc" -gt 0 ]; then
    pct=$(( curc * 100 / maxc ))
    if [ "$pct" -ge "$MYSQL_CONN_WARN_PCT" ]; then
      raise "mysql.conns" WARNING mysql "MySQL connections ${curc}/${maxc} (${pct}% >= ${MYSQL_CONN_WARN_PCT}%)"
    else
      clear_key "mysql.conns" mysql "MySQL connections ${curc}/${maxc} (${pct}%)"
    fi
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# CHECK: Redis + Bull queue  (Phase 14) — via existing ACL user, no ACL widening
# ─────────────────────────────────────────────────────────────────────────────
check_redis() {
  command -v docker >/dev/null 2>&1 || return 0
  docker inspect "$REDIS_CONTAINER" >/dev/null 2>&1 || { raise "redis.absent" CRITICAL redis "Redis container '$REDIS_CONTAINER' absent"; return; }
  clear_key "redis.absent" redis "Redis container present"
  local ru rp; ru="$(docker exec "$REDIS_CONTAINER" printenv REDIS_USERNAME 2>/dev/null)"; rp="$(docker exec "$REDIS_CONTAINER" printenv REDIS_PASSWORD 2>/dev/null)"
  if [ -z "$rp" ]; then raise "redis.credread" WARNING redis "Could not read Redis ACL credential"; return; fi
  clear_key "redis.credread" redis "Redis ACL credential readable"
  local rc; rc="$(docker exec -e REDISCLI_AUTH="$rp" "$REDIS_CONTAINER" redis-cli --user "$ru" PING 2>/dev/null | tr -d '\r')"
  if [ "$rc" != "PONG" ]; then raise "redis.ping" CRITICAL redis "Redis PING did not return PONG (got '${rc:-none}')"; return; fi
  clear_key "redis.ping" redis "Redis PING ok"
  # memory vs maxmemory (only if maxmemory>0), evictions, rejected connections
  local info used maxm ev rej
  info="$(docker exec -e REDISCLI_AUTH="$rp" "$REDIS_CONTAINER" redis-cli --user "$ru" INFO 2>/dev/null | tr -d '\r')"
  used="$(printf '%s\n' "$info" | awk -F: '/^used_memory:/{print $2}')"
  maxm="$(printf '%s\n' "$info" | awk -F: '/^maxmemory:/{print $2}')"
  ev="$(printf '%s\n'   "$info" | awk -F: '/^evicted_keys:/{print $2}')"
  rej="$(printf '%s\n'  "$info" | awk -F: '/^rejected_connections:/{print $2}')"
  if [[ "$maxm" =~ ^[0-9]+$ ]] && [ "$maxm" -gt 0 ] && [[ "$used" =~ ^[0-9]+$ ]]; then
    local pct=$(( used * 100 / maxm ))
    if [ "$pct" -ge "$REDIS_MEM_WARN_PCT" ]; then raise "redis.mem" WARNING redis "Redis memory ${pct}% of maxmemory (>= ${REDIS_MEM_WARN_PCT}%)"
    else clear_key "redis.mem" redis "Redis memory ${pct}% of maxmemory"; fi
  fi
  # evictions delta
  local evf="$STATE/redis.evicted"; local prev=0; [ -f "$evf" ] && prev="$(cat "$evf" 2>/dev/null)"; [[ "$prev" =~ ^[0-9]+$ ]] || prev=0
  [[ "$ev" =~ ^[0-9]+$ ]] || ev=0
  if [ "$ev" -gt "$prev" ]; then raise "redis.evict" WARNING redis "Redis evicted ${ev} keys total (was $prev)"; fi
  printf '%s' "$ev" > "$evf" 2>/dev/null || true
  [[ "$rej" =~ ^[0-9]+$ ]] && [ "$rej" -gt 0 ] && raise "redis.rejected" WARNING redis "Redis rejected_connections=$rej"
  # Bull email queue: alert on failed jobs backlog
  local failed
  failed="$(docker exec -e REDISCLI_AUTH="$rp" "$REDIS_CONTAINER" redis-cli --user "$ru" LLEN 'bull:email:failed' 2>/dev/null | tr -d '\r')"
  if [[ "$failed" =~ ^[0-9]+$ ]]; then
    if [ "$failed" -ge "${BULL_FAILED_CRIT:-50}" ]; then raise "redis.bull.failed" CRITICAL redis "Bull email queue failed jobs=${failed}"
    elif [ "$failed" -ge "${BULL_FAILED_WARN:-10}" ]; then raise "redis.bull.failed" WARNING redis "Bull email queue failed jobs=${failed}"
    else clear_key "redis.bull.failed" redis "Bull email failed jobs=${failed}"; fi
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# CHECK: TLS certificate expiry  (Phase 15) — real cert data via openssl
# ─────────────────────────────────────────────────────────────────────────────
check_tls() {
  command -v openssl >/dev/null 2>&1 || return 0
  local d enddate end_epoch days
  for d in $TLS_DOMAINS; do
    enddate="$(echo | timeout 15 openssl s_client -servername "$d" -connect "$d:443" 2>/dev/null \
               | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)"
    [ -n "$enddate" ] || { raise "tls.$d.probe" WARNING tls "Could not read TLS certificate for $d"; continue; }
    clear_key "tls.$d.probe" tls "TLS certificate readable for $d"
    end_epoch="$(date -u -d "$enddate" +%s 2>/dev/null)"; [ -n "$end_epoch" ] || continue
    days=$(( (end_epoch - NOW_EPOCH) / 86400 ))
    if [ "$days" -le "$TLS_CRIT_DAYS" ]; then
      raise "tls.$d.expiry" CRITICAL tls "TLS cert for $d expires in ${days}d (<= ${TLS_CRIT_DAYS}d)"
    elif [ "$days" -le "$TLS_WARN_DAYS" ]; then
      raise "tls.$d.expiry" WARNING tls "TLS cert for $d expires in ${days}d (<= ${TLS_WARN_DAYS}d)"
    else
      clear_key "tls.$d.expiry" tls "TLS cert for $d valid ${days}d"
    fi
  done
}

# ─────────────────────────────────────────────────────────────────────────────
# CHECK: SSH / host security  (Phases 11/12) — journald + auth.log
# ─────────────────────────────────────────────────────────────────────────────
check_ssh() {
  local since="${SSH_WINDOW:-1 hour ago}"
  local jr failed invalid rootok sudo_fail
  jr="$(journalctl -u ssh -u sshd --no-pager --since "$since" 2>/dev/null)"
  [ -n "$jr" ] || jr="$(grep -E "$(date -u '+%b %e')" /var/log/auth.log 2>/dev/null)"
  failed="$(printf '%s\n' "$jr" | grep -c 'Failed password' 2>/dev/null)"
  invalid="$(printf '%s\n' "$jr" | grep -c 'Invalid user' 2>/dev/null)"
  rootok="$(printf '%s\n' "$jr" | grep -c 'Accepted .* for root ' 2>/dev/null)"
  sudo_fail="$(journalctl --no-pager --since "$since" 2>/dev/null | grep -c 'sudo:.*authentication failure' 2>/dev/null)"
  [[ "$failed" =~ ^[0-9]+$ ]] || failed=0; [[ "$invalid" =~ ^[0-9]+$ ]] || invalid=0
  [[ "$rootok" =~ ^[0-9]+$ ]] || rootok=0; [[ "$sudo_fail" =~ ^[0-9]+$ ]] || sudo_fail=0

  local total=$(( failed + invalid ))
  if [ "$total" -ge "$SSH_FAIL_CRIT" ]; then
    raise "ssh.bruteforce" CRITICAL ssh "SSH auth failures high: ${failed} failed + ${invalid} invalid-user in last hour (>= ${SSH_FAIL_CRIT})"
  elif [ "$total" -ge "$SSH_FAIL_WARN" ]; then
    raise "ssh.bruteforce" WARNING ssh "SSH auth failures: ${failed} failed + ${invalid} invalid-user in last hour (>= ${SSH_FAIL_WARN})"
  else
    clear_key "ssh.bruteforce" ssh "SSH auth failures normal (${total} in last hour)"
  fi

  # successful root SSH login: informational security-relevant event.
  # Dedup on count so we only notify when NEW root logins appear since last run.
  local rf="$STATE/ssh.rootlogins"; local prev=0; [ -f "$rf" ] && prev="$(cat "$rf" 2>/dev/null)"; [[ "$prev" =~ ^[0-9]+$ ]] || prev=0
  # count total root accepts today for a stable baseline
  local rday; rday="$(journalctl -u ssh -u sshd --no-pager --since 'today' 2>/dev/null | grep -c 'Accepted .* for root ')"
  [[ "$rday" =~ ^[0-9]+$ ]] || rday=0
  if [ "${ALERT_ON_ROOT_SSH:-0}" = "1" ] && [ "$rday" -gt "$prev" ]; then
    _send INFO ssh "ssh.rootlogin" "New successful root SSH login(s) observed today (total=${rday})"
  fi
  printf '%s' "$rday" > "$rf" 2>/dev/null || true

  # repeated sudo authentication failures
  if [ "$sudo_fail" -ge "${SUDO_FAIL_WARN:-5}" ]; then
    raise "ssh.sudofail" WARNING ssh "sudo authentication failures: ${sudo_fail} in last hour"
  else
    clear_key "ssh.sudofail" ssh "sudo auth failures normal (${sudo_fail})"
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# PERIODIC LOCAL SECURITY SUMMARY  (Phase 18)
# Writes a concise local summary to the spool. NEVER dispatched externally
# unless SUMMARY_EXTERNAL=1 explicitly set AND transport configured. Contains
# no secrets — only counts/states.
# ─────────────────────────────────────────────────────────────────────────────
check_summary() {
  local up disk mem sshf n5xx dbst rdst bkage
  up="$(uptime -p 2>/dev/null || echo 'n/a')"
  disk="$(df -P / 2>/dev/null | awk 'NR==2{print $5}')"
  local mt ma; mt="$(awk '/^MemTotal:/{print $2}' /proc/meminfo)"; ma="$(awk '/^MemAvailable:/{print $2}' /proc/meminfo)"
  if [ -n "$mt" ] && [ "$mt" -gt 0 ]; then mem="$(( (mt-ma)*100/mt ))%"; else mem="n/a"; fi
  sshf="$(journalctl -u ssh -u sshd --no-pager --since 'today' 2>/dev/null | grep -c 'Failed password')"
  [[ "$sshf" =~ ^[0-9]+$ ]] || sshf=0
  # container health snapshot (HANDLA scope)
  local chealth="" c st
  for c in $HANDLA_CONTAINERS; do
    st="$(docker inspect -f '{{.State.Status}}' "$c" 2>/dev/null || echo absent)"
    chealth="${chealth}${c}=${st} "
  done
  # db / redis quick state (best-effort, no creds printed)
  dbst="$(docker inspect -f '{{.State.Status}}' "$MYSQL_CONTAINER" 2>/dev/null || echo absent)"
  rdst="$(docker inspect -f '{{.State.Status}}' "$REDIS_CONTAINER" 2>/dev/null || echo absent)"
  local marker="/var/lib/handla-backup/last-success" mtime
  mtime="$(stat -c %Y "$marker" 2>/dev/null || echo 0)"
  if [ "$mtime" -gt 0 ]; then bkage="$(( (NOW_EPOCH - mtime)/3600 ))h"; else bkage="none"; fi

  local body
  body="$(cat <<EOF
[HANDLA][SUMMARY] $(date -u +%FT%TZ)
uptime:    ${up}
disk /:    ${disk:-n/a}
memory:    ${mem}
ssh fails today: ${sshf}
containers: ${chealth}
mysql:     ${dbst}
redis:     ${rdst}
backup age: ${bkage}
EOF
)"
  printf '%s\n' "$body" >> "$STATE_DIR/summary.log" 2>/dev/null || true
  if [ "$DRY_RUN" = "1" ]; then printf '%s\n' "$body"; fi
  # Only dispatch externally if operator explicitly enabled daily external summary
  if [ "${SUMMARY_EXTERNAL:-0}" = "1" ] && [ "$DRY_RUN" != "1" ]; then
    _send INFO summary "summary.daily" "Daily summary: disk ${disk:-n/a} mem ${mem} sshfails ${sshf} backup ${bkage}"
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# SELF-TEST  (Phase 24) — internal assertions on pure logic. Returns nonzero on
# failure. Uses an isolated temp STATE + DRY_RUN so nothing external is sent and
# no real system state is touched.
# ─────────────────────────────────────────────────────────────────────────────
_selftest() {
  local fails=0
  local tmp; tmp="$(mktemp -d 2>/dev/null || echo /tmp/handla-selftest.$$)"; mkdir -p "$tmp/state"
  STATE_DIR="$tmp"; STATE="$tmp/state"; DRY_RUN=1
  _t_expect() {  # _t_expect "desc" expected actual
    if [ "$2" != "$3" ]; then echo "SELFTEST FAIL: $1 (expected='$2' got='$3')"; fails=$((fails+1));
    else echo "SELFTEST ok: $1"; fi
  }

  # --- fge float compare ---
  fge "2.5" "1.5" && _t_expect "fge 2.5>=1.5" 0 0 || _t_expect "fge 2.5>=1.5" 0 1
  fge "1.0" "1.5" && _t_expect "fge 1.0>=1.5" 1 0 || _t_expect "fge 1.0>=1.5" 1 1

  # --- state file key sanitization (no path traversal) ---
  # Security invariant: whatever key comes in, the resulting path must live
  # directly inside $STATE (exactly one path segment after it) — no '/' from the
  # key can escape the directory. Dots are allowed (needed for keys like
  # 'tls.handla.tech.expiry'); '/' and shell metachars are collapsed to '_'.
  local sf base; sf="$(_state_file "../../etc/evil key;rm -rf /")"
  case "$sf" in "$STATE"/*) _t_expect "state key stays in dir" yes yes ;; *) _t_expect "state key stays in dir" yes no ;; esac
  base="${sf#$STATE/}"
  case "$base" in */*) _t_expect "no slash escapes state dir" no yes ;; *) _t_expect "no slash escapes state dir" no no ;; esac
  case "$base" in *";"*|*" "*|*"&"*) _t_expect "no shell metachars in filename" no yes ;; *) _t_expect "no shell metachars in filename" no no ;; esac

  # --- dedup: first raise sends, second identical raise suppressed ---
  local out1 out2
  out1="$(raise "t.key" WARNING test "cond bad" 2>&1)"
  case "$out1" in *"ALERT WARNING test t.key"*) _t_expect "raise#1 sends" yes yes ;; *) _t_expect "raise#1 sends" yes no ;; esac
  out2="$(raise "t.key" WARNING test "cond bad" 2>&1)"
  if [ -z "$out2" ]; then _t_expect "raise#2 dedup-suppressed" empty empty; else _t_expect "raise#2 dedup-suppressed" empty "$out2"; fi

  # --- severity change re-alerts ---
  local out3; out3="$(raise "t.key" CRITICAL test "cond worse" 2>&1)"
  case "$out3" in *"ALERT CRITICAL test t.key"*) _t_expect "severity change re-alerts" yes yes ;; *) _t_expect "severity change re-alerts" yes no ;; esac

  # --- recovery: clear_key on active alarm sends RECOVERY once, then silent ---
  local out4 out5
  out4="$(clear_key "t.key" test "cond cleared" 2>&1)"
  case "$out4" in *"ALERT RECOVERY test t.key"*) _t_expect "clear sends RECOVERY" yes yes ;; *) _t_expect "clear sends RECOVERY" yes no ;; esac
  out5="$(clear_key "t.key" test "still fine" 2>&1)"
  if [ -z "$out5" ]; then _t_expect "clear when not-alarmed silent" empty empty; else _t_expect "clear when not-alarmed silent" empty "$out5"; fi

  # --- clear on never-seen key is silent ---
  local out6; out6="$(clear_key "never.seen" test "ok" 2>&1)"
  if [ -z "$out6" ]; then _t_expect "clear unknown key silent" empty empty; else _t_expect "clear unknown key silent" empty "$out6"; fi

  rm -rf "$tmp" 2>/dev/null || true
  if [ "$fails" -eq 0 ]; then echo "SELFTEST: ALL PASS"; return 0; else echo "SELFTEST: $fails FAILURE(S)"; return 1; fi
}

# ─────────────────────────────────────────────────────────────────────────────
# MAIN DISPATCHER
#   handla-monitor              → run all checks
#   handla-monitor <check>      → run a single check (disk|memory|load|docker|
#                                 http|http_errors|backup|mysql|redis|tls|ssh|
#                                 summary)
#   handla-monitor summary      → write periodic local summary
#   handla-monitor --selftest   → run internal logic assertions (nonzero on fail)
# ─────────────────────────────────────────────────────────────────────────────
run_all() {
  check_disk
  check_memory
  check_load
  check_docker
  check_http
  check_http_errors
  check_backup
  check_mysql
  check_redis
  check_tls
  check_ssh
}

main() {
  local cmd="${1:-all}"
  case "$cmd" in
    all)          run_all ;;
    disk)         check_disk ;;
    memory|mem)   check_memory ;;
    load|cpu)     check_load ;;
    docker)       check_docker ;;
    http)         check_http ;;
    http_errors|http5xx) check_http_errors ;;
    backup)       check_backup ;;
    mysql|db)     check_mysql ;;
    redis|queue)  check_redis ;;
    tls|cert)     check_tls ;;
    ssh|security) check_ssh ;;
    summary)      check_summary ;;
    --selftest|selftest) _selftest; exit $? ;;
    -h|--help|help)
      grep -E '^#   handla-monitor' "$0" | sed 's/^#   //'
      exit 0 ;;
    *)
      log "unknown check '$cmd' (use --help)"; exit 2 ;;
  esac
  exit 0
}

main "$@"
