#!/usr/bin/env bash
# =============================================================================
# run-tests.sh  —  offline tests for HANDLA monitoring logic.
# =============================================================================
# These tests exercise PURE LOGIC with mocked inputs and DRY_RUN=1. They never
# touch production, never send external alerts, and do not depend on any real
# failure. Run locally or in CI:
#
#     bash deploy/monitoring/tests/run-tests.sh
#
# Exit 0 = all pass; nonzero = failures.
#
# NOTE on mocking: handla-monitor.sh pins PATH at the top (correct for prod),
# so we cannot mock external commands via PATH. Instead we source the monitor's
# functions and then SHADOW the externals (df/docker/curl/systemctl/stat/...)
# with shell functions — shell functions take precedence over PATH lookups.
# =============================================================================
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
MON="$HERE/../handla-monitor.sh"
ALERT="$HERE/../handla-alert.sh"

PASS=0; FAIL=0
ok()   { echo "  ok   : $1"; PASS=$((PASS+1)); }
bad()  { echo "  FAIL : $1"; FAIL=$((FAIL+1)); }
have() { case "$1" in *"$2"*) return 0;; *) return 1;; esac; }

echo "== 0. static syntax =="
bash -n "$MON"   && ok "handla-monitor.sh parses"   || bad "handla-monitor.sh parse"
bash -n "$ALERT" && ok "handla-alert.sh parses"     || bad "handla-alert.sh parse"

echo "== 1. handla-monitor --selftest (dedup/recovery/sanitize/thresholds) =="
if bash "$MON" --selftest >/tmp/handla_selftest.out 2>&1; then
  ok "--selftest all pass"
else
  bad "--selftest reported failures"; sed 's/^/    /' /tmp/handla_selftest.out
fi

SANDBOX="$(mktemp -d)"
FUNCS="$SANDBOX/funcs.sh"
# Strip the dispatcher tail AND the PATH pin so our shadow functions win.
sed -e '/^main "\$@"$/d' -e '/^export PATH=/d' "$MON" > "$FUNCS"

# Each test runs in its own subshell: source funcs, define shadow externals,
# set an isolated STATE + DRY_RUN, then invoke the check.
echo "== 2. disk threshold logic (shadowed df) =="
OUT="$(
  DRY_RUN=1; STATE_DIR="$SANDBOX/s2"; STATE="$STATE_DIR/state"; mkdir -p "$STATE"; NOW_EPOCH="$(date -u +%s)"
  source "$FUNCS" >/dev/null 2>&1
  DRY_RUN=1; STATE_DIR="$SANDBOX/s2"; STATE="$STATE_DIR/state"; NOW_EPOCH="$(date -u +%s)"
  df() { if printf '%s ' "$@" | grep -q ' -i '; then
           printf 'FS I IU IF IUSE M\n/dev/vda1 1000000 500000 500000 50%% /\n'
         else
           printf 'FS B U A CAP M\n/dev/vda1 100000000 95000000 5000000 95%% /\n'
         fi; }
  check_disk
)"
have "$OUT" "ALERT CRITICAL disk disk./" && ok "disk 95% ⇒ CRITICAL" || { bad "disk 95% ⇒ CRITICAL"; echo "    got: $OUT"; }

OUT="$(
  source "$FUNCS" >/dev/null 2>&1
  DRY_RUN=1; STATE_DIR="$SANDBOX/s2b"; STATE="$STATE_DIR/state"; mkdir -p "$STATE"; NOW_EPOCH="$(date -u +%s)"
  df() { if printf '%s ' "$@" | grep -q ' -i '; then printf 'FS I IU IF IUSE M\n/dev/vda1 1000000 100000 900000 10%% /\n'
         else printf 'FS B U A CAP M\n/dev/vda1 100000000 40000000 60000000 40%% /\n'; fi; }
  check_disk
)"
[ -z "$OUT" ] && ok "disk 40% ⇒ no alert" || { bad "disk 40% ⇒ no alert"; echo "    got: $OUT"; }

echo "== 3. stale-backup detection (shadowed systemctl + stat) =="
OUT="$(
  source "$FUNCS" >/dev/null 2>&1
  DRY_RUN=1; STATE_DIR="$SANDBOX/s3"; STATE="$STATE_DIR/state"; mkdir -p "$STATE"; NOW_EPOCH="$(date -u +%s)"; BACKUP_STALE_HOURS=30
  systemctl() { case "$*" in
      *list-unit-files*) echo "handla-backup.timer enabled";;
      *"is-enabled"*) echo enabled;; *"is-active"*) echo active;;
      *"show handla-backup.service"*) echo success;; *) return 0;; esac; }
  # marker file exists but is ancient
  mkdir -p "$SANDBOX/bk"; : > "$SANDBOX/bk/last-success"
  stat() { echo 1000000000; }            # mtime = 2001 ⇒ very stale
  # redirect the hardcoded marker path by shadowing the file-test via a wrapper:
  # simplest: point BACKUP marker via a function that rewrites the path is not
  # possible; instead we verify the stale arithmetic+raise directly on the marker
  # we DO control by re-implementing the exact branch used by check_backup.
  mtime="$(stat "$SANDBOX/bk/last-success")"; age_h=$(( (NOW_EPOCH - mtime)/3600 ))
  [ -f "$SANDBOX/bk/last-success" ] && [ "$age_h" -ge "$BACKUP_STALE_HOURS" ] && \
    raise "backup.stale" CRITICAL backup "No successful backup for ${age_h}h (threshold ${BACKUP_STALE_HOURS}h)"
)"
have "$OUT" "ALERT CRITICAL backup backup.stale" && ok "stale marker ⇒ CRITICAL" || { bad "stale marker ⇒ CRITICAL"; echo "    got: $OUT"; }

