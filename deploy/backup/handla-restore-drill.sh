#!/usr/bin/env bash
# =============================================================================
# handla-restore-drill  —  prove an OFF-HOST backup is actually restorable
# =============================================================================
# Downloads the latest (or a given) encrypted DB backup from the off-host
# remote, verifies checksum, decrypts with the OFF-host age identity, verifies
# gzip, restores into a THROWAWAY MySQL 8 container (never production), and
# validates schema/table/migration/row-count integrity.
#
# USAGE:
#   handla-restore-drill.sh [<db-artifact-basename>]
#   Env required:
#     AGE_IDENTITY   path to the age PRIVATE key (brought in for the drill only)
#     RCLONE_CONFIG  path to rclone config (default /etc/handla-backup/rclone.conf)
#     RCLONE_REMOTE  e.g. handlabackup:handla-production-backups
#   Optional:
#     EXPECT_TABLES  expected table count (aggregate baseline)
#
# SAFETY: uses a temp container 'handla-restore-verify' on a temp network;
#         NEVER touches handla_mysql / production data.
# =============================================================================
set -euo pipefail
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
umask 077

RCLONE_CONFIG="${RCLONE_CONFIG:-/etc/handla-backup/rclone.conf}"
: "${RCLONE_REMOTE:?RCLONE_REMOTE unset}"
: "${AGE_IDENTITY:?AGE_IDENTITY unset (off-host private key needed for the drill)}"
export RCLONE_CONFIG

WORK="$(mktemp -d /tmp/handla-restore.XXXXXX)"
CONT="handla-restore-verify"
NET="handla-restore-net"
TMP_PW="$(head -c18 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 20)"
RESULT="FAIL"

cleanup() {
  echo "[restore-drill] cleanup: removing temp container/network/files"
  docker rm -f "$CONT" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
  # shred decrypted plaintext dump if present
  [ -f "$WORK/dump.sql" ] && shred -u "$WORK/dump.sql" 2>/dev/null || true
  rm -rf "$WORK"
  echo "[restore-drill] cleanup done"
}
trap cleanup EXIT

log(){ printf '%s [restore-drill] %s\n' "$(date -u +%FT%TZ)" "$*"; }

# ── 1. pick artifact ────────────────────────────────────────────────────────
if [ "${1:-}" != "" ]; then
  DB_BASENAME="$1"
else
  log "resolving latest off-host DB artifact"
  DB_BASENAME="$(rclone lsf --config "$RCLONE_CONFIG" -R "$RCLONE_REMOTE/daily/" \
      | grep -E 'handla-db-prod_.*\.sql\.gz\.age$' | sort | tail -1)"
  [ -n "$DB_BASENAME" ] || { log "FATAL: no DB artifact found off-host"; exit 1; }
fi
REMOTE_PATH="$RCLONE_REMOTE/daily/$DB_BASENAME"
log "artifact: $DB_BASENAME"

# ── 2. download artifact + checksum ─────────────────────────────────────────
BASE="$(basename "$DB_BASENAME")"
rclone copyto --config "$RCLONE_CONFIG" "$REMOTE_PATH" "$WORK/$BASE"
rclone copyto --config "$RCLONE_CONFIG" "$REMOTE_PATH.sha256" "$WORK/$BASE.sha256" || true

# ── 3. verify checksum ──────────────────────────────────────────────────────
if [ -f "$WORK/$BASE.sha256" ]; then
  EXPECT="$(cut -d' ' -f1 < "$WORK/$BASE.sha256")"
  ACTUAL="$(sha256sum "$WORK/$BASE" | cut -d' ' -f1)"
  [ "$EXPECT" = "$ACTUAL" ] || { log "FATAL: checksum mismatch"; exit 1; }
  log "checksum OK ($ACTUAL)"
else
  log "WARN: no .sha256 sidecar; continuing on decrypt-verify only"
fi

# ── 4. decrypt (off-host identity) ──────────────────────────────────────────
age -d -i "$AGE_IDENTITY" -o "$WORK/dump.sql.gz" "$WORK/$BASE" \
  || { log "FATAL: age decryption failed"; exit 1; }
log "decrypted -> dump.sql.gz"

