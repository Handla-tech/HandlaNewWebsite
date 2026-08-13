import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AccountingService } from '../accounting.service';
import { Account } from '../entities/account.entity';
import { LedgerEntry } from '../entities/ledger-entry.entity';
import { Client } from '../../clients/entities/client.entity';
import {
  AccountType,
  LedgerDirection,
  LedgerSourceType,
  UserRole,
} from '../../../common/enums';
import { User } from '../../auth/entities/user.entity';

function makeUser(overrides: Partial<User> = {}): User {
  return { id: 'u-1', role: UserRole.ADMIN, ...overrides } as User;
}

describe('AccountingService', () => {
  let service: AccountingService;
  let accountRepo: any;
  let ledgerRepo: any;
  let clientRepo: any;

  beforeEach(async () => {
    accountRepo = {
      findOne: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn((x) => Promise.resolve({ id: 'acc-1', ...x })),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    ledgerRepo = {
      findOne: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn((x) => Promise.resolve({ id: 'led-1', ...x })),
      remove: jest.fn(),
      delete: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    clientRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountingService,
        { provide: getRepositoryToken(Account), useValue: accountRepo },
        { provide: getRepositoryToken(LedgerEntry), useValue: ledgerRepo },
        { provide: getRepositoryToken(Client), useValue: clientRepo },
      ],
    }).compile();

    service = module.get(AccountingService);
  });

  describe('record (idempotent ledger writer)', () => {
    it('returns existing entry and does not insert when source already posted', async () => {
      const existing = { id: 'led-existing' };
      ledgerRepo.findOne.mockResolvedValue(existing);

      const result = await service.record({
        entryDate: '2026-01-01',
        accountCode: '4000',
        direction: LedgerDirection.IN,
        amount: 100,
        sourceType: LedgerSourceType.INVOICE,
        sourceId: 'inv-1',
      });

      expect(result).toBe(existing);
      expect(ledgerRepo.save).not.toHaveBeenCalled();
    });

    it('resolves account by code and inserts a new entry', async () => {
      ledgerRepo.findOne.mockResolvedValue(null);
      accountRepo.findOne.mockResolvedValue({ id: 'acc-income', code: '4000' });

      const result = await service.record({
        entryDate: '2026-01-01',
        accountCode: '4000',
        clientId: 'client-1',
        direction: LedgerDirection.IN,
        amount: 250.5,
        currency: 'USD',
        sourceType: LedgerSourceType.INVOICE,
        sourceId: 'inv-2',
      });

      expect(accountRepo.findOne).toHaveBeenCalledWith({ where: { code: '4000' } });
      expect(ledgerRepo.save).toHaveBeenCalled();
      expect(result).toMatchObject({
        accountId: 'acc-income',
        clientId: 'client-1',
        direction: LedgerDirection.IN,
        amount: 250.5,
      });
    });

    it('returns null and skips insert when account code cannot be resolved', async () => {
      ledgerRepo.findOne.mockResolvedValue(null);
      accountRepo.findOne.mockResolvedValue(null);

      const result = await service.record({
        entryDate: '2026-01-01',
        accountCode: 'DOES-NOT-EXIST',
        direction: LedgerDirection.OUT,
        amount: 10,
        sourceType: LedgerSourceType.EXPENSE,
        sourceId: 'exp-1',
      });

      expect(result).toBeNull();
      expect(ledgerRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('getClientLedger', () => {
    it('computes a running balance and IN/OUT totals per currency', async () => {
      clientRepo.findOne.mockResolvedValue({ id: 'client-1' });
      ledgerRepo.find.mockResolvedValue([
        { id: 'a', entryDate: '2026-01-01', direction: LedgerDirection.IN, amount: 100, currency: 'USD', sourceType: LedgerSourceType.INVOICE, sourceId: 'i1', description: null },
        { id: 'b', entryDate: '2026-01-02', direction: LedgerDirection.OUT, amount: 30, currency: 'USD', sourceType: LedgerSourceType.MANUAL, sourceId: 'b', description: 'refund' },
      ]);

      const res = await service.getClientLedger('client-1');

      expect(res.rows).toHaveLength(2);
      expect(res.rows[0].runningBalance).toBe(100);
      expect(res.rows[1].runningBalance).toBe(70);
      expect(res.totals.in).toBe(100);
      expect(res.totals.out).toBe(30);
      expect(res.totals.net).toBe(70);
      expect(res.totals.byCurrency.USD).toEqual({ in: 100, out: 30, net: 70 });
    });
  });

  describe('removeManualEntry', () => {
    it('blocks non-admin', async () => {
      await expect(
        service.removeManualEntry('led-1', makeUser({ role: UserRole.EMPLOYEE })),
      ).rejects.toBeDefined();
    });

    it('blocks deletion of non-manual entries', async () => {
      ledgerRepo.findOne.mockResolvedValue({ id: 'led-1', sourceType: LedgerSourceType.INVOICE });
      await expect(
        service.removeManualEntry('led-1', makeUser({ role: UserRole.ADMIN })),
      ).rejects.toBeDefined();
      expect(ledgerRepo.remove).not.toHaveBeenCalled();
    });

    it('deletes a manual entry as admin', async () => {
      const entry = { id: 'led-1', sourceType: LedgerSourceType.MANUAL };
      ledgerRepo.findOne.mockResolvedValue(entry);
      await service.removeManualEntry('led-1', makeUser({ role: UserRole.ADMIN }));
      expect(ledgerRepo.remove).toHaveBeenCalledWith(entry);
    });
  });

  describe('createAccount', () => {
    it('rejects duplicate code', async () => {
      accountRepo.findOne.mockResolvedValue({ id: 'x', code: '4000' });
      await expect(
        service.createAccount({ code: '4000', name: 'Dup', type: AccountType.INCOME }),
      ).rejects.toBeDefined();
    });

    it('creates a new account', async () => {
      accountRepo.findOne.mockResolvedValue(null);
      const res = await service.createAccount({ code: '6000', name: 'New', type: AccountType.EXPENSE });
      expect(accountRepo.save).toHaveBeenCalled();
      expect(res).toMatchObject({ code: '6000', type: AccountType.EXPENSE, isSystem: false });
    });
  });
});
