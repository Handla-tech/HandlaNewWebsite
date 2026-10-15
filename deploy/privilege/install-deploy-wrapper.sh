#!/usr/bin/env bash
# =============================================================================
# install-deploy-wrapper.sh  —  installs the root-owned deployment wrapper,
# the narrow sudoers rule, the root-owned trusted checkout, and the root-owned
# secrets store on the Handla VPS.
#
# RUN AS ROOT on the VPS.  Idempotent and non-destructive:
#   - does NOT touch the docker group (that is a later, separately-gated step)
#   - does NOT modify MySQL/Redis/Traefik/firewall
#   - seeds the root-owned secrets store from the EXISTING backend .env once
#
#   sudo bash install-deploy-wrapper.sh
# =============================================================================
set -euo pipefail

WRAPPER_SRC="${WRAPPER_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/handla-production-deploy}"
SUDOERS_SRC="${SUDOERS_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/handla-deploy.sudoers}"

WRAPPER_DST="/usr/local/sbin/handla-production-deploy"
SUDOERS_DST="/etc/sudoers.d/handla-deploy"
TRUSTED_DIR="/opt/handla-production"
SECRETS_DIR="/opt/handla-production-secrets"
SECRETS_ENV="$SECRETS_DIR/backend.env"
LEGACY_ENV="/opt/handla/handla-backend/.env"
EXPECTED_REMOTE="https://github.com/Handla-tech/HandlaNewWebsite.git"
BRANCH="main"

log() { echo "[install] $*"; }

[ "$(id -u)" -eq 0 ] || { echo "[install] must run as root" >&2; exit 1; }

# ---- 0. Pre-install sanity & syntax check ---------------------------------
log "Checking wrapper syntax..."
bash -n "$WRAPPER_SRC" || { echo "[install] FATAL: wrapper syntax check failed" >&2; exit 2; }

# ---- 1. Install the wrapper: backup existing -> install root:root 0755 -----
if [ -f "$WRAPPER_DST" ]; then
  BACKUP_PATH="${WRAPPER_DST}.bak.$(date +%Y%m%d%H%M%S)"
  log "Backing up existing wrapper to $BACKUP_PATH"
  cp -p "$WRAPPER_DST" "$BACKUP_PATH"
fi

log "Installing wrapper -> $WRAPPER_DST (root:root 0755)"
install -o root -g root -m 0755 "$WRAPPER_SRC" "$WRAPPER_DST"
NEW_HASH="$(shasum -a 256 "$WRAPPER_DST" | awk '{print $1}')"
log "Installed wrapper SHA-256: $NEW_HASH"

# ---- 2. Seed the root-owned secrets store (once) ---------------------------
if [ ! -f "$SECRETS_ENV" ]; then
  install -d -m 0700 -o root -g root "$SECRETS_DIR"
  if [ -f "$LEGACY_ENV" ]; then
    log "Seeding root-owned secrets store from $LEGACY_ENV"
    install -m 0600 -o root -g root "$LEGACY_ENV" "$SECRETS_ENV"
  else
    echo "[install] WARNING: $LEGACY_ENV not found; create $SECRETS_ENV manually (root:root 0600)." >&2
  fi
else
  log "Secrets store already present at $SECRETS_ENV (left unchanged)"
fi

# ---- 2b. Prepare root-owned rollback storage directory ---------------------
ROLLBACK_DIR="/opt/handla-production-rollback"
install -d -m 0700 -o root -g root "$ROLLBACK_DIR"
log "Durable rollback directory ensured at $ROLLBACK_DIR (root:root 0700)"

# ---- 3. Create the root-owned trusted checkout -----------------------------
if [ ! -d "$TRUSTED_DIR/.git" ]; then
  log "Cloning trusted checkout -> $TRUSTED_DIR ($BRANCH)"
  install -d -m 0755 -o root -g root "$TRUSTED_DIR"
  git -c safe.directory="$TRUSTED_DIR" clone --branch "$BRANCH" --single-branch \
      "$EXPECTED_REMOTE" "$TRUSTED_DIR"
  chown -R root:root "$TRUSTED_DIR"
else
  log "Trusted checkout already present at $TRUSTED_DIR (left unchanged)"
fi

# ---- 4. Install the narrow sudoers rule (validate BEFORE activating) -------
log "Validating sudoers fragment before install"
visudo -cf "$SUDOERS_SRC"
install -o root -g root -m 0440 "$SUDOERS_SRC" "$SUDOERS_DST"
log "Validating full sudoers set after install"
visudo -c

log "Done. Wrapper, sudoers, trusted checkout and secrets store are in place."
log "NOTE: docker-group removal is a SEPARATE, later step (not done here)."
