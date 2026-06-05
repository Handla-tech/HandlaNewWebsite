import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * MySQL: contracts table already created in InitialSchema. No-op.
 */
export class CreateContractsTable1748650005000 implements MigrationInterface {
  name = 'CreateContractsTable1748650005000';

  public async up(_queryRunner: QueryRunner): Promise<void> {}
  public async down(_queryRunner: QueryRunner): Promise<void> {}
}
