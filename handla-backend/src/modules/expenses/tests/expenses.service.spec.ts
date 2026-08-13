import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SelectQueryBuilder } from 'typeorm';

import { ExpensesService } from '../expenses.service';
import { AccountingService } from '../../accounting/accounting.service';
import { Expense } from '../entities/expense.entity';
import { Invoice } from '../../invoices/entities/invoice.entity';
import { User } from '../../auth/entities/user.entity';
import { ExpenseType, InvoicePaymentStatus, UserRole, ClientStatus } from '../../../common/enums';
import {
  ResourceNotFoundException,
  OwnershipViolationException,
  InsufficientPermissionsException,
  AppException,
} from '../../../utils/exceptions';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id:                   'user-1',
    email:                'user@example.com',
    passwordHash:         'hashed',
    name:                 'Test User',
    role:                 UserRole.EMPLOYEE,
    createdAt:            new Date('2024-01-01'),
    updatedAt:            new Date('2024-01-01'),
    adminConversations:   [],
    clientConversations:  [],
    assignedConversations:[],
    messages:             [],
    notifications:        [],
    testimonials:         [],
    ...overrides,
  };
}

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id:            'inv-1',
    invoiceNumber: 'INV-2026-0001',
    clientId:      'client-1',
    ownerId:       'user-1',
    subtotal:      1000,
    taxRate:       0,
    taxAmount:     0,
    total:         1000,
    currency:      'USD',
    paymentStatus: InvoicePaymentStatus.PAID,
    dueDate:       null,
    paidAt:        new Date('2026-06-01'),
    notes:         null,
    lineItems:     [],
    createdAt:     new Date('2026-01-01'),
    updatedAt:     new Date('2026-01-01'),
    client:        undefined as any,
    owner:         makeUser(),
    ...overrides,
  };
}

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id:          'exp-1',
    type:        ExpenseType.EXPENSE,
    category:    'Software',
    amount:      250,
    currency:    'USD',
    description: 'Monthly AWS bill',
    expenseDate: '2026-06-01',
    invoiceId:   null,
    invoice:     null,
    ownerId:     'user-1',
    owner:       makeUser(),
    createdAt:   new Date('2026-06-01'),
    updatedAt:   new Date('2026-06-01'),
    ...overrides,
  };
}

// ─── Mock QueryBuilder factory ─────────────────────────────────────────────────

function buildQbMock(overrides: Partial<SelectQueryBuilder<any>> = {}): jest.Mocked<SelectQueryBuilder<any>> {
  const qb: any = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    andWhere:          jest.fn().mockReturnThis(),
    where:             jest.fn().mockReturnThis(),
    orderBy:           jest.fn().mockReturnThis(),
    addOrderBy:        jest.fn().mockReturnThis(),
    skip:              jest.fn().mockReturnThis(),
    take:              jest.fn().mockReturnThis(),
    select:            jest.fn().mockReturnThis(),
    clone:             jest.fn(),
    getManyAndCount:   jest.fn().mockResolvedValue([[], 0]),
    getRawOne:         jest.fn().mockResolvedValue({ sum: '0' }),
    ...overrides,
  };
  qb.clone.mockReturnValue(qb);
  return qb as jest.Mocked<SelectQueryBuilder<any>>;
}

// ─── Mock Repositories ────────────────────────────────────────────────────────

const mockExpenseRepo = () => ({
  createQueryBuilder: jest.fn(),
  findOne:            jest.fn(),
  create:             jest.fn(),
  save:               jest.fn(),
  remove:             jest.fn(),
});