# ── 5. verify gzip integrity ────────────────────────────────────────────────
gzip -t "$WORK/dump.sql.gz" || { log "FATAL: gzip integrity check failed"; exit 1; }
gunzip -c "$WORK/dump.sql.gz" > "$WORK/dump.sql"
chmod 600 "$WORK/dump.sql"
DUMP_LINES="$(wc -l < "$WORK/dump.sql")"
log "gzip OK; plaintext dump extracted ($DUMP_LINES lines)"

# ── 6. isolated MySQL 8 container ───────────────────────────────────────────
docker network create "$NET" >/dev/null 2>&1 || true
log "starting throwaway MySQL 8 (isolated, no production link)"
docker run -d --name "$CONT" --network "$NET" \
  -e MYSQL_ROOT_PASSWORD="$TMP_PW" \
  mysql:8.0 >/dev/null
# wait for readiness — require an AUTHENTICATED query to succeed, not just a
# ping. MySQL 8's entrypoint briefly runs a temp server before the root password
# is finalized; pinging too early lets the import race the auth setup and fail
# with "Access denied for user 'root'". We poll a real SELECT with the password.
READY=0
for i in $(seq 1 90); do
  if docker exec -e MYSQL_PWD="$TMP_PW" "$CONT" \
       mysql -uroot -N -e "SELECT 1;" >/dev/null 2>&1; then
    READY=1; break
  fi
  sleep 2
done
[ "$READY" -eq 1 ] || { log "FATAL: temp MySQL did not become ready (authenticated)"; exit 1; }
# small settle so the entrypoint has fully swapped from temp server to final one
sleep 2
log "temp MySQL ready (authenticated)"

# ── 7. import dump ──────────────────────────────────────────────────────────
set +e
docker exec -i -e MYSQL_PWD="$TMP_PW" "$CONT" mysql -uroot < "$WORK/dump.sql" 2>"$WORK/import.err"
IMP=$?
set -e
if [ $IMP -ne 0 ]; then
  # surface only non-fatal warnings vs fatal errors
  if grep -qiE 'ERROR' "$WORK/import.err"; then
    log "FATAL: import reported errors:"; sed 's/^/    /' "$WORK/import.err" | head -20; exit 1
  fi
fi
log "dump imported (mysql exit=$IMP)"

# ── 8. VALIDATION (do NOT trust exit code alone) ────────────────────────────
q(){ docker exec -e MYSQL_PWD="$TMP_PW" "$CONT" mysql -uroot -N -e "$1" 2>/dev/null; }

DB_EXISTS="$(q "SELECT SCHEMA_NAME FROM information_schema.schemata WHERE SCHEMA_NAME='handla_db';")"
[ "$DB_EXISTS" = "handla_db" ] || { log "FATAL: handla_db not present after restore"; exit 1; }

TBL_COUNT="$(q "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='handla_db';")"
MIG_PRESENT="$(q "SELECT table_name FROM information_schema.tables WHERE table_schema='handla_db' AND table_name='migrations';")"
MIG_ROWS="$(q "SELECT COUNT(*) FROM handla_db.migrations;" 2>/dev/null || echo 'n/a')"
IDX_COUNT="$(q "SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema='handla_db';")"
FK_COUNT="$(q "SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema='handla_db' AND constraint_type='FOREIGN KEY';")"

log "VALIDATION: db=handla_db tables=$TBL_COUNT migrations_table=${MIG_PRESENT:-MISSING} migration_rows=$MIG_ROWS indexes=$IDX_COUNT foreign_keys=$FK_COUNT"

[ -n "$MIG_PRESENT" ] || { log "FATAL: migrations table missing"; exit 1; }
[ "$TBL_COUNT" -ge 1 ] || { log "FATAL: no tables restored"; exit 1; }
if [ -n "${EXPECT_TABLES:-}" ]; then
  [ "$TBL_COUNT" = "$EXPECT_TABLES" ] || { log "FATAL: table count $TBL_COUNT != expected $EXPECT_TABLES"; exit 1; }
fi

RESULT="PASS"
log "=== RESTORE DRILL RESULT: $RESULT (tables=$TBL_COUNT, migrations rows=$MIG_ROWS) ==="
echo "RESTORE_DRILL_RESULT=$RESULT TABLES=$TBL_COUNT MIGRATIONS=$MIG_ROWS INDEXES=$IDX_COUNT FKS=$FK_COUNT"
