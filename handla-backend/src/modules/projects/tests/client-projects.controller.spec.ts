import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';

import { ClientProjectsController } from '../client-projects.controller';
import { ProjectsService } from '../projects.service';
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

describe('ClientProjectsController', () => {
  let controller: ClientProjectsController;
  let service: { findByClient: jest.Mock };

  const clientId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

  beforeEach(async () => {
    service = { findByClient: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClientProjectsController],
      providers: [{ provide: ProjectsService, useValue: service }],
    }).compile();

    controller = module.get(ClientProjectsController);
  });

  it('forwards clientId and current user to projectsService.findByClient', async () => {
    const projects = [{ id: 'p-1' }, { id: 'p-2' }];
    service.findByClient.mockResolvedValue(projects);
    const user = makeUser({ role: UserRole.CLIENT });

    const res = await controller.findByClient(clientId, user);

    expect(service.findByClient).toHaveBeenCalledWith(clientId, user);
    expect(res).toEqual({ message: 'Client projects retrieved', data: { projects } });
  });

  it('returns an empty list when the service returns []', async () => {
    service.findByClient.mockResolvedValue([]);
    const res = await controller.findByClient(clientId, makeUser());

    expect(res.data.projects).toEqual([]);
  });

  it('allows ADMIN, EMPLOYEE, CLIENT roles via @Roles metadata', () => {
    const roles = new Reflector().get<UserRole[]>(
      ROLES_KEY,
      ClientProjectsController.prototype.findByClient,
    );
    expect(roles).toEqual([UserRole.ADMIN, UserRole.EMPLOYEE, UserRole.CLIENT]);
  });
});
