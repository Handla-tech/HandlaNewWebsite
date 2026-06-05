#!/bin/sh
# =============================================================================
# Handla API — Docker entrypoint
# Responsibilities:
#   1. Wait for MySQL to be ready (up to 60 s)
#   2. Wait for Redis to be ready (up to 30 s)
#   3. Run TypeORM migrations
#   4. Start the NestJS API
# =============================================================================

set -e

# ─── Helpers ─────────────────────────────────────────────────────────────────

log()  { echo "[entrypoint] $*"; }
warn() { echo "[entrypoint] WARN: $*" >&2; }
die()  { echo "[entrypoint] ERROR: $*" >&2; exit 1; }

# ─── Wait for MySQL ───────────────────────────────────────────────────────────

DB_HOST="${DATABASE_HOST:-mysql}"
DB_PORT="${DATABASE_PORT:-3306}"
DB_RETRIES=30
DB_WAIT=2

log "Waiting for MySQL at ${DB_HOST}:${DB_PORT}..."
for i in $(seq 1 $DB_RETRIES); do
  if nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; then
    log "MySQL is ready ✓ (attempt ${i})"
    break
  fi
  if [ "$i" -eq "$DB_RETRIES" ]; then
    die "MySQL did not become ready after $((DB_RETRIES * DB_WAIT))s — aborting."
  fi
  log "  attempt ${i}/${DB_RETRIES} — retrying in ${DB_WAIT}s..."
  sleep $DB_WAIT
done

# Give MySQL an extra second to fully accept connections after the port opens
sleep 1

# ─── Wait for Redis ───────────────────────────────────────────────────────────

REDIS_HOST="${REDIS_HOST:-redis}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_RETRIES=15
REDIS_WAIT=2

log "Waiting for Redis at ${REDIS_HOST}:${REDIS_PORT}..."
for i in $(seq 1 $REDIS_RETRIES); do
  if nc -z "$REDIS_HOST" "$REDIS_PORT" 2>/dev/null; then
    log "Redis is ready ✓ (attempt ${i})"
    break
  fi
  if [ "$i" -eq "$REDIS_RETRIES" ]; then
    warn "Redis did not become ready — continuing anyway (email queue will buffer)."
    break
  fi
  log "  attempt ${i}/${REDIS_RETRIES} — retrying in ${REDIS_WAIT}s..."
  sleep $REDIS_WAIT
done

# ─── Run Migrations ──────────────────────────────────────────────────────────

log "Running TypeORM migrations..."
# Use the compiled JS data-source (dist) to avoid needing ts-node at runtime
node -e "
const { AppDataSource } = require('./dist/config/data-source');
AppDataSource.initialize()
  .then(() => AppDataSource.runMigrations({ transaction: 'all' }))
  .then((ran) => {
    console.log('[entrypoint] Migrations applied:', ran.length ? ran.map(m => m.name).join(', ') : 'none (already up-to-date)');
    return AppDataSource.destroy();
  })
  .catch((err) => {
    console.error('[entrypoint] Migration failed:', err.message);
    process.exit(1);
  });
"

log "Migrations complete ✓"

# ─── Start API ────────────────────────────────────────────────────────────────

log "Starting Handla API (NODE_ENV=${NODE_ENV:-production})..."
exec node dist/main
