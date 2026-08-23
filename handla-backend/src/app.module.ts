import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { WinstonModule } from 'nest-winston';

import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import awsConfig from './config/aws.config';
import emailConfig from './config/email.config';
import socketConfig from './config/socket.config';
import aiConfig from './config/ai.config';
import saasConfig from './config/saas.config';
import authConfig from './config/auth.config';
import { winstonConfig } from './utils/logger';

// ─── Entities ───────────────────────────────────────────────────────────────
import { User } from './modules/auth/entities/user.entity';
import { EmailVerification } from './modules/auth/entities/email-verification.entity';
import { Conversation } from './modules/chat/entities/conversation.entity';
import { Message } from './modules/chat/entities/message.entity';
import { Notification } from './modules/notifications/entities/notification.entity';
import { Testimonial } from './modules/testimonials/entities/testimonial.entity';
import { WebsiteProject } from './modules/website/entities/website-project.entity';
import { WebsiteProduct } from './modules/website/entities/website-product.entity';
import { Client } from './modules/clients/entities/client.entity';
import { Project } from './modules/projects/entities/project.entity';
import { Task } from './modules/tasks/entities/task.entity';
import { Contract } from './modules/contracts/entities/contract.entity';
import { Invoice } from './modules/invoices/entities/invoice.entity';
import { InvoiceLineItem } from './modules/invoices/entities/invoice-line-item.entity';
import { Expense } from './modules/expenses/entities/expense.entity';
import { Account } from './modules/accounting/entities/account.entity';
import { LedgerEntry } from './modules/accounting/entities/ledger-entry.entity';
import { Supplier } from './modules/suppliers/entities/supplier.entity';
import { Purchase } from './modules/purchases/entities/purchase.entity';
import { PurchaseLineItem } from './modules/purchases/entities/purchase-line-item.entity';
import { Quotation } from './modules/quotations/entities/quotation.entity';
import { QuotationLineItem } from './modules/quotations/entities/quotation-line-item.entity';
import { Ticket } from './modules/support/entities/ticket.entity';
import { TicketReply } from './modules/support/entities/ticket-reply.entity';
import { ClientApiKey } from './modules/support/entities/client-api-key.entity';
import { AnalyticsEvent } from './modules/analytics/entities/analytics-event.entity';
import { KnowledgeEntry } from './modules/ai/entities/knowledge-entry.entity';
import { ConversationAiState } from './modules/ai/entities/conversation-ai-state.entity';
import { SaasProduct } from './modules/saas/entities/saas-product.entity';
import { SaasPlan } from './modules/saas/entities/saas-plan.entity';
import { SaasTenant } from './modules/saas/entities/saas-tenant.entity';
import { SaasSubscription } from './modules/saas/entities/saas-subscription.entity';
import { SaasTenantDomain } from './modules/saas/entities/saas-tenant-domain.entity';
import { SaasProvisioningLog } from './modules/saas/entities/saas-provisioning-log.entity';

// ─── Feature Modules ────────────────────────────────────────────────────────
import { AuthModule } from './modules/auth/auth.module';
import { ChatModule } from './modules/chat/chat.module';
import { NotificationModule } from './modules/notifications/notification.module';
import { TestimonialModule } from './modules/testimonials/testimonial.module';
import { WebsiteModule } from './modules/website/website.module';
import { EmailModule } from './modules/email/email.module';
import { HealthModule } from './health/health.module';
import { UsersModule } from './modules/users/users.module';
import { ClientsModule } from './modules/clients/clients.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { AccountingModule } from './modules/accounting/accounting.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { PurchasesModule } from './modules/purchases/purchases.module';
import { QuotationsModule } from './modules/quotations/quotations.module';
import { SupportModule } from './modules/support/support.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AiModule } from './modules/ai/ai.module';
import { SaasModule } from './modules/saas/saas.module';
import { PublicTokenModule } from './common/public-token/public-token.module';

@Module({
  imports: [
    // ─── Config ────────────────────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, jwtConfig, awsConfig, emailConfig, socketConfig, aiConfig, saasConfig, authConfig],
      envFilePath: '.env',
    }),

    // ─── Winston Logger ─────────────────────────────────────────────────────────
    WinstonModule.forRoot(winstonConfig),

    // ─── TypeORM ────────────────────────────────────────────────────────────────
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        ...configService.get('database'),
        entities: [User, EmailVerification, Conversation, Message, Notification, Testimonial, WebsiteProject, WebsiteProduct, Client, Project, Task, Contract, Invoice, InvoiceLineItem, Expense, Account, LedgerEntry, Supplier, Purchase, PurchaseLineItem, Quotation, QuotationLineItem, Ticket, TicketReply, ClientApiKey, AnalyticsEvent, KnowledgeEntry, ConversationAiState, SaasProduct, SaasPlan, SaasTenant, SaasSubscription, SaasTenantDomain, SaasProvisioningLog],
      }),
    }),

    // ─── Shared: public-document capability tokens (INFO-01) ────────────────────
    PublicTokenModule,

    // ─── Feature Modules ────────────────────────────────────────────────────────
    AuthModule,
    ChatModule,
    NotificationModule,
    TestimonialModule,
    WebsiteModule,
    EmailModule,
    UsersModule,
    ClientsModule,
    ProjectsModule,
    TasksModule,
    ContractsModule,
    InvoicesModule,
    ExpensesModule,
    DashboardModule,
    ProfilesModule,
    AccountingModule,
    SuppliersModule,
    PurchasesModule,
    QuotationsModule,
    SupportModule,
    ReportsModule,
    AnalyticsModule,
    AiModule,
    SaasModule,
    HealthModule,

    // ─── Rate Limiting ──────────────────────────────────────────────────────────
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            ttl: parseInt(configService.get('THROTTLE_TTL') || '60000', 10),
            limit: parseInt(configService.get('THROTTLE_LIMIT') || '100', 10),
          },
        ],
      }),
    }),
  ],
  providers: [
    // Global rate-limiting. Without this APP_GUARD registration the
    // ThrottlerModule config and every @Throttle() decorator (e.g. on the
    // auth login/register endpoints) would be INERT — no brute-force
    // protection at all. Registering the guard here enforces the default
    // limit platform-wide and activates all per-route overrides.
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
