import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Expense } from './entities/expense.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { User } from '../auth/entities/user.entity';

import { ExpensesService } from './expenses.service';
import { ExpensesController } from './expenses.controller';
import { InvoicesModule } from '../invoices/invoices.module';
import { AccountingModule } from '../accounting/accounting.module';

/**
 * ERP-8 — ExpensesModule
 *
 * forwardRef() resolves the circular dependency between InvoicesModule and
 * ExpensesModule:
 *   InvoicesModule  exports  InvoicesService  (used by no one here yet)
 *   ExpensesModule  exports  ExpensesService  (injected into InvoicesService.markAsPaid)
 *
 * This module imports InvoicesModule with forwardRef so both modules can
 * resolve at startup without deadlock. InvoicesModule mirrors this below.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Expense, Invoice, User]),
    forwardRef(() => InvoicesModule),
    AccountingModule,
  ],
  providers: [ExpensesService],
  controllers: [ExpensesController],
  exports: [ExpensesService],
})
export class ExpensesModule {}
