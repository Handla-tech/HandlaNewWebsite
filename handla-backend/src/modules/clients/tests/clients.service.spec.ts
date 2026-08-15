import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { ClientsService } from '../clients.service';
import { Client } from '../entities/client.entity';
import { User } from '../../auth/entities/user.entity';
import { UserRole, ClientStatus } from '../../../common/enums';
import {
  ResourceNotFoundException,
  OwnershipViolationException,
  InsufficientPermissionsException,
  EmailAlreadyExistsException,
  AppException,
} from '../../../utils/exceptions';
import { NotificationService } from '../../notifications/notification.service';
import { EmailService } from '../../email/email.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-uuid-1',
    email: 'user@example.com',
    passwordHash: 'hashed',
    name: 'Test User',
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
    id: 'client-uuid-1',
    userId: 'user-uuid-client',
    ownerId: 'user-uuid-1',
    company: 'Acme Corp',
    status: ClientStatus.ACTIVE,
    notes: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    user: makeUser({ id: 'user-uuid-client', role: UserRole.CLIENT }),
    owner: makeUser({ id: 'user-uuid-1', role: UserRole.EMPLOYEE }),
    projects: [],
    contracts: [],
    invoices: [],
    ...overrides,
  };
}

// ─── Mock QueryBuilder ────────────────────────────────────────────────────────

function makeQB(result: Client[] | null = [], count = 0) {
  const qb: any = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([result ?? [], count]),
  };
  return qb;
}

// ─── Mock Repos ───────────────────────────────────────────────────────────────

const mockClientRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  createQueryBuilder: jest.fn(),
  manager: {
    transaction: jest.fn(),
    createQueryBuilder: jest.fn(),
  },
};

const mockUserRepo = {
  findOne: jest.fn(),
};

const mockNotificationService = {
  createErpNotification: jest.fn().mockResolvedValue({}),
};

