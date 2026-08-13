import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan } from 'typeorm';

import { Purchase } from './entities/purchase.entity';
import { PurchaseLineItem } from './entities/purchase-line-item.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { User } from '../auth/entities/user.entity';
import {
  PurchaseStatus,
  PurchasePaymentStatus,
  UserRole,
  NotificationType,
} from '../../common/enums';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';
import { PurchasesQueryDto } from './dto/purchases-query.dto';
import { MarkPurchasePaidDto } from './dto/mark-purchase-paid.dto';
import { PurchaseLineItemDto } from './dto/purchase-line-item.dto';
import {
  ResourceNotFoundException,
  OwnershipViolationException,
  InsufficientPermissionsException,
  AppException,
} from '../../utils/exceptions';
import { ExpensesService } from '../expenses/expenses.service';
import { NotificationService } from '../notifications/notification.service';

export interface PaginatedPurchases {
  purchases: Purchase[];
  total: number;
  page: number;
  pages: number;
}

/**
 * PUR-1 — PurchasesService (the A-P mirror of InvoicesService).
 *
 * markAsPaid() → ExpensesService.createFromPaidPurchase() → EXPENSE + ledger OUT.
 * Overdue scheduler flips UNPAID+past-due to OVERDUE daily.
 * Number format: PO-YYYY-NNNN (serialised inside a transaction).
 */
@Injectable()
export class PurchasesService {
  private readonly logger = new Logger(PurchasesService.name);

  constructor(
    @InjectRepository(Purchase)
    private readonly purchaseRepo: Repository<Purchase>,
    @InjectRepository(PurchaseLineItem)
    private readonly lineItemRepo: Repository<PurchaseLineItem>,
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,
    private readonly dataSource: DataSource,
    private readonly expensesService: ExpensesService,
    private readonly notificationService: NotificationService,
  ) {}

  // ─── generatePurchaseNumber ───────────────────────────────────────────────
  async generatePurchaseNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `PO-${year}-`;
    const result = await this.purchaseRepo
      .createQueryBuilder('p')
      .select('MAX(p.purchaseNumber)', 'max')
      .where('p.purchaseNumber LIKE :prefix', { prefix: `${prefix}%` })
      .getRawOne<{ max: string | null }>();

