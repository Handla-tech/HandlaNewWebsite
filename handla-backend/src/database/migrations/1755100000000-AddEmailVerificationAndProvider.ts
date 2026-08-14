import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: AddEmailVerificationAndProvider
 *
 * 1. Adds `email_verified_at`, `provider`, `provider_id` to `users` and makes
 *    `password_hash` nullable (Google-only accounts have no local password).
 * 2. Backfills `email_verified_at = created_at` for every PRE-EXISTING user so
 *    accounts created before OTP existed are NOT locked out by the new
 *    "must be verified" rule.
 * 3. Creates the `email_verifications` table that backs the single OTP service
 *    (hashed codes, purpose, expiry, attempt count, single-use consumption).
 *
 * Idempotent: every step checks information_schema before altering, so it is
 * safe to run against a DB where synchronize:true may have already created
 * some of these objects in development.
 */
export class AddEmailVerificationAndProvider1755100000000 implements MigrationInterface {
  name = 'AddEmailVerificationAndProvider1755100000000';

  private async columnExists(q: QueryRunner, table: string, column: string): Promise<boolean> {
    const rows: Array<{ COLUMN_NAME: string }> = await q.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column],
    );
    return rows.length > 0;
  }

  private async tableExists(q: QueryRunner, table: string): Promise<boolean> {
    const rows: Array<{ TABLE_NAME: string }> = await q.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [table],
    );
    return rows.length > 0;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── users: new columns ────────────────────────────────────────────────
    if (!(await this.columnExists(queryRunner, 'users', 'email_verified_at'))) {
      await queryRunner.query(
        'ALTER TABLE `users` ADD COLUMN `email_verified_at` DATETIME NULL DEFAULT NULL',
      );
      // Backfill: treat every already-existing user as verified so they are not
      // locked out. New signups from here on start NULL (unverified).
      await queryRunner.query(
        'UPDATE `users` SET `email_verified_at` = `created_at` WHERE `email_verified_at` IS NULL',
      );
    }
    if (!(await this.columnExists(queryRunner, 'users', 'provider'))) {
      await queryRunner.query(
        'ALTER TABLE `users` ADD COLUMN `provider` VARCHAR(32) NULL DEFAULT NULL',
      );
    }
    if (!(await this.columnExists(queryRunner, 'users', 'provider_id'))) {
      await queryRunner.query(
        'ALTER TABLE `users` ADD COLUMN `provider_id` VARCHAR(255) NULL DEFAULT NULL',
      );
      await queryRunner.query(
        'CREATE INDEX `idx_users_provider` ON `users` (`provider`, `provider_id`)',
      );
    }

    // password_hash → nullable (Google-only accounts)
    await queryRunner.query(
      'ALTER TABLE `users` MODIFY COLUMN `password_hash` VARCHAR(255) NULL DEFAULT NULL',
    );

    // ── email_verifications table ─────────────────────────────────────────
    if (!(await this.tableExists(queryRunner, 'email_verifications'))) {
      await queryRunner.query(`
        CREATE TABLE \`email_verifications\` (
          \`id\` VARCHAR(36) NOT NULL,
          \`email\` VARCHAR(255) NOT NULL,
          \`user_id\` VARCHAR(36) NULL DEFAULT NULL,
          \`code_hash\` VARCHAR(255) NOT NULL,
          \`purpose\` ENUM('SIGNUP','LOGIN','GOOGLE','PASSWORD_RESET') NOT NULL,
          \`payload\` TEXT NULL DEFAULT NULL,
          \`attempt_count\` INT NOT NULL DEFAULT 0,
          \`expires_at\` DATETIME NOT NULL,
          \`consumed_at\` DATETIME NULL DEFAULT NULL,
          \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          INDEX \`idx_email_verifications_lookup\` (\`email\`, \`purpose\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await this.tableExists(queryRunner, 'email_verifications')) {
      await queryRunner.query('DROP TABLE `email_verifications`');
    }
    if (await this.columnExists(queryRunner, 'users', 'provider_id')) {
      await queryRunner.query('DROP INDEX `idx_users_provider` ON `users`').catch(() => undefined);
      await queryRunner.query('ALTER TABLE `users` DROP COLUMN `provider_id`');
    }
    if (await this.columnExists(queryRunner, 'users', 'provider')) {
      await queryRunner.query('ALTER TABLE `users` DROP COLUMN `provider`');
    }
    if (await this.columnExists(queryRunner, 'users', 'email_verified_at')) {
      await queryRunner.query('ALTER TABLE `users` DROP COLUMN `email_verified_at`');
    }
    // Leave password_hash nullable on down — restoring NOT NULL could fail if
    // any Google-only rows exist. Non-destructive.
  }
}
