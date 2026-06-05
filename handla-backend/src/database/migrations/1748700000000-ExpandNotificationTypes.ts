import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * MySQL: notification type enum already includes all ERP event types
 * in the InitialSchema column definition. No-op.
 */
export class ExpandNotificationTypes1748700000000 implements MigrationInterface {
  name = 'ExpandNotificationTypes1748700000000';

  public async up(_queryRunner: QueryRunner): Promise<void> {}
  public async down(_queryRunner: QueryRunner): Promise<void> {}
}
