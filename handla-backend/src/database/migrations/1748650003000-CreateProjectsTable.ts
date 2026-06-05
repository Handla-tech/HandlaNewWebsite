import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * MySQL: projects table already created in InitialSchema. No-op.
 */
export class CreateProjectsTable1748650003000 implements MigrationInterface {
  name = 'CreateProjectsTable1748650003000';

  public async up(_queryRunner: QueryRunner): Promise<void> {}
  public async down(_queryRunner: QueryRunner): Promise<void> {}
}
