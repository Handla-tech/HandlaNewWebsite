import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * MySQL: tasks table already created in InitialSchema. No-op.
 */
export class CreateTasksTable1748650004000 implements MigrationInterface {
  name = 'CreateTasksTable1748650004000';

  public async up(_queryRunner: QueryRunner): Promise<void> {}
  public async down(_queryRunner: QueryRunner): Promise<void> {}
}
