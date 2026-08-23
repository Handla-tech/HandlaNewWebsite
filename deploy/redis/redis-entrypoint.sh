#!/bin/sh
# =============================================================================
# Handla — Redis secure entrypoint
# =============================================================================
# Boots redis:7-alpine with ACL authentication instead of the default open,
# unauthenticated "default" user.
#
# What it does on every container start (so it survives recreation):
#   1. Generates an ACL file at $ACL_FILE from the REDIS_PASSWORD env var.
#        - Creates the dedicated application user (REDIS_USERNAME, default
#          "handla_app") with a password and broad key/channel access
#          (+@all ~* &*) MINUS a deny-list of dangerous administrative
#          commands the application (Bull email queue) never needs.
#        - Disables the built-in "default" user so there is NO unauthenticated
#          access path.
#   2. Starts redis-server pointed at that ACL file, preserving the existing
#      persistence (--save) and log settings.
#
# SECURITY NOTES:
#   - The password is injected ONLY via the REDIS_PASSWORD environment variable
#     (populated from handla-backend/.env at deploy time). It is never committed
#     to git and never baked into the image.
#   - The generated ACL file lives on the redis_data volume (/data), readable
#     only inside the container. It is regenerated from env on every boot, so a
#     rotated password takes effect on the next recreate.
#   - This script contains NO secret values itself.
# =============================================================================
set -eu

REDIS_USERNAME="${REDIS_USERNAME:-handla_app}"
ACL_FILE="${ACL_FILE:-/data/users.acl}"

if [ -z "${REDIS_PASSWORD:-}" ]; then
  echo "[redis-entrypoint] FATAL: REDIS_PASSWORD is not set. Refusing to start" \
       "without authentication (would leave Redis open)." >&2
  exit 1
fi

# Dangerous / administrative commands the Handla app (Bull email queue) does
# NOT require. Denied even for the application user as defence-in-depth.
# Bull needs data structures + scripting (EVAL/EVALSHA/SCRIPT) + pub/sub +
# blocking list/zset ops + CLIENT + INFO — all of which remain allowed.
DENY_CMDS="-flushall -flushdb -swapdb -config -shutdown -debug -module -acl \
-cluster -replicaof -slaveof -failover -save -bgsave -bgrewriteaof -reset -migrate -restore"

# Build the ACL file. NOTE: Redis ACL files (unlike redis.conf) do NOT allow
# comment lines — every line MUST start with the `user` keyword — so we write
# ONLY user directives here. The password directive is the only secret-bearing
# content; the file is written with a restrictive umask.
umask 077
{
  # Dedicated application user: authenticated, broad data access, admin denied.
  printf 'user %s on >%s ~* &* +@all %s\n' "$REDIS_USERNAME" "$REDIS_PASSWORD" "$DENY_CMDS"
  # Disable the built-in default user entirely: no unauthenticated access.
  echo "user default off nopass ~* &* -@all"
} > "$ACL_FILE"
chmod 600 "$ACL_FILE"

echo "[redis-entrypoint] ACL file generated at $ACL_FILE for user '$REDIS_USERNAME'; default user disabled."

# Hand off to redis-server with the ACL file plus the original runtime flags.
exec redis-server \
  --aclfile "$ACL_FILE" \
  --save 60 1 \
  --loglevel warning \
  "$@"
