import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: AddOriginToMessages
 *
 * Adds the `origin` column to the `messages` table:
 *   - origin  ENUM('CLIENT','STAFF','AI','SYSTEM')  NULL  (default NULL)
 *
 * Background: the Message entity declares `origin` (MessageOrigin enum — used to
 * tag whether a chat message came from a CLIENT, STAFF member, the AI assistant,
 * or an automated SYSTEM notice), but no migration ever added the matching
 * column. On environments that used synchronize:true the column was auto-created,
 * which hid the gap — but a database built purely from migrations (e.g.
 * `npm run db:reset`, or any deployment with DATABASE_SYNCHRONIZE=false) was
 * missing it, so every chat/dashboard load failed with:
 *   Unknown column 'Message.origin' in 'field list'
 *
 * Kept nullable with no default so existing rows and legacy chat writes need no
 * change (origin is resolved to CLIENT/STAFF at read time when null).
 *
 * Idempotent: the column is added only if absent (checked via
 * information_schema), so it is safe to re-run.
 */
export class AddOriginToMessages1755500000000 implements MigrationInterface {
  name = 'AddOriginToMessages1755500000000';

  private async columnExists(q: QueryRunner, column: string): Promise<boolean> {
    const rows: Array<{ COLUMN_NAME: string }> = await q.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME   = 'messages'
         AND COLUMN_NAME  = ?`,
      [column],
    );
    return rows.length > 0;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.columnExists(queryRunner, 'origin'))) {
      await queryRunner.query(
        "ALTER TABLE `messages` ADD COLUMN `origin` ENUM('CLIENT','STAFF','AI','SYSTEM') NULL DEFAULT NULL",
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await this.columnExists(queryRunner, 'origin')) {
      await queryRunner.query('ALTER TABLE `messages` DROP COLUMN `origin`');
    }
  }
}
