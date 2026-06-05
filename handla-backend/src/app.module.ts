import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { WinstonModule } from 'nest-winston';

import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import awsConfig from './config/aws.config';
import emailConfig from './config/email.config';
import socketConfig from './config/socket.config';
import { winstonConfig } from './utils/logger';

// ─── Entities ───────────────────────────────────────────────────────────────
import { User } from './modules/auth/entities/user.entity';
import { Conversation } from './modules/chat/entities/conversation.entity';
import { Message } from './modules/chat/entities/message.entity';
import { Notification } from './modules/notifications/entities/notification.entity';
import { Testimonial } from './modules/testimonials/entities/testimonial.entity';
import { Client } from './modules/clients/entities/client.entity';
import { Project } from './modules/projects/entities/project.entity';
import { Task } from './modules/tasks/entities/task.entity';
import { Contract } from './modules/contracts/entities/contract.entity';
import { Invoice } from './modules/invoices/entities/invoice.entity';
import { InvoiceLineItem } from './modules/invoices/entities/invoice-line-item.entity';
import { Expense } from './modules/expenses/entities/expense.entity';

// ─── Feature Modules ────────────────────────────────────────────────────────
import { AuthModule } from './modules/auth/auth.module';
import { ChatModule } from './modules/chat/chat.module';
import { NotificationModule } from './modules/notifications/notification.module';
import { TestimonialModule } from './modules/testimonials/testimonial.module';
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

@Module({
  imports: [
    // ─── Config ────────────────────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, jwtConfig, awsConfig, emailConfig, socketConfig],
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
        entities: [User, Conversation, Message, Notification, Testimonial, Client, Project, Task, Contract, Invoice, InvoiceLineItem, Expense],
      }),
    }),

    // ─── Feature Modules ────────────────────────────────────────────────────────
    AuthModule,
    ChatModule,
    NotificationModule,
    TestimonialModule,
    EmailModule,
    UsersModule,
    ClientsModule,
    ProjectsModule,
    TasksModule,
    ContractsModule,
    InvoicesModule,
    ExpensesModule,
    DashboardModule,
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
})
export class AppModule {}
