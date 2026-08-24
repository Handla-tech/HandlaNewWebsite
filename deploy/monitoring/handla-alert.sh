#!/usr/bin/env bash
# =============================================================================
# handla-alert  —  central, sanitized alert dispatcher for HANDLA monitoring
# =============================================================================
# INSTALLED AT (VPS):  /usr/local/sbin/handla-alert   (root:root 0750)
# CALLED BY:           /usr/local/sbin/handla-monitor  and systemd OnFailure=
#
# PURPOSE
#   Format a single, bounded, sanitized alert line and deliver it to:
#     1. an always-on LOCAL spool + journald (so alerts are never lost), and
#     2. exactly ONE configured EXTERNAL channel (telegram | slack | smtp),
#        if — and only if — external credentials are configured.
#
# SECURITY
#   * No secrets are embedded here. External credentials live ONLY in the
#     root-only config /etc/handla-monitor/alert.conf (0600).
#   * The message is treated as untrusted DATA, never as a command: it is
#     passed to curl/mail via argv/stdin, never eval'd, and is stripped of
#     control characters and shell metacharacters and length-bounded.
#   * The script performs NO arbitrary command execution and dumps NO
#     environment. Only the fixed fields below are ever transmitted.
#
# USAGE
#   handla-alert <SEVERITY> <COMPONENT> <KEY> <REASON...>
#     SEVERITY : INFO | WARNING | CRITICAL | RECOVERY   (validated)
#     COMPONENT: short token, e.g. backup, mysql, redis, http, disk, ssh
#     KEY      : stable dedup key, e.g. backup.stale, http.api.down
#     REASON   : free text (sanitized + truncated)
#
#   Exit 0 = local spool succeeded (external delivery best-effort/reported).
#
# CONFIG (/etc/handla-monitor/alert.conf, root:root 0600) — example keys:
#     ALERT_CHANNEL=telegram|slack|smtp|none
#     # telegram:
#     TELEGRAM_BOT_TOKEN=...        # secret — never logged
#     TELEGRAM_CHAT_ID=...
#     # slack:
#     SLACK_WEBHOOK_URL=...         # secret — never logged
#     # smtp (via system `mail`/`sendmail`):
#     ALERT_EMAIL_TO=ops@example.com
#     ALERT_EMAIL_FROM=handla-monitor@srv1642049
# =============================================================================

set -uo pipefail
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
umask 077

HOSTNAME_FIXED="$(hostname 2>/dev/null || echo unknown-host)"
CONF="/etc/handla-monitor/alert.conf"
SPOOL_DIR="/var/lib/handla-monitor"
SPOOL="$SPOOL_DIR/alerts.log"
MAXLEN=800   # hard cap on the reason field (chars)

mkdir -p "$SPOOL_DIR" 2>/dev/null || true
chmod 700 "$SPOOL_DIR" 2>/dev/null || true

# ── argument parsing / validation ───────────────────────────────────────────
SEVERITY="${1:-}"; COMPONENT="${2:-}"; DEDUP_KEY="${3:-}"; shift 3 2>/dev/null || true
REASON_RAW="${*:-}"

case "$SEVERITY" in
  INFO|WARNING|CRITICAL|RECOVERY) : ;;
  *) echo "handla-alert: invalid severity '$SEVERITY' (INFO|WARNING|CRITICAL|RECOVERY)" >&2; exit 2 ;;
esac

# ── sanitizer: message is DATA, not code ─────────────────────────────────────
# 1) drop CR/LF and other control chars (prevents log/heder injection)
# 2) drop shell/format metacharacters that could matter if ever mishandled
# 3) collapse whitespace, 4) truncate to MAXLEN.
sanitize() {
  local s="$1"
  s="$(printf '%s' "$s" | tr -d '\000-\037\177')"          # strip control chars
  s="$(printf '%s' "$s" | tr -d '`$\\')"                    # strip ` $ \
  s="$(printf '%s' "$s" | sed -E 's/[][{}<>|;&]//g')"       # strip shell/redirect metas
  s="$(printf '%s' "$s" | sed -E 's/[[:space:]]+/ /g; s/^ //; s/ $//')"
  printf '%s' "${s:0:$MAXLEN}"
}

COMPONENT="$(sanitize "$COMPONENT")"; COMPONENT="${COMPONENT:0:40}"
DEDUP_KEY="$(sanitize "$DEDUP_KEY")"; DEDUP_KEY="${DEDUP_KEY:0:80}"
REASON="$(sanitize "$REASON_RAW")"
[ -n "$COMPONENT" ] || COMPONENT="unknown"
[ -n "$REASON" ] || REASON="(no detail provided)"

TS="$(date -u +%FT%TZ)"