const mockInvoiceRepo = () => ({
  createQueryBuilder: jest.fn(),
});

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('ExpensesService', () => {
  let service: ExpensesService;
  let expenseRepo: ReturnType<typeof mockExpenseRepo>;
  let invoiceRepo: ReturnType<typeof mockInvoiceRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpensesService,
        { provide: getRepositoryToken(Expense), useFactory: mockExpenseRepo },
        { provide: getRepositoryToken(Invoice), useFactory: mockInvoiceRepo },
        { provide: AccountingService, useValue: { record: jest.fn().mockResolvedValue(null) } },
      ],
    }).compile();

    service     = module.get<ExpensesService>(ExpensesService);
    expenseRepo = module.get(getRepositoryToken(Expense));
    invoiceRepo = module.get(getRepositoryToken(Invoice));
  });

  // ─── findAll ──────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('ADMIN sees all — no owner_id filter applied', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      const qb    = buildQbMock({ getManyAndCount: jest.fn().mockResolvedValue([[makeExpense()], 1]) });
      expenseRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(admin, {});
      expect(result.total).toBe(1);
      // owner_id filter should NOT be applied for ADMIN without explicit ownerId
      const calls = qb.andWhere.mock.calls.map((c: any[]) => c[0]);
      expect(calls.some((c: string) => c.includes('owner_id'))).toBe(false);
    });

    it('EMPLOYEE sees only own — owner_id filter applied', async () => {
      const employee = makeUser({ id: 'emp-1', role: UserRole.EMPLOYEE });
      const qb       = buildQbMock();
      expenseRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(employee, {});
      const ownerCall = qb.andWhere.mock.calls.find((c: any[]) => c[0].includes('owner_id'));
      expect(ownerCall).toBeDefined();
      expect(ownerCall![1]).toEqual({ uid: 'emp-1' });
    });

    it('filters by type when provided', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      const qb    = buildQbMock();
      expenseRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(admin, { type: ExpenseType.INCOME });
      const typeCall = qb.andWhere.mock.calls.find((c: any[]) => c[0].includes('type'));
      expect(typeCall).toBeDefined();
    });

    it('excludeInvoiceLinked filters invoice_id IS NULL', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      const qb    = buildQbMock();
      expenseRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(admin, { excludeInvoiceLinked: true });
      const nullCall = qb.andWhere.mock.calls.find((c: any[]) => c[0].includes('invoice_id IS NULL'));
      expect(nullCall).toBeDefined();
    });

    it('applies dateFrom and dateTo filters', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      const qb    = buildQbMock();
      expenseRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(admin, { dateFrom: '2026-01-01', dateTo: '2026-12-31' });
      const fromCall = qb.andWhere.mock.calls.find((c: any[]) => c[0].includes('expense_date >='));
      const toCall   = qb.andWhere.mock.calls.find((c: any[]) => c[0].includes('expense_date <='));
      expect(fromCall).toBeDefined();
      expect(toCall).toBeDefined();
    });
  });

  // ─── findOne ──────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns expense for ADMIN regardless of owner', async () => {
      const admin   = makeUser({ role: UserRole.ADMIN });
      const expense = makeExpense({ ownerId: 'someone-else' });
      expenseRepo.findOne.mockResolvedValue(expense);

      const result = await service.findOne('exp-1', admin);
      expect(result.id).toBe('exp-1');
    });

    it('throws ResourceNotFoundException when not found', async () => {
      expenseRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('x', makeUser({ role: UserRole.ADMIN }))).rejects.toThrow(ResourceNotFoundException);
    });

    it('throws OwnershipViolationException for EMPLOYEE accessing other\'s entry', async () => {
      const employee = makeUser({ id: 'emp-1', role: UserRole.EMPLOYEE });
      expenseRepo.findOne.mockResolvedValue(makeExpense({ ownerId: 'someone-else' }));
      await expect(service.findOne('exp-1', employee)).rejects.toThrow(OwnershipViolationException);
    });

    it('EMPLOYEE can access own entry', async () => {
      const employee = makeUser({ id: 'user-1', role: UserRole.EMPLOYEE });
      expenseRepo.findOne.mockResolvedValue(makeExpense({ ownerId: 'user-1' }));
      const result = await service.findOne('exp-1', employee);
      expect(result.ownerId).toBe('user-1');
    });
  });

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates manual entry with correct fields and sets ownerId', async () => {
      const user    = makeUser({ id: 'emp-1' });
      const created = makeExpense({ ownerId: 'emp-1', invoiceId: null });
      expenseRepo.create.mockReturnValue(created);
      expenseRepo.save.mockResolvedValue(created);

      const result = await service.create(
        { type: ExpenseType.EXPENSE, category: 'Software', amount: 250 },
        user,
      );

      expect(result.ownerId).toBe('emp-1');
      expect(result.invoiceId).toBeNull();
    });

    it('never sets invoiceId from API (always null)', async () => {
      const user    = makeUser();
      const created = makeExpense();
      expenseRepo.create.mockReturnValue(created);
      expenseRepo.save.mockResolvedValue(created);

      await service.create({ type: ExpenseType.INCOME, category: 'Sales', amount: 500 }, user);

      const createCall = expenseRepo.create.mock.calls[0][0] as Partial<Expense>;
      expect(createCall.invoiceId).toBeNull();
    });

    it('uses today as expenseDate when not provided', async () => {
      const user    = makeUser();
      const created = makeExpense();
      expenseRepo.create.mockReturnValue(created);
      expenseRepo.save.mockResolvedValue(created);

      await service.create({ type: ExpenseType.EXPENSE, category: 'Travel', amount: 100 }, user);

      const createCall = expenseRepo.create.mock.calls[0][0] as Partial<Expense>;
      expect(createCall.expenseDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  // ─── createFromPaidInvoice ────────────────────────────────────────────────

  describe('createFromPaidInvoice', () => {
    it('creates INCOME entry with category "Invoice Payment" and invoiceId set', async () => {
      const invoice = makeInvoice({ id: 'inv-1', total: 1000, currency: 'USD' });
      const created = makeExpense({ type: ExpenseType.INCOME, invoiceId: 'inv-1', amount: 1000 });

      expenseRepo.findOne.mockResolvedValue(null); // no existing entry
      expenseRepo.create.mockReturnValue(created);
      expenseRepo.save.mockResolvedValue(created);

      const result = await service.createFromPaidInvoice(invoice, 'user-1');
      expect(result).not.toBeNull();
      expect(result!.type).toBe(ExpenseType.INCOME);

      const createCall = expenseRepo.create.mock.calls[0][0] as Partial<Expense>;
      expect(createCall.category).toBe('Invoice Payment');
      expect(createCall.invoiceId).toBe('inv-1');
      expect(createCall.amount).toBe(1000);
    });

    it('is idempotent — returns null if entry already exists for invoice', async () => {
      const invoice  = makeInvoice({ id: 'inv-1' });
      const existing = makeExpense({ invoiceId: 'inv-1' });
      expenseRepo.findOne.mockResolvedValue(existing);

      const result = await service.createFromPaidInvoice(invoice, 'user-1');
      expect(result).toBeNull();
      expect(expenseRepo.save).not.toHaveBeenCalled();
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    it('throws AppException when trying to update invoice-linked entry', async () => {
      const admin   = makeUser({ role: UserRole.ADMIN });
      const expense = makeExpense({ invoiceId: 'inv-1' });
      expenseRepo.findOne.mockResolvedValue(expense);

      await expect(
        service.update('exp-1', { category: 'Changed' }, admin),
      ).rejects.toThrow(AppException);
    });

    it('throws OwnershipViolationException for EMPLOYEE on other\'s entry', async () => {
      const employee = makeUser({ id: 'emp-1', role: UserRole.EMPLOYEE });
      const expense  = makeExpense({ invoiceId: null, ownerId: 'other' });
      expenseRepo.findOne.mockResolvedValue(expense);

      await expect(
        service.update('exp-1', { category: 'New' }, employee),
      ).rejects.toThrow(OwnershipViolationException);
    });

    it('ADMIN can update manual entries', async () => {
      const admin   = makeUser({ role: UserRole.ADMIN });
      const expense = makeExpense({ invoiceId: null, ownerId: 'emp-1' });
      const updated = { ...expense, category: 'Updated' };
      expenseRepo.findOne.mockResolvedValue(expense);
      expenseRepo.save.mockResolvedValue(updated);

      const result = await service.update('exp-1', { category: 'Updated' }, admin);
      expect(result.category).toBe('Updated');
    });
  });

  // ─── remove ───────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('throws InsufficientPermissionsException for EMPLOYEE', async () => {
      const employee = makeUser({ role: UserRole.EMPLOYEE });
      await expect(service.remove('exp-1', employee)).rejects.toThrow(InsufficientPermissionsException);
    });

    it('throws ResourceNotFoundException when expense not found', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      expenseRepo.findOne.mockResolvedValue(null);
      await expect(service.remove('x', admin)).rejects.toThrow(ResourceNotFoundException);
    });

    it('throws AppException when trying to delete invoice-linked entry', async () => {
      const admin   = makeUser({ role: UserRole.ADMIN });
      const expense = makeExpense({ invoiceId: 'inv-1' });
      expenseRepo.findOne.mockResolvedValue(expense);
      await expect(service.remove('exp-1', admin)).rejects.toThrow(AppException);
    });

    it('ADMIN can delete manual entries', async () => {
      const admin   = makeUser({ role: UserRole.ADMIN });
      const expense = makeExpense({ invoiceId: null });
      expenseRepo.findOne.mockResolvedValue(expense);
      expenseRepo.remove.mockResolvedValue(expense);

      await expect(service.remove('exp-1', admin)).resolves.toBeUndefined();
      expect(expenseRepo.remove).toHaveBeenCalledWith(expense);
    });
  });

  // ─── getFinancialSummary ──────────────────────────────────────────────────

  describe('getFinancialSummary', () => {
    function setupSummaryMocks(
      incomeSum = '0',
      expenseSum = '0',
      manualSum = '0',
      paidSum = '0',
      outstandingSum = '0',
    ) {
      const expQb = buildQbMock({ getRawOne: jest.fn() });
      const invQb = buildQbMock({ getRawOne: jest.fn() });

      // calls in order: incomeRow, expenseRow, manualIncomeRow (via Promise.all)
      (expQb.getRawOne as jest.Mock)
        .mockResolvedValueOnce({ sum: incomeSum })
        .mockResolvedValueOnce({ sum: expenseSum })
        .mockResolvedValueOnce({ sum: manualSum });

      // invoice QBs: clone() returns the same mock
      (invQb.getRawOne as jest.Mock)
        .mockResolvedValueOnce({ sum: paidSum })
        .mockResolvedValueOnce({ sum: outstandingSum });

      expenseRepo.createQueryBuilder.mockReturnValue(expQb);
      invoiceRepo.createQueryBuilder.mockReturnValue(invQb);
    }

    it('returns zeroes when no data', async () => {
      setupSummaryMocks();
      const admin = makeUser({ role: UserRole.ADMIN });

      const result = await service.getFinancialSummary(admin);

      expect(result.totalIncome).toBe(0);
      expect(result.totalExpenses).toBe(0);
      expect(result.netBalance).toBe(0);
      expect(result.outstandingInvoices).toBe(0);
    });

    it('calculates netBalance = totalIncome − totalExpenses', async () => {
      setupSummaryMocks('5000', '2000', '1500', '3000', '1000');
      const admin = makeUser({ role: UserRole.ADMIN });

      const result = await service.getFinancialSummary(admin);

      expect(result.totalIncome).toBe(5000);
      expect(result.totalExpenses).toBe(2000);
      expect(result.netBalance).toBe(3000);
    });

    it('EMPLOYEE scope — owner_id filter applied on expense query', async () => {
      const employee = makeUser({ id: 'emp-1', role: UserRole.EMPLOYEE });
      const expQb    = buildQbMock();
      const invQb    = buildQbMock();
      expenseRepo.createQueryBuilder.mockReturnValue(expQb);
      invoiceRepo.createQueryBuilder.mockReturnValue(invQb);

      await service.getFinancialSummary(employee);

      const ownerCall = expQb.andWhere.mock.calls.find((c: any[]) => c[0].includes('owner_id'));
      expect(ownerCall).toBeDefined();
      expect(ownerCall![1]).toEqual({ uid: 'emp-1' });
    });

    it('includes periodFrom and periodTo in response when filtered', async () => {
      setupSummaryMocks();
      const admin = makeUser({ role: UserRole.ADMIN });

      const result = await service.getFinancialSummary(admin, '2026-01-01', '2026-12-31');

      expect(result.periodFrom).toBe('2026-01-01');
      expect(result.periodTo).toBe('2026-12-31');
    });

    it('paidInvoicesIncome reflects sum from invoices table (not expenses)', async () => {
      setupSummaryMocks('1000', '500', '0', '8000', '2000');
      const admin = makeUser({ role: UserRole.ADMIN });

      const result = await service.getFinancialSummary(admin);

      expect(result.paidInvoicesIncome).toBe(8000);
      expect(result.outstandingInvoices).toBe(2000);
    });
  });
});