const mockEmailService = {
  queueLeadAssigned: jest.fn().mockResolvedValue(undefined),
  queueUserCreatedEmail: jest.fn().mockResolvedValue(undefined),
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('ClientsService', () => {
  let service: ClientsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientsService,
        { provide: getRepositoryToken(Client), useValue: mockClientRepo },
        { provide: getRepositoryToken(User),   useValue: mockUserRepo },
        { provide: NotificationService,        useValue: mockNotificationService },
        { provide: EmailService,               useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<ClientsService>(ClientsService);
    jest.clearAllMocks();
  });

  // ─── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('ADMIN sees all clients (no ownerId filter)', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      const client = makeClient();
      const qb = makeQB([client], 1);
      mockClientRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(admin, { page: 1, limit: 20 });

      expect(result.total).toBe(1);
      expect(result.clients).toHaveLength(1);
      // ADMIN: no andWhere called for userId
      const andWhereCalls = (qb.andWhere as jest.Mock).mock.calls;
      expect(andWhereCalls.some((c: string[]) => c[0].includes('ownerId'))).toBe(false);
    });

    it('EMPLOYEE sees only own clients', async () => {
      const employee = makeUser({ role: UserRole.EMPLOYEE, id: 'emp-id' });
      const qb = makeQB([makeClient({ ownerId: 'emp-id' })], 1);
      mockClientRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(employee, { page: 1, limit: 20 });

      expect(result.total).toBe(1);
      // EMPLOYEE: andWhere should include userId filter
      const andWhereCalls = (qb.andWhere as jest.Mock).mock.calls;
      expect(andWhereCalls.some((c: any[]) => c[0].includes('ownerId'))).toBe(true);
    });

    it('applies status filter', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      const qb = makeQB([makeClient({ status: ClientStatus.INACTIVE })], 1);
      mockClientRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(admin, { page: 1, limit: 20, status: ClientStatus.INACTIVE });

      const andWhereCalls = (qb.andWhere as jest.Mock).mock.calls;
      expect(andWhereCalls.some((c: any[]) => c[0].includes('status'))).toBe(true);
    });

    it('applies search filter on name/company', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      const qb = makeQB([], 0);
      mockClientRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(admin, { page: 1, limit: 20, search: 'Acme' });

      const andWhereCalls = (qb.andWhere as jest.Mock).mock.calls;
      // MySQL uses LIKE (case-insensitive on utf8mb4_unicode_ci), not Postgres ILIKE.
      expect(andWhereCalls.some((c: any[]) => c[0].includes('LIKE'))).toBe(true);
    });

    it('returns correct pagination math', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      const qb = makeQB([], 45);
      mockClientRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(admin, { page: 2, limit: 20 });

      expect(result.page).toBe(2);
      expect(result.pages).toBe(3); // ceil(45/20) = 3
      expect(result.total).toBe(45);
    });
  });

  // ─── findOne ────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns client when found', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      const client = makeClient();
      mockClientRepo.findOne.mockResolvedValue(client);

      const result = await service.findOne('client-uuid-1', admin);
      expect(result.id).toBe('client-uuid-1');
    });

    it('throws ResourceNotFoundException when not found', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      mockClientRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('ghost-id', admin)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });

    it('throws OwnershipViolationException for EMPLOYEE who does not own client', async () => {
      const employee = makeUser({ role: UserRole.EMPLOYEE, id: 'emp-a' });
      const client = makeClient({ ownerId: 'emp-b' }); // different owner
      mockClientRepo.findOne.mockResolvedValue(client);

      await expect(service.findOne('client-uuid-1', employee)).rejects.toBeInstanceOf(
        OwnershipViolationException,
      );
    });

    it('EMPLOYEE who owns client can access it', async () => {
      const employee = makeUser({ role: UserRole.EMPLOYEE, id: 'emp-a' });
      const client = makeClient({ ownerId: 'emp-a' });
      mockClientRepo.findOne.mockResolvedValue(client);

      const result = await service.findOne('client-uuid-1', employee);
      expect(result.ownerId).toBe('emp-a');
    });
  });

  // ─── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a client record with ownerId from EMPLOYEE actor', async () => {
      const employee = makeUser({ role: UserRole.EMPLOYEE, id: 'emp-id' });
      const targetUser = makeUser({ id: 'client-user', role: UserRole.CLIENT });
      const saved = makeClient({ userId: 'client-user', ownerId: 'emp-id' });

      mockUserRepo.findOne.mockResolvedValue(targetUser);
      mockClientRepo.findOne
        .mockResolvedValueOnce(null) // no duplicate check
        .mockResolvedValueOnce(saved); // refetch after save
      mockClientRepo.create.mockReturnValue(saved);
      mockClientRepo.save.mockResolvedValue(saved);

      const result = await service.create({ userId: 'client-user' }, employee);
      expect(result.ownerId).toBe('emp-id');
    });

    it('throws AppException if target user is not CLIENT role', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      const targetUser = makeUser({ id: 'lead-user', role: UserRole.LEAD });

      mockUserRepo.findOne.mockResolvedValue(targetUser);

      await expect(service.create({ userId: 'lead-user' }, admin)).rejects.toBeInstanceOf(
        AppException,
      );
    });

    it('throws AppException if Client record already exists for userId', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      const targetUser = makeUser({ id: 'client-user', role: UserRole.CLIENT });
      const existing = makeClient({ userId: 'client-user' });

      mockUserRepo.findOne.mockResolvedValue(targetUser);
      mockClientRepo.findOne.mockResolvedValue(existing); // duplicate found

      await expect(service.create({ userId: 'client-user' }, admin)).rejects.toBeInstanceOf(
        AppException,
      );
    });

    it('throws ResourceNotFoundException if target user not found', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(service.create({ userId: 'ghost' }, admin)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });
  });

  // ─── provision ────────────────────────────────────────────────────────────────

  describe('provision', () => {
    /** Wire the transaction mock to run the callback with a fake EntityManager. */
    function wireTransaction(createdClientId: string, createdUserId = 'new-user-id') {
      const manager: any = {
        create: jest.fn((entity: any, data: any) => ({ ...data })),
        save: jest.fn(),
      };
      // First save() = user (gets an id), second save() = client (gets an id).
      manager.save
        .mockResolvedValueOnce({ id: createdUserId })
        .mockResolvedValueOnce({ id: createdClientId });
      mockClientRepo.manager.transaction.mockImplementation(async (cb: any) => cb(manager));
      return manager;
    }

    it('creates a CLIENT user + record atomically; EMPLOYEE actor owns it', async () => {
      const employee = makeUser({ role: UserRole.EMPLOYEE, id: 'emp-id' });
      const finalClient = makeClient({ id: 'prov-client', ownerId: 'emp-id' });

      mockUserRepo.findOne.mockResolvedValue(null); // email not taken
      const manager = wireTransaction('prov-client');
      mockClientRepo.findOne.mockResolvedValue(finalClient); // refetch after tx

      const result = await service.provision(
        { name: 'Jane', email: 'Jane@Example.com', password: 'password123' },
        employee,
      );

      // User is created with lowercased email + CLIENT role.
      expect(manager.create).toHaveBeenCalledWith(
        User,
        expect.objectContaining({ email: 'jane@example.com', role: UserRole.CLIENT }),
      );
      // Client is owned by the acting employee.
      expect(manager.create).toHaveBeenCalledWith(
        Client,
        expect.objectContaining({ ownerId: 'emp-id' }),
      );
      expect(result).toBe(finalClient);
    });

    it('ADMIN actor leaves the new client unassigned (ownerId null)', async () => {
      const admin = makeUser({ role: UserRole.ADMIN, id: 'admin-id' });
      mockUserRepo.findOne.mockResolvedValue(null);
      const manager = wireTransaction('prov-client-2');
      mockClientRepo.findOne.mockResolvedValue(makeClient({ id: 'prov-client-2' }));

      await service.provision(
        { name: 'Bob', email: 'bob@example.com', password: 'password123' },
        admin,
      );

      expect(manager.create).toHaveBeenCalledWith(
        Client,
        expect.objectContaining({ ownerId: null }),
      );
    });

    it('throws EmailAlreadyExistsException when email is taken', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      mockUserRepo.findOne.mockResolvedValue(makeUser({ id: 'dupe' }));

      await expect(
        service.provision(
          { name: 'Dup', email: 'dupe@example.com', password: 'password123' },
          admin,
        ),
      ).rejects.toBeInstanceOf(EmailAlreadyExistsException);
      expect(mockClientRepo.manager.transaction).not.toHaveBeenCalled();
    });
  });

  // ─── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('EMPLOYEE can update own client', async () => {
      const employee = makeUser({ role: UserRole.EMPLOYEE, id: 'emp-a' });
      const client = makeClient({ ownerId: 'emp-a' });
      mockClientRepo.findOne.mockResolvedValue(client);
      mockClientRepo.save.mockResolvedValue({ ...client, company: 'Updated Corp' });

      const result = await service.update('client-uuid-1', { company: 'Updated Corp' }, employee);
      expect(result.company).toBe('Updated Corp');
    });

    it("EMPLOYEE cannot update another employee's client", async () => {
      const employee = makeUser({ role: UserRole.EMPLOYEE, id: 'emp-a' });
      const client = makeClient({ ownerId: 'emp-b' }); // different owner
      mockClientRepo.findOne.mockResolvedValue(client);

      await expect(
        service.update('client-uuid-1', { company: 'X' }, employee),
      ).rejects.toBeInstanceOf(OwnershipViolationException);
    });

    it('ADMIN can update any client', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      const client = makeClient({ ownerId: 'emp-b' });
      mockClientRepo.findOne.mockResolvedValue(client);
      mockClientRepo.save.mockResolvedValue({ ...client, status: ClientStatus.INACTIVE });

      const result = await service.update(
        'client-uuid-1',
        { status: ClientStatus.INACTIVE },
        admin,
      );
      expect(result.status).toBe(ClientStatus.INACTIVE);
    });
  });

  // ─── remove ─────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('ADMIN can remove a client', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      const client = makeClient();
      mockClientRepo.findOne.mockResolvedValue(client);
      mockClientRepo.remove.mockResolvedValue(undefined);

      await expect(service.remove('client-uuid-1', admin)).resolves.toBeUndefined();
      expect(mockClientRepo.remove).toHaveBeenCalledWith(client);
    });

    it('EMPLOYEE throws InsufficientPermissionsException on remove', async () => {
      const employee = makeUser({ role: UserRole.EMPLOYEE });

      await expect(service.remove('client-uuid-1', employee)).rejects.toBeInstanceOf(
        InsufficientPermissionsException,
      );
    });

    it('throws ResourceNotFoundException if client not found', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      mockClientRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('ghost-id', admin)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });
  });

  // ─── assignOwner ────────────────────────────────────────────────────────────

  describe('assignOwner', () => {
    it('ADMIN can reassign owner and updates conversations', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      const client = makeClient({ ownerId: 'emp-old' });
      const newOwner = makeUser({ id: 'emp-new', role: UserRole.EMPLOYEE });

      // First findOne (for client), second findOne (refetch after save)
      mockClientRepo.findOne
        .mockResolvedValueOnce(client)
        .mockResolvedValueOnce({ ...client, ownerId: 'emp-new' });
      mockUserRepo.findOne.mockResolvedValue(newOwner);
      mockClientRepo.save.mockResolvedValue({ ...client, ownerId: 'emp-new' });

      // Mock the transaction
      const mockQBUpdate = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      mockClientRepo.manager.transaction.mockImplementation(
        async (cb: (em: any) => Promise<void>) => {
          await cb({ createQueryBuilder: () => mockQBUpdate });
        },
      );

      const result = await service.assignOwner('client-uuid-1', 'emp-new', admin);
      expect(result.ownerId).toBe('emp-new');
    });

    it('throws AppException if new owner is not EMPLOYEE', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      const client = makeClient();
      const badOwner = makeUser({ id: 'client-id', role: UserRole.CLIENT });

      mockClientRepo.findOne.mockResolvedValue(client);
      mockUserRepo.findOne.mockResolvedValue(badOwner);

      await expect(service.assignOwner('client-uuid-1', 'client-id', admin)).rejects.toBeInstanceOf(
        AppException,
      );
    });

    it('throws InsufficientPermissionsException for EMPLOYEE', async () => {
      const employee = makeUser({ role: UserRole.EMPLOYEE });

      await expect(
        service.assignOwner('client-uuid-1', 'emp-new', employee),
      ).rejects.toBeInstanceOf(InsufficientPermissionsException);
    });

    it('throws ResourceNotFoundException if client not found', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      mockClientRepo.findOne.mockResolvedValue(null);

      await expect(service.assignOwner('ghost-id', 'emp-new', admin)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });

    it('throws ResourceNotFoundException if new owner not found', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      const client = makeClient();
      mockClientRepo.findOne.mockResolvedValue(client);
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(service.assignOwner('client-uuid-1', 'ghost-emp', admin)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });
  });

  // ─── createFromLeadPromotion ─────────────────────────────────────────────────

  describe('createFromLeadPromotion', () => {
    it('creates a client record with the provided ownerId', async () => {
      const newClient = makeClient({ userId: 'lead-user-id', ownerId: 'emp-id' });

      mockClientRepo.findOne.mockResolvedValue(null); // no duplicate
      mockClientRepo.create.mockReturnValue(newClient);
      mockClientRepo.save.mockResolvedValue(newClient);

      const result = await service.createFromLeadPromotion('lead-user-id', 'emp-id');
      expect(result.userId).toBe('lead-user-id');
      expect(result.ownerId).toBe('emp-id');
    });

    it('is idempotent — returns existing record without creating a duplicate', async () => {
      const existing = makeClient({ userId: 'lead-user-id' });
      mockClientRepo.findOne.mockResolvedValue(existing);

      const result = await service.createFromLeadPromotion('lead-user-id', 'emp-id');
      expect(result).toBe(existing);
      expect(mockClientRepo.create).not.toHaveBeenCalled();
    });

    it('creates a client with null ownerId when no owner provided', async () => {
      const newClient = makeClient({ userId: 'lead-user-id', ownerId: null });

      mockClientRepo.findOne.mockResolvedValue(null);
      mockClientRepo.create.mockReturnValue(newClient);
      mockClientRepo.save.mockResolvedValue(newClient);

      const result = await service.createFromLeadPromotion('lead-user-id', null);
      expect(result.ownerId).toBeNull();
    });
  });
});
