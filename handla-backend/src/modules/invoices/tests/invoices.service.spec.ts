import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { InvoicesService } from '../invoices.service';
import { Invoice } from '../entities/invoice.entity';
import { InvoiceLineItem } from '../entities/invoice-line-item.entity';
import { Client } from '../../clients/entities/client.entity';
import { User } from '../../auth/entities/user.entity';
import { UserRole, InvoicePaymentStatus, ClientStatus, NotificationType } from '../../../common/enums';
import {
  ResourceNotFoundException,
  OwnershipViolationException,
  InsufficientPermissionsException,
  AppException,
} from '../../../utils/exceptions';
import { NotificationService } from '../../notifications/notification.service';
import { EmailService } from '../../email/email.service';
import { ExpensesService } from '../../expenses/expenses.service';
import { LineItemDto } from '../dto/line-item.dto';
import { Conversation } from '../../chat/entities/conversation.entity';
import { ChatService } from '../../chat/chat.service';
import { AwsService } from '../../aws/aws.service';
import { makePublicTokenTestProviders } from '../../../common/public-token/testing/public-token-test-providers';
import { FileUpload, FileUploadResourceType, FileUploadStatus } from '../../uploads/entities/file-upload.entity';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'employee@test.com',
    passwordHash: 'hashed',
    name: 'Test Employee',
    role: UserRole.EMPLOYEE,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    adminConversations: [],
    clientConversations: [],
    assignedConversations: [],
    messages: [],
    notifications: [],
    testimonials: [],
    ...overrides,
  };
}

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 'client-1',
    userId: 'client-user-1',
    ownerId: 'user-1',
    company: 'Acme Corp',
    status: ClientStatus.ACTIVE,
    notes: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    user: makeUser({ id: 'client-user-1', role: UserRole.CLIENT }),
    owner: makeUser({ id: 'user-1', role: UserRole.EMPLOYEE }),
    projects: [],
    contracts: [],
    invoices: [],
    ...overrides,
  };
}

function makeLineItem(overrides: Partial<InvoiceLineItem> = {}): InvoiceLineItem {
  return {
    id: 'li-1',
    invoiceId: 'inv-1',
    description: 'Web development',
    quantity: 10,
    unitPrice: 100,
    lineTotal: 1000,
    sortOrder: 0,
    invoice: {} as Invoice,
    ...overrides,
  };
}

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'inv-1',
    invoiceNumber: 'INV-2026-0001',
    clientId: 'client-1',
    ownerId: 'user-1',
    subtotal: 1000,
    taxRate: 0,
    taxAmount: 0,
    total: 1000,
    currency: 'USD',
    paymentStatus: InvoicePaymentStatus.UNPAID,
    dueDate: null,
    paidAt: null,
    notes: null,
    lineItems: [makeLineItem()],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    client: makeClient(),
    owner: makeUser(),
    ...overrides,
  };
}

// ─── Mock Repos ───────────────────────────────────────────────────────────────

