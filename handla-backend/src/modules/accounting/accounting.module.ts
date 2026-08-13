import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Account } from './entities/account.entity';
import { LedgerEntry } from './entities/ledger-entry.entity';
import { Client } from '../clients/entities/client.entity';

import { AccountingService } from './accounting.service';
import { AccountingController } from './accounting.controller';
import { AccountingSeeder } from './accounting.seeder';

/**
 * ACC-1 — AccountingModule
 *
 * Exports AccountingService so invoice/expense/purchase modules can post to
 * the unified ledger via record(). Seeds a default Chart of Accounts on init.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Account, LedgerEntry, Client])],
  providers: [AccountingService, AccountingSeeder],
  controllers: [AccountingController],
  exports: [AccountingService],
})
export class AccountingModule {}