    let nextNum = 1;
    if (result?.max) {
      const parts = result.max.split('-');
      const current = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(current)) nextNum = current + 1;
    }
    return `${prefix}${String(nextNum).padStart(4, '0')}`;
  }

  // ─── calculateTotals ──────────────────────────────────────────────────────
  calculateTotals(
    lineItems: PurchaseLineItemDto[],
    taxRate: number,
  ): { subtotal: number; taxAmount: number; total: number } {
    const subtotal = parseFloat(
      lineItems.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0).toFixed(2),
    );
    const taxAmount = parseFloat(((subtotal * taxRate) / 100).toFixed(2));
    const total = parseFloat((subtotal + taxAmount).toFixed(2));
    return { subtotal, taxAmount, total };
  }

  // ─── findAll ──────────────────────────────────────────────────────────────
  async findAll(user: User, query: PurchasesQueryDto): Promise<PaginatedPurchases> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));

    const qb = this.purchaseRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.supplier', 'supplier')
      .leftJoinAndSelect('p.owner', 'owner')
      .leftJoinAndSelect('p.lineItems', 'lineItems')
      .orderBy('p.createdAt', 'DESC');

    if (user.role === UserRole.EMPLOYEE) {
      qb.andWhere('p.owner_id = :uid', { uid: user.id });
    }

    if (query.supplierId) qb.andWhere('p.supplier_id = :sid', { sid: query.supplierId });
    if (query.status) qb.andWhere('p.status = :st', { st: query.status });
    if (query.paymentStatus) qb.andWhere('p.payment_status = :ps', { ps: query.paymentStatus });
    if (query.ownerId) qb.andWhere('p.owner_id = :oid', { oid: query.ownerId });
    if (query.search) qb.andWhere('p.purchaseNumber LIKE :s', { s: `%${query.search}%` });
    if (query.dateFrom) qb.andWhere('DATE(p.createdAt) >= :from', { from: query.dateFrom });
    if (query.dateTo) qb.andWhere('DATE(p.createdAt) <= :to', { to: query.dateTo });

    const [purchases, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { purchases, total, page, pages: Math.ceil(total / limit) };
  }

  // ─── findOne ──────────────────────────────────────────────────────────────
  async findOne(id: string, user: User): Promise<Purchase> {
    const purchase = await this.purchaseRepo.findOne({
      where: { id },
      relations: ['supplier', 'owner', 'lineItems'],
    });
    if (!purchase) throw new ResourceNotFoundException('Purchase', id);
    this.assertAccess(purchase, user);
    return purchase;
  }

  // ─── create ───────────────────────────────────────────────────────────────
  async create(dto: CreatePurchaseDto, actingUser: User): Promise<Purchase> {
    const supplier = await this.supplierRepo.findOne({ where: { id: dto.supplierId } });
    if (!supplier) throw new ResourceNotFoundException('Supplier', dto.supplierId);

    const taxRate = dto.taxRate ?? 0;
    const { subtotal, taxAmount, total } = this.calculateTotals(dto.lineItems, taxRate);

    return this.dataSource.transaction(async (manager) => {
      const purchaseNumber = await this.generatePurchaseNumber();

      const purchase = manager.create(Purchase, {
        purchaseNumber,
        supplierId: dto.supplierId,
        ownerId: actingUser.id,
        status: dto.status ?? PurchaseStatus.DRAFT,
        paymentStatus: PurchasePaymentStatus.UNPAID,
        subtotal,
        taxRate,
        taxAmount,
        total,
        currency: dto.currency ?? null,
        accountCode: dto.accountCode ?? null,
        orderDate: dto.orderDate ?? null,
        dueDate: dto.dueDate ?? null,
        notes: dto.notes ?? null,
      });
      const saved = await manager.save(Purchase, purchase);

      const items = dto.lineItems.map((item, idx) =>
        manager.create(PurchaseLineItem, {
          purchaseId: saved.id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: parseFloat((item.quantity * item.unitPrice).toFixed(2)),
          sortOrder: idx,
        }),
      );
      await manager.save(PurchaseLineItem, items);

      this.logger.log(
        `Purchase created: ${purchaseNumber} supplier=${dto.supplierId} total=${total} owner=${actingUser.id}`,
      );

      return manager.findOneOrFail(Purchase, {
        where: { id: saved.id },
        relations: ['supplier', 'owner', 'lineItems'],
      });
    });
  }

  // ─── update ───────────────────────────────────────────────────────────────
  async update(id: string, dto: UpdatePurchaseDto, user: User): Promise<Purchase> {
    const purchase = await this.findOne(id, user);

    if (purchase.paymentStatus !== PurchasePaymentStatus.UNPAID) {
      throw new AppException(
        `Only UNPAID purchases can be edited (current: "${purchase.paymentStatus}").`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const taxRate = dto.taxRate ?? purchase.taxRate;

    return this.dataSource.transaction(async (manager) => {
      if (dto.lineItems) {
        await manager.delete(PurchaseLineItem, { purchaseId: id });
        const items = dto.lineItems.map((item, idx) =>
          manager.create(PurchaseLineItem, {
            purchaseId: id,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: parseFloat((item.quantity * item.unitPrice).toFixed(2)),
            sortOrder: idx,
          }),
        );
        await manager.save(PurchaseLineItem, items);
        const totals = this.calculateTotals(dto.lineItems, taxRate);
        purchase.subtotal = totals.subtotal;
        purchase.taxAmount = totals.taxAmount;
        purchase.total = totals.total;
      } else if (dto.taxRate !== undefined) {
        const totals = this.calculateTotals(
          (purchase.lineItems ?? []).map((li) => ({
            description: li.description,
            quantity: Number(li.quantity),
            unitPrice: Number(li.unitPrice),
          })),
          dto.taxRate,
        );
        purchase.subtotal = totals.subtotal;
        purchase.taxAmount = totals.taxAmount;
        purchase.total = totals.total;
      }

      if (dto.taxRate !== undefined) purchase.taxRate = dto.taxRate;
      if (dto.currency !== undefined) purchase.currency = dto.currency ?? null;
      if (dto.accountCode !== undefined) purchase.accountCode = dto.accountCode ?? null;
      if (dto.status !== undefined) purchase.status = dto.status;
      if (dto.orderDate !== undefined) purchase.orderDate = dto.orderDate ?? null;
      if (dto.dueDate !== undefined) purchase.dueDate = dto.dueDate ?? null;
      if (dto.notes !== undefined) purchase.notes = dto.notes ?? null;

      await manager.save(Purchase, purchase);

      return manager.findOneOrFail(Purchase, {
        where: { id },
        relations: ['supplier', 'owner', 'lineItems'],
      });
    });
  }

  // ─── remove ───────────────────────────────────────────────────────────────
  async remove(id: string, user: User): Promise<void> {
    if (user.role !== UserRole.ADMIN) {
      throw new InsufficientPermissionsException('delete purchases (ADMIN only)');
    }
    const purchase = await this.purchaseRepo.findOne({ where: { id } });
    if (!purchase) throw new ResourceNotFoundException('Purchase', id);
    if (purchase.paymentStatus === PurchasePaymentStatus.PAID) {
      throw new AppException(
        'Cannot delete a PAID purchase.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    await this.purchaseRepo.remove(purchase);
    this.logger.log(`Purchase deleted: id=${id} by admin=${user.id}`);
  }

  // ─── markAsPaid ────────────────────────────────────────────────────────────
  async markAsPaid(id: string, dto: MarkPurchasePaidDto, user: User): Promise<Purchase> {
    const purchase = await this.findOne(id, user);

    if (purchase.paymentStatus === PurchasePaymentStatus.PAID) {
      throw new AppException('Purchase is already marked as PAID.', HttpStatus.UNPROCESSABLE_ENTITY);
    }

    purchase.paymentStatus = PurchasePaymentStatus.PAID;
    purchase.paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
    await this.purchaseRepo.save(purchase);

    this.logger.log(
      `Purchase marked PAID: ${purchase.purchaseNumber} paidAt=${purchase.paidAt.toISOString()} by=${user.id}`,
    );

    // Auto-create the linked EXPENSE (which posts an OUT ledger entry).
    void this.expensesService.createFromPaidPurchase(
      {
        id: purchase.id,
        purchaseNumber: purchase.purchaseNumber,
        total: Number(purchase.total),
        currency: purchase.currency ?? null,
        accountCode: purchase.accountCode ?? null,
      },
      user.id,
    );

    return purchase;
  }

  // ─── recalculateOverdueStatus ──────────────────────────────────────────────
  async recalculateOverdueStatus(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdue = await this.purchaseRepo.find({
      where: {
        paymentStatus: PurchasePaymentStatus.UNPAID,
        dueDate: LessThan(today.toISOString().split('T')[0]) as any,
      },
      relations: ['owner'],
    });
    if (overdue.length === 0) return 0;

    const ids = overdue.map((p) => p.id);
    await this.purchaseRepo
      .createQueryBuilder()
      .update(Purchase)
      .set({ paymentStatus: PurchasePaymentStatus.OVERDUE })
      .whereInIds(ids)
      .execute();

    for (const p of overdue) {
      this.logger.warn(`Purchase overdue: ${p.purchaseNumber} dueDate=${p.dueDate}`);
      if (p.ownerId) {
        void this.notificationService.createErpNotification(
          p.ownerId,
          NotificationType.PURCHASE_OVERDUE,
          'Purchase Overdue',
          `Purchase ${p.purchaseNumber} is now overdue.`,
          p.id,
        );
      }
    }

    this.logger.log(`recalculateOverdueStatus: ${overdue.length} purchase(s) marked OVERDUE`);
    return overdue.length;
  }

  // ─── access ─────────────────────────────────────────────────────────────────
  private assertAccess(purchase: Purchase, user: User): void {
    if (user.role === UserRole.ADMIN) return;
    if (user.role === UserRole.EMPLOYEE) {
      if (purchase.ownerId !== user.id) throw new OwnershipViolationException();
      return;
    }
    throw new InsufficientPermissionsException('access purchases');
  }
}
