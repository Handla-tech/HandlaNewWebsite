import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Account } from './entities/account.entity';
import { AccountType } from '../../common/enums';

/**
 * ACC-1 — Default Chart of Accounts seeder.
 *
 * Runs on module init. Idempotent: only inserts an account if its code is
 * missing. These `isSystem` accounts are referenced by the invoice/expense/
 * purchase ledger hooks (by code), so they must always exist.
 */
@Injectable()
export class AccountingSeeder implements OnModuleInit {
  private readonly logger = new Logger(AccountingSeeder.name);

  // Code, name, type. Codes are stable API used by hooks — do NOT rename.
  static readonly DEFAULTS: Array<{ code: string; name: string; type: AccountType }> = [
    // Assets
    { code: '1000', name: 'Cash / Bank', type: AccountType.ASSET },
    { code: '1100', name: 'Accounts Receivable', type: AccountType.ASSET },
    // Liabilities
    { code: '2000', name: 'Accounts Payable', type: AccountType.LIABILITY },
    { code: '2100', name: 'Taxes Payable', type: AccountType.LIABILITY },
    // Income
    { code: '4000', name: 'Services Income', type: AccountType.INCOME },
    { code: '4100', name: 'Hosting & Subscriptions Income', type: AccountType.INCOME },
    { code: '4900', name: 'Other Income', type: AccountType.INCOME },
    // Expenses
    { code: '5000', name: 'Software Subscriptions', type: AccountType.EXPENSE },
    { code: '5100', name: 'Salaries & Contractors', type: AccountType.EXPENSE },
    { code: '5200', name: 'Hosting & Infrastructure', type: AccountType.EXPENSE },
    { code: '5300', name: 'Marketing & Advertising', type: AccountType.EXPENSE },
    { code: '5400', name: 'Office & Admin', type: AccountType.EXPENSE },
    { code: '5900', name: 'Other Expense', type: AccountType.EXPENSE },
    // Equity
    { code: '3000', name: "Owner's Equity", type: AccountType.EQUITY },
  ];

  // Codes used by internal hooks — exported for reuse.
  static readonly CODE_SERVICES_INCOME = '4000';
  static readonly CODE_OTHER_INCOME = '4900';
  static readonly CODE_ACCOUNTS_PAYABLE = '2000';
  static readonly CODE_OTHER_EXPENSE = '5900';

  constructor(
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
  ) {}

  async onModuleInit(): Promise<void> {
    // Skip if the table doesn't exist yet (fresh DB before sync) — best-effort.
    try {
      await this.seed();
    } catch (err) {
      this.logger.warn(`Chart of Accounts seed skipped: ${(err as Error).message}`);
    }
  }

  async seed(): Promise<void> {
    let created = 0;
    for (const def of AccountingSeeder.DEFAULTS) {
      const existing = await this.accountRepo.findOne({ where: { code: def.code } });
      if (existing) continue;
      await this.accountRepo.save(
        this.accountRepo.create({
          code: def.code,
          name: def.name,
          type: def.type,
          isSystem: true,
          isActive: true,
        }),
      );
      created++;
    }
    if (created > 0) {
      this.logger.log(`Chart of Accounts seeded: ${created} default account(s) created.`);
    }
  }
}
