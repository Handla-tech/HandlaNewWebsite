import 'dotenv/config';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Glob ALL entities (same as the runtime AppModule config) rather than a
// hand-maintained subset. Previously this file only listed 12 of the 35
// entities, which meant migrations/CLI were blind to the rest (purchases,
// quotations, saas, suppliers, support, accounting, ai, analytics, website),
// so those tables only ever existed via synchronize:true. Globbing keeps the
// migration data-source in lockstep with the app.
//
// SECURITY (MySQL runtime/migrator split): this DataSource is used ONLY for
// schema migrations (entrypoint.sh migration step + the `typeorm` CLI). It
// therefore prefers a dedicated migrator identity that holds DDL privileges
// (CREATE/ALTER/DROP/INDEX/REFERENCES). The runtime application uses the
// separate DML-only identity in database.config.ts (DATABASE_USER). When the
// migrator variables are unset we fall back to DATABASE_USER/DATABASE_PASSWORD
// so existing single-user deployments keep working until the split is applied.
/**
 * Resolve the migrator credentials from an environment map.
 *
 * Pure and side-effect free so it can be unit-tested deterministically without
 * depending on a loaded `.env` file. Prefers the dedicated migrator identity
 * (DATABASE_MIGRATION_USER/PASSWORD) and falls back to the runtime
 * DATABASE_USER/PASSWORD for backward compatibility.
 */
export function resolveMigrationCredentials(
  env: NodeJS.ProcessEnv = process.env,
): { username: string; password: string | undefined } {
  const isProduction = env.NODE_ENV === 'production';
  const migratorUser = env.DATABASE_MIGRATION_USER?.trim();
  const migratorPassword = env.DATABASE_MIGRATION_PASSWORD;

  if (isProduction) {
    if (!migratorUser) {
      throw new Error(
        'DATABASE_MIGRATION_USER is required in production. Refusing to run migrations with unprivileged or fallback credentials.',
      );
    }
    if (!migratorPassword) {
      throw new Error(
        'DATABASE_MIGRATION_PASSWORD is required in production. Refusing to run migrations with missing password.',
      );
    }
    return {
      username: migratorUser,
      password: migratorPassword,
    };
  }

  // Non-production (dev/test) fallback for backward compatibility
  return {
    username: migratorUser || env.DATABASE_USER || 'root',
    password: migratorPassword || env.DATABASE_PASSWORD || undefined,
  };
}

const { username: migrationUser, password: migrationPassword } =
  resolveMigrationCredentials();

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '3306', 10),
  database: process.env.DATABASE_NAME || 'handla_db',
  username: migrationUser,
  password: migrationPassword,
  entities: [path.resolve(__dirname, '../modules/**/*.entity{.ts,.js}')],
  migrations: [path.resolve(__dirname, '../database/migrations/*{.ts,.js}')],
  synchronize: false,
  logging: true,
  charset: 'utf8mb4',
  timezone: 'Z',
});
