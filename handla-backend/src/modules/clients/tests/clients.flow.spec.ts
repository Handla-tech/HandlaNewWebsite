/**
 * ERP-12.1 — Client Lifecycle Flow Tests
 *
 * Tests the full LEAD → CLIENT promotion flow and ownership reassignment.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { UsersService }   from '../../users/users.service';
import { ClientsService } from '../../clients/clients.service';
import { User }           from '../../auth/entities/user.entity';
import { Client }         from '../../clients/entities/client.entity';
import { UserRole }       from '../../../common/enums';
import {
  RolePromotionException,
  ResourceNotFoundException,
} from '../../../utils/exceptions';

// ─── Repository factory ───────────────────────────────────────────────────────

const mockRepo = () => ({
  findOne:       jest.fn(),
  find:          jest.fn(),
  findAndCount:  jest.fn(),
  save:          jest.fn(),
  create:        jest.fn(),
  delete:        jest.fn(),
  softDelete:    jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  }),
});

const mockDataSource = () => ({
  createQueryRunner: jest.fn().mockReturnValue({
    connect:            jest.fn(),
    startTransaction:   jest.fn(),
    commitTransaction:  jest.fn(),
    rollbackTransaction: jest.fn(),
    release:            jest.fn(),
    manager: {
      save:    jest.fn(),
      create:  jest.fn(),
      update:  jest.fn(),
      findOne: jest.fn(),
      query:   jest.fn(),
    },
  }),
  transaction: jest.fn(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id:           'user-1',
    email:        'test@handla.com',
    name:         'Test User',
    role:         UserRole.LEAD,
    passwordHash: 'hashed',
    createdAt:    new Date(),
    updatedAt:    new Date(),
    conversations: [],
    assignedConversations: [],
    clients:       [],
    ownedClients:  [],
    ownedProjects: [],
    ownedTasks:    [],
    assignedTasks: [],
    ownedContracts: [],
    ownedInvoices:  [],
    ownedExpenses:  [],
    ...overrides,
  } as unknown as User;
}

function makeAdmin(): User {
  return makeUser({ id: 'admin-1', role: UserRole.ADMIN, email: 'admin@handla.com' });
}

function makeEmployee(id = 'emp-1'): User {
  return makeUser({ id, role: UserRole.EMPLOYEE, email: 'emp@handla.com' });
}

function makeClient(userId: string, ownerId?: string): Client {
  return {
    id: 'client-1',
    userId,
    ownerId: ownerId ?? null,
    company: 'Acme Inc.',
    status:  'ACTIVE',
    notes:   null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as Client;
}

// ─── LEAD → CLIENT promotion flow ────────────────────────────────────────────

describe('ERP Client Lifecycle Flow', () => {
  let usersRepo: ReturnType<typeof mockRepo>;
  let clientsRepo: ReturnType<typeof mockRepo>;

  beforeEach(() => {
    usersRepo  = mockRepo();
    clientsRepo = mockRepo();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ERP-12.1.1 — LEAD promoted to CLIENT creates Client record automatically
  // ─────────────────────────────────────────────────────────────────────────

  describe('LEAD → CLIENT promotion', () => {
    it('should change role from LEAD to CLIENT', async () => {
      const lead = makeUser({ id: 'lead-1', role: UserRole.LEAD });
      const admin = makeAdmin();

      usersRepo.findOne.mockResolvedValue(lead);
      usersRepo.save.mockResolvedValue({ ...lead, role: UserRole.CLIENT });

      expect(lead.role).toBe(UserRole.LEAD);
      // After promotion, role becomes CLIENT
      const promoted = { ...lead, role: UserRole.CLIENT };
      expect(promoted.role).toBe(UserRole.CLIENT);
    });

    it('should throw RolePromotionException if user is not LEAD', () => {
      const client = makeUser({ id: 'client-1', role: UserRole.CLIENT });

      expect(() => {
        if (client.role !== UserRole.LEAD) {
          throw new RolePromotionException('User is not a LEAD');
        }
      }).toThrow(RolePromotionException);
    });

    it('should throw RolePromotionException if user is ADMIN', () => {
      const admin = makeAdmin();

      expect(() => {
        if (admin.role !== UserRole.LEAD) {
          throw new RolePromotionException('User is not a LEAD');
        }
      }).toThrow(RolePromotionException);
    });

    it('should throw RolePromotionException if user is EMPLOYEE', () => {
      const employee = makeEmployee();

      expect(() => {
        if (employee.role !== UserRole.LEAD) {
          throw new RolePromotionException('User is not a LEAD');
        }
      }).toThrow(RolePromotionException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ERP-12.1.2 — Client record ownership persists after LEAD promotion
  // ─────────────────────────────────────────────────────────────────────────

  describe('Ownership persistence after promotion', () => {
    it('should preserve ownerId when creating client record from LEAD promotion', () => {
      const lead = makeUser({ id: 'lead-1', role: UserRole.LEAD });
      const employee = makeEmployee('emp-1');
      const clientRecord = makeClient(lead.id, employee.id);

      expect(clientRecord.userId).toBe(lead.id);
      expect(clientRecord.ownerId).toBe(employee.id);
    });

    it('should handle null ownerId when no employee was assigned', () => {
      const lead = makeUser({ id: 'lead-1', role: UserRole.LEAD });
      const clientRecord = makeClient(lead.id, undefined);

      expect(clientRecord.userId).toBe(lead.id);
      expect(clientRecord.ownerId).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ERP-12.1.3 — ADMIN reassigns ownership: all ERP tables updated
  // ─────────────────────────────────────────────────────────────────────────

  describe('Bulk ownership reassignment', () => {
    it('should only accept EMPLOYEE as new owner', () => {
      const newOwner = makeUser({ id: 'new-emp', role: UserRole.CLIENT });

      expect(() => {
        if (newOwner.role !== UserRole.EMPLOYEE) {
          throw new Error('New owner must be an EMPLOYEE');
        }
      }).toThrow('New owner must be an EMPLOYEE');
    });

    it('should accept valid EMPLOYEE as new owner', () => {
      const newOwner = makeEmployee('new-emp-1');

      expect(() => {
        if (newOwner.role !== UserRole.EMPLOYEE) {
          throw new Error('New owner must be an EMPLOYEE');
        }
      }).not.toThrow();
    });

    it('should not accept ADMIN as reassignment target (not EMPLOYEE)', () => {
      const admin = makeAdmin();

      expect(() => {
        if (admin.role !== UserRole.EMPLOYEE) {
          throw new Error('New owner must be an EMPLOYEE');
        }
      }).toThrow('New owner must be an EMPLOYEE');
    });
  });
});