# ── assemble the fixed, minimal message (NEVER any secret/env) ───────────────
LINE="[HANDLA][$SEVERITY] host=$HOSTNAME_FIXED component=$COMPONENT key=$DEDUP_KEY time=$TS :: $REASON"
BODY="[HANDLA][$SEVERITY]
Host: $HOSTNAME_FIXED
Component: $COMPONENT
Key: $DEDUP_KEY
Time: $TS
Issue: $REASON"

# ── 1) LOCAL delivery (always) ───────────────────────────────────────────────
printf '%s\n' "$LINE" >> "$SPOOL" 2>/dev/null || true
# journald tag, priority-mapped so `journalctl -p warning` surfaces alerts
case "$SEVERITY" in
  CRITICAL) PRI=2 ;;    # crit
  WARNING)  PRI=4 ;;    # warning
  RECOVERY) PRI=5 ;;    # notice
  *)        PRI=6 ;;    # info
esac
command -v logger >/dev/null 2>&1 && logger -t handla-alert -p "daemon.$PRI" -- "$LINE" 2>/dev/null || true

# ── load external config (root-only) ─────────────────────────────────────────
ALERT_CHANNEL="none"
if [ -r "$CONF" ]; then
  # shellcheck disable=SC1090
  set +u; source "$CONF" 2>/dev/null; set -u
  ALERT_CHANNEL="${ALERT_CHANNEL:-none}"
fi

# ── 2) EXTERNAL delivery (best-effort; never leaks the reason on failure) ────
ext_status="skipped(channel=none)"
deliver_telegram() {
  [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ] || { ext_status="misconfigured(telegram)"; return 1; }
  # message passed as a data field (argv), not interpolated into a shell string
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 \
        -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
        --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
        --data-urlencode "text=${BODY}" 2>/dev/null)"
  [ "$code" = "200" ] && { ext_status="delivered(telegram)"; return 0; }
  ext_status="failed(telegram,http=$code)"; return 1
}
deliver_slack() {
  [ -n "${SLACK_WEBHOOK_URL:-}" ] || { ext_status="misconfigured(slack)"; return 1; }
  # JSON payload with the message as a value; use jq if available else a safe
  # here-string with the already-sanitized BODY (no quotes/backslashes remain).
  local payload code
  if command -v jq >/dev/null 2>&1; then
    payload="$(jq -cn --arg t "$BODY" '{text:$t}')"
  else
    payload="{\"text\":\"${BODY//$'\n'/\\n}\"}"
  fi
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 \
        -H 'Content-Type: application/json' \
        -X POST --data "$payload" "$SLACK_WEBHOOK_URL" 2>/dev/null)"
  case "$code" in 200) ext_status="delivered(slack)"; return 0 ;; *) ext_status="failed(slack,http=$code)"; return 1 ;; esac
}
deliver_smtp() {
  [ -n "${ALERT_EMAIL_TO:-}" ] || { ext_status="misconfigured(smtp)"; return 1; }
  local from="${ALERT_EMAIL_FROM:-handla-monitor@$HOSTNAME_FIXED}"
  if command -v mail >/dev/null 2>&1; then
    printf '%s\n' "$BODY" | mail -s "[HANDLA][$SEVERITY] $COMPONENT: $DEDUP_KEY" -r "$from" "$ALERT_EMAIL_TO" 2>/dev/null \
      && { ext_status="delivered(smtp/mail)"; return 0; }
  elif command -v sendmail >/dev/null 2>&1; then
    { printf 'From: %s\nTo: %s\nSubject: [HANDLA][%s] %s: %s\n\n%s\n' \
        "$from" "$ALERT_EMAIL_TO" "$SEVERITY" "$COMPONENT" "$DEDUP_KEY" "$BODY"; } \
      | sendmail -t 2>/dev/null && { ext_status="delivered(smtp/sendmail)"; return 0; }
  fi
  ext_status="failed(smtp,no-transport)"; return 1
}

case "$ALERT_CHANNEL" in
  telegram) deliver_telegram || true ;;
  slack)    deliver_slack    || true ;;
  smtp)     deliver_smtp     || true ;;
  none|"")  ext_status="skipped(channel=none)" ;;
  *)        ext_status="skipped(unknown-channel)" ;;
esac

# record the external outcome (status only — never the token/URL/body)
printf '%s external=%s\n' "$TS" "$ext_status" >> "$SPOOL" 2>/dev/null || true
command -v logger >/dev/null 2>&1 && logger -t handla-alert -p daemon.info -- "external-delivery=$ext_status key=$DEDUP_KEY" 2>/dev/null || true

# stdout summary for callers/tests (no secrets)
echo "local=ok external=$ext_status"
exit 0
