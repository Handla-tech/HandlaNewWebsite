import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * MySQL: clients table already created in InitialSchema. No-op.
 */
export class CreateClientsTable1748650002000 implements MigrationInterface {
  name = 'CreateClientsTable1748650002000';

  public async up(_queryRunner: QueryRunner): Promise<void> {}
  public async down(_queryRunner: QueryRunner): Promise<void> {}
}
