import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: AddWebsiteProjectArabicFields
 *
 * Adds OPTIONAL Arabic-locale columns to `website_projects` so a single
 * canonical project record can carry both English and Arabic marketing copy.
 * The public routes /en/projects and /ar/projects then read the same row and
 * pick the locale-appropriate field (Arabic falls back to English when the
 * Arabic value is NULL). This intentionally avoids duplicate EN/AR rows.
 *
 * New nullable columns:
 *   - title_ar        varchar(160)
 *   - summary_ar      varchar(255)
 *   - description_ar  text
 *   - category_ar     varchar(80)
 *
 * Design notes:
 *   - All columns are NULLABLE and additive — existing rows and the existing
 *     admin CRUD (which only writes the English columns) keep working
 *     unchanged. No data is moved, dropped or rewritten.
 *   - Each ADD COLUMN is guarded via information_schema so the migration is
 *     idempotent and safe to run on a DB where the columns already exist
 *     (e.g. a database that briefly ran with synchronize:true).
 *   - No foreign keys, no index changes, no destructive operations.
 */
export class AddWebsiteProjectArabicFields1755700000000 implements MigrationInterface {
  name = 'AddWebsiteProjectArabicFields1755700000000';

  private async columnExists(
    q: QueryRunner,
    table: string,
    column: string,
  ): Promise<boolean> {
    const rows: Array<{ COLUMN_NAME: string }> = await q.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column],
    );
    return rows.length > 0;
  }

  private async addColumnIfAbsent(
    q: QueryRunner,
    table: string,
    column: string,
    ddl: string,
  ): Promise<void> {
    if (!(await this.columnExists(q, table, column))) {
      await q.query(`ALTER TABLE \`${table}\` ADD COLUMN ${ddl}`);
    }
  }

  private async dropColumnIfPresent(
    q: QueryRunner,
    table: string,
    column: string,
  ): Promise<void> {
    if (await this.columnExists(q, table, column)) {
      await q.query(`ALTER TABLE \`${table}\` DROP COLUMN \`${column}\``);
    }
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.addColumnIfAbsent(
      queryRunner,
      'website_projects',
      'title_ar',
      '`title_ar` varchar(160) NULL AFTER `title`',
    );
    await this.addColumnIfAbsent(
      queryRunner,
      'website_projects',
      'summary_ar',
      '`summary_ar` varchar(255) NULL AFTER `summary`',
    );
    await this.addColumnIfAbsent(
      queryRunner,
      'website_projects',
      'description_ar',
      '`description_ar` text NULL AFTER `description`',
    );
    await this.addColumnIfAbsent(
      queryRunner,
      'website_projects',
      'category_ar',
      '`category_ar` varchar(80) NULL AFTER `category`',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropColumnIfPresent(queryRunner, 'website_projects', 'category_ar');
    await this.dropColumnIfPresent(queryRunner, 'website_projects', 'description_ar');
    await this.dropColumnIfPresent(queryRunner, 'website_projects', 'summary_ar');
    await this.dropColumnIfPresent(queryRunner, 'website_projects', 'title_ar');
  }
}
