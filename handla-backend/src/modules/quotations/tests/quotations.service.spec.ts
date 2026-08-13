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
import { AppException } from '../../../utils/exceptions';

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
  let dataSource: any;

  beforeEach(async () => {
    quotationRepo = {
      createQueryBuilder: jest.fn(() => buildQb()),
      findOne: jest.fn(),
      find: jest.fn(),
      findOneOrFail: jest.fn(),
      save: jest.fn((x) => Promise.resolve(x)),
      remove: jest.fn(),
    };
    clientRepo = { findOne: jest.fn() };
    contractsService = { create: jest.fn().mockResolvedValue({ id: 'con-1' }) };
    invoicesService = { create: jest.fn().mockResolvedValue({ id: 'inv-1' }) };
    notificationService = { createErpNotification: jest.fn() };
    dataSource = {
      transaction: jest.fn(async (cb: any) =>
        cb({
          create: (_e: any, v: any) => v,
          save: jest.fn((_e: any, v: any) => Promise.resolve(v)),
          delete: jest.fn(),
          findOneOrFail: jest.fn().mockResolvedValue({ id: 'q-1' }),
        }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuotationsService,
        { provide: getRepositoryToken(Quotation), useValue: quotationRepo },
        { provide: getRepositoryToken(QuotationLineItem), useValue: { } },
        { provide: getRepositoryToken(Client), useValue: clientRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: ContractsService, useValue: contractsService },
        { provide: InvoicesService, useValue: invoicesService },
        { provide: NotificationService, useValue: notificationService },
      ],
    }).compile();

    service = module.get<QuotationsService>(QuotationsService);
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateQuoteNumber', () => {
    it('starts at 0001 when no prior quotation', async () => {
      const num = await service.generateQuoteNumber();
      expect(num).toMatch(/^QUO-\d{4}-0001$/);
    });

    it('increments from the max existing number', async () => {
      const year = new Date().getFullYear();
      quotationRepo.createQueryBuilder.mockReturnValue(
        buildQb({ getRawOne: jest.fn().mockResolvedValue({ max: `QUO-${year}-0007` }) }),
      );
      const num = await service.generateQuoteNumber();
      expect(num).toBe(`QUO-${year}-0008`);
    });
  });

  describe('calculateTotals', () => {
    it('computes subtotal, tax and total with 2dp', () => {
      const t = service.calculateTotals(
        [
          { description: 'A', quantity: 2, unitPrice: 10 },
          { description: 'B', quantity: 1, unitPrice: 5.5 },
        ],
        10,
      );
      expect(t.subtotal).toBe(25.5);
      expect(t.taxAmount).toBe(2.55);
      expect(t.total).toBe(28.05);
    });
  });

  describe('findByPublicToken', () => {
    it('returns a sanitized projection (no ownerId/publicToken leak)', async () => {
      quotationRepo.findOne.mockResolvedValue({
        id: 'q-1',
        quoteNumber: 'QUO-2026-0001',
        title: 'Web build',
        status: QuotationStatus.SENT,
        subtotal: 100,
        taxRate: 0,
        taxAmount: 0,
        total: 100,
        currency: null,
        validUntil: null,
        notes: null,
        createdAt: new Date(),
        publicToken: 'tok',
        ownerId: 'u-9',
        lineItems: [
          { description: 'X', quantity: 1, unitPrice: 100, lineTotal: 100, sortOrder: 0 },
        ],
        client: { company: 'Acme', user: { name: 'Jane' } },
        owner: { name: 'Staff' },
      });
      const res = await service.findByPublicToken('tok');
      expect(res.quoteNumber).toBe('QUO-2026-0001');
      expect(res.publicToken).toBeUndefined();
      expect(res.ownerId).toBeUndefined();
      expect(res.client).toEqual({ name: 'Jane', company: 'Acme' });
      expect(res.lineItems).toHaveLength(1);
    });
  });

  describe('applyAccept (via acceptByToken)', () => {
    it('rejects when quotation is not SENT', async () => {
      quotationRepo.findOne.mockResolvedValue({
        id: 'q-1',
        status: QuotationStatus.DRAFT,
        quoteNumber: 'QUO-2026-0001',
      });
      await expect(service.acceptByToken('tok')).rejects.toBeInstanceOf(AppException);
    });

    it('moves SENT → ACCEPTED and notifies owner', async () => {
      quotationRepo.findOne.mockResolvedValue({
        id: 'q-1',
        status: QuotationStatus.SENT,
        quoteNumber: 'QUO-2026-0001',
        ownerId: 'u-9',
      });
      const res = await service.acceptByToken('tok');
      expect(res.status).toBe(QuotationStatus.ACCEPTED);
      expect(res.acceptedAt).toBeInstanceOf(Date);
      expect(notificationService.createErpNotification).toHaveBeenCalled();
    });
  });

  describe('convert', () => {
    it('creates a draft invoice + draft contract and marks CONVERTED', async () => {
      const quotation: any = {
        id: 'q-1',
        status: QuotationStatus.ACCEPTED,
        quoteNumber: 'QUO-2026-0001',
        title: 'Web build',
        clientId: 'c-1',
        ownerId: 'u-1',
        taxRate: 0,
        total: 100,
        currency: null,
        lineItems: [
          { description: 'X', quantity: 1, unitPrice: 100, lineTotal: 100, sortOrder: 0 },
        ],
      };
      quotationRepo.findOne.mockResolvedValue(quotation);
      quotationRepo.findOneOrFail.mockResolvedValue({
        ...quotation,
        status: QuotationStatus.CONVERTED,
      });

      const res = await service.convert('q-1', makeUser());
      expect(invoicesService.create).toHaveBeenCalledTimes(1);
      expect(contractsService.create).toHaveBeenCalledTimes(1);
      expect(quotation.convertedInvoiceId).toBe('inv-1');
      expect(quotation.convertedContractId).toBe('con-1');
      expect(res.status).toBe(QuotationStatus.CONVERTED);
    });

    it('refuses to convert a non-ACCEPTED quotation', async () => {
      quotationRepo.findOne.mockResolvedValue({
        id: 'q-1',
        status: QuotationStatus.SENT,
        ownerId: 'u-1',
        quoteNumber: 'QUO-2026-0001',
      });
      await expect(service.convert('q-1', makeUser())).rejects.toBeInstanceOf(AppException);
      expect(invoicesService.create).not.toHaveBeenCalled();
    });
  });

  describe('recalculateExpiredStatus', () => {
    it('returns 0 when nothing is expiring', async () => {
      quotationRepo.find.mockResolvedValue([]);
      const count = await service.recalculateExpiredStatus();
      expect(count).toBe(0);
    });

    it('marks past-due SENT quotations EXPIRED', async () => {
      quotationRepo.find.mockResolvedValue([{ id: 'q-1' }, { id: 'q-2' }]);
      const count = await service.recalculateExpiredStatus();
      expect(count).toBe(2);
    });
  });
});
