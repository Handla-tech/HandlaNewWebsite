import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { UsersService } from '../users.service';
import { User } from '../../auth/entities/user.entity';
import { UserRole } from '../../../common/enums';
import { EmailService } from '../../email/email.service';
import { ClientsService } from '../../clients/clients.service';
import { NotificationService } from '../../notifications/notification.service';
import {
  ResourceNotFoundException,
  EmailAlreadyExistsException,
  RolePromotionException,
} from '../../../utils/exceptions';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'uuid-1',
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

// ─── Mock QueryBuilder ────────────────────────────────────────────────────────

function makeQB(result: User | User[] | null, count?: number) {
  const qb: any = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(result),
    getManyAndCount: jest.fn().mockResolvedValue([result ?? [], count ?? 0]),
  };
  return qb;
}

// ─── Mock Repos / Services ────────────────────────────────────────────────────

const mockUserRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  createQueryBuilder: jest.fn(),
  manager: {
    transaction: jest.fn(),
  },
};

const mockEmailService = {
  queueUserCreatedEmail: jest.fn().mockResolvedValue(undefined),
  queueLeadPromoted: jest.fn().mockResolvedValue(undefined),
};

const mockNotificationService = {
  createErpNotification: jest.fn().mockResolvedValue({}),
};

const mockClientsService = {
  createFromLeadPromotion: jest.fn().mockResolvedValue({}),
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: EmailService,           useValue: mockEmailService },
        { provide: ClientsService,          useValue: mockClientsService },
        { provide: NotificationService,     useValue: mockNotificationService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // findAll()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('findAll()', () => {
    it('returns paginated user list', async () => {
      const users = [makeUser(), makeUser({ id: 'uuid-2', email: 'b@example.com' })];
      mockUserRepo.createQueryBuilder.mockReturnValue(makeQB(users, 2));

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.users).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pages).toBe(1);
    });

    it('applies role filter via andWhere', async () => {
      const qb = makeQB([], 0);
      mockUserRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ page: 1, limit: 20, role: UserRole.ADMIN });

      expect(qb.andWhere).toHaveBeenCalledWith('u.role = :role', { role: UserRole.ADMIN });
    });

    it('applies ILIKE search on name and email', async () => {
      const qb = makeQB([], 0);
      mockUserRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ page: 1, limit: 20, search: 'alice' });

      expect(qb.andWhere).toHaveBeenCalledWith('(u.name ILIKE :search OR u.email ILIKE :search)', {
        search: '%alice%',
      });
    });

    it('returns empty list when no users match', async () => {
      mockUserRepo.createQueryBuilder.mockReturnValue(makeQB([], 0));

      const result = await service.findAll({ page: 1, limit: 20, search: 'nobody' });

      expect(result.users).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.pages).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // findOne()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('findOne()', () => {
    it('returns user when found', async () => {
      const user = makeUser();
      mockUserRepo.createQueryBuilder.mockReturnValue(makeQB(user));

      const result = await service.findOne('uuid-1');

      expect(result.id).toBe('uuid-1');
      expect(result.email).toBe('user@example.com');
    });

    it('throws ResourceNotFoundException when user does not exist', async () => {
      mockUserRepo.createQueryBuilder.mockReturnValue(makeQB(null));

      await expect(service.findOne('non-existent-id')).rejects.toThrow(ResourceNotFoundException);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // createUser()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('createUser()', () => {
    const dto = {
      email: 'new@example.com',
      name: 'New User',
      password: 'SecurePass@1',
      role: UserRole.EMPLOYEE,
    };

    it('creates user, hashes password, and returns user without passwordHash', async () => {
      const saved = makeUser({ email: dto.email, name: dto.name, role: dto.role });
      mockUserRepo.findOne.mockResolvedValue(null);
      mockUserRepo.create.mockReturnValue(saved);
      mockUserRepo.save.mockResolvedValue(saved);

      const result = await service.createUser(dto);

      expect(mockUserRepo.save).toHaveBeenCalledTimes(1);
      expect(result.email).toBe(dto.email);
      expect((result as any).passwordHash).toBeUndefined();
    });

    it('throws EmailAlreadyExistsException when email is taken', async () => {
      mockUserRepo.findOne.mockResolvedValue(makeUser({ email: dto.email }));

      await expect(service.createUser(dto)).rejects.toThrow(EmailAlreadyExistsException);
    });

    it('queues user-created email after successful creation', async () => {
      const saved = makeUser({ email: dto.email, name: dto.name, role: dto.role });
      mockUserRepo.findOne.mockResolvedValue(null);
      mockUserRepo.create.mockReturnValue(saved);
      mockUserRepo.save.mockResolvedValue(saved);

      await service.createUser(dto);

      expect(mockEmailService.queueUserCreatedEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientEmail: saved.email,
          userName: saved.name,
          temporaryPassword: dto.password,
        }),
      );
    });

    it('does NOT throw if email queue fails (fire-and-forget)', async () => {
      const saved = makeUser({ email: dto.email, name: dto.name, role: dto.role });
      mockUserRepo.findOne.mockResolvedValue(null);
      mockUserRepo.create.mockReturnValue(saved);
      mockUserRepo.save.mockResolvedValue(saved);
      mockEmailService.queueUserCreatedEmail.mockRejectedValueOnce(new Error('Queue unavailable'));

      // Should NOT reject — email error is swallowed
      await expect(service.createUser(dto)).resolves.toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // updateRole()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('updateRole()', () => {
    it('updates user role and returns updated user without passwordHash', async () => {
      const user = makeUser({ role: UserRole.LEAD });
      const updated = { ...user, role: UserRole.CLIENT };
      mockUserRepo.findOne.mockResolvedValue(user);
      mockUserRepo.save.mockResolvedValue(updated);

      const result = await service.updateRole('uuid-1', { role: UserRole.CLIENT });

      expect(result.role).toBe(UserRole.CLIENT);
      expect((result as any).passwordHash).toBeUndefined();
    });

    it('throws ResourceNotFoundException when user not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(service.updateRole('bad-id', { role: UserRole.CLIENT })).rejects.toThrow(
        ResourceNotFoundException,
      );
    });

    it('throws RolePromotionException when trying to demote an ADMIN', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      mockUserRepo.findOne.mockResolvedValue(admin);

      await expect(service.updateRole('uuid-1', { role: UserRole.EMPLOYEE })).rejects.toThrow(
        RolePromotionException,
      );
    });

    it('allows updating ADMIN role to ADMIN (no-op change does not throw)', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      const updated = { ...admin, role: UserRole.ADMIN };
      mockUserRepo.findOne.mockResolvedValue(admin);
      mockUserRepo.save.mockResolvedValue(updated);

      const result = await service.updateRole('uuid-1', { role: UserRole.ADMIN });

      expect(result.role).toBe(UserRole.ADMIN);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // promoteLeadToClient()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('promoteLeadToClient()', () => {
    const actingAdmin = makeUser({ id: 'admin-id', role: UserRole.ADMIN });

    it('promotes LEAD to CLIENT successfully', async () => {
      const lead = makeUser({ role: UserRole.LEAD });
      const promoted = { ...lead, role: UserRole.CLIENT };
      mockUserRepo.findOne.mockResolvedValue(lead);
      mockUserRepo.save.mockResolvedValue(promoted);

      const result = await service.promoteLeadToClient('uuid-1', actingAdmin);

      expect(result.role).toBe(UserRole.CLIENT);
      expect((result as any).passwordHash).toBeUndefined();
    });

    it('throws RolePromotionException if user is not LEAD', async () => {
      const employee = makeUser({ role: UserRole.EMPLOYEE });
      mockUserRepo.findOne.mockResolvedValue(employee);

      await expect(service.promoteLeadToClient('uuid-1', actingAdmin)).rejects.toThrow(
        RolePromotionException,
      );
    });

    it('throws ResourceNotFoundException if user not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(service.promoteLeadToClient('non-existent', actingAdmin)).rejects.toThrow(
        ResourceNotFoundException,
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // reassignOwnership()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('reassignOwnership()', () => {
    const currentOwner = makeUser({ id: 'from-id', role: UserRole.EMPLOYEE });
    const newOwner = makeUser({ id: 'to-id', role: UserRole.EMPLOYEE });

    it('runs inside a DB transaction and returns per-table counts', async () => {
      mockUserRepo.findOne
        .mockResolvedValueOnce(currentOwner) // current owner exists
        .mockResolvedValueOnce(newOwner); // new owner exists

      const fakeResult = { affected: 3 };
      const mockQBUpdate: any = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(fakeResult),
      };
      const mockEm = {
        createQueryBuilder: jest.fn().mockReturnValue(mockQBUpdate),
      };

      mockUserRepo.manager.transaction.mockImplementation(
        async (cb: (em: EntityManager) => Promise<void>) => cb(mockEm as any),
      );

      const result = await service.reassignOwnership('from-id', 'to-id');

      expect(mockUserRepo.manager.transaction).toHaveBeenCalledTimes(1);
      expect(result.reassigned.conversations).toBe(3);
    });

    it('throws ResourceNotFoundException when current owner does not exist', async () => {
      mockUserRepo.findOne
        .mockResolvedValueOnce(null) // current owner missing
        .mockResolvedValueOnce(newOwner);

      await expect(service.reassignOwnership('bad-from', 'to-id')).rejects.toThrow(
        ResourceNotFoundException,
      );
    });

    it('throws ResourceNotFoundException when new owner does not exist', async () => {
      mockUserRepo.findOne.mockResolvedValueOnce(currentOwner).mockResolvedValueOnce(null); // new owner missing

      await expect(service.reassignOwnership('from-id', 'bad-to')).rejects.toThrow(
        ResourceNotFoundException,
      );
    });

    it('throws RolePromotionException when new owner is not EMPLOYEE', async () => {
      const nonEmployee = makeUser({ id: 'to-id', role: UserRole.CLIENT });
      mockUserRepo.findOne.mockResolvedValueOnce(currentOwner).mockResolvedValueOnce(nonEmployee);

      await expect(service.reassignOwnership('from-id', 'to-id')).rejects.toThrow(
        RolePromotionException,
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // deleteUser()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('deleteUser()', () => {
    it('hard-deletes user by ID', async () => {
      const user = makeUser();
      mockUserRepo.findOne.mockResolvedValue(user);
      mockUserRepo.remove.mockResolvedValue(undefined);

      await expect(service.deleteUser('uuid-1')).resolves.toBeUndefined();
      expect(mockUserRepo.remove).toHaveBeenCalledWith(user);
    });

    it('throws ResourceNotFoundException when user does not exist', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(service.deleteUser('non-existent')).rejects.toThrow(ResourceNotFoundException);
    });
  });
});
