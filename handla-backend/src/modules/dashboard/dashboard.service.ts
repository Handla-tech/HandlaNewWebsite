import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';

import { User }     from '../auth/entities/user.entity';
import { Client }   from '../clients/entities/client.entity';
import { Project }  from '../projects/entities/project.entity';
import { Task }     from '../tasks/entities/task.entity';
import { Contract } from '../contracts/entities/contract.entity';
import { Invoice }  from '../invoices/entities/invoice.entity';
import { Expense }  from '../expenses/entities/expense.entity';

import {
  UserRole,
  ProjectStatus,
  TaskStatus,
  ContractStatus,
  InvoicePaymentStatus,
  ExpenseType,
} from '../../common/enums';

// ─── Response DTOs ────────────────────────────────────────────────────────────

export interface ProjectsByStatus {
  planning:  number;
  active:    number;
  onHold:    number;
  completed: number;
  cancelled: number;
}

export interface ContractsByStatus {
  draft:    number;
  sent:     number;
  signed:   number;
  rejected: number;
}

export interface DashboardStats {
  // Lead / Client
  totalLeads:           number;
  totalClients:         number;
  newLeadsThisMonth:    number;
  newClientsThisMonth:  number;
  // Projects
  activeProjects:     number;
  projectsByStatus:   ProjectsByStatus;
  // Tasks
  totalTasks:         number;
  completedTasks:     number;
  completionRate:     number;   // 0–100 rounded integer
  delayedTasks:       number;
  pendingTasks:       number;
  // Financial (current month)
  totalIncome:            number;
  totalExpenses:          number;
  netBalance:             number;
  outstandingInvoices:    number;
  overdueInvoicesCount:   number;
  // Contracts
  contractsByStatus: ContractsByStatus;
}

