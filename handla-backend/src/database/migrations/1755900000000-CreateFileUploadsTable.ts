import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: CreateFileUploadsTable
 *
 * Implements server-side file provenance tracking for uploaded files (task attachments,
 * invoice payment proofs, etc).
 *
 * Requirements:
 *  - Idempotent: guards table and index creation with information_schema checks.
 *  - Non-destructive: creates new table `file_uploads`.
 *  - Reversible: `down` drops table safely.
 */
export class CreateFileUploadsTable1755900000000 implements MigrationInterface {
  name = 'CreateFileUploadsTable1755900000000';

  private async tableExists(q: QueryRunner, table: string): Promise<boolean> {
    const rows: Array<{ TABLE_NAME: string }> = await q.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [table],
    );
    return rows.length > 0;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.tableExists(queryRunner, 'file_uploads'))) {
      await queryRunner.query(`
        CREATE TABLE \`file_uploads\` (
          \`id\` VARCHAR(36) NOT NULL,
          \`user_id\` VARCHAR(36) NOT NULL,
          \`resource_type\` ENUM('TASK', 'INVOICE') NOT NULL,
          \`resource_id\` VARCHAR(36) NOT NULL,
          \`s3_key\` VARCHAR(500) NOT NULL,
          \`file_url\` VARCHAR(1000) NOT NULL,
          \`original_name\` VARCHAR(255) NOT NULL,
          \`mime_type\` VARCHAR(100) NOT NULL,
          \`size_bytes\` INT NOT NULL,
          \`status\` ENUM('PENDING', 'CONSUMED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
          \`consumed_at\` DATETIME NULL DEFAULT NULL,
          \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          \`updated_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`idx_file_uploads_s3_key\` (\`s3_key\`),
          KEY \`idx_file_uploads_user_id\` (\`user_id\`),
          KEY \`idx_file_uploads_resource_id\` (\`resource_id\`),
          KEY \`idx_file_uploads_status\` (\`status\`),
          KEY \`idx_file_uploads_user_resource\` (\`user_id\`, \`resource_type\`, \`resource_id\`),
          KEY \`idx_file_uploads_status_created\` (\`status\`, \`created_at\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await this.tableExists(queryRunner, 'file_uploads')) {
      await queryRunner.query('DROP TABLE `file_uploads`');
    }
  }
}
