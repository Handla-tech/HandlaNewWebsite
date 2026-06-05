import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * MySQL: Role enum values (ADMIN, EMPLOYEE, CLIENT, LEAD) are already
 * baked into the users table definition in InitialSchema. This migration
 * is a no-op but kept so the migrations table stays consistent.
 */
export class AddRoleEnumValues1748650000000 implements MigrationInterface {
  name = 'AddRoleEnumValues1748650000000';

  public async up(_queryRunner: QueryRunner): Promise<void> {
    // MySQL inline ENUM already contains all four values — nothing to do.
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // no-op
  }
}
