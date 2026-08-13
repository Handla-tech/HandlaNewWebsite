import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Purchase } from './entities/purchase.entity';
import { PurchaseLineItem } from './entities/purchase-line-item.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';

import { PurchasesService } from './purchases.service';
import { PurchasesController } from './purchases.controller';
import { PurchasesScheduler } from './purchases.scheduler';

import { ExpensesModule } from '../expenses/expenses.module';
import { NotificationModule } from '../notifications/notification.module';

/**
 * PUR-1 — PurchasesModule
 *
 * Imports ExpensesModule so markAsPaid() can auto-create an EXPENSE (which in
 * turn posts an OUT ledger entry via the Accounting hook). No circular dep:
 * ExpensesModule does not depend on PurchasesModule.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Purchase, PurchaseLineItem, Supplier]),
    ExpensesModule,
    NotificationModule,
  ],
  providers: [PurchasesService, PurchasesScheduler],
  controllers: [PurchasesController],
  exports: [PurchasesService],
})
export class PurchasesModule {}
