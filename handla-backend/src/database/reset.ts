import 'dotenv/config';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { DataSource } from 'typeorm';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { AppDataSource } from '../config/data-source';

/**
 * Database reset — DROP the database and rebuild it from scratch.
 *
 *   npm run db:reset
 *
 * What it does, in order:
 *   1. DROP DATABASE  <name>            (deletes ALL data + schema)
 *   2. CREATE DATABASE <name>           (fresh, empty, utf8mb4)
 *   3. runMigrations()                  (rebuilds the full schema)
 *   4. seed.ts                          (inserts the seed data)
 *
 * ⚠️  DESTRUCTIVE: every table and row in the target database is deleted.
 * Because of that this script REFUSES to run in production and requires an
 * explicit confirmation flag when NODE_ENV looks non-local.
 *
 * Safety flags:
 *   --force / -f          proceed without the interactive-style guard
 *   ALLOW_DB_RESET=true   same as --force (handy for CI / npm scripts)
 *
 * Admin seed is configurable via env (see seed.ts):
 *   ADMIN_EMAIL=admin@handla.tech ADMIN_PASSWORD='...' ADMIN_NAME='...' \
 *     npm run db:reset -- --force
 */

const DB_NAME = process.env.DATABASE_NAME || 'handla_db';
const DB_HOST = process.env.DATABASE_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DATABASE_PORT || '3306', 10);
const DB_USER = process.env.DATABASE_USER || 'root';
const DB_PASS = process.env.DATABASE_PASSWORD || undefined;

const argv = process.argv.slice(2);
const forced =
  argv.includes('--force') ||
  argv.includes('-f') ||
  String(process.env.ALLOW_DB_RESET).toLowerCase() === 'true';

const nodeEnv = (process.env.NODE_ENV || 'development').toLowerCase();
const looksProd = nodeEnv === 'production' || nodeEnv === 'prod';

function assertSafe(): void {
  if (looksProd) {
    console.error(
      '❌ Refusing to reset the database: NODE_ENV is "production".\n' +
        '   This wipes ALL data. If you REALLY mean it, unset NODE_ENV or set it\n' +
        '   to a non-production value and re-run with --force.',
    );
    process.exit(1);
  }
  if (!forced) {
    console.error(
      '⚠️  db:reset will DROP the entire database and delete ALL data:\n' +
        `      database: ${DB_NAME}  @  ${DB_HOST}:${DB_PORT}\n\n` +
        '   This cannot be undone. Re-run with --force to proceed, e.g.:\n' +
        '      npm run db:reset -- --force\n' +
        '   (or set ALLOW_DB_RESET=true).',
    );
    process.exit(1);
  }
}

/**
 * A server-level DataSource that does NOT select a database, so we can DROP /
 * CREATE the target database itself.
 */
const serverDataSource = new DataSource({
  type: 'mysql',
  host: DB_HOST,
  port: DB_PORT,
  username: DB_USER,
  password: DB_PASS,
  // no `database` on purpose
  charset: 'utf8mb4',
  logging: false,
});

async function dropAndCreateDatabase(): Promise<void> {
  await serverDataSource.initialize();
  try {
    console.log(`🗑️   Dropping database \`${DB_NAME}\` (if it exists)...`);
    await serverDataSource.query(`DROP DATABASE IF EXISTS \`${DB_NAME}\``);

    console.log(`🆕  Creating database \`${DB_NAME}\` (utf8mb4)...`);
    await serverDataSource.query(
      `CREATE DATABASE \`${DB_NAME}\` ` +
        `CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    console.log('✅  Database recreated (empty).');
  } finally {
    await serverDataSource.destroy();
  }
}

async function runMigrations(): Promise<void> {
  console.log('🏗️   Running migrations to rebuild the schema...');
  await AppDataSource.initialize();
  const ran = await AppDataSource.runMigrations();
  console.log(`✅  ${ran.length} migration(s) applied.`);
  // NOTE: connection is left OPEN on purpose — runSeed() reuses it and closes
  // it when it's done.
}

async function main(): Promise<void> {
  assertSafe();

  console.log('🔻 Resetting database...');
  console.log(`   target: ${DB_NAME} @ ${DB_HOST}:${DB_PORT}\n`);

  await dropAndCreateDatabase();
  await runMigrations();

  // Run the seeder in-process so it uses the same env + a fresh connection.
  console.log('🌱  Seeding fresh data...');
  const { runSeed } = await import('./seeders/seed');
  await runSeed();

  console.log('\n🎉 Database reset complete — fresh schema + seed data.');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ db:reset failed:', err);
  process.exit(1);
});