export interface FinancialChartMonth {
  month:    string; // 'YYYY-MM'
  income:   number;
  expenses: number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(User)     private readonly userRepo:     Repository<User>,
    @InjectRepository(Client)   private readonly clientRepo:   Repository<Client>,
    @InjectRepository(Project)  private readonly projectRepo:  Repository<Project>,
    @InjectRepository(Task)     private readonly taskRepo:     Repository<Task>,
    @InjectRepository(Contract) private readonly contractRepo: Repository<Contract>,
    @InjectRepository(Invoice)  private readonly invoiceRepo:  Repository<Invoice>,
    @InjectRepository(Expense)  private readonly expenseRepo:  Repository<Expense>,
  ) {}

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /** Returns the first and last instant of the current calendar month (UTC). */
  private currentMonthRange(): { start: Date; end: Date } {
    const now   = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    return { start, end };
  }

  /** Sums a numeric column from an array of entities (handles string-typed NUMERIC from PG). */
  private sum(rows: { amount?: number | string; total?: number | string }[], field: 'amount' | 'total' = 'amount'): number {
    return rows.reduce((acc, r) => acc + parseFloat(String((r as any)[field] ?? 0)), 0);
  }

  // ─── getStats ─────────────────────────────────────────────────────────────

  async getStats(user: User): Promise<DashboardStats> {
    const isAdmin = user.role === UserRole.ADMIN;
    const ownerId = user.id;
    const { start: monthStart, end: monthEnd } = this.currentMonthRange();

    // ── Lead / Client ──────────────────────────────────────────────────────

    const totalLeads = isAdmin
      ? await this.userRepo.count({ where: { role: UserRole.LEAD } })
      : 0; // employees don't own raw users — leads not scoped to them here

    const totalClients = isAdmin
      ? await this.clientRepo.count()
      : await this.clientRepo.count({ where: { ownerId } });

    const newLeadsThisMonth = isAdmin
      ? await this.userRepo.count({
          where: {
            role:      UserRole.LEAD,
            createdAt: Between(monthStart, monthEnd),
          },
        })
      : 0;

    const newClientsThisMonth = isAdmin
      ? await this.clientRepo.count({
          where: { createdAt: Between(monthStart, monthEnd) },
        })
      : await this.clientRepo.count({
          where: { ownerId, createdAt: Between(monthStart, monthEnd) },
        });

    // ── Projects ───────────────────────────────────────────────────────────

    const projectWhere = isAdmin ? {} : { ownerId };

    const [planning, active, onHold, completed, cancelled] = await Promise.all([
      this.projectRepo.count({ where: { ...projectWhere, status: ProjectStatus.PLANNING   } }),
      this.projectRepo.count({ where: { ...projectWhere, status: ProjectStatus.ACTIVE     } }),
      this.projectRepo.count({ where: { ...projectWhere, status: ProjectStatus.ON_HOLD    } }),
      this.projectRepo.count({ where: { ...projectWhere, status: ProjectStatus.COMPLETED  } }),
      this.projectRepo.count({ where: { ...projectWhere, status: ProjectStatus.CANCELLED  } }),
    ]);

    const projectsByStatus: ProjectsByStatus = { planning, active, onHold, completed, cancelled };
    const activeProjects = active;

    // ── Tasks ──────────────────────────────────────────────────────────────

    const taskWhere = isAdmin ? {} : { ownerId };

    const [totalTasks, completedTasks, delayedTasks, pendingTasks] = await Promise.all([
      this.taskRepo.count({ where: taskWhere }),
      this.taskRepo.count({ where: { ...taskWhere, status: TaskStatus.COMPLETED  } }),
      this.taskRepo.count({ where: { ...taskWhere, status: TaskStatus.DELAYED    } }),
      this.taskRepo.count({ where: { ...taskWhere, status: TaskStatus.PENDING    } }),
    ]);

    const completionRate = totalTasks === 0
      ? 0
      : Math.round((completedTasks / totalTasks) * 100);

    // ── Financial ──────────────────────────────────────────────────────────

    const expenseWhere = isAdmin
      ? { expenseDate: Between(monthStart.toISOString().slice(0, 10), monthEnd.toISOString().slice(0, 10)) }
      : { ownerId, expenseDate: Between(monthStart.toISOString().slice(0, 10), monthEnd.toISOString().slice(0, 10)) };

    const [incomeRows, expenseRows] = await Promise.all([
      this.expenseRepo.find({ where: { ...expenseWhere, type: ExpenseType.INCOME  }, select: ['amount'] }),
      this.expenseRepo.find({ where: { ...expenseWhere, type: ExpenseType.EXPENSE }, select: ['amount'] }),
    ]);

    const totalIncome   = parseFloat(this.sum(incomeRows).toFixed(2));
    const totalExpenses = parseFloat(this.sum(expenseRows).toFixed(2));
    const netBalance    = parseFloat((totalIncome - totalExpenses).toFixed(2));

    // Outstanding = sum of UNPAID + OVERDUE invoices
    const invoiceWhere = isAdmin ? {} : { ownerId };

    const [unpaidRows, overdueRows] = await Promise.all([
      this.invoiceRepo.find({
        where: { ...invoiceWhere, paymentStatus: InvoicePaymentStatus.UNPAID  },
        select: ['total'],
      }),
      this.invoiceRepo.find({
        where: { ...invoiceWhere, paymentStatus: InvoicePaymentStatus.OVERDUE },
        select: ['total', 'id'],
      }),
    ]);

    const outstandingInvoices  = parseFloat(
      (this.sum(unpaidRows, 'total') + this.sum(overdueRows, 'total')).toFixed(2),
    );
    const overdueInvoicesCount = overdueRows.length;

    // ── Contracts ──────────────────────────────────────────────────────────

    const contractWhere = isAdmin ? {} : { ownerId };

    const [cDraft, cSent, cSigned, cRejected] = await Promise.all([
      this.contractRepo.count({ where: { ...contractWhere, status: ContractStatus.DRAFT    } }),
      this.contractRepo.count({ where: { ...contractWhere, status: ContractStatus.SENT     } }),
      this.contractRepo.count({ where: { ...contractWhere, status: ContractStatus.SIGNED   } }),
      this.contractRepo.count({ where: { ...contractWhere, status: ContractStatus.REJECTED } }),
    ]);

    const contractsByStatus: ContractsByStatus = {
      draft:    cDraft,
      sent:     cSent,
      signed:   cSigned,
      rejected: cRejected,
    };

    return {
      totalLeads,
      totalClients,
      newLeadsThisMonth,
      newClientsThisMonth,
      activeProjects,
      projectsByStatus,
      totalTasks,
      completedTasks,
      completionRate,
      delayedTasks,
      pendingTasks,
      totalIncome,
      totalExpenses,
      netBalance,
      outstandingInvoices,
      overdueInvoicesCount,
      contractsByStatus,
    };
  }

  // ─── getFinancialChart ────────────────────────────────────────────────────

  /** Returns last 6 calendar months of income vs expenses for chart rendering. */
  async getFinancialChart(user: User): Promise<FinancialChartMonth[]> {
    const isAdmin = user.role === UserRole.ADMIN;
    const ownerId = user.id;
    const result: FinancialChartMonth[] = [];

    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const year  = now.getUTCFullYear() + Math.floor((now.getUTCMonth() - i) / 12);
      const month = ((now.getUTCMonth() - i) % 12 + 12) % 12;

      const start = new Date(Date.UTC(year, month, 1));
      const end   = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

      const startDate = start.toISOString().slice(0, 10);
      const endDate   = end.toISOString().slice(0, 10);

      const baseWhere = isAdmin
        ? { expenseDate: Between(startDate, endDate) }
        : { ownerId, expenseDate: Between(startDate, endDate) };

      const [incomeRows, expenseRows] = await Promise.all([
        this.expenseRepo.find({
          where: { ...baseWhere, type: ExpenseType.INCOME  },
          select: ['amount'],
        }),
        this.expenseRepo.find({
          where: { ...baseWhere, type: ExpenseType.EXPENSE },
          select: ['amount'],
        }),
      ]);

      result.push({
        month:    `${year}-${String(month + 1).padStart(2, '0')}`,
        income:   parseFloat(this.sum(incomeRows).toFixed(2)),
        expenses: parseFloat(this.sum(expenseRows).toFixed(2)),
      });
    }

    return result;
  }
}
