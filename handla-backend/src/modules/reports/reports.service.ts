import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { LedgerEntry } from '../accounting/entities/ledger-entry.entity';
import { Account } from '../accounting/entities/account.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { Purchase } from '../purchases/entities/purchase.entity';
import { Project } from '../projects/entities/project.entity';
import { Ticket } from '../support/entities/ticket.entity';
import { Client } from '../clients/entities/client.entity';
import {
  AccountType,
  LedgerDirection,
  InvoicePaymentStatus,
  PurchasePaymentStatus,
  TicketStatus,
  TicketPriority,
} from '../../common/enums';
import { ReportQueryDto } from './dto/report-query.dto';

export interface DateRange {
  from: string;
  to: string;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * REP — ReportsService
 *
 * Read-only financial + operational aggregation over the accounting ledger,
 * invoices, expenses, purchases, projects, and tickets. All amounts are grouped
 * by currency (records with no currency fall under "UNSPECIFIED") because the
 * platform is multi-currency / per-record optional.
 */
@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectRepository(LedgerEntry)
    private readonly ledgerRepo: Repository<LedgerEntry>,
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(Expense)
    private readonly expenseRepo: Repository<Expense>,
    @InjectRepository(Purchase)
    private readonly purchaseRepo: Repository<Purchase>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
  ) {}

  // ─── helpers ────────────────────────────────────────────────────────────────

  /** Resolves the query date range, defaulting to the current calendar year. */
  resolveRange(query: ReportQueryDto): DateRange {
    const year = new Date().getFullYear();
    const from = query.from ?? `${year}-01-01`;
    const to = query.to ?? `${year}-12-31`;
    return { from, to };
  }

  private currencyKey(currency: string | null | undefined): string {
    return currency && currency.trim() ? currency.toUpperCase() : 'UNSPECIFIED';
  }

  /** Truncates a YYYY-MM-DD date to a period bucket key. */
  private periodKey(date: string, groupBy: 'month' | 'quarter' | 'year'): string {
    const [y, m] = date.split('-');
    if (groupBy === 'year') return y;
    if (groupBy === 'quarter') {
      const q = Math.floor((parseInt(m, 10) - 1) / 3) + 1;
      return `${y}-Q${q}`;
    }
    return `${y}-${m}`;
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  FINANCIAL — Profit & Loss (from the ledger's INCOME / EXPENSE accounts)
  // ════════════════════════════════════════════════════════════════════════════
  async profitAndLoss(query: ReportQueryDto): Promise<any> {
    const { from, to } = this.resolveRange(query);

    const qb = this.ledgerRepo
      .createQueryBuilder('l')
      .innerJoin(Account, 'a', 'a.id = l.account_id')
      .select('a.type', 'accountType')
      .addSelect('a.code', 'accountCode')
      .addSelect('a.name', 'accountName')
      .addSelect('l.currency', 'currency')
      .addSelect('SUM(l.amount)', 'total')
      .where('l.entry_date BETWEEN :from AND :to', { from, to })
      .andWhere('a.type IN (:...types)', {
        types: [AccountType.INCOME, AccountType.EXPENSE],
      })
      .groupBy('a.type')
      .addGroupBy('a.code')
      .addGroupBy('a.name')
      .addGroupBy('l.currency');

    if (query.clientId) qb.andWhere('l.client_id = :cid', { cid: query.clientId });

    const rows = await qb.getRawMany<{
      accountType: AccountType;
      accountCode: string;
      accountName: string;
      currency: string | null;
      total: string;
    }>();

    // Group by currency → { income[], expenses[], totalIncome, totalExpense, net }
    const byCurrency: Record<string, any> = {};
    for (const r of rows) {
      const cur = this.currencyKey(r.currency);
      const amount = round2(parseFloat(r.total) || 0);
      byCurrency[cur] ??= {
        currency: cur,
        income: [],
        expenses: [],
        totalIncome: 0,
        totalExpense: 0,
        netProfit: 0,
      };
      const line = { code: r.accountCode, name: r.accountName, amount };
      if (r.accountType === AccountType.INCOME) {
        byCurrency[cur].income.push(line);
        byCurrency[cur].totalIncome = round2(byCurrency[cur].totalIncome + amount);
      } else {
        byCurrency[cur].expenses.push(line);
        byCurrency[cur].totalExpense = round2(byCurrency[cur].totalExpense + amount);
      }
    }
    for (const c of Object.values<any>(byCurrency)) {
      c.netProfit = round2(c.totalIncome - c.totalExpense);
    }

    return {
      report: 'profit_and_loss',
      range: { from, to },
      clientId: query.clientId ?? null,
      currencies: Object.values(byCurrency),
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  FINANCIAL — Cash flow (ledger IN vs OUT, optionally periodized)
  // ════════════════════════════════════════════════════════════════════════════
  async cashFlow(query: ReportQueryDto): Promise<any> {
    const { from, to } = this.resolveRange(query);
    const groupBy = query.groupBy ?? 'month';

    const qb = this.ledgerRepo
      .createQueryBuilder('l')
      .select('l.entry_date', 'entryDate')
      .addSelect('l.direction', 'direction')
      .addSelect('l.currency', 'currency')
      .addSelect('l.amount', 'amount')
      .where('l.entry_date BETWEEN :from AND :to', { from, to });
    if (query.clientId) qb.andWhere('l.client_id = :cid', { cid: query.clientId });

    const rows = await qb.getRawMany<{
      entryDate: string;
      direction: LedgerDirection;
      currency: string | null;
      amount: string;
    }>();

    // period → currency → { inflow, outflow, net }
    const periods: Record<string, Record<string, any>> = {};
    const totals: Record<string, { inflow: number; outflow: number; net: number }> = {};

    for (const r of rows) {
      const dateStr =
        typeof r.entryDate === 'string'
          ? r.entryDate.slice(0, 10)
          : new Date(r.entryDate).toISOString().slice(0, 10);
      const period = this.periodKey(dateStr, groupBy);
      const cur = this.currencyKey(r.currency);
      const amount = parseFloat(r.amount) || 0;

      periods[period] ??= {};
      periods[period][cur] ??= { currency: cur, inflow: 0, outflow: 0, net: 0 };
      totals[cur] ??= { inflow: 0, outflow: 0, net: 0 };

      if (r.direction === LedgerDirection.IN) {
        periods[period][cur].inflow = round2(periods[period][cur].inflow + amount);
        totals[cur].inflow = round2(totals[cur].inflow + amount);
      } else {
        periods[period][cur].outflow = round2(periods[period][cur].outflow + amount);
        totals[cur].outflow = round2(totals[cur].outflow + amount);
      }
      periods[period][cur].net = round2(
        periods[period][cur].inflow - periods[period][cur].outflow,
      );
      totals[cur].net = round2(totals[cur].inflow - totals[cur].outflow);
    }

    const series = Object.keys(periods)
      .sort()
      .map((period) => ({
        period,
        currencies: Object.values(periods[period]),
      }));

    return {
      report: 'cash_flow',
      range: { from, to },
      groupBy,
      clientId: query.clientId ?? null,
      series,
      totals: Object.entries(totals).map(([currency, v]) => ({ currency, ...v })),
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  FINANCIAL — Tax summary (output tax on invoices vs input tax on purchases)
  // ════════════════════════════════════════════════════════════════════════════
  async taxSummary(query: ReportQueryDto): Promise<any> {
    const { from, to } = this.resolveRange(query);

    // Output tax — tax charged on issued invoices (by paid date if paid, else all).
    const invQb = this.invoiceRepo
      .createQueryBuilder('i')
      .select('i.currency', 'currency')
      .addSelect('SUM(i.tax_amount)', 'taxAmount')
      .addSelect('SUM(i.subtotal)', 'taxable')
      .where('i.created_at BETWEEN :from AND :to', {
        from: `${from} 00:00:00`,
        to: `${to} 23:59:59`,
      })
      .groupBy('i.currency');
    if (query.clientId) invQb.andWhere('i.client_id = :cid', { cid: query.clientId });
    const invRows = await invQb.getRawMany<{
      currency: string | null;
      taxAmount: string;
      taxable: string;
    }>();

    // Input tax — tax paid on purchases.
    const purQb = this.purchaseRepo
      .createQueryBuilder('p')
      .select('p.currency', 'currency')
      .addSelect('SUM(p.tax_amount)', 'taxAmount')
      .addSelect('SUM(p.subtotal)', 'taxable')
      .where('p.created_at BETWEEN :from AND :to', {
        from: `${from} 00:00:00`,
        to: `${to} 23:59:59`,
      })
      .groupBy('p.currency');
    const purRows = await purQb.getRawMany<{
      currency: string | null;
      taxAmount: string;
      taxable: string;
    }>();

    const byCurrency: Record<string, any> = {};
    for (const r of invRows) {
      const cur = this.currencyKey(r.currency);
      byCurrency[cur] ??= {
        currency: cur,
        outputTax: 0,
        outputTaxable: 0,
        inputTax: 0,
        inputTaxable: 0,
        netTaxPayable: 0,
      };
      byCurrency[cur].outputTax = round2(parseFloat(r.taxAmount) || 0);
      byCurrency[cur].outputTaxable = round2(parseFloat(r.taxable) || 0);
    }
    for (const r of purRows) {
      const cur = this.currencyKey(r.currency);
      byCurrency[cur] ??= {
        currency: cur,
        outputTax: 0,
        outputTaxable: 0,
        inputTax: 0,
        inputTaxable: 0,
        netTaxPayable: 0,
      };
      byCurrency[cur].inputTax = round2(parseFloat(r.taxAmount) || 0);
      byCurrency[cur].inputTaxable = round2(parseFloat(r.taxable) || 0);
    }
    for (const c of Object.values<any>(byCurrency)) {
      c.netTaxPayable = round2(c.outputTax - c.inputTax);
    }

    return {
      report: 'tax_summary',
      range: { from, to },
      clientId: query.clientId ?? null,
      currencies: Object.values(byCurrency),
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  FINANCIAL — Accounts Receivable aging (unpaid/overdue invoices)
  // ════════════════════════════════════════════════════════════════════════════
  async arAging(query: ReportQueryDto): Promise<any> {
    const qb = this.invoiceRepo
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.client', 'client')
      .leftJoinAndSelect('client.user', 'clientUser')
      .where('i.payment_status IN (:...statuses)', {
        statuses: [InvoicePaymentStatus.UNPAID, InvoicePaymentStatus.OVERDUE],
      });
    if (query.clientId) qb.andWhere('i.client_id = :cid', { cid: query.clientId });
    const invoices = await qb.getMany();

    return this.buildAging(
      invoices.map((i) => ({
        id: i.id,
        number: i.invoiceNumber,
        party: (i as any).client?.user?.name ?? (i as any).client?.company ?? null,
        dueDate: i.dueDate,
        amount: Number(i.total),
        currency: i.currency,
      })),
      'ar_aging',
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  FINANCIAL — Accounts Payable aging (unpaid/overdue purchases)
  // ════════════════════════════════════════════════════════════════════════════
  async apAging(query: ReportQueryDto): Promise<any> {
    const qb = this.purchaseRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.supplier', 'supplier')
      .where('p.payment_status IN (:...statuses)', {
        statuses: [PurchasePaymentStatus.UNPAID, PurchasePaymentStatus.OVERDUE],
      });
    const purchases = await qb.getMany();

    return this.buildAging(
      purchases.map((p) => ({
        id: p.id,
        number: p.purchaseNumber,
        party: (p as any).supplier?.name ?? null,
        dueDate: p.dueDate,
        amount: Number(p.total),
        currency: p.currency,
      })),
      'ap_aging',
    );
  }

  /** Shared aging-bucket builder (Current, 1-30, 31-60, 61-90, 90+). */
  private buildAging(
    items: Array<{
      id: string;
      number: string;
      party: string | null;
      dueDate: string | null;
      amount: number;
      currency: string | null;
    }>,
    reportName: string,
  ): any {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const bucketOf = (dueDate: string | null): string => {
      if (!dueDate) return 'current';
      const due = new Date(dueDate);
      due.setHours(0, 0, 0, 0);
      const days = Math.floor((today.getTime() - due.getTime()) / 86_400_000);
      if (days <= 0) return 'current';
      if (days <= 30) return 'd1_30';
      if (days <= 60) return 'd31_60';
      if (days <= 90) return 'd61_90';
      return 'd90_plus';
    };

    const emptyBuckets = () => ({
      current: 0,
      d1_30: 0,
      d31_60: 0,
      d61_90: 0,
      d90_plus: 0,
      total: 0,
    });

    const byCurrency: Record<string, any> = {};
    const detail: any[] = [];

    for (const it of items) {
      const cur = this.currencyKey(it.currency);
      const bucket = bucketOf(it.dueDate);
      byCurrency[cur] ??= { currency: cur, ...emptyBuckets() };
      const amt = round2(it.amount || 0);
      byCurrency[cur][bucket] = round2(byCurrency[cur][bucket] + amt);
      byCurrency[cur].total = round2(byCurrency[cur].total + amt);
      detail.push({
        id: it.id,
        number: it.number,
        party: it.party,
        dueDate: it.dueDate,
        amount: amt,
        currency: cur,
        bucket,
      });
    }

    return {
      report: reportName,
      buckets: ['current', 'd1_30', 'd31_60', 'd61_90', 'd90_plus'],
      currencies: Object.values(byCurrency),
      detail,
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  OPERATIONAL — Revenue by client (paid invoices)
  // ════════════════════════════════════════════════════════════════════════════
  async revenueByClient(query: ReportQueryDto): Promise<any> {
    const { from, to } = this.resolveRange(query);

    const qb = this.invoiceRepo
      .createQueryBuilder('i')
      .leftJoin('i.client', 'client')
      .leftJoin('client.user', 'clientUser')
      .select('i.client_id', 'clientId')
      .addSelect('clientUser.name', 'clientName')
      .addSelect('client.company', 'company')
      .addSelect('i.currency', 'currency')
      .addSelect('SUM(i.total)', 'revenue')
      .addSelect('COUNT(i.id)', 'invoiceCount')
      .where('i.payment_status = :paid', { paid: InvoicePaymentStatus.PAID })
      .andWhere('i.paid_at BETWEEN :from AND :to', {
        from: `${from} 00:00:00`,
        to: `${to} 23:59:59`,
      })
      .groupBy('i.client_id')
      .addGroupBy('clientUser.name')
      .addGroupBy('client.company')
      .addGroupBy('i.currency')
      .orderBy('revenue', 'DESC');
    if (query.clientId) qb.andWhere('i.client_id = :cid', { cid: query.clientId });

    const rows = await qb.getRawMany<{
      clientId: string;
      clientName: string | null;
      company: string | null;
      currency: string | null;
      revenue: string;
      invoiceCount: string;
    }>();

    return {
      report: 'revenue_by_client',
      range: { from, to },
      rows: rows.map((r) => ({
        clientId: r.clientId,
        clientName: r.clientName ?? r.company ?? null,
        currency: this.currencyKey(r.currency),
        revenue: round2(parseFloat(r.revenue) || 0),
        invoiceCount: parseInt(r.invoiceCount, 10) || 0,
      })),
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  OPERATIONAL — Projects status breakdown
  // ════════════════════════════════════════════════════════════════════════════
  async projectsStatus(query: ReportQueryDto): Promise<any> {
    const qb = this.projectRepo
      .createQueryBuilder('p')
      .select('p.status', 'status')
      .addSelect('COUNT(p.id)', 'count')
      .groupBy('p.status');
    if (query.clientId) qb.andWhere('p.client_id = :cid', { cid: query.clientId });
    const rows = await qb.getRawMany<{ status: string; count: string }>();

    const byStatus: Record<string, number> = {};
    let total = 0;
    for (const r of rows) {
      const c = parseInt(r.count, 10) || 0;
      byStatus[r.status] = c;
      total += c;
    }
    return {
      report: 'projects_status',
      clientId: query.clientId ?? null,
      total,
      byStatus,
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  OPERATIONAL — Support statistics
  // ════════════════════════════════════════════════════════════════════════════
  async supportStats(query: ReportQueryDto): Promise<any> {
    const { from, to } = this.resolveRange(query);

    const qb = this.ticketRepo
      .createQueryBuilder('t')
      .where('t.created_at BETWEEN :from AND :to', {
        from: `${from} 00:00:00`,
        to: `${to} 23:59:59`,
      });
    if (query.clientId) qb.andWhere('t.client_id = :cid', { cid: query.clientId });
    const tickets = await qb.getMany();

    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    let open = 0;
    let resolved = 0;
    let slaBreached = 0;
    let resolutionMsSum = 0;
    let resolutionCount = 0;
    const now = Date.now();

    for (const t of tickets) {
      byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
      byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1;
      byCategory[t.category] = (byCategory[t.category] ?? 0) + 1;

      const isOpen =
        t.status !== TicketStatus.RESOLVED && t.status !== TicketStatus.CLOSED;
      if (isOpen) open += 1;

      if (t.resolvedAt) {
        resolved += 1;
        resolutionMsSum +=
          new Date(t.resolvedAt).getTime() - new Date(t.createdAt).getTime();
        resolutionCount += 1;
      }

      // SLA breach (open + past a due date without response/resolution).
      if (isOpen) {
        const respBreached =
          !t.firstRespondedAt &&
          t.firstResponseDueAt &&
          new Date(t.firstResponseDueAt).getTime() < now;
        const resBreached =
          t.resolveDueAt && new Date(t.resolveDueAt).getTime() < now;
        if (respBreached || resBreached) slaBreached += 1;
      }
    }

    const avgResolutionHours =
      resolutionCount > 0
        ? round2(resolutionMsSum / resolutionCount / 3_600_000)
        : null;

    return {
      report: 'support_stats',
      range: { from, to },
      clientId: query.clientId ?? null,
      total: tickets.length,
      open,
      resolved,
      slaBreached,
      avgResolutionHours,
      byStatus,
      byPriority,
      byCategory,
    };
  }
}
