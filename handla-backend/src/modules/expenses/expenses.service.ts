import { Injectable, Logger, HttpStatus, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';

import { Expense } from './entities/expense.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { User } from '../auth/entities/user.entity';
import {
  ExpenseType,
  InvoicePaymentStatus,
  UserRole,
  LedgerDirection,
  LedgerSourceType,
} from '../../common/enums';
import { AccountingService } from '../accounting/accounting.service';
import { AccountingSeeder } from '../accounting/accounting.seeder';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpensesQueryDto } from './dto/expenses-query.dto';
import { FinancialSummaryDto } from './dto/financial-summary.dto';
import {
  ResourceNotFoundException,
  OwnershipViolationException,
  InsufficientPermissionsException,
  AppException,
} from '../../utils/exceptions';

export interface PaginatedExpenses {
  expenses: Expense[];
  total: number;
  page: number;
  pages: number;
}

/**
 * ERP-8 — ExpensesService
 *
 * Manual bookkeeping for income and expense entries.
 * Auto-income entries are created via createFromPaidInvoice() (called by InvoicesService.markAsPaid).
 *
 * Rules:
 *  - invoice-linked entries (invoiceId IS NOT NULL) are read-only
 *  - EMPLOYEE sees only own entries; ADMIN sees all
 *  - remove() is ADMIN-only and blocked on invoice-linked entries
 *
 * Circular dependency (ERP-8.5):
 *   InvoicesModule imports ExpensesModule with forwardRef().
 *   InvoicesService injects ExpensesService via @Inject(forwardRef(() => ExpensesService)).
 */
