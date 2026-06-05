import 'dotenv/config';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { User } from '../modules/auth/entities/user.entity';
import { Conversation } from '../modules/chat/entities/conversation.entity';
import { Message } from '../modules/chat/entities/message.entity';
import { Notification } from '../modules/notifications/entities/notification.entity';
import { Testimonial } from '../modules/testimonials/entities/testimonial.entity';
import { Client } from '../modules/clients/entities/client.entity';
import { Project } from '../modules/projects/entities/project.entity';
import { Task } from '../modules/tasks/entities/task.entity';
import { Contract } from '../modules/contracts/entities/contract.entity';
import { Invoice } from '../modules/invoices/entities/invoice.entity';
import { InvoiceLineItem } from '../modules/invoices/entities/invoice-line-item.entity';
import { Expense } from '../modules/expenses/entities/expense.entity';

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '3306', 10),
  database: process.env.DATABASE_NAME || 'handla_db',
  username: process.env.DATABASE_USER || 'root',
  password: process.env.DATABASE_PASSWORD || undefined,
  entities: [
    User, Conversation, Message, Notification, Testimonial,
    Client, Project, Task, Contract, Invoice, InvoiceLineItem, Expense,
  ],
  migrations: [path.resolve(__dirname, '../database/migrations/*{.ts,.js}')],
  synchronize: false,
  logging: true,
  charset: 'utf8mb4',
  timezone: 'Z',
});
