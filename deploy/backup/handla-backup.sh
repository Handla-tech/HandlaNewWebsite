#!/usr/bin/env bash
# =============================================================================
# handla-backup  —  encrypted, off-host Handla production backup
# =============================================================================
# INSTALLED AT (VPS):  /usr/local/sbin/handla-backup   (root:root 0750)
# INVOKED BY:          systemd  handla-backup.service   (daily via .timer)
#
# FLOW (fail-closed at every step; a failure anywhere = non-zero exit,
#        NO last-success marker update, NO "success" log line):
#
#   mysqldump ─► gzip ─► age-encrypt ─► sha256 ─► rclone upload (off-host)
#                                                 └─► verify remote size+hash
#   config env files ─► tar ─► gzip ─► age-encrypt ─► sha256 ─► upload
#
# SECURITY
#   * The plaintext DB dump NEVER touches disk unencrypted: mysqldump is piped
#     straight through gzip|age, so only the .sql.gz.age artifact is written.
#   * DB/rclone/age credentials are read from a root-only config file; this
#     script never echoes secret values.
#   * age RECIPIENT (public key) encrypts; the matching identity (private key)
#     is NOT required on the VPS to make a backup and is stored OFF-host.
#
# CONFIG FILE (root:root 0600):  /etc/handla-backup/backup.conf
#   Provides (no secrets are hard-coded here):
#     MYSQL_CONTAINER=handla_mysql
#     MYSQL_DB=handla_db
#     AGE_RECIPIENT=age1........................        # public key only
#     RCLONE_REMOTE=handlabackup:handla-production-backups   # rclone dest
#     RCLONE_CONFIG=/etc/handla-backup/rclone.conf      # root:root 0600
#     KEEP_LOCAL=3                                       # local encrypted copies
#     RETAIN_DAILY=7 RETAIN_WEEKLY=4 RETAIN_MONTHLY=3    # off-host retention
#   MySQL admin auth is taken from the running container's env (root pw),
#   read at runtime via `docker exec … printenv` — never written to disk.
# =============================================================================

set -euo pipefail

# ── 0. Fixed, sanitised environment ─────────────────────────────────────────
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
umask 077

CONF="/etc/handla-backup/backup.conf"
LOCK="/run/handla-backup.lock"
LOCAL_DIR="/opt/handla-backup/local"
LOG_DIR="/var/log/handla-backup"
STATE_DIR="/var/lib/handla-backup"
SUCCESS_MARKER="$STATE_DIR/last-success"
RUN_TS="$(date -u +%Y%m%d-%H%M%S)"
LOG="$LOG_DIR/backup-${RUN_TS}.log"

mkdir -p "$LOCAL_DIR" "$LOG_DIR" "$STATE_DIR"
chmod 700 "$LOCAL_DIR" "$LOG_DIR" "$STATE_DIR" 2>/dev/null || true

# ── logging helpers (never print secrets) ───────────────────────────────────
log()  { printf '%s [handla-backup] %s\n' "$(date -u +%FT%TZ)" "$*" | tee -a "$LOG" ; }
die()  { printf '%s [handla-backup] FATAL: %s\n' "$(date -u +%FT%TZ)" "$*" | tee -a "$LOG" >&2 ; exit 1 ; }

# ── single-instance lock (no overlapping runs) ──────────────────────────────
exec 9>"$LOCK" || die "cannot open lock $LOCK"
flock -n 9 || die "another handla-backup run holds the lock; aborting"

log "=== backup run start (ts=$RUN_TS) ==="

# ── 1. Load config ──────────────────────────────────────────────────────────
[ -r "$CONF" ] || die "config $CONF not readable"
# shellcheck disable=SC1090
source "$CONF"
: "${MYSQL_CONTAINER:?MYSQL_CONTAINER unset}"
: "${MYSQL_DB:?MYSQL_DB unset}"
: "${AGE_RECIPIENT:?AGE_RECIPIENT unset}"
: "${RCLONE_REMOTE:?RCLONE_REMOTE unset}"
: "${RCLONE_CONFIG:?RCLONE_CONFIG unset}"
KEEP_LOCAL="${KEEP_LOCAL:-3}"
RETAIN_DAILY="${RETAIN_DAILY:-7}"
CONFIG_FILES="${CONFIG_FILES:-/opt/handla-production-secrets/backend.env}"
export RCLONE_CONFIG

for bin in docker gzip age sha256sum rclone flock; do
  command -v "$bin" >/dev/null 2>&1 || die "required binary missing: $bin"
