import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { ReportsService } from '../reports.service';
import { LedgerEntry } from '../../accounting/entities/ledger-entry.entity';
import { Account } from '../../accounting/entities/account.entity';
import { Invoice } from '../../invoices/entities/invoice.entity';
import { Expense } from '../../expenses/entities/expense.entity';
import { Purchase } from '../../purchases/entities/purchase.entity';
import { Project } from '../../projects/entities/project.entity';
import { Ticket } from '../../support/entities/ticket.entity';
import { Client } from '../../clients/entities/client.entity';
import {
  AccountType,
  LedgerDirection,
  InvoicePaymentStatus,
  PurchasePaymentStatus,
  TicketStatus,
  TicketPriority,
  TicketCategory,
} from '../../../common/enums';

/** A chainable query-builder mock whose terminal getters resolve to `data`. */
function qbReturning(data: { raw?: any[]; entities?: any[] }) {
  const qb: any = {
    innerJoin: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(data.raw ?? []),
    getMany: jest.fn().mockResolvedValue(data.entities ?? []),
  };
  return qb;
}

function repoWithQb(data: { raw?: any[]; entities?: any[] }) {
  return { createQueryBuilder: jest.fn(() => qbReturning(data)) };
}

describe('ReportsService', () => {
  async function build(repos: Record<string, any>): Promise<ReportsService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: getRepositoryToken(LedgerEntry), useValue: repos.ledger ?? repoWithQb({}) },
        { provide: getRepositoryToken(Account), useValue: repos.account ?? repoWithQb({}) },
        { provide: getRepositoryToken(Invoice), useValue: repos.invoice ?? repoWithQb({}) },
        { provide: getRepositoryToken(Expense), useValue: repos.expense ?? repoWithQb({}) },
        { provide: getRepositoryToken(Purchase), useValue: repos.purchase ?? repoWithQb({}) },
        { provide: getRepositoryToken(Project), useValue: repos.project ?? repoWithQb({}) },
        { provide: getRepositoryToken(Ticket), useValue: repos.ticket ?? repoWithQb({}) },
        { provide: getRepositoryToken(Client), useValue: repos.client ?? repoWithQb({}) },
      ],
    }).compile();
    return module.get(ReportsService);
  }

  describe('resolveRange', () => {
    it('defaults to the current calendar year', async () => {
      const service = await build({});
      const year = new Date().getFullYear();
      expect(service.resolveRange({})).toEqual({
        from: `${year}-01-01`,
        to: `${year}-12-31`,
      });
    });

    it('honours provided from/to', async () => {
      const service = await build({});
      expect(service.resolveRange({ from: '2025-03-01', to: '2025-03-31' })).toEqual({
        from: '2025-03-01',
        to: '2025-03-31',
      });
    });
  });

  describe('profitAndLoss', () => {
    it('splits income vs expense per currency and computes net', async () => {
      const ledger = repoWithQb({
        raw: [
          { accountType: AccountType.INCOME, accountCode: '4000', accountName: 'Services', currency: 'USD', total: '1000.00' },
          { accountType: AccountType.EXPENSE, accountCode: '5200', accountName: 'Software', currency: 'USD', total: '300.00' },
          { accountType: AccountType.INCOME, accountCode: '4000', accountName: 'Services', currency: 'EUR', total: '500.00' },
        ],
      });
      const service = await build({ ledger });
      const result = await service.profitAndLoss({});

      const usd = result.currencies.find((c: any) => c.currency === 'USD');
      expect(usd.totalIncome).toBe(1000);
      expect(usd.totalExpense).toBe(300);
      expect(usd.netProfit).toBe(700);
      const eur = result.currencies.find((c: any) => c.currency === 'EUR');
      expect(eur.netProfit).toBe(500);
    });
  });

  describe('cashFlow', () => {
    it('buckets inflow/outflow by month and totals per currency', async () => {
      const ledger = repoWithQb({
        raw: [
          { entryDate: '2026-01-10', direction: LedgerDirection.IN, currency: 'USD', amount: '100' },
          { entryDate: '2026-01-20', direction: LedgerDirection.OUT, currency: 'USD', amount: '40' },
          { entryDate: '2026-02-05', direction: LedgerDirection.IN, currency: 'USD', amount: '60' },
        ],
      });
      const service = await build({ ledger });
      const result = await service.cashFlow({ from: '2026-01-01', to: '2026-02-28', groupBy: 'month' });

      expect(result.series).toHaveLength(2);
      const jan = result.series.find((s: any) => s.period === '2026-01').currencies[0];
      expect(jan.inflow).toBe(100);
      expect(jan.outflow).toBe(40);
      expect(jan.net).toBe(60);
      const totalUsd = result.totals.find((t: any) => t.currency === 'USD');
      expect(totalUsd.inflow).toBe(160);
      expect(totalUsd.net).toBe(120);
    });
  });

  describe('taxSummary', () => {
    it('computes net tax payable = output - input', async () => {
      const invoice = repoWithQb({ raw: [{ currency: 'USD', taxAmount: '150', taxable: '1000' }] });
      const purchase = repoWithQb({ raw: [{ currency: 'USD', taxAmount: '40', taxable: '400' }] });
      const service = await build({ invoice, purchase });
      const result = await service.taxSummary({});
      const usd = result.currencies.find((c: any) => c.currency === 'USD');
      expect(usd.outputTax).toBe(150);
      expect(usd.inputTax).toBe(40);
      expect(usd.netTaxPayable).toBe(110);
    });
  });

  describe('arAging', () => {
    it('buckets invoices by days overdue', async () => {
      const today = new Date();
      const daysAgo = (n: number) => {
        const d = new Date(today);
        d.setDate(d.getDate() - n);
        return d.toISOString().slice(0, 10);
      };
      const invoice = repoWithQb({
        entities: [
          { id: 'i1', invoiceNumber: 'INV-1', dueDate: daysAgo(0), total: 100, currency: 'USD', client: { user: { name: 'A' } } },
          { id: 'i2', invoiceNumber: 'INV-2', dueDate: daysAgo(15), total: 50, currency: 'USD', client: { user: { name: 'B' } } },
          { id: 'i3', invoiceNumber: 'INV-3', dueDate: daysAgo(120), total: 25, currency: 'USD', client: { company: 'C Inc' } },
        ],
      });
      const service = await build({ invoice });
      const result = await service.arAging({});
      const usd = result.currencies.find((c: any) => c.currency === 'USD');
      expect(usd.current).toBe(100);
      expect(usd.d1_30).toBe(50);
      expect(usd.d90_plus).toBe(25);
      expect(usd.total).toBe(175);
      expect(result.detail).toHaveLength(3);
    });
  });

  describe('apAging', () => {
    it('uses UNPAID/OVERDUE purchases and supplier name', async () => {
      const purchase = repoWithQb({
        entities: [
          { id: 'p1', purchaseNumber: 'PO-1', dueDate: null, total: 200, currency: 'EUR', supplier: { name: 'Vendor' } },
        ],
      });
      const service = await build({ purchase });
      const result = await service.apAging({});
      expect(result.report).toBe('ap_aging');
      const eur = result.currencies.find((c: any) => c.currency === 'EUR');
      expect(eur.current).toBe(200);
      expect(result.detail[0].party).toBe('Vendor');
    });
  });

  describe('revenueByClient', () => {
    it('maps raw rows to revenue rows', async () => {
      const invoice = repoWithQb({
        raw: [
          { clientId: 'c1', clientName: 'Acme', company: 'Acme Inc', currency: 'USD', revenue: '900', invoiceCount: '3' },
        ],
      });
      const service = await build({ invoice });
      const result = await service.revenueByClient({});
      expect(result.rows[0]).toEqual({
        clientId: 'c1',
        clientName: 'Acme',
        currency: 'USD',
        revenue: 900,
        invoiceCount: 3,
      });
    });
  });

  describe('projectsStatus', () => {
    it('aggregates counts by status with a total', async () => {
      const project = repoWithQb({
        raw: [
          { status: 'ACTIVE', count: '4' },
          { status: 'COMPLETED', count: '2' },
        ],
      });
      const service = await build({ project });
      const result = await service.projectsStatus({});
      expect(result.total).toBe(6);
      expect(result.byStatus.ACTIVE).toBe(4);
    });
  });

  describe('supportStats', () => {
    it('counts by status/priority/category, open, resolved, avg resolution', async () => {
      const created = new Date('2026-01-01T00:00:00Z');
      const resolved = new Date('2026-01-01T04:00:00Z'); // 4h
      const ticket = repoWithQb({
        entities: [
          {
            status: TicketStatus.RESOLVED,
            priority: TicketPriority.HIGH,
            category: TicketCategory.BUG,
            createdAt: created,
            resolvedAt: resolved,
            firstRespondedAt: created,
            firstResponseDueAt: null,
            resolveDueAt: null,
          },
          {
            status: TicketStatus.OPEN,
            priority: TicketPriority.LOW,
            category: TicketCategory.QUESTION,
            createdAt: created,
            resolvedAt: null,
            firstRespondedAt: null,
            firstResponseDueAt: new Date('2000-01-01'), // long overdue → breach
            resolveDueAt: null,
          },
        ],
      });
      const service = await build({ ticket });
      const result = await service.supportStats({});
      expect(result.total).toBe(2);
      expect(result.open).toBe(1);
      expect(result.resolved).toBe(1);
      expect(result.slaBreached).toBe(1);
      expect(result.avgResolutionHours).toBe(4);
      expect(result.byPriority[TicketPriority.HIGH]).toBe(1);
    });
  });
});
