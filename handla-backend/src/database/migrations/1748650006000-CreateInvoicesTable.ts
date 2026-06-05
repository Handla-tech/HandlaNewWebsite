import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * MySQL: invoices + invoice_line_items tables already created in InitialSchema. No-op.
 */
export class CreateInvoicesTable1748650006000 implements MigrationInterface {
  name = 'CreateInvoicesTable1748650006000';

  public async up(_queryRunner: QueryRunner): Promise<void> {}
  public async down(_queryRunner: QueryRunner): Promise<void> {}
}
