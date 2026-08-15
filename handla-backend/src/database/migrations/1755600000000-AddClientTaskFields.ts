import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: AddClientTaskFields
 *
 * Adds three columns to `tasks` so a task can be directed at the CLIENT (a
 * requested deliverable such as "upload your brand assets") rather than being
 * purely internal staff work:
 *   - assigned_to_client  BOOLEAN  NOT NULL DEFAULT 0
 *   - requires_upload     BOOLEAN  NOT NULL DEFAULT 0
 *   - attachments         JSON     NULL     (files the client submitted)
 *
 * All existing tasks stay internal (assigned_to_client=0), so behaviour is
 * unchanged until a staff member explicitly creates a client task.
 *
 * Idempotent: each column is added only if absent (checked via
 * information_schema), so it is safe to re-run.
 */
export class AddClientTaskFields1755600000000 implements MigrationInterface {
  name = 'AddClientTaskFields1755600000000';

  private async columnExists(q: QueryRunner, column: string): Promise<boolean> {
    const rows: Array<{ COLUMN_NAME: string }> = await q.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME   = 'tasks'
         AND COLUMN_NAME  = ?`,
      [column],
    );
    return rows.length > 0;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.columnExists(queryRunner, 'assigned_to_client'))) {
      await queryRunner.query(
        'ALTER TABLE `tasks` ADD COLUMN `assigned_to_client` TINYINT(1) NOT NULL DEFAULT 0',
      );
    }
    if (!(await this.columnExists(queryRunner, 'requires_upload'))) {
      await queryRunner.query(
        'ALTER TABLE `tasks` ADD COLUMN `requires_upload` TINYINT(1) NOT NULL DEFAULT 0',
      );
    }
    if (!(await this.columnExists(queryRunner, 'attachments'))) {
      await queryRunner.query(
        'ALTER TABLE `tasks` ADD COLUMN `attachments` JSON NULL',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await this.columnExists(queryRunner, 'attachments')) {
      await queryRunner.query('ALTER TABLE `tasks` DROP COLUMN `attachments`');
    }
    if (await this.columnExists(queryRunner, 'requires_upload')) {
      await queryRunner.query('ALTER TABLE `tasks` DROP COLUMN `requires_upload`');
    }
    if (await this.columnExists(queryRunner, 'assigned_to_client')) {
      await queryRunner.query('ALTER TABLE `tasks` DROP COLUMN `assigned_to_client`');
    }
  }
}
