import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * INFO-01 — AddPublicTokenLifecycle
 *
 * Adds the unified public capability-token lifecycle columns to the three
 * public-document tables (invoices, contracts, quotations):
 *
 *   public_token             VARCHAR(64) NULL  UNIQUE   (invoices/contracts only;
 *                                                        quotations already has it)
 *   public_token_expires_at  DATETIME    NULL
 *   public_token_revoked_at  DATETIME    NULL
 *   public_token_created_at  DATETIME    NULL
 *
 * Design / safety notes:
 *  - Idempotent: every column/index is guarded by an information_schema check so
 *    re-running (or running against a partially-migrated DB) is a no-op. Matches
 *    the existing Handla migration convention (see AddDetailsToContracts).
 *  - NON-DESTRUCTIVE: only ADD COLUMN / CREATE INDEX. No table rebuild, no data
 *    rewrite, no column drops on `up`. Existing rows are untouched.
 *  - NO SECRET BACKFILL: invoices & contracts keep `public_token` NULL until an
 *    admin explicitly generates a secure link — their existing public links use
 *    the raw entity UUID (`/public/:id`) and remain valid through the
 *    transitional compatibility window (PUBLIC_DOC_LEGACY_ID_LINKS). Because we
 *    do NOT mint tokens here, no token value is ever written to the migration
 *    log, and rollback never needs to reconstruct a secret.
 *  - quotations.public_token ALREADY EXISTS (NOT NULL, unique) from the ERP
 *    migration; we only add the three lifecycle columns there.
 *  - `down` removes exactly what `up` added (columns + the two new indexes),
 *    leaving quotations.public_token intact.
 */
export class AddPublicTokenLifecycle1755800000000 implements MigrationInterface {
  name = 'AddPublicTokenLifecycle1755800000000';

  private async columnExists(q: QueryRunner, table: string, column: string): Promise<boolean> {
    const rows: Array<{ COLUMN_NAME: string }> = await q.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column],
    );
    return rows.length > 0;
  }

  private async indexExists(q: QueryRunner, table: string, index: string): Promise<boolean> {
    const rows: Array<{ INDEX_NAME: string }> = await q.query(
      `SELECT INDEX_NAME FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
      [table, index],
    );
    return rows.length > 0;
  }

  private async addColumn(q: QueryRunner, table: string, column: string, ddl: string): Promise<void> {
    if (!(await this.columnExists(q, table, column))) {
      await q.query(`ALTER TABLE \`${table}\` ADD COLUMN ${ddl}`);
    }
  }

  private async dropColumn(q: QueryRunner, table: string, column: string): Promise<void> {
    if (await this.columnExists(q, table, column)) {
      await q.query(`ALTER TABLE \`${table}\` DROP COLUMN \`${column}\``);
    }
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const lifecycleCols: Array<[string, string]> = [
      ['public_token_expires_at', '`public_token_expires_at` DATETIME NULL'],
      ['public_token_revoked_at', '`public_token_revoked_at` DATETIME NULL'],
      ['public_token_created_at', '`public_token_created_at` DATETIME NULL'],
    ];

    // ── invoices ──────────────────────────────────────────────────────────────
    await this.addColumn(
      queryRunner,
      'invoices',
      'public_token',
      '`public_token` VARCHAR(64) NULL',
    );
    for (const [col, ddl] of lifecycleCols) await this.addColumn(queryRunner, 'invoices', col, ddl);
    if (!(await this.indexExists(queryRunner, 'invoices', 'idx_invoices_public_token'))) {
      // UNIQUE index; NULLs are allowed to repeat in MySQL, so many un-linked
      // invoices (all NULL) coexist fine while any minted token stays unique.
      await queryRunner.query(
        `CREATE UNIQUE INDEX \`idx_invoices_public_token\` ON \`invoices\` (\`public_token\`)`,
      );
    }

    // ── contracts ───────────────────────────────────────────────────────────────
    await this.addColumn(
      queryRunner,
      'contracts',
      'public_token',
      '`public_token` VARCHAR(64) NULL',
    );
    for (const [col, ddl] of lifecycleCols) await this.addColumn(queryRunner, 'contracts', col, ddl);
    if (!(await this.indexExists(queryRunner, 'contracts', 'idx_contracts_public_token'))) {
      await queryRunner.query(
        `CREATE UNIQUE INDEX \`idx_contracts_public_token\` ON \`contracts\` (\`public_token\`)`,
      );
    }

    // ── quotations (public_token + its unique index already exist) ──────────────
    for (const [col, ddl] of lifecycleCols) await this.addColumn(queryRunner, 'quotations', col, ddl);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const lifecycleCols = [
      'public_token_created_at',
      'public_token_revoked_at',
      'public_token_expires_at',
    ];

    // quotations: drop only the lifecycle columns we added (keep public_token).
    for (const col of lifecycleCols) await this.dropColumn(queryRunner, 'quotations', col);

    // contracts: drop index (if present) then the columns we added.
    if (await this.indexExists(queryRunner, 'contracts', 'idx_contracts_public_token')) {
      await queryRunner.query(`DROP INDEX \`idx_contracts_public_token\` ON \`contracts\``);
    }
    for (const col of lifecycleCols) await this.dropColumn(queryRunner, 'contracts', col);
    await this.dropColumn(queryRunner, 'contracts', 'public_token');

    // invoices: drop index (if present) then the columns we added.
    if (await this.indexExists(queryRunner, 'invoices', 'idx_invoices_public_token')) {
      await queryRunner.query(`DROP INDEX \`idx_invoices_public_token\` ON \`invoices\``);
    }
    for (const col of lifecycleCols) await this.dropColumn(queryRunner, 'invoices', col);
    await this.dropColumn(queryRunner, 'invoices', 'public_token');
  }
}
