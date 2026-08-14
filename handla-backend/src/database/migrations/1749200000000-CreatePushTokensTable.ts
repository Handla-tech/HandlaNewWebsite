import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: CreatePushTokensTable
 *
 * Creates the `push_tokens` table used to deliver native (Expo) push
 * notifications to a user's mobile devices. One user may register many
 * devices; a given Expo token string is globally unique so we can upsert on it
 * and re-assign a device to whichever user last signed in on it.
 *
 * Idempotent — creating the table when it already exists is a no-op (matches
 * the DATABASE_SYNCHRONIZE=true auto-create path used in development).
 */
export class CreatePushTokensTable1749200000000 implements MigrationInterface {
  name = 'CreatePushTokensTable1749200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const existing: Array<{ TABLE_NAME: string }> = await queryRunner.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'push_tokens'`,
    );
    if (existing.length > 0) return;

    await queryRunner.query(`
      CREATE TABLE \`push_tokens\` (
        \`id\` varchar(36) NOT NULL,
        \`user_id\` varchar(36) NOT NULL,
        \`token\` varchar(255) NOT NULL,
        \`platform\` varchar(20) NULL,
        \`device_name\` varchar(120) NULL,
        \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_push_token_token\` (\`token\`),
        KEY \`idx_push_token_user\` (\`user_id\`),
        CONSTRAINT \`fk_push_tokens_user\` FOREIGN KEY (\`user_id\`)
          REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const existing: Array<{ TABLE_NAME: string }> = await queryRunner.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'push_tokens'`,
    );
    if (existing.length > 0) {
      await queryRunner.query(`DROP TABLE \`push_tokens\``);
    }
  }
}
