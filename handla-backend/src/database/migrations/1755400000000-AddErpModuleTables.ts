import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: AddErpModuleTables
 *
 * Creates the ERP / SaaS / support / accounting / analytics / website tables
 * that had entities but NO migration. They previously only ever existed
 * because the app ran with synchronize:true, which auto-created them — so a
 * database built purely from migrations (e.g. `npm run db:reset`) was missing
 * them entirely, and turning synchronize OFF would break every feature that
 * relies on them.
 *
 * Tables created (20):
 *   suppliers, purchases, purchase_line_items,
 *   quotations, quotation_line_items,
 *   accounts, ledger_entries,
 *   ai_knowledge_entries, ai_conversation_state,
 *   analytics_events,
 *   tickets, ticket_replies, client_api_keys,
 *   saas_products, saas_plans, saas_tenants, saas_tenant_domains,
 *   saas_subscriptions, saas_provisioning_logs,
 *   website_projects, website_products
 *
 * Design notes:
 *   - DDL is taken verbatim from what TypeORM's schema builder emits for these
 *     entities (varchar(36) UUID keys), so with synchronize:true there is zero
 *     schema drift after this runs.
 *   - These tables carry NO database-level foreign keys to the pre-existing
 *     char(36) tables (users/clients/…). That is deliberate: it avoids the
 *     char(36)-vs-varchar(36) FK type clash (errno 150) and matches how
 *     synchronize created them. Referential integrity for these modules is
 *     enforced in the application layer.
 *   - Each CREATE is guarded (IF NOT EXISTS via information_schema), so the
 *     migration is idempotent and safe on a DB where synchronize already made
 *     some/all of them.
 *
 * IMPORTANT: this migration intentionally does NOT touch users or any other
 * existing table. (The auto-generated diff wanted to rebuild users.id from
 * char(36) to varchar(36), which drops the PK and breaks every incoming FK —
 * that is exactly the errno 150 failure we are fixing, so it is excluded.)
 */
export class AddErpModuleTables1755400000000 implements MigrationInterface {
  name = 'AddErpModuleTables1755400000000';

