import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: AddPurchaseIdToExpenses
 *
 * Adds the nullable `purchase_id` column (+ supporting index) to the
 * `expenses` table.
 *
 * Background: the Expense entity gained a `purchaseId` field so that a paid
 * Purchase Order can auto-generate a linked EXPENSE entry
 * (ExpensesService.createFromPaidPurchase, idempotent on purchaseId), but the
 * matching column was never added to the schema. As a result any
 * `INSERT INTO expenses` (including `npm run seed`) failed with:
 *   QueryFailedError: Unknown column 'purchase_id' in 'INSERT INTO'
 *
 * The column is nullable (only set for auto-expense entries from paid POs) and
 * has NO foreign key on purpose: the Expense entity deliberately avoids a hard
 * relation to Purchase to prevent a module dependency cycle, so we only store
 * the id for idempotency + tracing.
 *
 * Idempotent: adding a column / index that already exists is skipped (checked
 * via information_schema), so it is safe to re-run and safe alongside a dev
 * environment that used synchronize:true.
 */
export class AddPurchaseIdToExpenses1755200000000 implements MigrationInterface {
  name = 'AddPurchaseIdToExpenses1755200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── Column: purchase_id ────────────────────────────────────────────────
    const existingColumn: Array<{ COLUMN_NAME: string }> = await queryRunner.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME   = 'expenses'
         AND COLUMN_NAME  = 'purchase_id'`,
    );
    if (existingColumn.length === 0) {
      await queryRunner.query(
        `ALTER TABLE \`expenses\` ADD COLUMN \`purchase_id\` VARCHAR(36) NULL DEFAULT NULL`,
      );
    }

    // ─── Index: idx_expenses_purchase_id ────────────────────────────────────
    const existingIndex: Array<{ INDEX_NAME: string }> = await queryRunner.query(
      `SELECT INDEX_NAME FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME   = 'expenses'
         AND INDEX_NAME   = 'idx_expenses_purchase_id'`,
    );
    if (existingIndex.length === 0) {
      await queryRunner.query(
        `CREATE INDEX \`idx_expenses_purchase_id\` ON \`expenses\` (\`purchase_id\`)`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const existingIndex: Array<{ INDEX_NAME: string }> = await queryRunner.query(
      `SELECT INDEX_NAME FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME   = 'expenses'
         AND INDEX_NAME   = 'idx_expenses_purchase_id'`,
    );
    if (existingIndex.length > 0) {
      await queryRunner.query(
        `DROP INDEX \`idx_expenses_purchase_id\` ON \`expenses\``,
      );
    }

    const existingColumn: Array<{ COLUMN_NAME: string }> = await queryRunner.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME   = 'expenses'
         AND COLUMN_NAME  = 'purchase_id'`,
    );
    if (existingColumn.length > 0) {
      await queryRunner.query(
        `ALTER TABLE \`expenses\` DROP COLUMN \`purchase_id\``,
      );
    }
  }
}
