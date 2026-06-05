import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Invoice } from './entities/invoice.entity';
import { InvoiceLineItem } from './entities/invoice-line-item.entity';
import { Client } from '../clients/entities/client.entity';
import { User } from '../auth/entities/user.entity';
import { Conversation } from '../chat/entities/conversation.entity';

import { InvoicesService } from './invoices.service';
import { InvoicesController } from './invoices.controller';
import { InvoicesScheduler } from './invoices.scheduler';
import { NotificationModule } from '../notifications/notification.module';
import { ExpensesModule } from '../expenses/expenses.module';
import { EmailModule } from '../email/email.module';
import { ChatModule } from '../chat/chat.module';

/**
 * ERP-7 — InvoicesModule (updated in ERP-8.5)
 *
 * Circular dependency resolved with forwardRef():
 *   InvoicesModule imports ExpensesModule (forwardRef)
 *   ExpensesModule imports InvoicesModule (forwardRef)
 *
 * InvoicesService injects ExpensesService via @Inject(forwardRef(() => ExpensesService))
 * to call createFromPaidInvoice() in markAsPaid().
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice, InvoiceLineItem, Client, User, Conversation]),
    NotificationModule,
    EmailModule,
    ChatModule,
    forwardRef(() => ExpensesModule),
  ],
  providers: [InvoicesService, InvoicesScheduler],
  controllers: [InvoicesController],
  exports: [InvoicesService],
})
export class InvoicesModule {}
