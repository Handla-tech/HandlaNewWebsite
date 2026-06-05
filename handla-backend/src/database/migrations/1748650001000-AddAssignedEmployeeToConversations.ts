import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * MySQL: assigned_employee_id is already included in the conversations table
 * definition in InitialSchema. This migration is a no-op.
 */
export class AddAssignedEmployeeToConversations1748650001000 implements MigrationInterface {
  name = 'AddAssignedEmployeeToConversations1748650001000';

  public async up(_queryRunner: QueryRunner): Promise<void> {
    // Column already created in InitialSchema — nothing to do.
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // no-op
  }
}
