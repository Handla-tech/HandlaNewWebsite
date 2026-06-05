import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { DashboardService } from '../dashboard.service';
import { User }     from '../../auth/entities/user.entity';
import { Client }   from '../../clients/entities/client.entity';
import { Project }  from '../../projects/entities/project.entity';
import { Task }     from '../../tasks/entities/task.entity';
import { Contract } from '../../contracts/entities/contract.entity';
import { Invoice }  from '../../invoices/entities/invoice.entity';
import { Expense }  from '../../expenses/entities/expense.entity';

import {
  UserRole,
  ProjectStatus,
  TaskStatus,
  ContractStatus,
  InvoicePaymentStatus,
  ExpenseType,
} from '../../../common/enums';

// ─── Factory helpers ──────────────────────────────────────────────────────────

function makeAdminUser(): User {
  return {
    id: 'admin-1',
    email: 'admin@example.com',
    passwordHash: 'hashed',
    name: 'Admin User',
    role: UserRole.ADMIN,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    adminConversations: [],
    clientConversations: [],
    assignedConversations: [],
    messages: [],
    notifications: [],
    testimonials: [],
  } as User;
}

function makeEmployeeUser(): User {
  return {
    id: 'emp-1',
    email: 'emp@example.com',
    passwordHash: 'hashed',
    name: 'Employee',
    role: UserRole.EMPLOYEE,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    adminConversations: [],
    clientConversations: [],
    assignedConversations: [],
    messages: [],
    notifications: [],
    testimonials: [],
  } as User;
}

// ─── Mock repo factory ────────────────────────────────────────────────────────