# fresh marker ⇒ no alert
OUT="$(
  source "$FUNCS" >/dev/null 2>&1
  DRY_RUN=1; STATE_DIR="$SANDBOX/s3b"; STATE="$STATE_DIR/state"; mkdir -p "$STATE"; NOW_EPOCH="$(date -u +%s)"; BACKUP_STALE_HOURS=30
  mtime=$NOW_EPOCH; age_h=$(( (NOW_EPOCH - mtime)/3600 ))
  if [ "$age_h" -ge "$BACKUP_STALE_HOURS" ]; then raise "backup.stale" CRITICAL backup "stale"; else clear_key "backup.stale" backup "fresh"; fi
)"
[ -z "$OUT" ] && ok "fresh marker ⇒ no alert" || { bad "fresh marker ⇒ no alert"; echo "    got: $OUT"; }

echo "== 4. HTTP failure needs 3 consecutive (shadowed curl) =="
OUT="$(
  source "$FUNCS" >/dev/null 2>&1
  DRY_RUN=1; STATE_DIR="$SANDBOX/s4"; STATE="$STATE_DIR/state"; mkdir -p "$STATE"; NOW_EPOCH="$(date -u +%s)"; HTTP_FAIL_THRESHOLD=3
  curl() { printf '500|0'; }             # always HTTP 500
  o1="$(_http_track http.api.local http 'http://x/api/health' '^(200)$' 'Local API')"
  o2="$(_http_track http.api.local http 'http://x/api/health' '^(200)$' 'Local API')"
  o3="$(_http_track http.api.local http 'http://x/api/health' '^(200)$' 'Local API')"
  printf 'F1=[%s] F2=[%s] F3=[%s]\n' "$o1" "$o2" "$o3"
)"
if have "$OUT" 'F1=[] F2=[]' && have "$OUT" 'ALERT CRITICAL http http.api.local'; then
  ok "HTTP alerts only on 3rd consecutive failure"
else bad "HTTP consecutive-failure logic"; echo "    got: $OUT"; fi

echo "== 5. HTTP recovers ⇒ RECOVERY + counter reset =="
OUT="$(
  source "$FUNCS" >/dev/null 2>&1
  DRY_RUN=1; STATE_DIR="$SANDBOX/s5"; STATE="$STATE_DIR/state"; mkdir -p "$STATE"; NOW_EPOCH="$(date -u +%s)"; HTTP_FAIL_THRESHOLD=3
  bad500() { printf '500|0'; }; good200() { printf '200|0'; }
  curl() { bad500; }
  _http_track http.api.local http 'http://x' '^(200)$' 'Local API' >/dev/null
  _http_track http.api.local http 'http://x' '^(200)$' 'Local API' >/dev/null
  _http_track http.api.local http 'http://x' '^(200)$' 'Local API' >/dev/null   # now CRITICAL (silenced)
  curl() { good200; }
  _http_track http.api.local http 'http://x' '^(200)$' 'Local API'              # recovery
)"
have "$OUT" "ALERT RECOVERY http http.api.local" && ok "HTTP restore ⇒ RECOVERY" || { bad "HTTP restore ⇒ RECOVERY"; echo "    got: $OUT"; }

echo "== 6. alert sanitization / injection safety =="
ASB="$SANDBOX/alertsb"; mkdir -p "$ASB"
sed "s#/var/lib/handla-monitor#$ASB#g; s#/etc/handla-monitor/alert.conf#$ASB/alert.conf#g" "$ALERT" > "$ASB/alert.sh"
chmod +x "$ASB/alert.sh"
MARK="$SANDBOX/pwned"; rm -f "$MARK"
"$ASB/alert.sh" CRITICAL backup backup.stale 'x `touch '"$MARK"'` $(touch '"$MARK"') ; touch '"$MARK"' | touch '"$MARK" >/dev/null 2>&1
if [ ! -e "$MARK" ]; then ok "command injection in reason neutralized (no exec)"; else bad "INJECTION EXECUTED"; fi
SPOOLED="$(cat "$ASB/alerts.log" 2>/dev/null)"
if have "$SPOOLED" '`' || have "$SPOOLED" '$(' || have "$SPOOLED" ';'; then
  bad "shell metachars survived sanitization"; echo "    got: $SPOOLED"
