import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: BackfillClientRecordsForPromotedLeads
 *
 * Problem: When a LEAD user was promoted to CLIENT via the API, the backend
 * tried to auto-create a Client record in promoteLeadToClient(). However, the
 * raw SQL used a PostgreSQL-style `$1` placeholder instead of MySQL's `?`,
 * causing the entire try-block to throw and be swallowed — so NO Client record
 * was created. These users have role=CLIENT in the `users` table but have no
 * row in the `clients` table, making them invisible in all ERP dropdowns.
 *
 * This migration backfills the missing Client records:
 *   - Finds every user with role='CLIENT' that has no `clients` row yet.
 *   - Inserts a Client record with status='ACTIVE', ownerId=NULL, company=NULL.
 *   - The admin can later assign an owner via the Assign Owner modal.
 *
 * Idempotent: uses INSERT IGNORE (MySQL) so re-running is safe.
 */
export class BackfillClientRecordsForPromotedLeads1748900000000
  implements MigrationInterface
{
  name = 'BackfillClientRecordsForPromotedLeads1748900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Insert a Client record for every CLIENT-role user that doesn't have one yet.
    // UUIDs are generated with UUID() in MySQL.
    // INSERT IGNORE silently skips rows that would violate the UNIQUE(user_id) constraint,
    // making this idempotent.
    await queryRunner.query(`
      INSERT IGNORE INTO \`clients\`
        (\`id\`, \`user_id\`, \`owner_id\`, \`company\`, \`status\`, \`notes\`, \`created_at\`, \`updated_at\`)
      SELECT
        UUID()          AS id,
        u.id            AS user_id,
        NULL            AS owner_id,
        NULL            AS company,
        'ACTIVE'        AS status,
        'Auto-created by backfill migration — promoted from LEAD without a Client record.' AS notes,
        NOW()           AS created_at,
        NOW()           AS updated_at
      FROM \`users\` u
      LEFT JOIN \`clients\` c ON c.user_id = u.id
      WHERE u.role = 'CLIENT'
        AND c.id IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove only the records created by this migration (identified by the notes marker).
    // This leaves manually-created or seeded Client records untouched.
    await queryRunner.query(`
      DELETE FROM \`clients\`
      WHERE \`notes\` = 'Auto-created by backfill migration — promoted from LEAD without a Client record.'
    `);
  }
}
