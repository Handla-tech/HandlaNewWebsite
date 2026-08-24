#!/usr/bin/env bash
# =============================================================================
# Handla — render + apply the runtime/migrator MySQL privilege split
# =============================================================================
#
# Renders deploy/mysql/runtime-migrator-split.sql with the supplied
# identities/passwords and applies it to the handla_mysql container as root.
#
# SECURITY:
#   • Passwords are read from the environment (or generated) and are NEVER
#     printed, logged, or written to disk in cleartext. The rendered SQL is
#     produced on a pipe and piped straight into mysql — no temp file.
#   • Requires the MySQL root password via MYSQL_ROOT_PASSWORD (env) so it is
#     not exposed on the process command line.
#
# USAGE (on the VPS, as an operator who can run docker):
#   export MYSQL_ROOT_PASSWORD='...'          # required, not echoed
#   export RUNTIME_PW="$(openssl rand -base64 30)"     # or supply your own
#   export MIGRATOR_PW="$(openssl rand -base64 30)"
#   ./render-and-apply.sh
#
# Optional overrides (defaults shown):
#   DB_NAME=handla_db
#   RUNTIME_USER=handla_runtime   RUNTIME_HOST=%
#   MIGRATOR_USER=handla_migrator MIGRATOR_HOST=%
#   MYSQL_CONTAINER=handla_mysql
#   DRY_RUN=1   # render only, print the SQL with passwords MASKED, do not apply
#
# After a successful apply this script prints (to stdout) the exact env-var
# NAMES to set on the API — never the values.
# =============================================================================
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE="$HERE/runtime-migrator-split.sql"

DB_NAME="${DB_NAME:-handla_db}"
RUNTIME_USER="${RUNTIME_USER:-handla_runtime}"
RUNTIME_HOST="${RUNTIME_HOST:-%}"
MIGRATOR_USER="${MIGRATOR_USER:-handla_migrator}"
MIGRATOR_HOST="${MIGRATOR_HOST:-%}"
MYSQL_CONTAINER="${MYSQL_CONTAINER:-handla_mysql}"
DRY_RUN="${DRY_RUN:-0}"

die() { echo "ERROR: $*" >&2; exit 1; }

[ -f "$TEMPLATE" ] || die "template not found: $TEMPLATE"
[ -n "${RUNTIME_PW:-}" ]  || die "RUNTIME_PW is required (export it; it will not be printed)"
[ -n "${MIGRATOR_PW:-}" ] || die "MIGRATOR_PW is required (export it; it will not be printed)"

# Reject passwords containing characters that would break the sed delimiter.
case "$RUNTIME_PW$MIGRATOR_PW" in
  *"|"*) die "passwords must not contain the '|' character (sed delimiter)";;
esac

render() {
  local rpw="$1" mpw="$2"
  sed -e "s|__DB_NAME__|${DB_NAME}|g" \
      -e "s|__RUNTIME_USER__|${RUNTIME_USER}|g" \
      -e "s|__RUNTIME_HOST__|${RUNTIME_HOST}|g" \
      -e "s|__RUNTIME_PW__|${rpw}|g" \
      -e "s|__MIGRATOR_USER__|${MIGRATOR_USER}|g" \
      -e "s|__MIGRATOR_HOST__|${MIGRATOR_HOST}|g" \
      -e "s|__MIGRATOR_PW__|${mpw}|g" \
      "$TEMPLATE"
}

if [ "$DRY_RUN" = "1" ]; then
  echo "── DRY RUN: rendered SQL (passwords MASKED) ─────────────────────────"
  render '********' '********'
  echo "── end dry run (nothing applied) ────────────────────────────────────"
  exit 0
fi

[ -n "${MYSQL_ROOT_PASSWORD:-}" ] || die "MYSQL_ROOT_PASSWORD is required (env, not echoed)"

echo "Applying runtime/migrator split to container '${MYSQL_CONTAINER}' (db=${DB_NAME})..."
# MYSQL_PWD passes the root password to the client without it appearing in argv.
render "$RUNTIME_PW" "$MIGRATOR_PW" \
  | docker exec -i -e MYSQL_PWD="$MYSQL_ROOT_PASSWORD" "$MYSQL_CONTAINER" \
      mysql -uroot

echo "✓ Applied. Set the following env-var NAMES on handla_api (values from your shell):"
echo "    DATABASE_USER=${RUNTIME_USER}"
echo "    DATABASE_PASSWORD=<RUNTIME_PW>"
echo "    DATABASE_MIGRATION_USER=${MIGRATOR_USER}"
echo "    DATABASE_MIGRATION_PASSWORD=<MIGRATOR_PW>"
echo "Then redeploy handla_api and verify /api/health + a read/write smoke test."