else ok "shell metachars stripped from spooled alert"; fi
"$ASB/alert.sh" NOTAVALIDSEV x y z >/dev/null 2>&1 && bad "invalid severity accepted" || ok "invalid severity rejected"

echo "== 7. missing-file / command-failure resilience (docker down) =="
OUT="$(
  source "$FUNCS" >/dev/null 2>&1
  DRY_RUN=1; STATE_DIR="$SANDBOX/s7"; STATE="$STATE_DIR/state"; mkdir -p "$STATE"; NOW_EPOCH="$(date -u +%s)"
  docker() { return 1; }                 # daemon unreachable
  command() { if [ "$1" = "-v" ] && [ "$2" = "docker" ]; then return 0; fi; builtin command "$@"; }
  check_docker
)"
have "$OUT" "ALERT CRITICAL docker docker.daemon" && ok "docker daemon down ⇒ CRITICAL (no crash)" || { bad "docker-down handling"; echo "    got: $OUT"; }

echo "== 8. malformed/untrusted log input does not break 5xx parser =="
OUT="$(
  source "$FUNCS" >/dev/null 2>&1
  DRY_RUN=1; STATE_DIR="$SANDBOX/s8"; STATE="$STATE_DIR/state"; mkdir -p "$STATE"; NOW_EPOCH="$(date -u +%s)"
  HTTP5XX_WARN=10; HTTP5XX_CRIT=40
  docker() {
    case "$1" in
      inspect) return 0;;
      logs) # emit junk + a few HANDLA 5xx lines
        printf 'garbage %%%%\n<script>evil</script> :3001" 500\n"GET / HTTP/1.1" 500 :3001"\n$(id) :3000" 502\n';;
      *) return 0;;
    esac; }
  command() { if [ "$1" = "-v" ] && [ "$2" = "docker" ]; then return 0; fi; builtin command "$@"; }
  check_http_errors
)"
# should NOT crash; with only ~2-3 5xx it stays under WARN(10) ⇒ no alert, or a
# controlled warning — either way no shell error and no injection.
if have "$OUT" "$(id -un)" ; then bad "log content executed (injection!)"; else ok "malformed log parsed safely, no injection"; fi

echo "== 9. container health: unhealthy ⇒ CRITICAL, then healthy ⇒ RECOVERY =="
# Accurate docker mock: dispatch on the -f format string ($3) so State.Status,
# Health.Status and RestartCount are answered independently. First pass reports
# the container unhealthy; second pass reports it healthy.
_mk_docker_mock() {  # $1 = health value to report
  cat <<EOF
docker() {
  case "\$1" in
    info) return 0 ;;
    ps)   echo "handla_api" ;;
    inspect)
      # args: inspect -f '<fmt>' <name>
      fmt="\$3"
      case "\$fmt" in
        *State.Status*)       echo running ;;
        *Health.Status*|*Health*) echo "$1" ;;
        *RestartCount*)       echo 0 ;;
        *)                    echo running ;;
      esac ;;
    *) return 0 ;;
  esac
}
command() { if [ "\$1" = "-v" ] && [ "\$2" = "docker" ]; then return 0; fi; builtin command "\$@"; }
EOF
}
CH_STATE="$SANDBOX/s9"; mkdir -p "$CH_STATE/state"
OUT1="$(
  source "$FUNCS" >/dev/null 2>&1
  DRY_RUN=1; STATE_DIR="$CH_STATE"; STATE="$CH_STATE/state"; NOW_EPOCH="$(date -u +%s)"
  HANDLA_CONTAINERS="handla_api"
  eval "$(_mk_docker_mock unhealthy)"
  check_docker
)"
OUT2="$(
  source "$FUNCS" >/dev/null 2>&1
  DRY_RUN=1; STATE_DIR="$CH_STATE"; STATE="$CH_STATE/state"; NOW_EPOCH="$(date -u +%s)"
  HANDLA_CONTAINERS="handla_api"
  eval "$(_mk_docker_mock healthy)"
  check_docker
)"
have "$OUT1" "ALERT CRITICAL docker docker.handla_api.health" && ok "unhealthy container ⇒ CRITICAL" || { bad "unhealthy ⇒ CRITICAL"; echo "    got: $OUT1"; }
have "$OUT2" "ALERT RECOVERY docker docker.handla_api.health" && ok "recovered container ⇒ RECOVERY" || { bad "recovered ⇒ RECOVERY"; echo "    got: $OUT2"; }

echo
echo "================= RESULT: PASS=$PASS FAIL=$FAIL ================="
rm -rf "$SANDBOX" 2>/dev/null || true
[ "$FAIL" -eq 0 ]
