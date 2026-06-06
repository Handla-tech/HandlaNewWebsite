import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';

import { ProjectTasksController } from '../project-tasks.controller';
import { TasksService } from '../tasks.service';
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

describe('ProjectTasksController', () => {
  let controller: ProjectTasksController;
  let service: { findByProject: jest.Mock };

  const projectId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

  beforeEach(async () => {
    service = { findByProject: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectTasksController],
      providers: [{ provide: TasksService, useValue: service }],
    }).compile();

    controller = module.get(ProjectTasksController);
  });

  it('forwards projectId and user to tasksService.findByProject', async () => {
    const tasks = [{ id: 't-1' }];
    service.findByProject.mockResolvedValue(tasks);
    const user = makeUser({ role: UserRole.EMPLOYEE });

    const res = await controller.findByProject(projectId, user);

    expect(service.findByProject).toHaveBeenCalledWith(projectId, user);
    expect(res).toEqual({ message: 'Project tasks retrieved', data: { tasks } });
  });

  it('returns empty array when the project has no tasks', async () => {
    service.findByProject.mockResolvedValue([]);
    const res = await controller.findByProject(projectId, makeUser());

    expect(res.data.tasks).toEqual([]);
  });

  it('allows ADMIN, EMPLOYEE, CLIENT roles via @Roles metadata', () => {
    const roles = new Reflector().get<UserRole[]>(
      ROLES_KEY,
      ProjectTasksController.prototype.findByProject,
    );
    expect(roles).toEqual([UserRole.ADMIN, UserRole.EMPLOYEE, UserRole.CLIENT]);
  });
});
