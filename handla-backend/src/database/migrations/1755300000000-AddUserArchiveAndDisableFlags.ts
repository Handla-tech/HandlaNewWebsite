import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: AddUserArchiveAndDisableFlags
 *
 * Adds the account lifecycle columns to `users`:
 *   - is_archived  BOOLEAN  (soft-archive: hidden from normal queries)
 *   - archived_at  DATETIME (when it was first archived)
 *   - is_disabled  BOOLEAN  (login blocked, records retained)
 *
 * Background: the User entity declares isArchived / archivedAt / isDisabled,
 * but no migration ever added the matching columns. On environments that used
 * synchronize:true the columns were auto-created, which hid the gap — but a
 * database built purely from migrations (e.g. `npm run db:reset`) was missing
 * them, so any `SELECT ... User.is_archived` failed with:
 *   Unknown column 'User.is_archived' in 'SELECT'
 *
 * Idempotent: each column is added only if absent (checked via
 * information_schema), so it is safe to re-run.
 */
export class AddUserArchiveAndDisableFlags1755300000000 implements MigrationInterface {
  name = 'AddUserArchiveAndDisableFlags1755300000000';

  private async columnExists(q: QueryRunner, column: string): Promise<boolean> {
    const rows: Array<{ COLUMN_NAME: string }> = await q.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME   = 'users'
         AND COLUMN_NAME  = ?`,
      [column],
    );
    return rows.length > 0;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.columnExists(queryRunner, 'is_archived'))) {
      await queryRunner.query(
        'ALTER TABLE `users` ADD COLUMN `is_archived` TINYINT(1) NOT NULL DEFAULT 0',
      );
    }
    if (!(await this.columnExists(queryRunner, 'archived_at'))) {
      await queryRunner.query(
        'ALTER TABLE `users` ADD COLUMN `archived_at` DATETIME NULL DEFAULT NULL',
      );
    }
    if (!(await this.columnExists(queryRunner, 'is_disabled'))) {
      await queryRunner.query(
        'ALTER TABLE `users` ADD COLUMN `is_disabled` TINYINT(1) NOT NULL DEFAULT 0',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const col of ['is_disabled', 'archived_at', 'is_archived']) {
      if (await this.columnExists(queryRunner, col)) {
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`${col}\``);
      }
    }
  }
}
