import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';

import { ClientContractsController } from '../client-contracts.controller';
import { ContractsService } from '../contracts.service';
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

describe('ClientContractsController', () => {
  let controller: ClientContractsController;
  let service: { findAll: jest.Mock };

  const clientId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

  beforeEach(async () => {
    service = { findAll: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClientContractsController],
      providers: [{ provide: ContractsService, useValue: service }],
    }).compile();

    controller = module.get(ClientContractsController);
  });

  it('merges clientId into the query and forwards to contractsService.findAll', async () => {
    service.findAll.mockResolvedValue({ contracts: [], total: 0 });
    const user = makeUser({ role: UserRole.ADMIN });

    const res = await controller.findByClient(clientId, { page: 2, limit: 5, status: 'DRAFT' } as any, user);

    expect(service.findAll).toHaveBeenCalledWith(user, { page: 2, limit: 5, status: 'DRAFT', clientId });
    expect(res).toEqual({ message: 'Client contracts retrieved', data: { contracts: [], total: 0 } });
  });

  it('clientId from the URL OVERRIDES any clientId in the query string', async () => {
    service.findAll.mockResolvedValue({});
    const user = makeUser();

    await controller.findByClient(clientId, { clientId: 'should-be-overridden' } as any, user);

    const passed = service.findAll.mock.calls[0][1];
    expect(passed.clientId).toBe(clientId);
  });

  it('allows ADMIN, EMPLOYEE, CLIENT roles via @Roles metadata', () => {
    const roles = new Reflector().get<UserRole[]>(
      ROLES_KEY,
      ClientContractsController.prototype.findByClient,
    );
    expect(roles).toEqual([UserRole.ADMIN, UserRole.EMPLOYEE, UserRole.CLIENT]);
  });
});
