import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Quotation } from './entities/quotation.entity';
import { QuotationLineItem } from './entities/quotation-line-item.entity';
import { Client } from '../clients/entities/client.entity';

import { QuotationsService } from './quotations.service';
import { QuotationsController } from './quotations.controller';
import { QuotationsScheduler } from './quotations.scheduler';

import { ContractsModule } from '../contracts/contracts.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { NotificationModule } from '../notifications/notification.module';

/**
 * QUO-1 — QuotationsModule
 *
 * Imports ContractsModule + InvoicesModule so an accepted quotation can be
 * converted into a draft Contract + draft Invoice (one-way dependency; neither
 * Contracts nor Invoices depend on Quotations). NotificationModule is used for
 * sent/accepted/rejected notifications.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Quotation, QuotationLineItem, Client]),
    ContractsModule,
    InvoicesModule,
    NotificationModule,
  ],
  providers: [QuotationsService, QuotationsScheduler],
  controllers: [QuotationsController],
  exports: [QuotationsService],
})
export class QuotationsModule {}
