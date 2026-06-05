import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: DeduplicateConversationsUniqueConstraint
 *
 * Problem: The conversations table had no UNIQUE constraint on (client_id, admin_id),
 * allowing duplicate rows for the same client-admin pair. This caused the Messages
 * module to show the same client twice in the conversation list.
 *
 * This migration:
 *   1. Deduplicates existing rows — for each (client_id, admin_id) pair, keeps the
 *      row with the most recent updated_at (i.e. the active one with messages) and
 *      deletes the older duplicates (re-pointing any orphaned messages first).
 *   2. Adds UNIQUE KEY uq_conversations_client_admin (client_id, admin_id) to prevent
 *      future duplicates at the database level.
 */
export class DeduplicateConversationsUniqueConstraint1748800000000
  implements MigrationInterface
{
  name = 'DeduplicateConversationsUniqueConstraint1748800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Step 1: Re-point messages from duplicate conversations to the keeper ──
    //
    // For every (client_id, admin_id) group that has more than one row,
    // identify the "keeper" (most recently updated) and move all messages
    // from the duplicate rows onto the keeper, then delete the duplicates.

    await queryRunner.query(`
      CREATE TEMPORARY TABLE IF NOT EXISTS _dup_conversations AS
        SELECT
          client_id,
          admin_id,
          (
            SELECT id FROM conversations c2
            WHERE c2.client_id = c.client_id AND c2.admin_id = c.admin_id
            ORDER BY c2.updated_at DESC, c2.created_at DESC
            LIMIT 1
          ) AS keeper_id
        FROM conversations c
        GROUP BY client_id, admin_id
        HAVING COUNT(*) > 1
    `);

    // Re-point messages from duplicate (non-keeper) conversations to the keeper
    await queryRunner.query(`
      UPDATE messages m
      JOIN conversations c ON m.conversation_id = c.id
      JOIN _dup_conversations d
        ON c.client_id = d.client_id
       AND c.admin_id  = d.admin_id
       AND c.id        != d.keeper_id
      SET m.conversation_id = d.keeper_id
    `);

    // Delete the duplicate (non-keeper) conversation rows
    await queryRunner.query(`
      DELETE c
      FROM conversations c
      JOIN _dup_conversations d
        ON c.client_id = d.client_id
       AND c.admin_id  = d.admin_id
       AND c.id        != d.keeper_id
    `);

    await queryRunner.query(`DROP TEMPORARY TABLE IF EXISTS _dup_conversations`);

    // ── Step 2: Add UNIQUE constraint to prevent future duplicates ────────────
    // Idempotent: only add the constraint if it doesn't already exist.
    // This prevents a failure when the migration is re-run (e.g. after a
    // partial failure) or if the constraint was already created by another path.
    await queryRunner.query(`
      SET @constraint_exists = (
        SELECT COUNT(*)
        FROM information_schema.TABLE_CONSTRAINTS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = 'conversations'
          AND CONSTRAINT_NAME = 'uq_conversations_client_admin'
          AND CONSTRAINT_TYPE = 'UNIQUE'
      )
    `);
    await queryRunner.query(`
      SET @sql = IF(
        @constraint_exists = 0,
        'ALTER TABLE \`conversations\` ADD CONSTRAINT \`uq_conversations_client_admin\` UNIQUE (\`client_id\`, \`admin_id\`)',
        'SELECT 1 -- constraint already exists, skipping'
      )
    `);
    await queryRunner.query(`PREPARE _stmt FROM @sql`);
    await queryRunner.query(`EXECUTE _stmt`);
    await queryRunner.query(`DEALLOCATE PREPARE _stmt`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Idempotent: only drop if it exists
    await queryRunner.query(`
      SET @constraint_exists = (
        SELECT COUNT(*)
        FROM information_schema.TABLE_CONSTRAINTS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = 'conversations'
          AND CONSTRAINT_NAME = 'uq_conversations_client_admin'
          AND CONSTRAINT_TYPE = 'UNIQUE'
      )
    `);
    await queryRunner.query(`
      SET @sql = IF(
        @constraint_exists > 0,
        'ALTER TABLE \`conversations\` DROP INDEX \`uq_conversations_client_admin\`',
        'SELECT 1 -- constraint not found, skipping'
      )
    `);
    await queryRunner.query(`PREPARE _stmt FROM @sql`);
    await queryRunner.query(`EXECUTE _stmt`);
    await queryRunner.query(`DEALLOCATE PREPARE _stmt`);
  }
}