function makeMockRepo() {
  const qb: any = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue({ max: null }),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    whereInIds: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({}),
  };

  return {
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn(),
    remove: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    _qb: qb,
  };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('InvoicesService', () => {
  let service: InvoicesService;
  let invoiceRepo: ReturnType<typeof makeMockRepo>;
  let lineItemRepo: ReturnType<typeof makeMockRepo>;
  let clientRepo: ReturnType<typeof makeMockRepo>;
  let userRepo: ReturnType<typeof makeMockRepo>;
  let conversationRepo: ReturnType<typeof makeMockRepo>;
  let notificationService: { createNotification: jest.Mock; createErpNotification: jest.Mock };
  let emailService: { queueInvoiceCreated: jest.Mock; queueInvoiceOverdue: jest.Mock };
  let chatService: { saveMessage: jest.Mock };
  let expensesService: { createFromPaidInvoice: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let fileUploadRepo: ReturnType<typeof makeMockRepo>;

  beforeEach(async () => {
    invoiceRepo = makeMockRepo();
    lineItemRepo = makeMockRepo();
    clientRepo = makeMockRepo();
    userRepo = makeMockRepo();
    fileUploadRepo = makeMockRepo();
    fileUploadRepo.create.mockImplementation((dto: any) => ({ id: 'proof-upload-uuid', ...dto }));
    fileUploadRepo.save.mockImplementation(async (r: any) => r);
    // InvoicesService also takes ConversationRepository + ChatService because
    // it posts a system-event chat message when an invoice is created.
    conversationRepo = makeMockRepo();
    conversationRepo.findOne.mockResolvedValue(null); // default: no conversation
    notificationService = {
      createNotification: jest.fn().mockResolvedValue({}),
      createErpNotification: jest.fn().mockResolvedValue({}),
    };
    emailService = {
      queueInvoiceCreated: jest.fn().mockResolvedValue(undefined),
      queueInvoiceOverdue: jest.fn().mockResolvedValue(undefined),
    };
    chatService         = { saveMessage: jest.fn().mockResolvedValue({}) };
    expensesService     = { createFromPaidInvoice: jest.fn().mockResolvedValue(null) };
    const mockAwsService = {
      uploadBuffer: jest.fn().mockResolvedValue('https://cdn.example.com/invoices/inv-1/proof.pdf'),
      resolveLogicalKey: jest.fn().mockImplementation((url: string) => {
        if (!url || !url.startsWith('https://cdn.example.com/')) return null;
        return url.replace('https://cdn.example.com/', '');
      }),
      isKeyInNamespace: jest.fn().mockImplementation((key: string, namespaces: string[]) => {
        if (!key) return false;
        return namespaces.some((ns) => key.startsWith(ns));
      }),
      fileExists: jest.fn().mockResolvedValue(true),
      generateGetUrl: jest.fn().mockImplementation(async (k) => `https://cdn.example.com/${k}?signed=true`),
    };

    // Simple transaction mock: calls the callback with a manager that mirrors invoiceRepo
    dataSource = {
      transaction: jest.fn().mockImplementation(async (cb) => {
        const manager = {
          create: jest.fn((Entity: any, data: any) => ({ ...data })),
          save: jest.fn().mockImplementation((_Entity: any, data: any) => Promise.resolve(data)),
          delete: jest.fn().mockResolvedValue({}),
          findOneOrFail: jest.fn().mockResolvedValue(makeInvoice()),
          getRepository: jest.fn().mockImplementation((entity: any) => {
            if (entity === FileUpload) return fileUploadRepo;
            if (entity === Invoice) return invoiceRepo;
            return invoiceRepo;
          }),
        };
        return cb(manager);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: getRepositoryToken(Invoice),         useValue: invoiceRepo      },
        { provide: getRepositoryToken(InvoiceLineItem), useValue: lineItemRepo     },
        { provide: getRepositoryToken(Client),          useValue: clientRepo       },
        { provide: getRepositoryToken(User),            useValue: userRepo         },
        { provide: getRepositoryToken(Conversation),    useValue: conversationRepo },
        { provide: getRepositoryToken(FileUpload),      useValue: fileUploadRepo   },
        { provide: NotificationService,                 useValue: notificationService },
        { provide: EmailService,                        useValue: emailService     },
        { provide: ChatService,                         useValue: chatService      },
        { provide: DataSource,                          useValue: dataSource       },
        { provide: ExpensesService,                     useValue: expensesService  },
        { provide: AwsService,                          useValue: mockAwsService   },
        // INFO-01 — PublicTokenService (real) + mock ConfigService.
        ...makePublicTokenTestProviders(),
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
  });

  // ── calculateTotals ──────────────────────────────────────────────────────
  describe('calculateTotals', () => {
    it('calculates zero-tax totals correctly', () => {
      const items: LineItemDto[] = [
        { description: 'Item A', quantity: 10, unitPrice: 100 },
        { description: 'Item B', quantity: 2, unitPrice: 50 },
      ];
      const result = service.calculateTotals(items, 0);
      expect(result.subtotal).toBe(1100);
      expect(result.taxAmount).toBe(0);
      expect(result.total).toBe(1100);
    });

    it('calculates 15% tax correctly', () => {
      const items: LineItemDto[] = [{ description: 'Dev', quantity: 1, unitPrice: 1000 }];
      const result = service.calculateTotals(items, 15);
      expect(result.subtotal).toBe(1000);
      expect(result.taxAmount).toBe(150);
      expect(result.total).toBe(1150);
    });

    it('rounds to 2 decimal places', () => {
      const items: LineItemDto[] = [{ description: 'Item', quantity: 3, unitPrice: 33.33 }];
      const result = service.calculateTotals(items, 0);
      expect(result.subtotal).toBe(99.99); // 3 × 33.33 = 99.99
    });

    it('handles multiple items with tax', () => {
      const items: LineItemDto[] = [
        { description: 'A', quantity: 5, unitPrice: 200 },
        { description: 'B', quantity: 3, unitPrice: 100 },
      ];
      const result = service.calculateTotals(items, 10);
      expect(result.subtotal).toBe(1300);
      expect(result.taxAmount).toBe(130);
      expect(result.total).toBe(1430);
    });
  });

  // ── generateInvoiceNumber ────────────────────────────────────────────────
  describe('generateInvoiceNumber', () => {
    it('returns INV-YYYY-0001 when no invoices exist for this year', async () => {
      invoiceRepo._qb.getRawOne.mockResolvedValue({ max: null });
      const year = new Date().getFullYear();
      const result = await service.generateInvoiceNumber();
      expect(result).toBe(`INV-${year}-0001`);
    });

    it('increments from existing max number', async () => {
      const year = new Date().getFullYear();
      invoiceRepo._qb.getRawOne.mockResolvedValue({ max: `INV-${year}-0042` });
      const result = await service.generateInvoiceNumber();
      expect(result).toBe(`INV-${year}-0043`);
    });

    it('zero-pads to 4 digits', async () => {
      const year = new Date().getFullYear();
      invoiceRepo._qb.getRawOne.mockResolvedValue({ max: `INV-${year}-0009` });
      const result = await service.generateInvoiceNumber();
      expect(result).toBe(`INV-${year}-0010`);
    });
  });

  // ── findAll ──────────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('ADMIN sees all invoices without ownership filter', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      const inv = makeInvoice();
      invoiceRepo._qb.getManyAndCount.mockResolvedValue([[inv], 1]);
      const result = await service.findAll(admin, { page: 1, limit: 20 });
      expect(result.total).toBe(1);
      expect(result.invoices).toHaveLength(1);
      // No ownerId filter should be applied for ADMIN
      const whereCallArgs = invoiceRepo._qb.andWhere.mock.calls.map((c: any[]) => c[0]);
      expect(whereCallArgs).not.toContain('inv.ownerId = :uid');
    });

    it('EMPLOYEE sees only own invoices', async () => {
      const employee = makeUser({ role: UserRole.EMPLOYEE });
      invoiceRepo._qb.getManyAndCount.mockResolvedValue([[], 0]);
      await service.findAll(employee, { page: 1, limit: 20 });
      const whereCallArgs = invoiceRepo._qb.andWhere.mock.calls.map((c: any[]) => c[0]);
      expect(whereCallArgs).toContain('inv.ownerId = :uid');
    });

    it('CLIENT sees only own client invoices', async () => {
      const clientUser = makeUser({ id: 'client-user-1', role: UserRole.CLIENT });
      const client = makeClient({ userId: 'client-user-1' });
      clientRepo.findOne.mockResolvedValue(client);
      invoiceRepo._qb.getManyAndCount.mockResolvedValue([[], 0]);
      await service.findAll(clientUser, { page: 1, limit: 20 });
      const whereCallArgs = invoiceRepo._qb.andWhere.mock.calls.map((c: any[]) => c[0]);
      expect(whereCallArgs).toContain('inv.clientId = :cid');
    });

    it('CLIENT with no client record returns empty result', async () => {
      const clientUser = makeUser({ id: 'orphan-user', role: UserRole.CLIENT });
      clientRepo.findOne.mockResolvedValue(null);
      const result = await service.findAll(clientUser, { page: 1, limit: 20 });
      expect(result.total).toBe(0);
      expect(result.invoices).toHaveLength(0);
    });

    it('applies paymentStatus filter', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      invoiceRepo._qb.getManyAndCount.mockResolvedValue([[], 0]);
      await service.findAll(admin, {
        page: 1,
        limit: 20,
        paymentStatus: InvoicePaymentStatus.OVERDUE,
      });
      const whereCallArgs = invoiceRepo._qb.andWhere.mock.calls.map((c: any[]) => c[0]);
      expect(whereCallArgs).toContain('inv.paymentStatus = :paymentStatus');
    });

    it('calculates pages correctly', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      invoiceRepo._qb.getManyAndCount.mockResolvedValue([
        Array(20).fill(makeInvoice()),
        45,
      ]);
      const result = await service.findAll(admin, { page: 1, limit: 20 });
      expect(result.total).toBe(45);
      expect(result.pages).toBe(3);
    });
  });

  // ── findOne ──────────────────────────────────────────────────────────────
  describe('findOne', () => {
    it('ADMIN can access any invoice', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      const inv = makeInvoice();
      invoiceRepo.findOne.mockResolvedValue(inv);
      await expect(service.findOne('inv-1', admin)).resolves.toEqual(inv);
    });

    it('throws ResourceNotFoundException when invoice not found', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      invoiceRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('ghost-id', admin)).rejects.toThrow(
        ResourceNotFoundException,
      );
    });

    it('EMPLOYEE can access own invoice', async () => {
      const emp = makeUser({ id: 'user-1', role: UserRole.EMPLOYEE });
      const inv = makeInvoice({ ownerId: 'user-1' });
      invoiceRepo.findOne.mockResolvedValue(inv);
      await expect(service.findOne('inv-1', emp)).resolves.toEqual(inv);
    });

    it('EMPLOYEE cannot access another owner\'s invoice', async () => {
      const emp = makeUser({ id: 'other-employee', role: UserRole.EMPLOYEE });
      const inv = makeInvoice({ ownerId: 'user-1' });
      invoiceRepo.findOne.mockResolvedValue(inv);
      await expect(service.findOne('inv-1', emp)).rejects.toThrow(
        OwnershipViolationException,
      );
    });

    it('CLIENT can access own invoice', async () => {
      const cUser = makeUser({ id: 'client-user-1', role: UserRole.CLIENT });
      const client = makeClient({ id: 'client-1', userId: 'client-user-1' });
      const inv = makeInvoice({ clientId: 'client-1' });
      invoiceRepo.findOne.mockResolvedValue(inv);
      clientRepo.findOne.mockResolvedValue(client);
      await expect(service.findOne('inv-1', cUser)).resolves.toEqual(inv);
    });

    it('CLIENT cannot access another client\'s invoice', async () => {
      const cUser = makeUser({ id: 'client-user-1', role: UserRole.CLIENT });
      const client = makeClient({ id: 'client-OTHER', userId: 'client-user-1' });
      const inv = makeInvoice({ clientId: 'client-1' }); // different client
      invoiceRepo.findOne.mockResolvedValue(inv);
      clientRepo.findOne.mockResolvedValue(client);
      await expect(service.findOne('inv-1', cUser)).rejects.toThrow(
        InsufficientPermissionsException,
      );
    });
  });

  // ── create ───────────────────────────────────────────────────────────────
  describe('create', () => {
    it('creates invoice with correct totals and sets ownerId from actingUser', async () => {
      const emp = makeUser({ id: 'user-1', role: UserRole.EMPLOYEE });
      const client = makeClient({ id: 'client-1', ownerId: 'user-1' });
      clientRepo.findOne.mockResolvedValue(client);

      const result = await service.create(
        {
          clientId: 'client-1',
          lineItems: [{ description: 'Dev', quantity: 10, unitPrice: 150 }],
          taxRate: 10,
        },
        emp,
      );

      // Transaction mock returns makeInvoice() from findOneOrFail
      expect(result).toBeDefined();
      expect(dataSource.transaction).toHaveBeenCalled();
    });

    it('throws ResourceNotFoundException when client not found', async () => {
      const emp = makeUser({ role: UserRole.EMPLOYEE });
      clientRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create(
          { clientId: 'ghost-client', lineItems: [{ description: 'x', quantity: 1, unitPrice: 1 }] },
          emp,
        ),
      ).rejects.toThrow(ResourceNotFoundException);
    });

    it('EMPLOYEE cannot create invoice for client they do not own', async () => {
      const emp = makeUser({ id: 'other-employee', role: UserRole.EMPLOYEE });
      const client = makeClient({ ownerId: 'user-1' }); // owned by different employee
      clientRepo.findOne.mockResolvedValue(client);
      await expect(
        service.create(
          { clientId: 'client-1', lineItems: [{ description: 'x', quantity: 1, unitPrice: 1 }] },
          emp,
        ),
      ).rejects.toThrow(OwnershipViolationException);
    });

    it('fires INVOICE_CREATED notification to client user', async () => {
      const emp = makeUser({ id: 'user-1', role: UserRole.EMPLOYEE });
      const client = makeClient({ userId: 'client-user-1', ownerId: 'user-1' });
      clientRepo.findOne.mockResolvedValue(client);

      await service.create(
        {
          clientId: 'client-1',
          lineItems: [{ description: 'Dev', quantity: 1, unitPrice: 500 }],
        },
        emp,
      );

      expect(notificationService.createErpNotification).toHaveBeenCalledWith(
        'client-user-1',
        'INVOICE_CREATED',
        expect.any(String),
        expect.any(String),
        undefined, // invoice id not populated in mock transaction
      );
    });
  });

  // ── update ────────────────────────────────────────────────────────────────
  describe('update', () => {
    it('only UNPAID invoices can be updated', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      const paidInvoice = makeInvoice({ paymentStatus: InvoicePaymentStatus.PAID });
      invoiceRepo.findOne.mockResolvedValue(paidInvoice);
      await expect(service.update('inv-1', { taxRate: 5 }, admin)).rejects.toThrow(AppException);
    });

    it('EMPLOYEE cannot update invoice they do not own', async () => {
      const emp = makeUser({ id: 'other-emp', role: UserRole.EMPLOYEE });
      const inv = makeInvoice({ ownerId: 'user-1' });
      invoiceRepo.findOne.mockResolvedValue(inv);
      await expect(service.update('inv-1', { notes: 'x' }, emp)).rejects.toThrow(
        OwnershipViolationException,
      );
    });

    it('ADMIN can update any UNPAID invoice', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      const inv = makeInvoice({ paymentStatus: InvoicePaymentStatus.UNPAID });
      invoiceRepo.findOne.mockResolvedValue(inv);
      const result = await service.update('inv-1', { notes: 'updated' }, admin);
      expect(result).toBeDefined();
    });
  });

  // ── markAsPaid ────────────────────────────────────────────────────────
  describe('markAsPaid', () => {
    it('marks UNPAID invoice as PAID and sets paidAt', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      const inv = makeInvoice({ paymentStatus: InvoicePaymentStatus.UNPAID });
      invoiceRepo.findOne.mockResolvedValue(inv);
      invoiceRepo.save.mockResolvedValue(inv);
      clientRepo.findOne.mockResolvedValue(makeClient());

      const result = await service.markAsPaid('inv-1', {}, admin);
      expect(result.paymentStatus).toBe(InvoicePaymentStatus.PAID);
      expect(result.paidAt).toBeDefined();
    });

    it('marks OVERDUE invoice as PAID', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      const inv = makeInvoice({ paymentStatus: InvoicePaymentStatus.OVERDUE });
      invoiceRepo.findOne.mockResolvedValue(inv);
      invoiceRepo.save.mockResolvedValue(inv);
      clientRepo.findOne.mockResolvedValue(makeClient());

      const result = await service.markAsPaid('inv-1', {}, admin);
      expect(result.paymentStatus).toBe(InvoicePaymentStatus.PAID);
    });

    it('throws AppException if already PAID', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      const inv = makeInvoice({ paymentStatus: InvoicePaymentStatus.PAID });
      invoiceRepo.findOne.mockResolvedValue(inv);
      await expect(service.markAsPaid('inv-1', {}, admin)).rejects.toThrow(AppException);
    });

    it('uses provided paidAt date', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      const inv = makeInvoice({ paymentStatus: InvoicePaymentStatus.UNPAID });
      invoiceRepo.findOne.mockResolvedValue(inv);
      invoiceRepo.save.mockResolvedValue(inv);
      clientRepo.findOne.mockResolvedValue(makeClient());

      const paidAt = '2026-06-01T10:00:00Z';
      const result = await service.markAsPaid('inv-1', { paidAt }, admin);
      expect(result.paidAt?.toISOString()).toBe(new Date(paidAt).toISOString());
    });

    it('fires INVOICE_PAID notification to client user', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      const inv = makeInvoice({ paymentStatus: InvoicePaymentStatus.UNPAID });
      const client = makeClient({ userId: 'client-user-1' });
      invoiceRepo.findOne.mockResolvedValue(inv);
      invoiceRepo.save.mockResolvedValue(inv);
      clientRepo.findOne.mockResolvedValue(client);

      await service.markAsPaid('inv-1', {}, admin);
      expect(notificationService.createErpNotification).toHaveBeenCalledWith(
        'client-user-1',
        'INVOICE_CREATED',
        expect.any(String),
        expect.any(String),
        expect.anything(), // invoice id
      );
    });
  });

  // ── recalculateOverdueStatus ──────────────────────────────────────────
  describe('recalculateOverdueStatus', () => {
    it('returns 0 when no UNPAID overdue invoices exist', async () => {
      invoiceRepo.find.mockResolvedValue([]);
      const count = await service.recalculateOverdueStatus();
      expect(count).toBe(0);
    });

    it('updates UNPAID past-due invoices to OVERDUE', async () => {
      const pastDueInvoice = makeInvoice({
        paymentStatus: InvoicePaymentStatus.UNPAID,
        dueDate: '2026-01-01',
      });
      invoiceRepo.find.mockResolvedValue([pastDueInvoice]);
      invoiceRepo._qb.execute.mockResolvedValue({});

      const count = await service.recalculateOverdueStatus();
      expect(count).toBe(1);
    });

    it('fires INVOICE_OVERDUE notification to owner and client', async () => {
      const pastDueInvoice = makeInvoice({
        paymentStatus: InvoicePaymentStatus.UNPAID,
        dueDate: '2026-01-01',
        ownerId: 'user-1',
        client: makeClient({ userId: 'client-user-1' }),
      });
      invoiceRepo.find.mockResolvedValue([pastDueInvoice]);

      await service.recalculateOverdueStatus();

      expect(notificationService.createErpNotification).toHaveBeenCalledTimes(2);
      const calls = notificationService.createErpNotification.mock.calls.map((c: any[]) => c[0] as string);
      expect(calls).toContain('user-1');
      expect(calls).toContain('client-user-1');
    });

    it('does not call update when no overdue invoices exist', async () => {
      invoiceRepo.find.mockResolvedValue([]);
      await service.recalculateOverdueStatus();
      expect(invoiceRepo._qb.execute).not.toHaveBeenCalled();
    });
  });

  // ── remove ───────────────────────────────────────────────────────────
  describe('remove', () => {
    it('ADMIN can delete UNPAID invoice', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      const inv = makeInvoice({ paymentStatus: InvoicePaymentStatus.UNPAID });
      invoiceRepo.findOne.mockResolvedValue(inv);
      invoiceRepo.remove.mockResolvedValue(undefined);
      await expect(service.remove('inv-1', admin)).resolves.toBeUndefined();
    });

    it('EMPLOYEE cannot delete invoices', async () => {
      const emp = makeUser({ role: UserRole.EMPLOYEE });
      await expect(service.remove('inv-1', emp)).rejects.toThrow(
        InsufficientPermissionsException,
      );
    });

    it('throws ResourceNotFoundException when invoice not found', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      invoiceRepo.findOne.mockResolvedValue(null);
      await expect(service.remove('ghost', admin)).rejects.toThrow(
        ResourceNotFoundException,
      );
    });

    it('ADMIN cannot delete PAID invoice', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      const paidInv = makeInvoice({ paymentStatus: InvoicePaymentStatus.PAID });
      invoiceRepo.findOne.mockResolvedValue(paidInv);
      await expect(service.remove('inv-1', admin)).rejects.toThrow(AppException);
    });

    it('ADMIN cannot delete OVERDUE invoice', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      const overdueInv = makeInvoice({ paymentStatus: InvoicePaymentStatus.OVERDUE });
      invoiceRepo.findOne.mockResolvedValue(overdueInv);
      await expect(service.remove('inv-1', admin)).rejects.toThrow(AppException);
    });
  });

  // ── uploadPaymentProof ────────────────────────────────────────────────
  describe('uploadPaymentProof', () => {
    const tinyPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n');
    const tinyPng = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082', 'hex');

    it('rejects non-CLIENT users', async () => {
      const emp = makeUser({ role: UserRole.EMPLOYEE });
      const file = { buffer: tinyPdf, originalname: 'proof.pdf' } as Express.Multer.File;
      await expect(service.uploadPaymentProof('inv-1', file, emp)).rejects.toThrow(
        InsufficientPermissionsException,
      );
    });

    it('rejects empty or missing file', async () => {
      const client = makeUser({ id: 'client-u', role: UserRole.CLIENT });
      const inv = makeInvoice({ clientId: 'c-1', client: makeClient({ userId: 'client-u' }) });
      invoiceRepo.findOne.mockResolvedValue(inv);
      clientRepo.findOne.mockResolvedValue(makeClient({ id: 'c-1', userId: 'client-u' }));

      const file = { buffer: Buffer.from(''), originalname: 'empty.pdf' } as Express.Multer.File;
      await expect(service.uploadPaymentProof('inv-1', file, client)).rejects.toThrow(AppException);
    });

    it('rejects unsupported file type', async () => {
      const client = makeUser({ id: 'client-u', role: UserRole.CLIENT });
      const inv = makeInvoice({ clientId: 'c-1', client: makeClient({ userId: 'client-u' }) });
      invoiceRepo.findOne.mockResolvedValue(inv);
      clientRepo.findOne.mockResolvedValue(makeClient({ id: 'c-1', userId: 'client-u' }));

      const file = { buffer: Buffer.from('MZ\x90\x00\x03\x00'), originalname: 'trojan.exe' } as Express.Multer.File;
      await expect(service.uploadPaymentProof('inv-1', file, client)).rejects.toThrow(AppException);
    });

    it('uploads valid PNG and returns server-controlled key in invoices namespace', async () => {
      const client = makeUser({ id: 'client-u', role: UserRole.CLIENT });
      const inv = makeInvoice({ id: 'inv-1', clientId: 'c-1', client: makeClient({ userId: 'client-u' }) });
      invoiceRepo.findOne.mockResolvedValue(inv);
      clientRepo.findOne.mockResolvedValue(makeClient({ id: 'c-1', userId: 'client-u' }));

      const file = { buffer: tinyPng, originalname: '../../../etc/passwd.png' } as Express.Multer.File;
      const res = await service.uploadPaymentProof('inv-1', file, client);

      expect(res.contentType).toBe('image/png');
      expect(res.key).toMatch(/^invoices\/inv-1\/[0-9]+-[a-f0-9-]+\.png$/);
    });
  });

  // ── submitPaymentProof ────────────────────────────────────────────────
  describe('submitPaymentProof', () => {
    it('rejects external URL not matching storage', async () => {
      const client = makeUser({ id: 'client-u', role: UserRole.CLIENT });
      const inv = makeInvoice({ id: 'inv-1', clientId: 'c-1', client: makeClient({ userId: 'client-u' }) });
      invoiceRepo.findOne.mockResolvedValue(inv);
      clientRepo.findOne.mockResolvedValue(makeClient({ id: 'c-1', userId: 'client-u' }));

      await expect(
        service.submitPaymentProof('inv-1', { proofUrl: 'https://evil.com/fake.png' }, client),
      ).rejects.toThrow(AppException);
    });

    it('rejects proof URL from another invoice namespace', async () => {
      const client = makeUser({ id: 'client-u', role: UserRole.CLIENT });
      const inv = makeInvoice({ id: 'inv-1', clientId: 'c-1', client: makeClient({ userId: 'client-u' }) });
      invoiceRepo.findOne.mockResolvedValue(inv);
      clientRepo.findOne.mockResolvedValue(makeClient({ id: 'c-1', userId: 'client-u' }));

      await expect(
        service.submitPaymentProof(
          'inv-1',
          { proofUrl: 'https://cdn.example.com/invoices/other-invoice/proof.png' },
          client,
        ),
      ).rejects.toThrow(AppException);
    });

    it('saves notes and notifies owner when proof is valid and verified in file_uploads', async () => {
      const client = makeUser({ id: 'client-u', role: UserRole.CLIENT });
      const inv = makeInvoice({
        id: 'inv-1',
        ownerId: 'owner-1',
        clientId: 'c-1',
        client: makeClient({ userId: 'client-u' }),
        notes: null,
      });
      invoiceRepo.findOne.mockResolvedValue(inv);
      clientRepo.findOne.mockResolvedValue(makeClient({ id: 'c-1', userId: 'client-u' }));
      invoiceRepo.save.mockImplementation(async (i: any) => i);
      fileUploadRepo.findOne.mockResolvedValueOnce({
        id: 'proof-up-1',
        userId: 'client-u',
        resourceType: FileUploadResourceType.INVOICE,
        resourceId: 'inv-1',
        s3Key: 'invoices/inv-1/proof.pdf',
        fileUrl: 'https://cdn.example.com/invoices/inv-1/proof.pdf',
        originalName: 'proof.pdf',
        sizeBytes: 1024,
        status: FileUploadStatus.PENDING,
      });

      const res = await service.submitPaymentProof(
        'inv-1',
        { proofUrl: 'https://cdn.example.com/invoices/inv-1/proof.pdf', notes: 'Paid in full' },
        client,
      );

      expect(res.notes).toContain('Proof URL: https://cdn.example.com/invoices/inv-1/proof.pdf');
      expect(res.notes).toContain('Paid in full');
      expect(notificationService.createErpNotification).toHaveBeenCalledWith(
        'owner-1',
        NotificationType.INVOICE_CREATED,
        'Payment Proof Submitted',
        expect.any(String),
        'inv-1',
      );
      expect(fileUploadRepo.update).toHaveBeenCalledWith(
        { s3Key: 'invoices/inv-1/proof.pdf', status: FileUploadStatus.PENDING },
        expect.objectContaining({ status: FileUploadStatus.CONSUMED }),
      );
    });

    it('rejects unverified proof not found in file_uploads', async () => {
      const client = makeUser({ id: 'client-u', role: UserRole.CLIENT });
      const inv = makeInvoice({ id: 'inv-1', clientId: 'c-1', client: makeClient({ userId: 'client-u' }) });
      invoiceRepo.findOne.mockResolvedValue(inv);
      clientRepo.findOne.mockResolvedValue(makeClient({ id: 'c-1', userId: 'client-u' }));
      fileUploadRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.submitPaymentProof(
          'inv-1',
          { proofUrl: 'https://cdn.example.com/invoices/inv-1/untracked.pdf' },
          client,
        ),
      ).rejects.toThrow(AppException);
    });

    it('rejects proof belonging to another user (cross-user reuse)', async () => {
      const client = makeUser({ id: 'client-u', role: UserRole.CLIENT });
      const inv = makeInvoice({ id: 'inv-1', clientId: 'c-1', client: makeClient({ userId: 'client-u' }) });
      invoiceRepo.findOne.mockResolvedValue(inv);
      clientRepo.findOne.mockResolvedValue(makeClient({ id: 'c-1', userId: 'client-u' }));
      fileUploadRepo.findOne.mockResolvedValueOnce({
        id: 'proof-up-cross',
        userId: 'other-user',
        resourceType: FileUploadResourceType.INVOICE,
        resourceId: 'inv-1',
        s3Key: 'invoices/inv-1/cross.pdf',
        fileUrl: 'https://cdn.example.com/invoices/inv-1/cross.pdf',
        originalName: 'cross.pdf',
        sizeBytes: 1024,
        status: FileUploadStatus.PENDING,
      });

      await expect(
        service.submitPaymentProof(
          'inv-1',
          { proofUrl: 'https://cdn.example.com/invoices/inv-1/cross.pdf' },
          client,
        ),
      ).rejects.toThrow(AppException);
    });

    it('rejects already-consumed payment proof', async () => {
      const client = makeUser({ id: 'client-u', role: UserRole.CLIENT });
      const inv = makeInvoice({ id: 'inv-1', clientId: 'c-1', client: makeClient({ userId: 'client-u' }) });
      invoiceRepo.findOne.mockResolvedValue(inv);
      clientRepo.findOne.mockResolvedValue(makeClient({ id: 'c-1', userId: 'client-u' }));
      fileUploadRepo.findOne.mockResolvedValueOnce({
        id: 'proof-up-consumed',
        userId: 'client-u',
        resourceType: FileUploadResourceType.INVOICE,
        resourceId: 'inv-1',
        s3Key: 'invoices/inv-1/consumed.pdf',
        fileUrl: 'https://cdn.example.com/invoices/inv-1/consumed.pdf',
        originalName: 'consumed.pdf',
        sizeBytes: 1024,
        status: FileUploadStatus.CONSUMED,
      });

      await expect(
        service.submitPaymentProof(
          'inv-1',
          { proofUrl: 'https://cdn.example.com/invoices/inv-1/consumed.pdf' },
          client,
        ),
      ).rejects.toThrow(AppException);
    });

    it('rolls back and throws CONFLICT if proof is consumed concurrently during transaction', async () => {
      const client = makeUser({ id: 'client-u', role: UserRole.CLIENT });
      const inv = makeInvoice({ id: 'inv-1', clientId: 'c-1', client: makeClient({ userId: 'client-u' }) });
      invoiceRepo.findOne.mockResolvedValue(inv);
      clientRepo.findOne.mockResolvedValue(makeClient({ id: 'c-1', userId: 'client-u' }));
      fileUploadRepo.findOne.mockResolvedValueOnce({
        id: 'proof-up-concurrent',
        userId: 'client-u',
        resourceType: FileUploadResourceType.INVOICE,
        resourceId: 'inv-1',
        s3Key: 'invoices/inv-1/concurrent.pdf',
        fileUrl: 'https://cdn.example.com/invoices/inv-1/concurrent.pdf',
        originalName: 'concurrent.pdf',
        sizeBytes: 1024,
        status: FileUploadStatus.PENDING,
      });
      // Simulate concurrent consumption inside transaction
      fileUploadRepo.update.mockResolvedValueOnce({ affected: 0 });

      await expect(
        service.submitPaymentProof(
          'inv-1',
          { proofUrl: 'https://cdn.example.com/invoices/inv-1/concurrent.pdf' },
          client,
        ),
      ).rejects.toThrow(AppException);
    });

    it('rolls back transaction if invoice save fails', async () => {
      const client = makeUser({ id: 'client-u', role: UserRole.CLIENT });
      const inv = makeInvoice({ id: 'inv-1', clientId: 'c-1', client: makeClient({ userId: 'client-u' }) });
      invoiceRepo.findOne.mockResolvedValue(inv);
      clientRepo.findOne.mockResolvedValue(makeClient({ id: 'c-1', userId: 'client-u' }));
      fileUploadRepo.findOne.mockResolvedValueOnce({
        id: 'proof-up-fail',
        userId: 'client-u',
        resourceType: FileUploadResourceType.INVOICE,
        resourceId: 'inv-1',
        s3Key: 'invoices/inv-1/fail.pdf',
        fileUrl: 'https://cdn.example.com/invoices/inv-1/fail.pdf',
        originalName: 'fail.pdf',
        sizeBytes: 1024,
        status: FileUploadStatus.PENDING,
      });
      fileUploadRepo.update.mockResolvedValueOnce({ affected: 1 });
      invoiceRepo.save.mockRejectedValueOnce(new Error('DB failure on invoice save'));

      await expect(
        service.submitPaymentProof(
          'inv-1',
          { proofUrl: 'https://cdn.example.com/invoices/inv-1/fail.pdf' },
          client,
        ),
      ).rejects.toThrow('DB failure on invoice save');
    });
  });

  describe('getSignedPaymentProofUrl', () => {
    it('generates signed download URL when client has access and proof is in invoice notes', async () => {
      const client = makeUser({ id: 'client-u', role: UserRole.CLIENT });
      const inv = makeInvoice({
        id: 'inv-1',
        clientId: 'c-1',
        client: makeClient({ userId: 'client-u' }),
        notes: '[Payment proof submitted] Proof URL: https://cdn.example.com/invoices/inv-1/proof.pdf',
      });
      invoiceRepo.findOne.mockResolvedValue(inv);
      clientRepo.findOne.mockResolvedValue(makeClient({ id: 'c-1', userId: 'client-u' }));

      const url = await service.getSignedPaymentProofUrl('inv-1', 'https://cdn.example.com/invoices/inv-1/proof.pdf', client);
      expect(url).toBe('https://cdn.example.com/invoices/inv-1/proof.pdf?signed=true');
    });

    it('rejects proof key belonging to a different invoice', async () => {
      const client = makeUser({ id: 'client-u', role: UserRole.CLIENT });
      const inv = makeInvoice({ id: 'inv-1', clientId: 'c-1', client: makeClient({ userId: 'client-u' }) });
      invoiceRepo.findOne.mockResolvedValue(inv);
      clientRepo.findOne.mockResolvedValue(makeClient({ id: 'c-1', userId: 'client-u' }));

      await expect(
        service.getSignedPaymentProofUrl('inv-1', 'https://cdn.example.com/invoices/other-inv/proof.pdf', client),
      ).rejects.toThrow(AppException);
    });
  });
});
