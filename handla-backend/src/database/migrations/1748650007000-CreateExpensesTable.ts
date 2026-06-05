import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * MySQL: expenses table already created in InitialSchema. No-op.
 */
export class CreateExpensesTable1748650007000 implements MigrationInterface {
  name = 'CreateExpensesTable1748650007000';

  public async up(_queryRunner: QueryRunner): Promise<void> {}
  public async down(_queryRunner: QueryRunner): Promise<void> {}
}
