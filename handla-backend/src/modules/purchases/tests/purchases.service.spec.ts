import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { PurchasesService } from '../purchases.service';
import { Purchase } from '../entities/purchase.entity';
import { PurchaseLineItem } from '../entities/purchase-line-item.entity';
import { Supplier } from '../../suppliers/entities/supplier.entity';
import { ExpensesService } from '../../expenses/expenses.service';
import { NotificationService } from '../../notifications/notification.service';
import {
  PurchaseStatus,
  PurchasePaymentStatus,
  UserRole,
} from '../../../common/enums';
import { User } from '../../auth/entities/user.entity';

function makeUser(overrides: Partial<User> = {}): User {
  return { id: 'u-1', role: UserRole.ADMIN, ...overrides } as User;
}

function buildQb(overrides: Record<string, any> = {}) {
  const qb: any = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    whereInIds: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({}),
    getRawOne: jest.fn().mockResolvedValue({ max: null }),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    ...overrides,
  };
  return qb;
}

describe('PurchasesService', () => {
  let service: PurchasesService;
  let purchaseRepo: any;
  let supplierRepo: any;
  let expensesService: any;
  let notificationService: any;

  beforeEach(async () => {
    purchaseRepo = {
      createQueryBuilder: jest.fn(() => buildQb()),
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn((x) => Promise.resolve(x)),
      remove: jest.fn(),
    };
    supplierRepo = { findOne: jest.fn() };
    expensesService = { createFromPaidPurchase: jest.fn().mockResolvedValue(null) };
    notificationService = { createErpNotification: jest.fn() };

    const dataSource = { transaction: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchasesService,
        { provide: getRepositoryToken(Purchase), useValue: purchaseRepo },
        { provide: getRepositoryToken(PurchaseLineItem), useValue: {} },
        { provide: getRepositoryToken(Supplier), useValue: supplierRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: ExpensesService, useValue: expensesService },
        { provide: NotificationService, useValue: notificationService },
      ],
    }).compile();

    service = module.get(PurchasesService);
  });

  describe('calculateTotals', () => {
    it('computes subtotal, tax, and total with 2dp rounding', () => {
      const r = service.calculateTotals(
        [
          { description: 'a', quantity: 2, unitPrice: 10 },
          { description: 'b', quantity: 1, unitPrice: 5.5 },
        ],
        10,
      );
      expect(r.subtotal).toBe(25.5);
      expect(r.taxAmount).toBe(2.55);
      expect(r.total).toBe(28.05);
    });
  });

  describe('generatePurchaseNumber', () => {
    it('starts at 0001 when no prior purchases', async () => {
      purchaseRepo.createQueryBuilder.mockReturnValue(buildQb({ getRawOne: jest.fn().mockResolvedValue({ max: null }) }));
      const year = new Date().getFullYear();
      expect(await service.generatePurchaseNumber()).toBe(`PO-${year}-0001`);
    });

    it('increments from the max existing number', async () => {
      const year = new Date().getFullYear();
      purchaseRepo.createQueryBuilder.mockReturnValue(
        buildQb({ getRawOne: jest.fn().mockResolvedValue({ max: `PO-${year}-0007` }) }),
      );
      expect(await service.generatePurchaseNumber()).toBe(`PO-${year}-0008`);
    });
  });

  describe('markAsPaid', () => {
    it('flips to PAID and triggers auto-expense', async () => {
      const purchase = {
        id: 'p-1',
        purchaseNumber: 'PO-2026-0001',
        paymentStatus: PurchasePaymentStatus.UNPAID,
        total: 100,
        currency: 'USD',
        accountCode: '5200',
        ownerId: 'u-1',
        supplierId: 's-1',
      } as any;
      purchaseRepo.findOne.mockResolvedValue(purchase);

      const result = await service.markAsPaid('p-1', {}, makeUser());

      expect(result.paymentStatus).toBe(PurchasePaymentStatus.PAID);
      expect(result.paidAt).toBeInstanceOf(Date);
      expect(expensesService.createFromPaidPurchase).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'p-1', accountCode: '5200', total: 100 }),
        'u-1',
      );
    });

    it('rejects when already PAID', async () => {
      purchaseRepo.findOne.mockResolvedValue({
        id: 'p-1',
        paymentStatus: PurchasePaymentStatus.PAID,
        ownerId: 'u-1',
      });
      await expect(service.markAsPaid('p-1', {}, makeUser())).rejects.toBeDefined();
      expect(expensesService.createFromPaidPurchase).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('blocks non-admin', async () => {
      await expect(
        service.remove('p-1', makeUser({ role: UserRole.EMPLOYEE })),
      ).rejects.toBeDefined();
    });

    it('blocks deleting a PAID purchase', async () => {
      purchaseRepo.findOne.mockResolvedValue({
        id: 'p-1',
        paymentStatus: PurchasePaymentStatus.PAID,
      });
      await expect(service.remove('p-1', makeUser())).rejects.toBeDefined();
      expect(purchaseRepo.remove).not.toHaveBeenCalled();
    });
  });

  describe('recalculateOverdueStatus', () => {
    it('returns 0 and does nothing when none overdue', async () => {
      purchaseRepo.find.mockResolvedValue([]);
      expect(await service.recalculateOverdueStatus()).toBe(0);
    });

    it('marks overdue purchases and notifies owners', async () => {
      purchaseRepo.find.mockResolvedValue([
        { id: 'p-1', purchaseNumber: 'PO-2026-0001', dueDate: '2020-01-01', ownerId: 'u-9' },
      ]);
      const count = await service.recalculateOverdueStatus();
      expect(count).toBe(1);
      expect(notificationService.createErpNotification).toHaveBeenCalled();
    });
  });
});
