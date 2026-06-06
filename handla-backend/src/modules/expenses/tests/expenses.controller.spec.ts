import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ParseUUIDPipe, ArgumentMetadata, BadRequestException } from '@nestjs/common';

import { ExpensesController } from '../expenses.controller';
import { ExpensesService } from '../expenses.service';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../../common/enums';
import { User } from '../../auth/entities/user.entity';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u-1',
    email: 'u@example.com',
    passwordHash: 'h',
    name: 'U',
    role: UserRole.ADMIN,
    isArchived: false,
    archivedAt: null,
    isDisabled: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    adminConversations: [],
    clientConversations: [],
    assignedConversations: [],
    messages: [],
    notifications: [],
    testimonials: [],
    ...overrides,
  } as User;
}

describe('ExpensesController', () => {
  let controller: ExpensesController;
  let service: {
    getFinancialSummary: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };

  const id = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

  beforeEach(async () => {
    service = {
      getFinancialSummary: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExpensesController],
      providers: [{ provide: ExpensesService, useValue: service }],
    }).compile();

    controller = module.get(ExpensesController);
  });

  // ── GET /summary ──────────────────────────────────────────────────────────
  describe('GET /erp/expenses/summary', () => {
    it('forwards user + date range to the service', async () => {
      const user = makeUser();
      service.getFinancialSummary.mockResolvedValue({ income: 100, expenses: 50 });

      const res = await controller.getFinancialSummary(user, '2024-01-01', '2024-01-31');

      expect(service.getFinancialSummary).toHaveBeenCalledWith(user, '2024-01-01', '2024-01-31');
      expect(res).toEqual({ income: 100, expenses: 50 });
    });

    it('works without date range params', async () => {
      const user = makeUser();
      service.getFinancialSummary.mockResolvedValue({ income: 0 });

      await controller.getFinancialSummary(user);

      expect(service.getFinancialSummary).toHaveBeenCalledWith(user, undefined, undefined);
    });
  });

  // ── GET / (list) ──────────────────────────────────────────────────────────
  describe('GET /erp/expenses', () => {
    it('forwards query to the service', async () => {
      const user = makeUser({ role: UserRole.EMPLOYEE });
      const query = { page: 1, limit: 10, type: 'EXPENSE' } as any;
      service.findAll.mockResolvedValue({ items: [], total: 0 });

      const res = await controller.findAll(user, query);

      expect(service.findAll).toHaveBeenCalledWith(user, query);
      expect(res).toEqual({ items: [], total: 0 });
    });
  });

  // ── GET /:id ──────────────────────────────────────────────────────────────
  describe('GET /erp/expenses/:id', () => {
    it('returns a single entry', async () => {
      const user = makeUser();
      service.findOne.mockResolvedValue({ id });

      const res = await controller.findOne(id, user);

      expect(service.findOne).toHaveBeenCalledWith(id, user);
      expect(res).toEqual({ id });
    });
  });

  // ── POST / ────────────────────────────────────────────────────────────────
  describe('POST /erp/expenses', () => {
    it('creates a manual entry', async () => {
      const user = makeUser();
      const dto = { type: 'EXPENSE', amount: 100, description: 'x' } as any;
      service.create.mockResolvedValue({ id, ...dto });

      const res = await controller.create(dto, user);

      expect(service.create).toHaveBeenCalledWith(dto, user);
      expect(res.id).toBe(id);
    });
  });

  // ── PATCH /:id ────────────────────────────────────────────────────────────
  describe('PATCH /erp/expenses/:id', () => {
    it('updates an entry', async () => {
      const user = makeUser();
      const dto = { amount: 250 } as any;
      service.update.mockResolvedValue({ id, amount: 250 });

      const res = await controller.update(id, dto, user);

      expect(service.update).toHaveBeenCalledWith(id, dto, user);
      expect(res.amount).toBe(250);
    });
  });

  // ── DELETE /:id ───────────────────────────────────────────────────────────
  describe('DELETE /erp/expenses/:id', () => {
    it('calls service.remove() and returns undefined (204 No Content)', async () => {
      const user = makeUser({ role: UserRole.ADMIN });
      service.remove.mockResolvedValue(undefined);

      const res = await controller.remove(id, user);

      expect(service.remove).toHaveBeenCalledWith(id, user);
      expect(res).toBeUndefined();
    });
  });

  // ── @Roles metadata ───────────────────────────────────────────────────────
  describe('@Roles metadata', () => {
    const reflector = new Reflector();
    const getRoles = (handler: any) => reflector.get<UserRole[]>(ROLES_KEY, handler);

    it('summary requires ADMIN or EMPLOYEE', () => {
      expect(getRoles(ExpensesController.prototype.getFinancialSummary))
        .toEqual([UserRole.ADMIN, UserRole.EMPLOYEE]);
    });
    it('findAll requires ADMIN or EMPLOYEE', () => {
      expect(getRoles(ExpensesController.prototype.findAll))
        .toEqual([UserRole.ADMIN, UserRole.EMPLOYEE]);
    });
    it('findOne requires ADMIN or EMPLOYEE', () => {
      expect(getRoles(ExpensesController.prototype.findOne))
        .toEqual([UserRole.ADMIN, UserRole.EMPLOYEE]);
    });
    it('create requires ADMIN or EMPLOYEE', () => {
      expect(getRoles(ExpensesController.prototype.create))
        .toEqual([UserRole.ADMIN, UserRole.EMPLOYEE]);
    });
    it('update requires ADMIN or EMPLOYEE', () => {
      expect(getRoles(ExpensesController.prototype.update))
        .toEqual([UserRole.ADMIN, UserRole.EMPLOYEE]);
    });
    it('remove requires ADMIN only', () => {
      expect(getRoles(ExpensesController.prototype.remove))
        .toEqual([UserRole.ADMIN]);
    });
  });

  // ── ParseUUIDPipe regression for /summary literal before /:id ───────────
  describe('literal-route ordering guard', () => {
    it('"summary" would fail ParseUUIDPipe — confirming literal route MUST come first', async () => {
      const pipe = new ParseUUIDPipe();
      const meta: ArgumentMetadata = { type: 'param', metatype: String, data: 'id' };
      await expect(pipe.transform('summary', meta)).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