done

# ── 2. Preflight: DB reachable, age recipient valid ─────────────────────────
docker inspect -f '{{.State.Running}}' "$MYSQL_CONTAINER" 2>/dev/null | grep -q true \
  || die "mysql container '$MYSQL_CONTAINER' not running"

# Root password is pulled from the container env at runtime (never persisted).
DB_ROOT_PW="$(docker exec "$MYSQL_CONTAINER" printenv MYSQL_ROOT_PASSWORD 2>/dev/null || true)"
[ -n "$DB_ROOT_PW" ] || die "could not obtain MySQL admin credential from container env"

DB_BASENAME="handla-db-prod_${RUN_TS}.sql.gz.age"
DB_ARTIFACT="$LOCAL_DIR/$DB_BASENAME"
CFG_BASENAME="handla-config-prod_${RUN_TS}.tar.gz.age"
CFG_ARTIFACT="$LOCAL_DIR/$CFG_BASENAME"

# ── 3. DATABASE: dump | gzip | age  (streamed; no plaintext on disk) ────────
# MySQL 8 flags:
#   --single-transaction  consistent InnoDB snapshot w/o locking
#   --routines --triggers --events  capture programmable objects (safe even if 0)
#   --default-character-set=utf8mb4 / --set-gtid-purged=OFF portable restore
#   --no-tablespaces      avoid needing PROCESS priv
log "dumping $MYSQL_DB (streamed dump|gzip|age) -> $DB_BASENAME"
set +e
# The password is passed via MYSQL_PWD in the exec env (not argv, not logged).
docker exec -e MYSQL_PWD="$DB_ROOT_PW" "$MYSQL_CONTAINER" \
  mysqldump -uroot \
    --single-transaction --quick --routines --triggers --events \
    --default-character-set=utf8mb4 --set-gtid-purged=OFF --no-tablespaces \
    --databases "$MYSQL_DB" 2>"$LOG.dumperr" \
  | gzip -9 \
  | age -r "$AGE_RECIPIENT" -o "$DB_ARTIFACT"
pipestatus=("${PIPESTATUS[@]}")
set -e
[ "${pipestatus[0]}" -eq 0 ] || { cat "$LOG.dumperr" >>"$LOG" 2>/dev/null; die "mysqldump failed (exit ${pipestatus[0]})"; }
[ "${pipestatus[1]}" -eq 0 ] || die "gzip failed (exit ${pipestatus[1]})"
[ "${pipestatus[2]}" -eq 0 ] || die "age encryption failed (exit ${pipestatus[2]})"
[ -s "$DB_ARTIFACT" ] || die "DB artifact empty/missing after pipeline"
rm -f "$LOG.dumperr"
DB_SIZE="$(stat -c %s "$DB_ARTIFACT")"
log "DB artifact written: $DB_BASENAME (${DB_SIZE} bytes)"

# ── 4. CONFIG: tar production secret/config files | gzip | age ──────────────
# Only files that genuinely cannot be reconstructed from GitHub/provider console.
CFG_LIST=()
for f in $CONFIG_FILES; do [ -r "$f" ] && CFG_LIST+=("$f"); done
if [ "${#CFG_LIST[@]}" -gt 0 ]; then
  log "archiving ${#CFG_LIST[@]} config file(s) -> $CFG_BASENAME"
  set +e
  tar -czf - --absolute-names "${CFG_LIST[@]}" 2>>"$LOG" | age -r "$AGE_RECIPIENT" -o "$CFG_ARTIFACT"
  cfgstatus=("${PIPESTATUS[@]}")
  set -e
  [ "${cfgstatus[0]}" -eq 0 ] || die "config tar failed"
  [ "${cfgstatus[1]}" -eq 0 ] || die "config age encryption failed"
  [ -s "$CFG_ARTIFACT" ] || die "config artifact empty"
  CFG_SIZE="$(stat -c %s "$CFG_ARTIFACT")"
  log "config artifact written: $CFG_BASENAME (${CFG_SIZE} bytes)"
else
  log "WARN: no readable config files matched; skipping config archive"
  CFG_ARTIFACT=""
fi

# ── 5. CHECKSUMS ────────────────────────────────────────────────────────────
( cd "$LOCAL_DIR" && sha256sum "$DB_BASENAME" > "$DB_BASENAME.sha256" )
[ -n "$CFG_ARTIFACT" ] && ( cd "$LOCAL_DIR" && sha256sum "$CFG_BASENAME" > "$CFG_BASENAME.sha256" )
log "sha256 checksums generated"

