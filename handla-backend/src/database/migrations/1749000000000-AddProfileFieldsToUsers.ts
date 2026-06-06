import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: AddProfileFieldsToUsers
 *
 * Adds six new nullable columns to the `users` table so every user can have a
 * profile (avatar, bio, phone, job title, company, location).
 *
 * Background: prior to this migration only `name`, `email` and `role` were
 * stored per user, which is why chat avatars showed only initials (or '?'
 * when the sender wasn't in the participants map) and there was no concept
 * of a profile picture or contact details.
 *
 * All columns are nullable — existing users get NULL until they fill in
 * their profile. The migration is idempotent: adding a column that already
 * exists is a no-op (checked via information_schema).
 */
export class AddProfileFieldsToUsers1749000000000 implements MigrationInterface {
  name = 'AddProfileFieldsToUsers1749000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const columns: Array<{ name: string; ddl: string }> = [
      { name: 'avatar_url',   ddl: '`avatar_url` VARCHAR(2048) NULL DEFAULT NULL' },
      { name: 'bio',          ddl: '`bio` VARCHAR(500) NULL DEFAULT NULL' },
      { name: 'phone_number', ddl: '`phone_number` VARCHAR(32) NULL DEFAULT NULL' },
      { name: 'job_title',    ddl: '`job_title` VARCHAR(120) NULL DEFAULT NULL' },
      { name: 'company',      ddl: '`company` VARCHAR(120) NULL DEFAULT NULL' },
      { name: 'location',     ddl: '`location` VARCHAR(120) NULL DEFAULT NULL' },
    ];

    for (const col of columns) {
      // Skip if already present (e.g. created by an earlier migration or by
      // synchronize:true in a dev environment).
      const existing: Array<{ COLUMN_NAME: string }> = await queryRunner.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'users'
           AND COLUMN_NAME  = ?`,
        [col.name],
      );
      if (existing.length === 0) {
        await queryRunner.query(`ALTER TABLE \`users\` ADD COLUMN ${col.ddl}`);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const colsToDrop = [
      'avatar_url', 'bio', 'phone_number', 'job_title', 'company', 'location',
    ];
    for (const col of colsToDrop) {
      const existing: Array<{ COLUMN_NAME: string }> = await queryRunner.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'users'
           AND COLUMN_NAME  = ?`,
        [col],
      );
      if (existing.length > 0) {
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`${col}\``);
      }
    }
  }
}
