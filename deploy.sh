#!/usr/bin/env bash
# =============================================================================
# Handla — one-command production deploy entrypoint (repo root)
# =============================================================================
# This is the single, obvious command to (re)deploy the whole site on the VPS.
# It works for the Genspark "Bring your own SSH server" tool, GitHub Actions,
# and manual runs alike.
#
#   ./deploy.sh                # pull latest main + build + up the full stack
#   PULL=0 ./deploy.sh         # deploy the current working tree (no git pull)
#   DEPLOY_BRANCH=dev ./deploy.sh
#
# It brings up: mysql · redis · api · web (Next.js) · nginx (+TLS) · certbot
# via `docker compose up -d --build` (docker-compose.yml + the auto-loaded
# docker-compose.override.yml). Migrations run automatically on api boot.
#
# Prereqs on the VPS (see DEPLOYMENT.md):
#   - Docker + Docker Compose v2 installed
#   - handla-backend/.env present (all secrets)
#   - TLS certs issued once (DEPLOYMENT.md §5)  — needed for nginx to start
# =============================================================================
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
exec ./deploy/deploy.sh "$@"
