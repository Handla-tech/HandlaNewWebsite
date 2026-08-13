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
 * QUO — QuotationsModule
 *
 * Sales estimates that convert into a draft Contract + draft Invoice on accept.
 * Depends (one-way) on ContractsModule + InvoicesModule (both export their
 * services) to generate the downstream documents, and NotificationModule for
 * client/owner alerts. No circular dependency — quotations sit "upstream" of
 * contracts/invoices.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Quotation, QuotationLineItem, Client]),
    ContractsModule,
    InvoicesModule,
    NotificationModule,
  ],
  controllers: [QuotationsController],
  providers: [QuotationsService, QuotationsScheduler],
  exports: [QuotationsService],
})
export class QuotationsModule {}
