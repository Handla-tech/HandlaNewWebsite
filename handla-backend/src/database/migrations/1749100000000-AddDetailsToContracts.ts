import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: AddDetailsToContracts
 *
 * Adds a single nullable JSON column `details` to the `contracts` table.
 *
 * Background: contracts previously only stored `title` and `body`. The
 * comprehensive contract form (client info, scope, milestones, warranty,
 * IP, NDA, hosting, signatures, …) writes its structured payload here.
 *
 * The existing `body` column is still populated by the service (auto-rendered
 * from `details`) so the Handlebars contract.hbs template + signed PDF flow
 * keep working unchanged.
 *
 * Idempotent — adding the column when it already exists is a no-op.
 */
export class AddDetailsToContracts1749100000000 implements MigrationInterface {
  name = 'AddDetailsToContracts1749100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const existing: Array<{ COLUMN_NAME: string }> = await queryRunner.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME   = 'contracts'
         AND COLUMN_NAME  = 'details'`,
    );
    if (existing.length === 0) {
      await queryRunner.query(
        `ALTER TABLE \`contracts\` ADD COLUMN \`details\` JSON NULL DEFAULT NULL`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const existing: Array<{ COLUMN_NAME: string }> = await queryRunner.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME   = 'contracts'
         AND COLUMN_NAME  = 'details'`,
    );
    if (existing.length > 0) {
      await queryRunner.query(
        `ALTER TABLE \`contracts\` DROP COLUMN \`details\``,
      );
    }
  }
}