  private async tableExists(q: QueryRunner, table: string): Promise<boolean> {
    const rows: Array<{ TABLE_NAME: string }> = await q.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [table],
    );
    return rows.length > 0;
  }

  private async createIfAbsent(
    q: QueryRunner,
    table: string,
    ddl: string,
  ): Promise<void> {
    if (!(await this.tableExists(q, table))) {
      await q.query(ddl);
    }
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.createIfAbsent(
      queryRunner,
      'suppliers',
      "CREATE TABLE `suppliers` (`id` varchar(36) NOT NULL, `name` varchar(150) NOT NULL, `company` varchar(150) NULL, `email` varchar(150) NULL, `phone` varchar(40) NULL, `tax_id` varchar(60) NULL, `address` text NULL, `notes` text NULL, `is_active` tinyint NOT NULL DEFAULT 1, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX `idx_suppliers_name` (`name`), INDEX `idx_suppliers_is_active` (`is_active`), PRIMARY KEY (`id`)) ENGINE=InnoDB",
    );

    await this.createIfAbsent(
      queryRunner,
      'purchases',
      "CREATE TABLE `purchases` (`id` varchar(36) NOT NULL, `purchase_number` varchar(50) NOT NULL, `supplier_id` varchar(36) NOT NULL, `owner_id` varchar(36) NULL, `status` enum ('DRAFT', 'ORDERED', 'RECEIVED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT', `payment_status` enum ('UNPAID', 'PAID', 'OVERDUE') NOT NULL DEFAULT 'UNPAID', `subtotal` decimal(12,2) NOT NULL DEFAULT '0.00', `tax_rate` decimal(5,2) NOT NULL DEFAULT '0.00', `tax_amount` decimal(12,2) NOT NULL DEFAULT '0.00', `total` decimal(12,2) NOT NULL DEFAULT '0.00', `currency` varchar(3) NULL, `account_code` varchar(20) NULL, `order_date` date NULL, `due_date` date NULL, `paid_at` datetime NULL, `notes` text NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX `idx_purchases_supplier_id` (`supplier_id`), INDEX `idx_purchases_owner_id` (`owner_id`), INDEX `idx_purchases_status` (`status`), INDEX `idx_purchases_payment_status` (`payment_status`), INDEX `idx_purchases_due_date` (`due_date`), UNIQUE INDEX `uq_purchases_purchase_number` (`purchase_number`), PRIMARY KEY (`id`)) ENGINE=InnoDB",
    );

    await this.createIfAbsent(
      queryRunner,
      'purchase_line_items',
      "CREATE TABLE `purchase_line_items` (`id` varchar(36) NOT NULL, `purchase_id` varchar(36) NOT NULL, `description` varchar(500) NOT NULL, `quantity` decimal(10,2) NOT NULL DEFAULT '1.00', `unit_price` decimal(12,2) NOT NULL DEFAULT '0.00', `line_total` decimal(12,2) NOT NULL, `sort_order` smallint NOT NULL DEFAULT '0', INDEX `idx_purchase_line_items_purchase_id` (`purchase_id`), PRIMARY KEY (`id`)) ENGINE=InnoDB",
    );

    await this.createIfAbsent(
      queryRunner,
      'quotations',
      "CREATE TABLE `quotations` (`id` varchar(36) NOT NULL, `quote_number` varchar(50) NOT NULL, `title` varchar(255) NOT NULL, `public_token` varchar(64) NOT NULL, `client_id` varchar(36) NOT NULL, `owner_id` varchar(36) NULL, `status` enum ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED') NOT NULL DEFAULT 'DRAFT', `subtotal` decimal(12,2) NOT NULL DEFAULT '0.00', `tax_rate` decimal(5,2) NOT NULL DEFAULT '0.00', `tax_amount` decimal(12,2) NOT NULL DEFAULT '0.00', `total` decimal(12,2) NOT NULL DEFAULT '0.00', `currency` varchar(3) NULL, `valid_until` date NULL, `sent_at` datetime NULL, `accepted_at` datetime NULL, `rejected_at` datetime NULL, `notes` text NULL, `converted_contract_id` varchar(36) NULL, `converted_invoice_id` varchar(36) NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX `idx_quotations_public_token` (`public_token`), INDEX `idx_quotations_client_id` (`client_id`), INDEX `idx_quotations_owner_id` (`owner_id`), INDEX `idx_quotations_status` (`status`), INDEX `idx_quotations_valid_until` (`valid_until`), UNIQUE INDEX `uq_quotations_quote_number` (`quote_number`), UNIQUE INDEX `uq_quotations_public_token` (`public_token`), PRIMARY KEY (`id`)) ENGINE=InnoDB",
    );

    await this.createIfAbsent(
      queryRunner,
      'quotation_line_items',
      "CREATE TABLE `quotation_line_items` (`id` varchar(36) NOT NULL, `quotation_id` varchar(36) NOT NULL, `description` varchar(500) NOT NULL, `quantity` decimal(10,2) NOT NULL DEFAULT '1.00', `unit_price` decimal(12,2) NOT NULL DEFAULT '0.00', `line_total` decimal(12,2) NOT NULL, `sort_order` smallint NOT NULL DEFAULT '0', INDEX `idx_quotation_line_items_quotation_id` (`quotation_id`), PRIMARY KEY (`id`)) ENGINE=InnoDB",
    );

    await this.createIfAbsent(
      queryRunner,
      'accounts',
      "CREATE TABLE `accounts` (`id` varchar(36) NOT NULL, `code` varchar(20) NOT NULL, `name` varchar(120) NOT NULL, `type` enum ('ASSET', 'LIABILITY', 'INCOME', 'EXPENSE', 'EQUITY') NOT NULL, `parent_id` varchar(36) NULL, `currency` varchar(3) NULL, `description` text NULL, `is_system` tinyint NOT NULL DEFAULT 0, `is_active` tinyint NOT NULL DEFAULT 1, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX `idx_accounts_code` (`code`), INDEX `idx_accounts_type` (`type`), UNIQUE INDEX `uq_accounts_code` (`code`), PRIMARY KEY (`id`)) ENGINE=InnoDB",
    );

    await this.createIfAbsent(
      queryRunner,
      'ledger_entries',
      "CREATE TABLE `ledger_entries` (`id` varchar(36) NOT NULL, `entry_date` date NOT NULL, `account_id` varchar(36) NOT NULL, `client_id` varchar(36) NULL, `direction` enum ('IN', 'OUT') NOT NULL, `amount` decimal(12,2) NOT NULL, `currency` varchar(3) NULL, `source_type` enum ('INVOICE', 'EXPENSE', 'PURCHASE', 'QUOTATION', 'MANUAL') NOT NULL, `source_id` varchar(64) NOT NULL, `description` varchar(255) NULL, `owner_id` varchar(36) NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX `idx_ledger_entry_date` (`entry_date`), INDEX `idx_ledger_account_id` (`account_id`), INDEX `idx_ledger_client_id` (`client_id`), INDEX `idx_ledger_direction` (`direction`), INDEX `idx_ledger_source_type` (`source_type`), UNIQUE INDEX `uq_ledger_source` (`source_type`, `source_id`), PRIMARY KEY (`id`)) ENGINE=InnoDB",
    );

    await this.createIfAbsent(
      queryRunner,
      'ai_knowledge_entries',
      "CREATE TABLE `ai_knowledge_entries` (`id` varchar(36) NOT NULL, `title` varchar(255) NOT NULL, `content` text NOT NULL, `category` enum ('COMPANY', 'PRODUCT', 'PRICING', 'PROCESS', 'FAQ', 'POLICY', 'OTHER') NOT NULL DEFAULT 'OTHER', `tags` varchar(512) NULL, `priority` int NOT NULL DEFAULT '0', `is_active` tinyint NOT NULL DEFAULT 1, `product` varchar(64) NULL, `author_id` varchar(36) NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX `idx_kb_active_category` (`is_active`, `category`), PRIMARY KEY (`id`)) ENGINE=InnoDB",
    );

    await this.createIfAbsent(
      queryRunner,
      'ai_conversation_state',
      "CREATE TABLE `ai_conversation_state` (`id` varchar(36) NOT NULL, `conversation_id` varchar(36) NOT NULL, `control_mode` enum ('AI', 'HUMAN') NOT NULL DEFAULT 'AI', `taken_over_by` varchar(36) NULL, `taken_over_at` datetime NULL, `needs_human` tinyint NOT NULL DEFAULT 0, `escalation_reason` varchar(512) NULL, `lead_status` enum ('NEW', 'QUALIFYING', 'QUALIFIED', 'DISQUALIFIED', 'CONVERTED') NOT NULL DEFAULT 'NEW', `lead_data` json NULL, `missing_fields` json NULL, `running_summary` text NULL, `last_handled_message_id` varchar(36) NULL, `ai_message_count` int NOT NULL DEFAULT '0', `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX `uq_ai_state_conversation` (`conversation_id`), PRIMARY KEY (`id`)) ENGINE=InnoDB",
    );

    await this.createIfAbsent(
      queryRunner,
      'analytics_events',
      "CREATE TABLE `analytics_events` (`id` varchar(36) NOT NULL, `site` varchar(100) NOT NULL DEFAULT 'default', `type` enum ('PAGEVIEW', 'EVENT') NOT NULL DEFAULT 'PAGEVIEW', `event_name` varchar(120) NULL, `url` varchar(1024) NULL, `path` varchar(512) NULL, `referrer` varchar(1024) NULL, `referrer_host` varchar(255) NULL, `title` varchar(255) NULL, `visitor_id` varchar(64) NULL, `session_id` varchar(64) NULL, `device_type` varchar(20) NULL, `browser` varchar(60) NULL, `os` varchar(60) NULL, `country` varchar(2) NULL, `language` varchar(10) NULL, `meta` json NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX `idx_analytics_site` (`site`), INDEX `idx_analytics_path` (`path`), INDEX `idx_analytics_visitor` (`visitor_id`), INDEX `idx_analytics_created_at` (`created_at`), INDEX `idx_analytics_type_time` (`type`, `created_at`), INDEX `idx_analytics_site_time` (`site`, `created_at`), PRIMARY KEY (`id`)) ENGINE=InnoDB",
    );

    await this.createIfAbsent(
      queryRunner,
      'tickets',
      "CREATE TABLE `tickets` (`id` varchar(36) NOT NULL, `ticket_number` varchar(50) NOT NULL, `subject` varchar(255) NOT NULL, `description` text NOT NULL, `client_id` varchar(36) NOT NULL, `project_id` varchar(36) NULL, `assignee_id` varchar(36) NULL, `reporter_id` varchar(36) NULL, `status` enum ('OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED') NOT NULL DEFAULT 'OPEN', `priority` enum ('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM', `category` enum ('BUG', 'FEATURE', 'QUESTION', 'BILLING', 'OTHER') NOT NULL DEFAULT 'QUESTION', `source` enum ('WEB', 'API', 'EMAIL') NOT NULL DEFAULT 'WEB', `attachments` json NULL, `first_response_due_at` datetime NULL, `resolve_due_at` datetime NULL, `first_responded_at` datetime NULL, `resolved_at` datetime NULL, `closed_at` datetime NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX `idx_tickets_client_id` (`client_id`), INDEX `idx_tickets_project_id` (`project_id`), INDEX `idx_tickets_assignee_id` (`assignee_id`), INDEX `idx_tickets_status` (`status`), INDEX `idx_tickets_priority` (`priority`), UNIQUE INDEX `uq_tickets_ticket_number` (`ticket_number`), PRIMARY KEY (`id`)) ENGINE=InnoDB",
    );

    await this.createIfAbsent(
      queryRunner,
      'ticket_replies',
      "CREATE TABLE `ticket_replies` (`id` varchar(36) NOT NULL, `ticket_id` varchar(36) NOT NULL, `author_id` varchar(36) NULL, `author_name` varchar(255) NULL, `body` text NOT NULL, `is_internal` tinyint NOT NULL DEFAULT 0, `attachments` json NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX `idx_ticket_replies_ticket_id` (`ticket_id`), PRIMARY KEY (`id`)) ENGINE=InnoDB",
    );

    await this.createIfAbsent(
      queryRunner,
      'client_api_keys',
      "CREATE TABLE `client_api_keys` (`id` varchar(36) NOT NULL, `client_id` varchar(36) NOT NULL, `label` varchar(100) NOT NULL, `key_hash` varchar(64) NOT NULL, `prefix` varchar(20) NOT NULL, `is_active` tinyint NOT NULL DEFAULT 1, `last_used_at` datetime NULL, `created_by` varchar(36) NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX `idx_client_api_keys_client_id` (`client_id`), INDEX `idx_client_api_keys_hash` (`key_hash`), UNIQUE INDEX `uq_client_api_keys_key_hash` (`key_hash`), PRIMARY KEY (`id`)) ENGINE=InnoDB",
    );

    await this.createIfAbsent(
      queryRunner,
      'saas_products',
      "CREATE TABLE `saas_products` (`id` varchar(36) NOT NULL, `code` varchar(64) NOT NULL, `name` varchar(128) NOT NULL, `description` text NULL, `subdomain_zone` varchar(255) NULL, `provisioner` varchar(64) NOT NULL DEFAULT 'http', `provisioning_base_url` varchar(512) NULL, `provisioning_key_hash` varchar(64) NULL, `is_active` tinyint NOT NULL DEFAULT 1, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX `uq_saas_products_code` (`code`), PRIMARY KEY (`id`)) ENGINE=InnoDB",
    );

    await this.createIfAbsent(
      queryRunner,
      'saas_plans',
      "CREATE TABLE `saas_plans` (`id` varchar(36) NOT NULL, `product_id` varchar(36) NOT NULL, `code` varchar(64) NOT NULL, `name` varchar(128) NOT NULL, `description` text NULL, `price_monthly` decimal(12,2) NULL, `price_yearly` decimal(12,2) NULL, `currency` varchar(8) NULL, `limits` json NULL, `entitlements` json NULL, `trial_days` int NOT NULL DEFAULT '0', `is_active` tinyint NOT NULL DEFAULT 1, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX `uq_saas_plans_product_code` (`product_id`, `code`), INDEX `idx_saas_plans_product` (`product_id`), PRIMARY KEY (`id`)) ENGINE=InnoDB",
    );

    await this.createIfAbsent(
      queryRunner,
      'saas_tenants',
      "CREATE TABLE `saas_tenants` (`id` varchar(36) NOT NULL, `client_id` varchar(36) NOT NULL, `product_id` varchar(36) NOT NULL, `slug` varchar(100) NOT NULL, `name` varchar(255) NOT NULL, `status` enum ('PENDING', 'PROVISIONING', 'ACTIVE', 'SUSPENDED', 'FAILED', 'ARCHIVED') NOT NULL DEFAULT 'PENDING', `external_tenant_id` varchar(255) NULL, `metadata` json NULL, `last_error` varchar(1024) NULL, `archived_at` datetime NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX `uq_saas_tenants_product_slug` (`product_id`, `slug`), INDEX `idx_saas_tenants_product` (`product_id`), INDEX `idx_saas_tenants_client` (`client_id`), INDEX `idx_saas_tenants_status` (`status`), PRIMARY KEY (`id`)) ENGINE=InnoDB",
    );

    await this.createIfAbsent(
      queryRunner,
      'saas_tenant_domains',
      "CREATE TABLE `saas_tenant_domains` (`id` varchar(36) NOT NULL, `tenant_id` varchar(36) NOT NULL, `domain` varchar(255) NOT NULL, `is_primary` tinyint NOT NULL DEFAULT 0, `is_verified` tinyint NOT NULL DEFAULT 0, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX `uq_saas_tenant_domains_domain` (`domain`), INDEX `idx_saas_tenant_domains_tenant` (`tenant_id`), PRIMARY KEY (`id`)) ENGINE=InnoDB",
    );

    await this.createIfAbsent(
      queryRunner,
      'saas_subscriptions',
      "CREATE TABLE `saas_subscriptions` (`id` varchar(36) NOT NULL, `tenant_id` varchar(36) NOT NULL, `plan_id` varchar(36) NOT NULL, `status` enum ('TRIAL', 'ACTIVE', 'PAST_DUE', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'TRIAL', `billing_interval` enum ('MONTHLY', 'YEARLY') NOT NULL DEFAULT 'MONTHLY', `trial_ends_at` datetime NULL, `current_period_start` datetime NULL, `current_period_end` datetime NULL, `cancelled_at` datetime NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX `idx_saas_subscriptions_status` (`status`), INDEX `idx_saas_subscriptions_tenant` (`tenant_id`), PRIMARY KEY (`id`)) ENGINE=InnoDB",
    );

    await this.createIfAbsent(
      queryRunner,
      'saas_provisioning_logs',
      "CREATE TABLE `saas_provisioning_logs` (`id` varchar(36) NOT NULL, `tenant_id` varchar(36) NOT NULL, `action` enum ('PROVISION', 'SUSPEND', 'REACTIVATE', 'UPDATE_PLAN', 'UPDATE_LIMITS', 'ARCHIVE') NOT NULL, `status` enum ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED') NOT NULL DEFAULT 'QUEUED', `request_id` varchar(64) NOT NULL, `attempts` int NOT NULL DEFAULT '0', `request_payload` json NULL, `response_payload` json NULL, `error_message` varchar(1024) NULL, `triggered_by` varchar(36) NULL, `started_at` datetime NULL, `finished_at` datetime NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX `uq_saas_prov_logs_request` (`request_id`), INDEX `idx_saas_prov_logs_status` (`status`), INDEX `idx_saas_prov_logs_tenant` (`tenant_id`), PRIMARY KEY (`id`)) ENGINE=InnoDB",
    );

    await this.createIfAbsent(
      queryRunner,
      'website_projects',
      "CREATE TABLE `website_projects` (`id` varchar(36) NOT NULL, `title` varchar(160) NOT NULL, `client_name` varchar(150) NULL, `summary` varchar(255) NULL, `description` text NOT NULL, `category` varchar(80) NULL, `image_url` varchar(2048) NULL, `project_url` varchar(2048) NULL, `tags` json NULL, `featured` tinyint NOT NULL DEFAULT 0, `sort_order` int NOT NULL DEFAULT '0', `created_by_admin_id` varchar(36) NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX `idx_website_project_sort_order` (`sort_order`), INDEX `idx_website_project_featured` (`featured`), PRIMARY KEY (`id`)) ENGINE=InnoDB",
    );

    await this.createIfAbsent(
      queryRunner,
      'website_products',
      "CREATE TABLE `website_products` (`id` varchar(36) NOT NULL, `name` varchar(160) NOT NULL, `tagline` varchar(255) NULL, `description` text NOT NULL, `category` varchar(80) NULL, `image_url` varchar(2048) NULL, `product_url` varchar(2048) NULL, `price` varchar(80) NULL, `features` json NULL, `featured` tinyint NOT NULL DEFAULT 0, `sort_order` int NOT NULL DEFAULT '0', `created_by_admin_id` varchar(36) NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX `idx_website_product_sort_order` (`sort_order`), INDEX `idx_website_product_featured` (`featured`), PRIMARY KEY (`id`)) ENGINE=InnoDB",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tables = [
      'website_products',
      'website_projects',
      'saas_provisioning_logs',
      'saas_subscriptions',
      'saas_tenant_domains',
      'saas_tenants',
      'saas_plans',
      'saas_products',
      'client_api_keys',
      'ticket_replies',
      'tickets',
      'analytics_events',
      'ai_conversation_state',
      'ai_knowledge_entries',
      'ledger_entries',
      'accounts',
      'quotation_line_items',
      'quotations',
      'purchase_line_items',
      'purchases',
      'suppliers',
    ];
    for (const t of tables) {
      if (await this.tableExists(queryRunner, t)) {
        await queryRunner.query(`DROP TABLE \`${t}\``);
      }
    }
  }
}