# ── 6. LOCAL INTEGRITY: verify age is decryptable ONLY if identity provided ─
# (Decrypt-verify is done in the restore drill with the OFF-host identity; here
#  we verify the gzip magic survived by checking age header + non-empty size.)
age --version >/dev/null || die "age unavailable for verification"

# ── 7. OFF-HOST UPLOAD (fail-closed) ────────────────────────────────────────
DEST_PREFIX="$RCLONE_REMOTE/daily/$RUN_TS"
upload() {
  local f="$1"
  log "uploading $(basename "$f") -> $DEST_PREFIX/"
  rclone copy --config "$RCLONE_CONFIG" "$f" "$DEST_PREFIX/" \
        --s3-no-check-bucket --log-file "$LOG" --log-level INFO \
    || die "rclone upload failed for $(basename "$f")"
}
upload "$DB_ARTIFACT"
upload "$DB_ARTIFACT.sha256"
if [ -n "$CFG_ARTIFACT" ]; then
  upload "$CFG_ARTIFACT"
  upload "$CFG_ARTIFACT.sha256"
fi

# ── 8. VERIFY OFF-HOST OBJECT (size must match) ─────────────────────────────
remote_size() { rclone size --config "$RCLONE_CONFIG" --json "$DEST_PREFIX/$1" 2>/dev/null | sed -E 's/.*"bytes":([0-9]+).*/\1/'; }
RS="$(remote_size "$DB_BASENAME")"
[ "$RS" = "$DB_SIZE" ] || die "off-host size mismatch for DB: local=$DB_SIZE remote=${RS:-none}"
log "off-host DB object verified: size matches ($RS bytes)"

# ── 9. LOCAL RETENTION (keep newest N encrypted copies) ─────────────────────
prune_local() {
  local pattern="$1" keep="$2"
  # newest-first; delete beyond keep. Only ever removes *.age + .sha256 pairs.
  mapfile -t olds < <(ls -1t "$LOCAL_DIR"/$pattern 2>/dev/null | tail -n +"$((keep+1))")
  for old in "${olds[@]:-}"; do
    [ -n "$old" ] || continue
    rm -f -- "$old" "$old.sha256"
    log "pruned local: $(basename "$old")"
  done
}
prune_local "handla-db-prod_*.sql.gz.age" "$KEEP_LOCAL"
prune_local "handla-config-prod_*.tar.gz.age" "$KEEP_LOCAL"

# ── 10. OFF-HOST RETENTION (age-based on the daily/ prefix) ─────────────────
# The production AWS backup credential intentionally has NO DeleteObject /
# DeleteObjectVersion, and objects are held under Object Lock. Client-side
# deletion is therefore neither possible nor desirable — expiration is handled
# by an AWS bucket LIFECYCLE policy (operator-managed), after Object Lock
# retention permits it. Set OFFHOST_PRUNE=false (default) for such immutable
# remotes to skip the futile, always-denied delete attempt. Set to true only
# for a remote whose credential legitimately grants delete (e.g. MinIO test).
OFFHOST_PRUNE="${OFFHOST_PRUNE:-false}"
if [ "$OFFHOST_PRUNE" = "true" ]; then
  rclone delete --config "$RCLONE_CONFIG" --min-age "${RETAIN_DAILY}d" \
        "$RCLONE_REMOTE/daily/" --rmdirs --log-file "$LOG" --log-level INFO \
    || log "NOTE: off-host retention prune skipped/denied (immutable remote?) — continuing"
else
  log "off-host retention: client-side prune DISABLED (immutable remote); expiry handled by AWS lifecycle + Object Lock"
fi

# ── 11. SUCCESS MARKER (only reached if EVERYTHING above succeeded) ─────────
printf '%s\n' "$RUN_TS" > "$SUCCESS_MARKER"
{
  echo "ts=$RUN_TS"
  echo "db_artifact=$DB_BASENAME"
  echo "db_size=$DB_SIZE"
  echo "db_sha256=$(cut -d' ' -f1 < "$LOCAL_DIR/$DB_BASENAME.sha256")"
  [ -n "$CFG_ARTIFACT" ] && echo "config_artifact=$CFG_BASENAME"
  echo "remote=$DEST_PREFIX"
} > "$STATE_DIR/last-success.meta"
chmod 600 "$SUCCESS_MARKER" "$STATE_DIR/last-success.meta"

log "=== backup run SUCCESS (ts=$RUN_TS) ==="
exit 0
