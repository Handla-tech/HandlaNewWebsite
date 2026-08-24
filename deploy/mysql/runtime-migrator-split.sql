-- =============================================================================
-- Handla — MySQL runtime / migrator privilege split (idempotent provisioning)
-- =============================================================================
--
-- PURPOSE
--   Split the single all-powerful application DB user (currently `handla@%`,
--   holding DDL+DML) into two least-privilege identities:
--
--     • handla_runtime  → DML ONLY (SELECT, INSERT, UPDATE, DELETE)
--                         Used by the running API process (`node dist/main`).
--                         Can NEVER create/alter/drop schema.
--
--     • handla_migrator → DDL + DML (schema management)
--                         Used ONLY by the migration step in entrypoint.sh and
--                         the TypeORM CLI. Not used to serve traffic.
--
--   root@localhost remains the administrative/recovery account. No GRANT OPTION
--   is given to either application user, and no global (*.*) privileges beyond
--   the harmless USAGE placeholder are granted — everything is scoped to the
--   application schema.
--
-- SAFETY / IDEMPOTENCY
--   • CREATE USER IF NOT EXISTS + ALTER USER ... IDENTIFIED BY makes this
--     re-runnable (password is (re)set to the supplied value each run).
--   • REVOKE ALL then GRANT the exact required set → converges to the intended
--     privilege set regardless of the user's prior grants.
--   • Scoped to a single database; other tenants on the shared host are never
--     referenced or touched.
--
-- HOW TO APPLY (operator, on the VPS — see OPERATOR-ACTIONS.md):
--   1. TAKE A BACKUP FIRST (mysqldump of handla_db + `SHOW GRANTS`).
--   2. Generate strong passwords OUT OF BAND (do NOT commit them):
--        RUNTIME_PW=$(openssl rand -base64 30)
--        MIGRATOR_PW=$(openssl rand -base64 30)
--   3. Render this template (placeholders are __UPPER_SNAKE__) and pipe to mysql
--      as root, e.g.:
--        sed -e "s|__DB_NAME__|handla_db|g" \
--            -e "s|__RUNTIME_USER__|handla_runtime|g" \
--            -e "s|__RUNTIME_HOST__|%|g" \
--            -e "s|__RUNTIME_PW__|$RUNTIME_PW|g" \
--            -e "s|__MIGRATOR_USER__|handla_migrator|g" \
--            -e "s|__MIGRATOR_HOST__|%|g" \
--            -e "s|__MIGRATOR_PW__|$MIGRATOR_PW|g" \
--            deploy/mysql/runtime-migrator-split.sql \
--        | docker exec -i handla_mysql mysql -uroot -p
--      (The `render-and-apply.sh` helper in this directory does the sed for you
--       and never echoes the passwords.)
--   4. Update the API environment (see OPERATOR-ACTIONS.md):
--        DATABASE_USER=handla_runtime           DATABASE_PASSWORD=<RUNTIME_PW>
--        DATABASE_MIGRATION_USER=handla_migrator DATABASE_MIGRATION_PASSWORD=<MIGRATOR_PW>
--   5. Redeploy handla_api and verify /api/health + a read/write smoke test.
--   6. Once verified, optionally drop the legacy combined `handla` user.
--
-- NOTE: The `%` host wildcard mirrors the existing `handla@%` account, which
-- connects from the Docker network (172.16.5.0/24). Narrow it if your topology
-- allows a fixed source (e.g. the Docker subnet) — the render helper accepts a
-- host argument for exactly this.
-- =============================================================================

-- ─── Runtime user: DML-only ─────────────────────────────────────────────────
CREATE USER IF NOT EXISTS '__RUNTIME_USER__'@'__RUNTIME_HOST__'
  IDENTIFIED BY '__RUNTIME_PW__';
ALTER USER '__RUNTIME_USER__'@'__RUNTIME_HOST__'
  IDENTIFIED BY '__RUNTIME_PW__';

-- Converge to exactly SELECT/INSERT/UPDATE/DELETE on the app schema.
REVOKE ALL PRIVILEGES, GRANT OPTION FROM '__RUNTIME_USER__'@'__RUNTIME_HOST__';
GRANT SELECT, INSERT, UPDATE, DELETE
  ON `__DB_NAME__`.*
  TO '__RUNTIME_USER__'@'__RUNTIME_HOST__';

-- ─── Migrator user: DDL + DML (schema management only) ───────────────────────
CREATE USER IF NOT EXISTS '__MIGRATOR_USER__'@'__MIGRATOR_HOST__'
  IDENTIFIED BY '__MIGRATOR_PW__';
ALTER USER '__MIGRATOR_USER__'@'__MIGRATOR_HOST__'
  IDENTIFIED BY '__MIGRATOR_PW__';

REVOKE ALL PRIVILEGES, GRANT OPTION FROM '__MIGRATOR_USER__'@'__MIGRATOR_HOST__';
-- DML (so migrations that backfill/seed data work) + DDL (schema changes).
-- REFERENCES + INDEX + ALTER + CREATE/DROP cover TypeORM migration operations.
GRANT SELECT, INSERT, UPDATE, DELETE,
      CREATE, ALTER, DROP, INDEX, REFERENCES,
      CREATE TEMPORARY TABLES, LOCK TABLES,
      CREATE VIEW, SHOW VIEW,
      TRIGGER, EXECUTE,
      CREATE ROUTINE, ALTER ROUTINE
  ON `__DB_NAME__`.*
  TO '__MIGRATOR_USER__'@'__MIGRATOR_HOST__';

FLUSH PRIVILEGES;