@Injectable()
export class ExpensesService {
  private readonly logger = new Logger(ExpensesService.name);

  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepo: Repository<Expense>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    private readonly accountingService: AccountingService,
  ) {}

  /**
   * Posts an expense/income row to the unified accounting ledger.
   * Idempotent on (EXPENSE, expense.id). Fire-and-forget safe.
   */
  private async postToLedger(
    expense: Expense,
    opts: { clientId?: string | null } = {},
  ): Promise<void> {
    try {
      const isIncome = expense.type === ExpenseType.INCOME;
      const accountCode = isIncome
        ? AccountingSeeder.CODE_SERVICES_INCOME
        : AccountingSeeder.CODE_OTHER_EXPENSE;
      await this.accountingService.record({
        entryDate: expense.expenseDate,
        accountCode,
        clientId: opts.clientId ?? null,
        direction: isIncome ? LedgerDirection.IN : LedgerDirection.OUT,
        amount: Number(expense.amount),
        currency: expense.currency ?? null,
        sourceType: LedgerSourceType.EXPENSE,
        sourceId: expense.id,
        description: expense.description ?? expense.category,
        ownerId: expense.ownerId,
      });
    } catch (err) {
      this.logger.warn(`postToLedger failed for expense ${expense.id}: ${(err as Error).message}`);
    }
  }

  // ─── findAll ──────────────────────────────────────────────────────────────

  async findAll(user: User, query: ExpensesQueryDto): Promise<PaginatedExpenses> {
    const page  = Math.max(1, query.page  ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip  = (page - 1) * limit;

    const qb = this.expenseRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.owner', 'owner')
      .leftJoinAndSelect('e.invoice', 'invoice')
      .orderBy('e.expenseDate', 'DESC')
      .addOrderBy('e.createdAt', 'DESC');

    // Role scope
    if (user.role === UserRole.EMPLOYEE) {
      qb.andWhere('e.owner_id = :uid', { uid: user.id });
    } else if (query.ownerId) {
      qb.andWhere('e.owner_id = :uid', { uid: query.ownerId });
    }

    if (query.type)     qb.andWhere('e.type = :type', { type: query.type });
    if (query.category) qb.andWhere('e.category LIKE :cat', { cat: `%${query.category}%` });
    if (query.dateFrom) qb.andWhere('e.expense_date >= :from', { from: query.dateFrom });
    if (query.dateTo)   qb.andWhere('e.expense_date <= :to', { to: query.dateTo });

    if (query.excludeInvoiceLinked) {
      qb.andWhere('e.invoice_id IS NULL');
    }

    const [expenses, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return { expenses, total, page, pages: Math.ceil(total / limit) };
  }

  // ─── findOne ──────────────────────────────────────────────────────────────

  async findOne(id: string, user: User): Promise<Expense> {
    const expense = await this.expenseRepo.findOne({
      where: { id },
      relations: ['owner', 'invoice'],
    });

    if (!expense) {
      throw new ResourceNotFoundException('Expense', id);
    }

    if (
      user.role === UserRole.EMPLOYEE &&
      expense.ownerId !== user.id
    ) {
      throw new OwnershipViolationException();
    }

    return expense;
  }

  // ─── create ───────────────────────────────────────────────────────────────

  async create(dto: CreateExpenseDto, actingUser: User): Promise<Expense> {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const expense = this.expenseRepo.create({
      type:        dto.type,
      category:    dto.category,
      amount:      dto.amount,
      currency:    'USD',
      description: dto.description ?? null,
      expenseDate: dto.expenseDate ?? today,
      invoiceId:   null, // API never sets invoiceId — auto only
      ownerId:     actingUser.id,
    });

    const saved = await this.expenseRepo.save(expense);

    this.logger.log(
      `Expense created: ${saved.id} type=${saved.type} amount=${saved.amount} by=${actingUser.id}`,
    );

    // Post to the unified accounting ledger (manual entries have no client)
    void this.postToLedger(saved, { clientId: null });

    return saved;
  }

  // ─── createFromPaidInvoice ────────────────────────────────────────────────
  /**
   * Internal method — called by InvoicesService.markAsPaid().
   * Creates an INCOME entry linked to the paid invoice.
   * Idempotent: checks invoiceId uniqueness before creating.
   */
  async createFromPaidInvoice(invoice: Invoice, ownerId: string): Promise<Expense | null> {
    // Idempotency check: skip if entry already exists for this invoice
    const existing = await this.expenseRepo.findOne({
      where: { invoiceId: invoice.id },
    });
    if (existing) {
      this.logger.warn(
        `createFromPaidInvoice: income entry already exists for invoice ${invoice.invoiceNumber} — skipping`,
      );
      return null;
    }

    const today = new Date().toISOString().slice(0, 10);

    const expense = this.expenseRepo.create({
      type:        ExpenseType.INCOME,
      category:    'Invoice Payment',
      amount:      Number(invoice.total),
      currency:    invoice.currency ?? 'USD',
      description: `Auto-income: ${invoice.invoiceNumber}`,
      expenseDate: today,
      invoiceId:   invoice.id,
      ownerId:     ownerId,
    });

    const saved = await this.expenseRepo.save(expense);

    this.logger.log(
      `Auto-income created: ${saved.id} for invoice ${invoice.invoiceNumber} amount=${saved.amount}`,
    );

    // Post income to the unified ledger, tagged with the invoice's client so it
    // appears in that client's statement.
    void this.postToLedger(saved, { clientId: invoice.clientId ?? null });

    return saved;
  }

  // ─── update ───────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateExpenseDto, user: User): Promise<Expense> {
    const expense = await this.findOne(id, user);

    // Invoice-linked entries are read-only
    if (expense.invoiceId !== null) {
      throw new AppException(
        'Cannot edit auto-generated income entries.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    // EMPLOYEE can only update own
    if (user.role === UserRole.EMPLOYEE && expense.ownerId !== user.id) {
      throw new OwnershipViolationException();
    }

    if (dto.type        !== undefined) expense.type        = dto.type;
    if (dto.category    !== undefined) expense.category    = dto.category;
    if (dto.amount      !== undefined) expense.amount      = dto.amount;
    if (dto.description !== undefined) expense.description = dto.description ?? null;
    if (dto.expenseDate !== undefined) expense.expenseDate = dto.expenseDate;

    return this.expenseRepo.save(expense);
  }

  // ─── remove ───────────────────────────────────────────────────────────────

  async remove(id: string, user: User): Promise<void> {
    if (user.role !== UserRole.ADMIN) {
      throw new InsufficientPermissionsException();
    }

    const expense = await this.expenseRepo.findOne({ where: { id } });
    if (!expense) {
      throw new ResourceNotFoundException('Expense', id);
    }

    if (expense.invoiceId !== null) {
      throw new AppException(
        'Cannot delete auto-generated income entries.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    await this.expenseRepo.remove(expense);
    this.logger.log(`Expense deleted: ${id} by ADMIN ${user.id}`);
  }

  // ─── getFinancialSummary ──────────────────────────────────────────────────

  async getFinancialSummary(
    user: User,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<FinancialSummaryDto> {
    // ── expense aggregates ─────────────────────────────────────────────────
    const expQb = this.expenseRepo.createQueryBuilder('e');

    if (user.role === UserRole.EMPLOYEE) {
      expQb.andWhere('e.owner_id = :uid', { uid: user.id });
    }
    if (dateFrom) expQb.andWhere('e.expense_date >= :from', { from: dateFrom });
    if (dateTo)   expQb.andWhere('e.expense_date <= :to',   { to:   dateTo   });

    const [incomeRow, expenseRow, manualIncomeRow] = await Promise.all([
      expQb.clone()
        .select('COALESCE(SUM(CAST(e.amount AS DECIMAL(15,2))), 0)', 'sum')
        .andWhere('e.type = :t', { t: ExpenseType.INCOME })
        .getRawOne<{ sum: string }>(),

      expQb.clone()
        .select('COALESCE(SUM(CAST(e.amount AS DECIMAL(15,2))), 0)', 'sum')
        .andWhere('e.type = :t', { t: ExpenseType.EXPENSE })
        .getRawOne<{ sum: string }>(),

      expQb.clone()
        .select('COALESCE(SUM(CAST(e.amount AS DECIMAL(15,2))), 0)', 'sum')
        .andWhere('e.type = :t', { t: ExpenseType.INCOME })
        .andWhere('e.invoice_id IS NULL')
        .getRawOne<{ sum: string }>(),
    ]);

    const totalIncome   = parseFloat(incomeRow?.sum   ?? '0');
    const totalExpenses = parseFloat(expenseRow?.sum  ?? '0');
    const manualIncome  = parseFloat(manualIncomeRow?.sum ?? '0');

    // ── invoice aggregates ─────────────────────────────────────────────────
    // paidInvoicesIncome: scoped by date (paidAt), ALL clients/owners for simplicity
    const invQb = this.invoiceRepo.createQueryBuilder('inv');

    if (user.role === UserRole.EMPLOYEE) {
      invQb.andWhere('inv.owner_id = :uid', { uid: user.id });
    }

    const paidQb = invQb.clone()
      .select('COALESCE(SUM(CAST(inv.total AS DECIMAL(15,2))), 0)', 'sum')
      .andWhere('inv.payment_status = :ps', { ps: InvoicePaymentStatus.PAID });
    if (dateFrom) paidQb.andWhere('inv.paid_at >= :from', { from: dateFrom });
    if (dateTo)   paidQb.andWhere('inv.paid_at <= :to',   { to:   dateTo   });
    const paidRow = await paidQb.getRawOne<{ sum: string }>();

    const outstandingRow = await this.invoiceRepo
      .createQueryBuilder('inv')
      .select('COALESCE(SUM(CAST(inv.total AS DECIMAL(15,2))), 0)', 'sum')
      .where('inv.payment_status IN (:...statuses)', {
        statuses: [InvoicePaymentStatus.UNPAID, InvoicePaymentStatus.OVERDUE],
      })
      .getRawOne<{ sum: string }>();

    const paidInvoicesIncome  = parseFloat(paidRow?.sum        ?? '0');
    const outstandingInvoices = parseFloat(outstandingRow?.sum ?? '0');

    return {
      totalIncome:        +totalIncome.toFixed(2),
      totalExpenses:      +totalExpenses.toFixed(2),
      netBalance:         +(totalIncome - totalExpenses).toFixed(2),
      paidInvoicesIncome: +paidInvoicesIncome.toFixed(2),
      manualIncome:       +manualIncome.toFixed(2),
      outstandingInvoices:+outstandingInvoices.toFixed(2),
      periodFrom:         dateFrom,
      periodTo:           dateTo,
    };
  }
}