function makeRepo() {
  return {
    count: jest.fn().mockResolvedValue(0),
    find:  jest.fn().mockResolvedValue([]),
  };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('DashboardService', () => {
  let service: DashboardService;

  let userRepo:     ReturnType<typeof makeRepo>;
  let clientRepo:   ReturnType<typeof makeRepo>;
  let projectRepo:  ReturnType<typeof makeRepo>;
  let taskRepo:     ReturnType<typeof makeRepo>;
  let contractRepo: ReturnType<typeof makeRepo>;
  let invoiceRepo:  ReturnType<typeof makeRepo>;
  let expenseRepo:  ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    userRepo     = makeRepo();
    clientRepo   = makeRepo();
    projectRepo  = makeRepo();
    taskRepo     = makeRepo();
    contractRepo = makeRepo();
    invoiceRepo  = makeRepo();
    expenseRepo  = makeRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: getRepositoryToken(User),     useValue: userRepo     },
        { provide: getRepositoryToken(Client),   useValue: clientRepo   },
        { provide: getRepositoryToken(Project),  useValue: projectRepo  },
        { provide: getRepositoryToken(Task),     useValue: taskRepo     },
        { provide: getRepositoryToken(Contract), useValue: contractRepo },
        { provide: getRepositoryToken(Invoice),  useValue: invoiceRepo  },
        { provide: getRepositoryToken(Expense),  useValue: expenseRepo  },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── getStats — ADMIN ──────────────────────────────────────────────────────

  describe('getStats — ADMIN', () => {
    it('returns system-wide counts without ownerId filter', async () => {
      userRepo.count
        .mockResolvedValueOnce(10)  // totalLeads
        .mockResolvedValueOnce(5);  // newLeadsThisMonth

      clientRepo.count
        .mockResolvedValueOnce(20) // totalClients
        .mockResolvedValueOnce(3); // newClientsThisMonth

      projectRepo.count
        .mockResolvedValueOnce(2) // planning
        .mockResolvedValueOnce(4) // active
        .mockResolvedValueOnce(1) // onHold
        .mockResolvedValueOnce(8) // completed
        .mockResolvedValueOnce(0); // cancelled

      taskRepo.count
        .mockResolvedValueOnce(50) // totalTasks
        .mockResolvedValueOnce(40) // completedTasks
        .mockResolvedValueOnce(3)  // delayedTasks
        .mockResolvedValueOnce(7); // pendingTasks

      expenseRepo.find
        .mockResolvedValueOnce([{ amount: 1000 }, { amount: 500 }]) // income rows
        .mockResolvedValueOnce([{ amount: 200 }, { amount: 300 }]); // expense rows

      invoiceRepo.find
        .mockResolvedValueOnce([{ total: 2000 }]) // unpaid
        .mockResolvedValueOnce([{ total: 500 }, { total: 300 }]); // overdue

      contractRepo.count
        .mockResolvedValueOnce(1) // draft
        .mockResolvedValueOnce(2) // sent
        .mockResolvedValueOnce(5) // signed
        .mockResolvedValueOnce(0); // rejected

      const admin  = makeAdminUser();
      const result = await service.getStats(admin);

      // Lead / Client
      expect(result.totalLeads).toBe(10);
      expect(result.totalClients).toBe(20);
      expect(result.newLeadsThisMonth).toBe(5);
      expect(result.newClientsThisMonth).toBe(3);

      // Projects
      expect(result.activeProjects).toBe(4);
      expect(result.projectsByStatus).toEqual({
        planning: 2, active: 4, onHold: 1, completed: 8, cancelled: 0,
      });

      // Tasks
      expect(result.totalTasks).toBe(50);
      expect(result.completedTasks).toBe(40);
      expect(result.completionRate).toBe(80);  // Math.round(40/50*100)
      expect(result.delayedTasks).toBe(3);
      expect(result.pendingTasks).toBe(7);

      // Financial
      expect(result.totalIncome).toBe(1500);
      expect(result.totalExpenses).toBe(500);
      expect(result.netBalance).toBe(1000);
      expect(result.outstandingInvoices).toBe(2800); // 2000 + 500 + 300
      expect(result.overdueInvoicesCount).toBe(2);

      // Contracts
      expect(result.contractsByStatus).toEqual({ draft: 1, sent: 2, signed: 5, rejected: 0 });
    });

    it('ADMIN clientRepo.count called WITHOUT ownerId', async () => {
      const admin = makeAdminUser();
      await service.getStats(admin);

      // First clientRepo.count call (totalClients) should NOT include ownerId
      const firstCallArgs = clientRepo.count.mock.calls[0];
      expect(firstCallArgs[0]).toBeUndefined(); // count() with no where = undefined arg
    });

    it('ADMIN userRepo queries are called (leads visible)', async () => {
      userRepo.count.mockResolvedValue(7);
      const admin  = makeAdminUser();
      const result = await service.getStats(admin);
      expect(result.totalLeads).toBe(7);
      expect(userRepo.count).toHaveBeenCalled();
    });
  });

  // ─── getStats — EMPLOYEE ───────────────────────────────────────────────────

  describe('getStats — EMPLOYEE', () => {
    it('returns ownerId-scoped stats and zero leads', async () => {
      clientRepo.count
        .mockResolvedValueOnce(5) // totalClients (ownerId-scoped)
        .mockResolvedValueOnce(1); // newClientsThisMonth (ownerId-scoped)

      projectRepo.count
        .mockResolvedValueOnce(0) // planning
        .mockResolvedValueOnce(2) // active
        .mockResolvedValueOnce(0) // onHold
        .mockResolvedValueOnce(3) // completed
        .mockResolvedValueOnce(0); // cancelled

      taskRepo.count
        .mockResolvedValueOnce(10) // totalTasks
        .mockResolvedValueOnce(6)  // completedTasks
        .mockResolvedValueOnce(1)  // delayedTasks
        .mockResolvedValueOnce(3); // pendingTasks

      expenseRepo.find
        .mockResolvedValueOnce([{ amount: 800 }])  // income
        .mockResolvedValueOnce([{ amount: 200 }]); // expenses

      invoiceRepo.find
        .mockResolvedValueOnce([{ total: 400 }]) // unpaid
        .mockResolvedValueOnce([]);              // overdue (none)

      contractRepo.count.mockResolvedValue(1);

      const emp    = makeEmployeeUser();
      const result = await service.getStats(emp);

      // Leads always 0 for employee
      expect(result.totalLeads).toBe(0);
      expect(result.newLeadsThisMonth).toBe(0);
      expect(userRepo.count).not.toHaveBeenCalled();

      // Clients scoped
      expect(result.totalClients).toBe(5);
      expect(result.newClientsThisMonth).toBe(1);

      // Tasks
      expect(result.totalTasks).toBe(10);
      expect(result.completedTasks).toBe(6);
      expect(result.completionRate).toBe(60); // Math.round(6/10*100)

      // Financial
      expect(result.totalIncome).toBe(800);
      expect(result.totalExpenses).toBe(200);
      expect(result.netBalance).toBe(600);
      expect(result.outstandingInvoices).toBe(400);
      expect(result.overdueInvoicesCount).toBe(0);
    });

    it('EMPLOYEE clientRepo.count called WITH ownerId', async () => {
      const emp = makeEmployeeUser();
      await service.getStats(emp);

      // Every clientRepo.count call should include ownerId: 'emp-1'
      for (const call of clientRepo.count.mock.calls) {
        expect(call[0]).toEqual(
          expect.objectContaining({ where: expect.objectContaining({ ownerId: 'emp-1' }) }),
        );
      }
    });

    it('EMPLOYEE projectRepo.count called WITH ownerId', async () => {
      const emp = makeEmployeeUser();
      await service.getStats(emp);

      for (const call of projectRepo.count.mock.calls) {
        expect(call[0]).toEqual(
          expect.objectContaining({ where: expect.objectContaining({ ownerId: 'emp-1' }) }),
        );
      }
    });

    it('EMPLOYEE taskRepo.count called WITH ownerId', async () => {
      const emp = makeEmployeeUser();
      await service.getStats(emp);

      for (const call of taskRepo.count.mock.calls) {
        expect(call[0]).toEqual(
          expect.objectContaining({ where: expect.objectContaining({ ownerId: 'emp-1' }) }),
        );
      }
    });

    it('EMPLOYEE invoiceRepo.find called WITH ownerId', async () => {
      const emp = makeEmployeeUser();
      await service.getStats(emp);

      for (const call of invoiceRepo.find.mock.calls) {
        expect(call[0]).toEqual(
          expect.objectContaining({ where: expect.objectContaining({ ownerId: 'emp-1' }) }),
        );
      }
    });
  });

  // ─── completionRate edge cases ────────────────────────────────────────────

  describe('completionRate edge cases', () => {
    it('returns 0 when totalTasks is 0 (no division by zero)', async () => {
      taskRepo.count.mockResolvedValue(0); // all count calls return 0

      const admin  = makeAdminUser();
      const result = await service.getStats(admin);

      expect(result.completionRate).toBe(0);
    });

    it('returns 100 when all tasks are completed', async () => {
      taskRepo.count
        .mockResolvedValueOnce(20) // totalTasks
        .mockResolvedValueOnce(20) // completedTasks
        .mockResolvedValueOnce(0)  // delayedTasks
        .mockResolvedValueOnce(0); // pendingTasks

      const admin  = makeAdminUser();
      const result = await service.getStats(admin);

      expect(result.completionRate).toBe(100);
    });

    it('rounds to nearest integer', async () => {
      taskRepo.count
        .mockResolvedValueOnce(3) // totalTasks
        .mockResolvedValueOnce(1) // completedTasks (1/3 = 33.33...)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(2);

      const admin  = makeAdminUser();
      const result = await service.getStats(admin);

      expect(result.completionRate).toBe(33); // Math.round(1/3*100) = 33
    });
  });

  // ─── Financial aggregation ─────────────────────────────────────────────────

  describe('financial aggregation', () => {
    it('sums income, expenses, and computes netBalance correctly', async () => {
      expenseRepo.find
        .mockResolvedValueOnce([
          { amount: '1500.50' }, // PG returns NUMERIC as string
          { amount: '499.50' },
        ]) // income
        .mockResolvedValueOnce([
          { amount: '300.00' },
          { amount: '200.75' },
        ]); // expenses

      invoiceRepo.find.mockResolvedValue([]);

      const admin  = makeAdminUser();
      const result = await service.getStats(admin);

      expect(result.totalIncome).toBeCloseTo(2000, 2);
      expect(result.totalExpenses).toBeCloseTo(500.75, 2);
      expect(result.netBalance).toBeCloseTo(1499.25, 2);
    });

    it('handles empty expense rows as 0', async () => {
      expenseRepo.find.mockResolvedValue([]);
      invoiceRepo.find.mockResolvedValue([]);

      const admin  = makeAdminUser();
      const result = await service.getStats(admin);

      expect(result.totalIncome).toBe(0);
      expect(result.totalExpenses).toBe(0);
      expect(result.netBalance).toBe(0);
    });

    it('handles negative netBalance (expenses > income)', async () => {
      expenseRepo.find
        .mockResolvedValueOnce([{ amount: 100 }])  // income
        .mockResolvedValueOnce([{ amount: 500 }]); // expenses

      invoiceRepo.find.mockResolvedValue([]);

      const admin  = makeAdminUser();
      const result = await service.getStats(admin);

      expect(result.netBalance).toBe(-400);
    });
  });

  // ─── Outstanding invoices ─────────────────────────────────────────────────

  describe('outstanding invoices', () => {
    it('sums UNPAID + OVERDUE totals only, ignores PAID', async () => {
      expenseRepo.find.mockResolvedValue([]);

      invoiceRepo.find
        .mockResolvedValueOnce([{ total: 1000 }, { total: 500 }]) // UNPAID rows
        .mockResolvedValueOnce([{ total: 250 }]);                  // OVERDUE rows

      const admin  = makeAdminUser();
      const result = await service.getStats(admin);

      expect(result.outstandingInvoices).toBe(1750);
      expect(result.overdueInvoicesCount).toBe(1);
    });

    it('returns 0 outstanding when no unpaid or overdue invoices', async () => {
      expenseRepo.find.mockResolvedValue([]);
      invoiceRepo.find.mockResolvedValue([]);

      const admin  = makeAdminUser();
      const result = await service.getStats(admin);

      expect(result.outstandingInvoices).toBe(0);
      expect(result.overdueInvoicesCount).toBe(0);
    });

    it('handles PG NUMERIC strings for invoice totals', async () => {
      expenseRepo.find.mockResolvedValue([]);

      invoiceRepo.find
        .mockResolvedValueOnce([{ total: '3500.99' }]) // UNPAID (string from PG)
        .mockResolvedValueOnce([{ total: '250.01' }]); // OVERDUE (string from PG)

      const admin  = makeAdminUser();
      const result = await service.getStats(admin);

      expect(result.outstandingInvoices).toBeCloseTo(3751, 0);
    });

    it('invoiceRepo.find called with UNPAID and OVERDUE statuses', async () => {
      expenseRepo.find.mockResolvedValue([]);
      invoiceRepo.find.mockResolvedValue([]);

      const admin = makeAdminUser();
      await service.getStats(admin);

      const statuses = invoiceRepo.find.mock.calls.map(
        (call: any[]) => call[0]?.where?.paymentStatus,
      );
      expect(statuses).toContain(InvoicePaymentStatus.UNPAID);
      expect(statuses).toContain(InvoicePaymentStatus.OVERDUE);
    });
  });

  // ─── getFinancialChart ────────────────────────────────────────────────────

  describe('getFinancialChart', () => {
    it('returns exactly 6 months in ascending order', async () => {
      // expenseRepo.find called 12 times (2 per month × 6 months)
      expenseRepo.find.mockResolvedValue([]);

      const admin  = makeAdminUser();
      const result = await service.getFinancialChart(admin);

      expect(result).toHaveLength(6);
    });

    it('month labels are in YYYY-MM format', async () => {
      expenseRepo.find.mockResolvedValue([]);

      const admin  = makeAdminUser();
      const result = await service.getFinancialChart(admin);

      for (const entry of result) {
        expect(entry.month).toMatch(/^\d{4}-\d{2}$/);
      }
    });

    it('months are in ascending chronological order', async () => {
      expenseRepo.find.mockResolvedValue([]);

      const admin  = makeAdminUser();
      const result = await service.getFinancialChart(admin);

      for (let i = 1; i < result.length; i++) {
        expect(result[i].month >= result[i - 1].month).toBe(true);
      }
    });

    it('aggregates income and expenses per month', async () => {
      // Mock: first month income=[500], first month expenses=[200]
      // remaining 5 months empty
      expenseRepo.find
        .mockResolvedValueOnce([{ amount: 500 }]) // month 0 income
        .mockResolvedValueOnce([{ amount: 200 }]) // month 0 expenses
        .mockResolvedValue([]); // all other months

      const admin  = makeAdminUser();
      const result = await service.getFinancialChart(admin);

      expect(result[0].income).toBe(500);
      expect(result[0].expenses).toBe(200);

      // Remaining months are 0
      for (let i = 1; i < result.length; i++) {
        expect(result[i].income).toBe(0);
        expect(result[i].expenses).toBe(0);
      }
    });

    it('EMPLOYEE chart queries include ownerId filter', async () => {
      expenseRepo.find.mockResolvedValue([]);

      const emp = makeEmployeeUser();
      await service.getFinancialChart(emp);

      for (const call of expenseRepo.find.mock.calls) {
        expect(call[0]).toEqual(
          expect.objectContaining({ where: expect.objectContaining({ ownerId: 'emp-1' }) }),
        );
      }
    });

    it('ADMIN chart queries do NOT include ownerId filter', async () => {
      expenseRepo.find.mockResolvedValue([]);

      const admin = makeAdminUser();
      await service.getFinancialChart(admin);

      for (const call of expenseRepo.find.mock.calls) {
        expect((call[0]?.where as any)?.ownerId).toBeUndefined();
      }
    });
  });

  // ─── projectsByStatus ─────────────────────────────────────────────────────

  describe('projectsByStatus', () => {
    it('maps all 5 project statuses correctly', async () => {
      projectRepo.count
        .mockResolvedValueOnce(1)  // PLANNING
        .mockResolvedValueOnce(2)  // ACTIVE
        .mockResolvedValueOnce(3)  // ON_HOLD
        .mockResolvedValueOnce(4)  // COMPLETED
        .mockResolvedValueOnce(5); // CANCELLED

      const admin  = makeAdminUser();
      const result = await service.getStats(admin);

      expect(result.projectsByStatus).toEqual({
        planning:  1,
        active:    2,
        onHold:    3,
        completed: 4,
        cancelled: 5,
      });
      expect(result.activeProjects).toBe(2);
    });

    it('projectRepo.count called with correct status values', async () => {
      const admin = makeAdminUser();
      await service.getStats(admin);

      const statuses = projectRepo.count.mock.calls.map(
        (call: any[]) => call[0]?.where?.status,
      );
      expect(statuses).toContain(ProjectStatus.PLANNING);
      expect(statuses).toContain(ProjectStatus.ACTIVE);
      expect(statuses).toContain(ProjectStatus.ON_HOLD);
      expect(statuses).toContain(ProjectStatus.COMPLETED);
      expect(statuses).toContain(ProjectStatus.CANCELLED);
    });
  });

  // ─── contractsByStatus ────────────────────────────────────────────────────

  describe('contractsByStatus', () => {
    it('maps all 4 contract statuses correctly', async () => {
      contractRepo.count
        .mockResolvedValueOnce(2)  // DRAFT
        .mockResolvedValueOnce(3)  // SENT
        .mockResolvedValueOnce(7)  // SIGNED
        .mockResolvedValueOnce(1); // REJECTED

      const admin  = makeAdminUser();
      const result = await service.getStats(admin);

      expect(result.contractsByStatus).toEqual({
        draft: 2, sent: 3, signed: 7, rejected: 1,
      });
    });

    it('contractRepo.count called with correct status values', async () => {
      const admin = makeAdminUser();
      await service.getStats(admin);

      const statuses = contractRepo.count.mock.calls.map(
        (call: any[]) => call[0]?.where?.status,
      );
      expect(statuses).toContain(ContractStatus.DRAFT);
      expect(statuses).toContain(ContractStatus.SENT);
      expect(statuses).toContain(ContractStatus.SIGNED);
      expect(statuses).toContain(ContractStatus.REJECTED);
    });
  });
});
