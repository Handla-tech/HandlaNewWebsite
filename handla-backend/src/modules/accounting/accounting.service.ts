import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Account } from './entities/account.entity';
import { LedgerEntry } from './entities/ledger-entry.entity';
import { Client } from '../clients/entities/client.entity';
import { User } from '../auth/entities/user.entity';
import {
  AccountType,
  LedgerDirection,
  LedgerSourceType,
  UserRole,
} from '../../common/enums';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { CreateLedgerEntryDto } from './dto/create-ledger-entry.dto';
import { LedgerQueryDto } from './dto/ledger-query.dto';
import {
  ResourceNotFoundException,
  InsufficientPermissionsException,
  AppException,
} from '../../utils/exceptions';

/**
 * Parameters for the generic internal ledger writer.
 * Used by invoice/expense/purchase hooks. Idempotent on (sourceType, sourceId).
 */
export interface RecordLedgerParams {
  entryDate: string;
  accountCode?: string;   // resolve account by code (preferred for hooks)
  accountId?: string;     // or by id
  clientId?: string | null;
  direction: LedgerDirection;
  amount: number;
  currency?: string | null;
  sourceType: LedgerSourceType;
  sourceId: string;
  description?: string | null;
  ownerId?: string | null;
}

export interface PaginatedLedger {
  entries: LedgerEntry[];
  total: number;
  page: number;
  pages: number;
}

export interface ClientLedgerRow {
  id: string;
  entryDate: string;
  direction: LedgerDirection;
  amount: number;
  currency: string | null;
  sourceType: LedgerSourceType;
  sourceId: string;
  description: string | null;
  runningBalance: number;
}

/**
 * ACC-1 — AccountingService
 *
 * Central money-movement service. Every paid invoice, expense, and paid
 * purchase posts here via record(). Provides:
 *   - Chart-of-Accounts CRUD
 *   - General ledger query (filters + pagination)
 *   - Manual ledger entries
 *   - Per-client statement with running balance
 *   - Account balances
 *
 * Idempotency: record() is a no-op if a row with the same (sourceType,sourceId)
 * already exists — safe to call from fire-and-forget hooks and re-runs.
 */
@Injectable()
export class AccountingService {
  private readonly logger = new Logger(AccountingService.name);

  constructor(
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
    @InjectRepository(LedgerEntry)
    private readonly ledgerRepo: Repository<LedgerEntry>,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
  ) {}

  // ══════════════════════════════════════════════════════════════════════════
  // Chart of Accounts
  // ══════════════════════════════════════════════════════════════════════════

  async findAllAccounts(includeInactive = false): Promise<Account[]> {
    const qb = this.accountRepo
      .createQueryBuilder('a')
      .orderBy('a.code', 'ASC');
    if (!includeInactive) qb.where('a.is_active = :active', { active: true });
    return qb.getMany();
  }

  async findAccount(id: string): Promise<Account> {
    const account = await this.accountRepo.findOne({ where: { id } });
    if (!account) throw new ResourceNotFoundException('Account', id);
    return account;
  }

  /** Resolve an account by its unique code (used by internal hooks). */
  async findAccountByCode(code: string): Promise<Account | null> {
    return this.accountRepo.findOne({ where: { code } });
  }

  async createAccount(dto: CreateAccountDto): Promise<Account> {
    const existing = await this.accountRepo.findOne({ where: { code: dto.code } });
    if (existing) {
      throw new AppException(
        `Account code "${dto.code}" already exists.`,
        HttpStatus.CONFLICT,
      );
    }
    const account = this.accountRepo.create({
      code: dto.code,
      name: dto.name,
      type: dto.type,
      parentId: dto.parentId ?? null,
      currency: dto.currency ?? null,
      description: dto.description ?? null,
      isActive: dto.isActive ?? true,
      isSystem: false,
    });
    const saved = await this.accountRepo.save(account);
    this.logger.log(`Account created: ${saved.code} (${saved.type})`);
    return saved;
  }

  async updateAccount(id: string, dto: UpdateAccountDto): Promise<Account> {
    const account = await this.findAccount(id);
    if (dto.code && dto.code !== account.code) {
      const clash = await this.accountRepo.findOne({ where: { code: dto.code } });
      if (clash) {
        throw new AppException(
          `Account code "${dto.code}" already exists.`,
          HttpStatus.CONFLICT,
        );
      }
      account.code = dto.code;
    }
    if (dto.name !== undefined) account.name = dto.name;
    if (dto.type !== undefined) account.type = dto.type;
    if (dto.parentId !== undefined) account.parentId = dto.parentId ?? null;
    if (dto.currency !== undefined) account.currency = dto.currency ?? null;
    if (dto.description !== undefined) account.description = dto.description ?? null;
    if (dto.isActive !== undefined) account.isActive = dto.isActive;
    return this.accountRepo.save(account);
  }

