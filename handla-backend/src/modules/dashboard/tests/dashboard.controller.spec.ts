import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';

import { DashboardController } from '../dashboard.controller';
import { DashboardService } from '../dashboard.service';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import { User } from '../../auth/entities/user.entity';
import { UserRole } from '../../../common/enums';

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

describe('DashboardController', () => {
  let controller: DashboardController;
  let service: { getStats: jest.Mock; getFinancialChart: jest.Mock };

  beforeEach(async () => {
    service = { getStats: jest.fn(), getFinancialChart: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [{ provide: DashboardService, useValue: service }],
    }).compile();

    controller = module.get(DashboardController);
  });

  describe('GET /erp/dashboard/stats', () => {
    it('returns the service result unchanged', async () => {
      const stats = { projectsByStatus: { planning: 1, active: 2, onHold: 0, completed: 3, cancelled: 0 } };
      service.getStats.mockResolvedValue(stats as any);

      const res = await controller.getStats(makeUser({ role: UserRole.ADMIN }));

      expect(service.getStats).toHaveBeenCalledTimes(1);
      expect(res).toBe(stats);
    });

    it('passes the current user to the service', async () => {
      const user = makeUser({ role: UserRole.EMPLOYEE, id: 'emp-1' });
      service.getStats.mockResolvedValue({} as any);

      await controller.getStats(user);

      expect(service.getStats).toHaveBeenCalledWith(user);
    });
  });

  describe('GET /erp/dashboard/financial-chart', () => {
    it('returns the service result unchanged', async () => {
      const chart = [{ month: '2024-01', income: 100, expenses: 50 }] as any;
      service.getFinancialChart.mockResolvedValue(chart);

      const res = await controller.getFinancialChart(makeUser());

      expect(res).toBe(chart);
    });

    it('passes the current user to the service', async () => {
      const user = makeUser({ id: 'emp-9', role: UserRole.EMPLOYEE });
      service.getFinancialChart.mockResolvedValue([] as any);

      await controller.getFinancialChart(user);

      expect(service.getFinancialChart).toHaveBeenCalledWith(user);
    });
  });

  // ── Route-level @Roles() metadata is what RolesGuard actually enforces ──
  describe('@Roles metadata', () => {
    it('getStats requires ADMIN or EMPLOYEE', () => {
      const reflector = new Reflector();
      const roles = reflector.get<UserRole[]>(ROLES_KEY, DashboardController.prototype.getStats);
      expect(roles).toEqual([UserRole.ADMIN, UserRole.EMPLOYEE]);
    });

    it('getFinancialChart requires ADMIN or EMPLOYEE', () => {
      const reflector = new Reflector();
      const roles = reflector.get<UserRole[]>(ROLES_KEY, DashboardController.prototype.getFinancialChart);
      expect(roles).toEqual([UserRole.ADMIN, UserRole.EMPLOYEE]);
    });

    it('RolesGuard would block a CLIENT user from /stats', () => {
      const reflector = new Reflector();
      const guard = new RolesGuard(reflector);
      const client = makeUser({ role: UserRole.CLIENT });
      const ctx: any = {
        getHandler: () => DashboardController.prototype.getStats,
        getClass: () => DashboardController,
        switchToHttp: () => ({ getRequest: () => ({ user: client }) }),
      };

      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('RolesGuard allows an ADMIN through to /stats', () => {
      const reflector = new Reflector();
      const guard = new RolesGuard(reflector);
      const admin = makeUser({ role: UserRole.ADMIN });
      const ctx: any = {
        getHandler: () => DashboardController.prototype.getStats,
        getClass: () => DashboardController,
        switchToHttp: () => ({ getRequest: () => ({ user: admin }) }),
      };

      expect(guard.canActivate(ctx)).toBe(true);
    });
  });
});
