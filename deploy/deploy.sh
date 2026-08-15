#!/usr/bin/env bash
# =============================================================================
# Handla — VPS deploy script (invoked by GitHub Actions over SSH, or manually)
#
# Idempotent: pulls the latest main, rebuilds the changed images, and restarts
# the stack. The api entrypoint runs TypeORM migrations automatically on boot.
#
# Assumes:
#   - repo cloned at $HANDLA_DIR (default /opt/handla)
#   - handla-backend/.env present on the VPS (NOT in git)
#   - Docker + Docker Compose v2 installed
# =============================================================================
set -euo pipefail

HANDLA_DIR="${HANDLA_DIR:-/opt/handla}"
BRANCH="${DEPLOY_BRANCH:-main}"
COMPOSE_FILES="-f docker-compose.yml -f deploy/docker-compose.prod.yml"

log() { echo "[deploy] $*"; }

cd "$HANDLA_DIR"

log "Fetching latest '$BRANCH'..."
git fetch --all --prune
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

log "Verifying backend .env exists..."
if [ ! -f handla-backend/.env ]; then
  echo "[deploy] ERROR: handla-backend/.env is missing on the VPS. Aborting." >&2
  exit 1
fi

log "Building images (only changed layers rebuild)..."
docker compose $COMPOSE_FILES build

log "Starting/updating the stack..."
docker compose $COMPOSE_FILES up -d

log "Pruning dangling images to reclaim disk..."
docker image prune -f >/dev/null 2>&1 || true

log "Current status:"
docker compose $COMPOSE_FILES ps

log "Done ✓  (api migrations run automatically via the api entrypoint)"
