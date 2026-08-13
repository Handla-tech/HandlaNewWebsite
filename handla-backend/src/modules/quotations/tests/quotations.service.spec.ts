import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { QuotationsService } from '../quotations.service';
import { Quotation } from '../entities/quotation.entity';
import { QuotationLineItem } from '../entities/quotation-line-item.entity';
import { Client } from '../../clients/entities/client.entity';
import { ContractsService } from '../../contracts/contracts.service';
import { InvoicesService } from '../../invoices/invoices.service';
import { NotificationService } from '../../notifications/notification.service';
import { QuotationStatus, UserRole } from '../../../common/enums';
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

describe('QuotationsService', () => {
  let service: QuotationsService;
  let quotationRepo: any;
  let clientRepo: any;
  let contractsService: any;
  let invoicesService: any;
  let notificationService: any;

  beforeEach(async () => {
    quotationRepo = {
      createQueryBuilder: jest.fn(() => buildQb()),
      findOne: jest.fn(),
      findOneOrFail: jest.fn((opts) => Promise.resolve({ id: opts?.where?.id ?? 'q-1' })),
      find: jest.fn(),
      save: jest.fn((x) => Promise.resolve(x)),
      remove: jest.fn(),
    };
    clientRepo = { findOne: jest.fn() };
    contractsService = { create: jest.fn().mockResolvedValue({ id: 'contract-1' }) };
    invoicesService = { create: jest.fn().mockResolvedValue({ id: 'invoice-1' }) };
    notificationService = { createErpNotification: jest.fn() };

    const dataSource = { transaction: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuotationsService,
        { provide: getRepositoryToken(Quotation), useValue: quotationRepo },
        { provide: getRepositoryToken(QuotationLineItem), useValue: {} },
        { provide: getRepositoryToken(Client), useValue: clientRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: ContractsService, useValue: contractsService },
        { provide: InvoicesService, useValue: invoicesService },
        { provide: NotificationService, useValue: notificationService },
      ],
    }).compile();

    service = module.get(QuotationsService);
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

  describe('generateQuoteNumber', () => {
    it('starts at 0001 when no prior quotations', async () => {
      quotationRepo.createQueryBuilder.mockReturnValue(
        buildQb({ getRawOne: jest.fn().mockResolvedValue({ max: null }) }),
      );
      const year = new Date().getFullYear();
      expect(await service.generateQuoteNumber()).toBe(`QUO-${year}-0001`);
    });

    it('increments from the max existing number', async () => {
      const year = new Date().getFullYear();
      quotationRepo.createQueryBuilder.mockReturnValue(
        buildQb({ getRawOne: jest.fn().mockResolvedValue({ max: `QUO-${year}-0012` }) }),
      );
      expect(await service.generateQuoteNumber()).toBe(`QUO-${year}-0013`);
    });
  });

  describe('findByPublicToken', () => {
    it('returns a sanitized projection (no owner/internal ids leaked)', async () => {
      quotationRepo.findOne.mockResolvedValue({
        id: 'q-1',
        quoteNumber: 'QUO-2026-0001',
        title: 'Website build',
        status: QuotationStatus.SENT,
        subtotal: 100,
        taxRate: 10,
        taxAmount: 10,
        total: 110,
        currency: 'USD',
        validUntil: '2026-12-31',
        notes: null,
        createdAt: new Date(),
        lineItems: [
          { description: 'x', quantity: 1, unitPrice: 100, lineTotal: 100, sortOrder: 0 },
        ],
        client: { user: { name: 'Acme' }, company: 'Acme Inc' },
        owner: { name: 'Staff' },
      });

      const result = await service.findByPublicToken('tok-1');
      expect(result.quoteNumber).toBe('QUO-2026-0001');
      expect(result.client).toEqual({ name: 'Acme', company: 'Acme Inc' });
      expect(result.issuer).toEqual({ name: 'Staff' });
      expect(result).not.toHaveProperty('ownerId');
      expect(result).not.toHaveProperty('publicToken');
      expect(result.lineItems[0]).toEqual({
        description: 'x',
        quantity: 1,
        unitPrice: 100,
        lineTotal: 100,
      });
    });

    it('throws when token not found', async () => {
      quotationRepo.findOne.mockResolvedValue(null);
      await expect(service.findByPublicToken('nope')).rejects.toBeDefined();
    });
  });

  describe('acceptByToken', () => {
    it('flips SENT → ACCEPTED and notifies owner', async () => {
      quotationRepo.findOne.mockResolvedValue({
        id: 'q-1',
        quoteNumber: 'QUO-2026-0001',
        status: QuotationStatus.SENT,
        ownerId: 'u-1',
      });
      const result = await service.acceptByToken('tok-1');
      expect(result.status).toBe(QuotationStatus.ACCEPTED);
      expect(result.acceptedAt).toBeInstanceOf(Date);
      expect(notificationService.createErpNotification).toHaveBeenCalled();
    });

    it('rejects accept when not SENT', async () => {
      quotationRepo.findOne.mockResolvedValue({
        id: 'q-1',
        status: QuotationStatus.DRAFT,
        ownerId: 'u-1',
      });
      await expect(service.acceptByToken('tok-1')).rejects.toBeDefined();
    });
  });

  describe('rejectByToken', () => {
    it('flips SENT → REJECTED and appends reason to notes', async () => {
      quotationRepo.findOne.mockResolvedValue({
        id: 'q-1',
        quoteNumber: 'QUO-2026-0001',
        status: QuotationStatus.SENT,
        ownerId: 'u-1',
        notes: null,
      });
      const result = await service.rejectByToken('tok-1', 'too expensive');
      expect(result.status).toBe(QuotationStatus.REJECTED);
      expect(result.rejectedAt).toBeInstanceOf(Date);
      expect(result.notes).toContain('too expensive');
    });
  });

  describe('convert', () => {
    it('creates a draft invoice + contract and marks CONVERTED', async () => {
      const quotation = {
        id: 'q-1',
        quoteNumber: 'QUO-2026-0001',
        title: 'Website build',
        status: QuotationStatus.ACCEPTED,
        clientId: 'c-1',
        ownerId: 'u-1',
        taxRate: 10,
        total: 110,
        currency: 'USD',
        lineItems: [
          { description: 'x', quantity: 1, unitPrice: 100, sortOrder: 0 },
        ],
      };
      quotationRepo.findOne.mockResolvedValue(quotation);

      const result = await service.convert('q-1', makeUser());

      expect(invoicesService.create).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: 'c-1', taxRate: 10 }),
        expect.anything(),
      );
      expect(contractsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: 'c-1' }),
        expect.anything(),
      );
      expect(quotationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: QuotationStatus.CONVERTED,
          convertedInvoiceId: 'invoice-1',
          convertedContractId: 'contract-1',
        }),
      );
      expect(result).toBeDefined();
    });

    it('rejects convert when not ACCEPTED', async () => {
      quotationRepo.findOne.mockResolvedValue({
        id: 'q-1',
        status: QuotationStatus.SENT,
        ownerId: 'u-1',
        lineItems: [],
      });
      await expect(service.convert('q-1', makeUser())).rejects.toBeDefined();
      expect(invoicesService.create).not.toHaveBeenCalled();
      expect(contractsService.create).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('blocks non-admin', async () => {
      await expect(
        service.remove('q-1', makeUser({ role: UserRole.EMPLOYEE })),
      ).rejects.toBeDefined();
    });

    it('blocks deleting a CONVERTED quotation', async () => {
      quotationRepo.findOne.mockResolvedValue({
        id: 'q-1',
        status: QuotationStatus.CONVERTED,
      });
      await expect(service.remove('q-1', makeUser())).rejects.toBeDefined();
      expect(quotationRepo.remove).not.toHaveBeenCalled();
    });
  });

  describe('recalculateExpiredStatus', () => {
    it('returns 0 when none are expiring', async () => {
      quotationRepo.find.mockResolvedValue([]);
      expect(await service.recalculateExpiredStatus()).toBe(0);
    });

    it('marks past-due SENT quotations EXPIRED', async () => {
      quotationRepo.find.mockResolvedValue([
        { id: 'q-1', quoteNumber: 'QUO-2026-0001' },
        { id: 'q-2', quoteNumber: 'QUO-2026-0002' },
      ]);
      const count = await service.recalculateExpiredStatus();
      expect(count).toBe(2);
    });
  });
});
