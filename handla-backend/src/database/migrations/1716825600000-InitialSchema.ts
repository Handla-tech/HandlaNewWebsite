import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * InitialSchema — MySQL version.
 *
 * All CREATE statements use IF NOT EXISTS so this migration is safe to run
 * on a DB that was bootstrapped via TypeORM synchronize (tables already exist).
 *
 * MySQL differences vs PostgreSQL original:
 *   - No CREATE TYPE — enums are inline column definitions
 *   - UUID generated via UUID() function (MySQL 8) or stored as CHAR(36)
 *   - TIMESTAMPTZ → DATETIME(6)
 *   - gen_random_uuid() → (UUID())
 *   - BOOLEAN → TINYINT(1)
 *   - SMALLINT stays the same
 */
export class InitialSchema1716825600000 implements MigrationInterface {
  name = 'InitialSchema1716825600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── Users ─────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`users\` (
        \`id\`            CHAR(36)     NOT NULL DEFAULT (UUID()),
        \`email\`         VARCHAR(255) NOT NULL,
        \`password_hash\` VARCHAR(255) NOT NULL,
        \`name\`          VARCHAR(100) NOT NULL,
        \`role\`          ENUM('ADMIN','EMPLOYEE','CLIENT','LEAD') NOT NULL DEFAULT 'LEAD',
        \`created_at\`    DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\`    DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        CONSTRAINT \`pk_users\` PRIMARY KEY (\`id\`),
        CONSTRAINT \`uq_users_email\` UNIQUE (\`email\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS \`idx_users_email\` ON \`users\` (\`email\`)
    `);

    // ─── Conversations ─────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`conversations\` (
        \`id\`                   CHAR(36)  NOT NULL DEFAULT (UUID()),
        \`admin_id\`             CHAR(36)  NOT NULL,
        \`client_id\`            CHAR(36)  NOT NULL,
        \`assigned_employee_id\` CHAR(36)  NULL,
        \`status\`               ENUM('ACTIVE','ON_HOLD','COMPLETED') NOT NULL DEFAULT 'ACTIVE',
        \`created_at\`           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\`           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        CONSTRAINT \`pk_conversations\` PRIMARY KEY (\`id\`),
        CONSTRAINT \`fk_conversations_admin\`
          FOREIGN KEY (\`admin_id\`)  REFERENCES \`users\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_conversations_client\`
          FOREIGN KEY (\`client_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_conversations_assigned_employee\`
          FOREIGN KEY (\`assigned_employee_id\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS \`idx_conversation_admin_client_status\`
        ON \`conversations\` (\`admin_id\`, \`client_id\`, \`status\`)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS \`idx_conversations_assigned_employee\`
        ON \`conversations\` (\`assigned_employee_id\`)
    `);

    // ─── Messages ──────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`messages\` (
        \`id\`              CHAR(36)    NOT NULL DEFAULT (UUID()),
        \`conversation_id\` CHAR(36)    NOT NULL,
        \`sender_id\`       CHAR(36)    NOT NULL,
        \`content\`         TEXT,
        \`file_url\`        VARCHAR(2048),
        \`is_read\`         TINYINT(1)  NOT NULL DEFAULT 0,
        \`created_at\`      DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\`      DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        CONSTRAINT \`pk_messages\` PRIMARY KEY (\`id\`),
        CONSTRAINT \`fk_messages_conversation\`
          FOREIGN KEY (\`conversation_id\`) REFERENCES \`conversations\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_messages_sender\`
          FOREIGN KEY (\`sender_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS \`idx_message_conversation_created\`
        ON \`messages\` (\`conversation_id\`, \`created_at\`)
    `);

    // ─── Notifications ─────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`notifications\` (
        \`id\`                 CHAR(36)    NOT NULL DEFAULT (UUID()),
        \`user_id\`            CHAR(36)    NOT NULL,
        \`type\`               ENUM(
          'MESSAGE','SYSTEM',
          'CONTRACT_SENT','CONTRACT_SIGNED','CONTRACT_REJECTED',
          'INVOICE_CREATED','INVOICE_OVERDUE',
          'LEAD_ASSIGNED','LEAD_PROMOTED',
          'TASK_ASSIGNED','TASK_DELAYED'
        ) NOT NULL DEFAULT 'MESSAGE',
        \`title\`              VARCHAR(255) NOT NULL,
        \`message\`            TEXT        NOT NULL,
        \`related_message_id\` CHAR(36),
        \`related_entity_id\`  CHAR(36),
        \`is_read\`            TINYINT(1)  NOT NULL DEFAULT 0,
        \`created_at\`         DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        CONSTRAINT \`pk_notifications\` PRIMARY KEY (\`id\`),
        CONSTRAINT \`fk_notifications_user\`
          FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS \`idx_notification_user_read_created\`
        ON \`notifications\` (\`user_id\`, \`is_read\`, \`created_at\`)
    `);

    // ─── Testimonials ──────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`testimonials\` (
        \`id\`                   CHAR(36)     NOT NULL DEFAULT (UUID()),
        \`client_name\`          VARCHAR(100) NOT NULL,
        \`client_company\`       VARCHAR(150),
        \`content\`              TEXT         NOT NULL,
        \`image_url\`            VARCHAR(2048),
        \`rating\`               SMALLINT     NOT NULL,
        \`created_by_admin_id\`  CHAR(36),
        \`created_at\`           DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\`           DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        CONSTRAINT \`pk_testimonials\` PRIMARY KEY (\`id\`),
        CONSTRAINT \`chk_testimonials_rating\` CHECK (\`rating\` >= 1 AND \`rating\` <= 5),
        CONSTRAINT \`fk_testimonials_admin\`
          FOREIGN KEY (\`created_by_admin_id\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS \`idx_testimonial_created_at\`
        ON \`testimonials\` (\`created_at\`)
    `);

    // ─── ERP: Clients ──────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`clients\` (
        \`id\`         CHAR(36)    NOT NULL DEFAULT (UUID()),
        \`user_id\`    CHAR(36)    NOT NULL,
        \`owner_id\`   CHAR(36),
        \`company\`    VARCHAR(255),
        \`status\`     ENUM('ACTIVE','INACTIVE','CHURNED') NOT NULL DEFAULT 'ACTIVE',
        \`notes\`      TEXT,
        \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        CONSTRAINT \`pk_clients\`       PRIMARY KEY (\`id\`),
        CONSTRAINT \`uq_clients_user_id\` UNIQUE (\`user_id\`),
        CONSTRAINT \`fk_clients_user_id\`
          FOREIGN KEY (\`user_id\`)  REFERENCES \`users\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_clients_owner_id\`
          FOREIGN KEY (\`owner_id\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS \`idx_clients_owner_id\` ON \`clients\` (\`owner_id\`)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS \`idx_clients_status\` ON \`clients\` (\`status\`)
    `);

    // ─── ERP: Projects ─────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`projects\` (
        \`id\`          CHAR(36)    NOT NULL DEFAULT (UUID()),
        \`title\`       VARCHAR(255) NOT NULL,
        \`description\` TEXT,
        \`client_id\`   CHAR(36)    NOT NULL,
        \`owner_id\`    CHAR(36),
        \`status\`      ENUM('PLANNING','ACTIVE','ON_HOLD','COMPLETED','CANCELLED') NOT NULL DEFAULT 'PLANNING',
        \`start_date\`  DATE,
        \`end_date\`    DATE,
        \`created_at\`  DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\`  DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        CONSTRAINT \`pk_projects\`  PRIMARY KEY (\`id\`),
        CONSTRAINT \`fk_projects_client\`
          FOREIGN KEY (\`client_id\`) REFERENCES \`clients\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_projects_owner\`
          FOREIGN KEY (\`owner_id\`)  REFERENCES \`users\`(\`id\`)   ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS \`idx_projects_client_id\` ON \`projects\` (\`client_id\`)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS \`idx_projects_owner_id\`  ON \`projects\` (\`owner_id\`)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS \`idx_projects_status\`    ON \`projects\` (\`status\`)
    `);

    // ─── ERP: Tasks ────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`tasks\` (
        \`id\`           CHAR(36)    NOT NULL DEFAULT (UUID()),
        \`title\`        VARCHAR(255) NOT NULL,
        \`description\`  TEXT,
        \`project_id\`   CHAR(36)    NOT NULL,
        \`assignee_id\`  CHAR(36),
        \`owner_id\`     CHAR(36),
        \`status\`       ENUM('PENDING','IN_PROGRESS','COMPLETED','DELAYED') NOT NULL DEFAULT 'PENDING',
        \`due_date\`     DATE,
        \`created_at\`   DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\`   DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        CONSTRAINT \`pk_tasks\`          PRIMARY KEY (\`id\`),
        CONSTRAINT \`fk_tasks_project\`  FOREIGN KEY (\`project_id\`)  REFERENCES \`projects\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_tasks_assignee\` FOREIGN KEY (\`assignee_id\`) REFERENCES \`users\`(\`id\`)    ON DELETE SET NULL,
        CONSTRAINT \`fk_tasks_owner\`    FOREIGN KEY (\`owner_id\`)    REFERENCES \`users\`(\`id\`)    ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS \`idx_tasks_project_id\`  ON \`tasks\` (\`project_id\`)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS \`idx_tasks_owner_id\`    ON \`tasks\` (\`owner_id\`)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS \`idx_tasks_assignee_id\` ON \`tasks\` (\`assignee_id\`)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS \`idx_tasks_status_due\`  ON \`tasks\` (\`status\`, \`due_date\`)
    `);

    // ─── ERP: Contracts ────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`contracts\` (
        \`id\`         CHAR(36)    NOT NULL DEFAULT (UUID()),
        \`title\`      VARCHAR(255) NOT NULL,
        \`body\`       TEXT         NOT NULL,
        \`client_id\`  CHAR(36)    NOT NULL,
        \`owner_id\`   CHAR(36),
        \`status\`     ENUM('DRAFT','SENT','SIGNED','REJECTED') NOT NULL DEFAULT 'DRAFT',
        \`sent_at\`    DATETIME(6),
        \`signed_at\`  DATETIME(6),
        \`s3_key\`     VARCHAR(2048),
        \`pdf_url\`    VARCHAR(2048),
        \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        CONSTRAINT \`pk_contracts\`   PRIMARY KEY (\`id\`),
        CONSTRAINT \`fk_contracts_client\`
          FOREIGN KEY (\`client_id\`) REFERENCES \`clients\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_contracts_owner\`
          FOREIGN KEY (\`owner_id\`)  REFERENCES \`users\`(\`id\`)   ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS \`idx_contracts_client_id\` ON \`contracts\` (\`client_id\`)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS \`idx_contracts_owner_id\`  ON \`contracts\` (\`owner_id\`)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS \`idx_contracts_status\`    ON \`contracts\` (\`status\`)
    `);

    // ─── ERP: Invoices + Line Items ────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`invoices\` (
        \`id\`               CHAR(36)    NOT NULL DEFAULT (UUID()),
        \`invoice_number\`   VARCHAR(50) NOT NULL,
        \`client_id\`        CHAR(36)    NOT NULL,
        \`owner_id\`         CHAR(36),
        \`subtotal\`         DECIMAL(12,2) NOT NULL DEFAULT 0,
        \`tax_rate\`         DECIMAL(5,2)  NOT NULL DEFAULT 0,
        \`tax_amount\`       DECIMAL(12,2) NOT NULL DEFAULT 0,
        \`total\`            DECIMAL(12,2) NOT NULL DEFAULT 0,
        \`currency\`         VARCHAR(3)  NOT NULL DEFAULT 'USD',
        \`payment_status\`   ENUM('UNPAID','PAID','OVERDUE') NOT NULL DEFAULT 'UNPAID',
        \`due_date\`         DATE,
        \`paid_at\`          DATETIME(6),
        \`notes\`            TEXT,
        \`created_at\`       DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\`       DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        CONSTRAINT \`pk_invoices\`                PRIMARY KEY (\`id\`),
        CONSTRAINT \`uq_invoices_invoice_number\` UNIQUE (\`invoice_number\`),
        CONSTRAINT \`fk_invoices_client\`
          FOREIGN KEY (\`client_id\`) REFERENCES \`clients\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_invoices_owner\`
          FOREIGN KEY (\`owner_id\`)  REFERENCES \`users\`(\`id\`)   ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`invoice_line_items\` (
        \`id\`          CHAR(36)      NOT NULL DEFAULT (UUID()),
        \`invoice_id\`  CHAR(36)      NOT NULL,
        \`description\` VARCHAR(500)  NOT NULL,
        \`quantity\`    DECIMAL(10,2) NOT NULL DEFAULT 1,
        \`unit_price\`  DECIMAL(12,2) NOT NULL DEFAULT 0,
        \`line_total\`  DECIMAL(12,2) NOT NULL,
        \`sort_order\`  SMALLINT      NOT NULL DEFAULT 0,
        CONSTRAINT \`pk_invoice_line_items\` PRIMARY KEY (\`id\`),
        CONSTRAINT \`fk_line_items_invoice\`
          FOREIGN KEY (\`invoice_id\`) REFERENCES \`invoices\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS \`idx_invoices_client_id\`
        ON \`invoices\` (\`client_id\`)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS \`idx_invoices_owner_id\`
        ON \`invoices\` (\`owner_id\`)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS \`idx_invoices_payment_status\`
        ON \`invoices\` (\`payment_status\`)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS \`idx_invoices_due_date\`
        ON \`invoices\` (\`due_date\`)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS \`idx_invoice_line_items_invoice_id\`
        ON \`invoice_line_items\` (\`invoice_id\`)
    `);

    // ─── ERP: Expenses ─────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`expenses\` (
        \`id\`           CHAR(36)      NOT NULL DEFAULT (UUID()),
        \`type\`         ENUM('INCOME','EXPENSE') NOT NULL,
        \`category\`     VARCHAR(100)  NOT NULL,
        \`amount\`       DECIMAL(12,2) NOT NULL,
        \`currency\`     VARCHAR(3)    NOT NULL DEFAULT 'USD',
        \`description\`  TEXT,
        \`expense_date\` DATE          NOT NULL DEFAULT (CURRENT_DATE),
        \`invoice_id\`   CHAR(36),
        \`owner_id\`     CHAR(36),
        \`created_at\`   DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\`   DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        CONSTRAINT \`pk_expenses\`    PRIMARY KEY (\`id\`),
        CONSTRAINT \`fk_expenses_invoice\`
          FOREIGN KEY (\`invoice_id\`) REFERENCES \`invoices\`(\`id\`) ON DELETE SET NULL,
        CONSTRAINT \`fk_expenses_owner\`
          FOREIGN KEY (\`owner_id\`)   REFERENCES \`users\`(\`id\`)    ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS \`idx_expenses_type\`
        ON \`expenses\` (\`type\`)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS \`idx_expenses_date\`
        ON \`expenses\` (\`expense_date\`)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS \`idx_expenses_owner_id\`
        ON \`expenses\` (\`owner_id\`)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS \`idx_expenses_invoice_id\`
        ON \`expenses\` (\`invoice_id\`)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`expenses\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`invoice_line_items\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`invoices\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`contracts\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`tasks\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`projects\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`clients\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`testimonials\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`notifications\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`messages\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`conversations\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`users\``);
  }
}
