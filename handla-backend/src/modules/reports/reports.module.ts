import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LedgerEntry } from '../accounting/entities/ledger-entry.entity';
import { Account } from '../accounting/entities/account.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { Purchase } from '../purchases/entities/purchase.entity';
import { Project } from '../projects/entities/project.entity';
import { Ticket } from '../support/entities/ticket.entity';
import { Client } from '../clients/entities/client.entity';

import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';

/**
 * REP — ReportsModule
 *
 * Read-only aggregation over accounting, invoices, expenses, purchases,
 * projects, support, and clients. Registers only the repositories it queries;
 * no services from other modules are injected, so there are no circular deps.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      LedgerEntry,
      Account,
      Invoice,
      Expense,
      Purchase,
      Project,
      Ticket,
      Client,
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