  async removeAccount(id: string): Promise<void> {
    const account = await this.findAccount(id);
    if (account.isSystem) {
      throw new AppException(
        'System accounts cannot be deleted. Deactivate it instead.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const inUse = await this.ledgerRepo.count({ where: { accountId: id } });
    if (inUse > 0) {
      throw new AppException(
        `Account "${account.code}" has ${inUse} ledger entries and cannot be deleted. Deactivate it instead.`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    await this.accountRepo.remove(account);
    this.logger.log(`Account deleted: ${account.code}`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Ledger — internal writer (idempotent)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Generic ledger writer. Resolves the account by code or id, dedupes on
   * (sourceType, sourceId), and inserts one row. Returns the row (existing or
   * new). Never throws for a duplicate — returns the existing row.
   */
  async record(params: RecordLedgerParams): Promise<LedgerEntry | null> {
    // Idempotency: skip if this source already posted
    const existing = await this.ledgerRepo.findOne({
      where: { sourceType: params.sourceType, sourceId: params.sourceId },
    });
    if (existing) {
      this.logger.debug(
        `Ledger record skipped (duplicate) source=${params.sourceType}:${params.sourceId}`,
      );
      return existing;
    }

    // Resolve account
    let accountId = params.accountId ?? null;
    if (!accountId && params.accountCode) {
      const acc = await this.findAccountByCode(params.accountCode);
      if (!acc) {
        this.logger.warn(
          `Ledger record: account code "${params.accountCode}" not found — entry not posted for ${params.sourceType}:${params.sourceId}`,
        );
        return null;
      }
      accountId = acc.id;
    }
    if (!accountId) {
      this.logger.warn(
        `Ledger record: no account resolved for ${params.sourceType}:${params.sourceId}`,
      );
      return null;
    }

    const entry = this.ledgerRepo.create({
      entryDate: params.entryDate,
      accountId,
      clientId: params.clientId ?? null,
      direction: params.direction,
      amount: Number(params.amount),
      currency: params.currency ?? null,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      description: params.description ?? null,
      ownerId: params.ownerId ?? null,
    });

    try {
      const saved = await this.ledgerRepo.save(entry);
      this.logger.log(
        `Ledger posted: ${params.direction} ${params.amount} ${params.currency ?? ''} ` +
          `source=${params.sourceType}:${params.sourceId} client=${params.clientId ?? '-'}`,
      );
      return saved;
    } catch (err: any) {
      // Unique constraint race — treat as idempotent success
      if (err?.code === 'ER_DUP_ENTRY' || err?.errno === 1062) {
        return this.ledgerRepo.findOne({
          where: { sourceType: params.sourceType, sourceId: params.sourceId },
        });
      }
      throw err;
    }
  }

  /**
   * Remove a ledger row for a given source (used when a document is
   * deleted/unpaid). Only affects non-manual entries.
   */
  async removeBySource(sourceType: LedgerSourceType, sourceId: string): Promise<void> {
    await this.ledgerRepo.delete({ sourceType, sourceId });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Ledger — queries
  // ══════════════════════════════════════════════════════════════════════════

  async findLedger(query: LedgerQueryDto): Promise<PaginatedLedger> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(200, Math.max(1, query.limit ?? 50));

    const qb = this.ledgerRepo
      .createQueryBuilder('l')
      .leftJoinAndSelect('l.account', 'account')
      .leftJoinAndSelect('l.client', 'client')
      .leftJoinAndSelect('client.user', 'clientUser')
      .orderBy('l.entryDate', 'DESC')
      .addOrderBy('l.createdAt', 'DESC');

    if (query.accountId) qb.andWhere('l.account_id = :aid', { aid: query.accountId });
    if (query.clientId) qb.andWhere('l.client_id = :cid', { cid: query.clientId });
    if (query.direction) qb.andWhere('l.direction = :dir', { dir: query.direction });
    if (query.sourceType) qb.andWhere('l.source_type = :st', { st: query.sourceType });
    if (query.currency) qb.andWhere('l.currency = :cur', { cur: query.currency });
    if (query.dateFrom) qb.andWhere('l.entry_date >= :from', { from: query.dateFrom });
    if (query.dateTo) qb.andWhere('l.entry_date <= :to', { to: query.dateTo });

    const [entries, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { entries, total, page, pages: Math.ceil(total / limit) };
  }

  /** Create a MANUAL ledger entry (staff bookkeeping adjustment). */
  async createManualEntry(dto: CreateLedgerEntryDto, actingUser: User): Promise<LedgerEntry> {
    const account = await this.findAccount(dto.accountId);
    if (dto.clientId) {
      const client = await this.clientRepo.findOne({ where: { id: dto.clientId } });
      if (!client) throw new ResourceNotFoundException('Client', dto.clientId);
    }

    const entry = this.ledgerRepo.create({
      entryDate: dto.entryDate,
      accountId: account.id,
      clientId: dto.clientId ?? null,
      direction: dto.direction,
      amount: Number(dto.amount),
      currency: dto.currency ?? account.currency ?? null,
      sourceType: LedgerSourceType.MANUAL,
      sourceId: '', // set after save to the row's own id
      description: dto.description ?? null,
      ownerId: actingUser.id,
    });

    const saved = await this.ledgerRepo.save(entry);
    // MANUAL entries reference themselves so the unique constraint holds
    saved.sourceId = saved.id;
    await this.ledgerRepo.save(saved);

    this.logger.log(`Manual ledger entry created: ${saved.id} by ${actingUser.id}`);
    return saved;
  }

  async removeManualEntry(id: string, user: User): Promise<void> {
    if (user.role !== UserRole.ADMIN) {
      throw new InsufficientPermissionsException('delete ledger entries (ADMIN only)');
    }
    const entry = await this.ledgerRepo.findOne({ where: { id } });
    if (!entry) throw new ResourceNotFoundException('LedgerEntry', id);
    if (entry.sourceType !== LedgerSourceType.MANUAL) {
      throw new AppException(
        'Only MANUAL ledger entries can be deleted. Reverse the source document instead.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    await this.ledgerRepo.remove(entry);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Per-client ledger / statement
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Returns a chronological statement for a single client with a running
   * balance. Balance convention (from the CLIENT's perspective):
   *   IN  (client paid us / invoice income)  → reduces what they owe → -amount
   *   OUT (credit/refund to client)          → +amount
   * We express `runningBalance` as cumulative net (IN positive) for reporting;
   * `totals` gives the raw sums so the UI can label them clearly.
   */
  async getClientLedger(clientId: string): Promise<{
    clientId: string;
    rows: ClientLedgerRow[];
    totals: { in: number; out: number; net: number; byCurrency: Record<string, { in: number; out: number; net: number }> };
  }> {
    const client = await this.clientRepo.findOne({ where: { id: clientId } });
    if (!client) throw new ResourceNotFoundException('Client', clientId);

    const entries = await this.ledgerRepo.find({
      where: { clientId },
      order: { entryDate: 'ASC', createdAt: 'ASC' },
    });

    let running = 0;
    const byCurrency: Record<string, { in: number; out: number; net: number }> = {};
    let totalIn = 0;
    let totalOut = 0;

    const rows: ClientLedgerRow[] = entries.map((e) => {
      const amt = Number(e.amount);
      const signed = e.direction === LedgerDirection.IN ? amt : -amt;
      running = parseFloat((running + signed).toFixed(2));

      const cur = e.currency ?? 'N/A';
      byCurrency[cur] = byCurrency[cur] ?? { in: 0, out: 0, net: 0 };
      if (e.direction === LedgerDirection.IN) {
        byCurrency[cur].in = parseFloat((byCurrency[cur].in + amt).toFixed(2));
        totalIn = parseFloat((totalIn + amt).toFixed(2));
      } else {
        byCurrency[cur].out = parseFloat((byCurrency[cur].out + amt).toFixed(2));
        totalOut = parseFloat((totalOut + amt).toFixed(2));
      }
      byCurrency[cur].net = parseFloat((byCurrency[cur].in - byCurrency[cur].out).toFixed(2));

      return {
        id: e.id,
        entryDate: e.entryDate,
        direction: e.direction,
        amount: amt,
        currency: e.currency,
        sourceType: e.sourceType,
        sourceId: e.sourceId,
        description: e.description,
        runningBalance: running,
      };
    });

    return {
      clientId,
      rows,
      totals: {
        in: totalIn,
        out: totalOut,
        net: parseFloat((totalIn - totalOut).toFixed(2)),
        byCurrency,
      },
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Balances
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Net balance for an account (IN − OUT), grouped by currency.
   */
  async getAccountBalance(
    accountId: string,
    opts: { from?: string; to?: string } = {},
  ): Promise<{ accountId: string; byCurrency: Record<string, number>; total: number }> {
    await this.findAccount(accountId);
    const qb = this.ledgerRepo
      .createQueryBuilder('l')
      .select('l.currency', 'currency')
      .addSelect('l.direction', 'direction')
      .addSelect('SUM(l.amount)', 'sum')
      .where('l.account_id = :aid', { aid: accountId })
      .groupBy('l.currency')
      .addGroupBy('l.direction');
    if (opts.from) qb.andWhere('l.entry_date >= :from', { from: opts.from });
    if (opts.to) qb.andWhere('l.entry_date <= :to', { to: opts.to });

    const rows = await qb.getRawMany<{ currency: string | null; direction: LedgerDirection; sum: string }>();
    const byCurrency: Record<string, number> = {};
    let total = 0;
    for (const r of rows) {
      const cur = r.currency ?? 'N/A';
      const val = Number(r.sum) * (r.direction === LedgerDirection.IN ? 1 : -1);
      byCurrency[cur] = parseFloat(((byCurrency[cur] ?? 0) + val).toFixed(2));
      total = parseFloat((total + val).toFixed(2));
    }
    return { accountId, byCurrency, total };
  }
}
