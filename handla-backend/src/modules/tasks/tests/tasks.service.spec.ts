import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { TasksService } from '../tasks.service';
import { Task } from '../entities/task.entity';
import { Project } from '../../projects/entities/project.entity';
import { User } from '../../auth/entities/user.entity';
import { UserRole, TaskStatus, ProjectStatus, ClientStatus } from '../../../common/enums';
import {
  ResourceNotFoundException,
  OwnershipViolationException,
  InsufficientPermissionsException,
  AppException,
} from '../../../utils/exceptions';
import { Client } from '../../clients/entities/client.entity';
import { NotificationService } from '../../notifications/notification.service';
import { EmailService } from '../../email/email.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
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
    id: 'client-1',
    userId: 'client-user-1',
    ownerId: 'user-1',
    company: 'Acme Corp',
    status: ClientStatus.ACTIVE,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: makeUser({ id: 'client-user-1', role: UserRole.CLIENT }),
    owner: makeUser({ id: 'user-1' }),
    projects: [],
    contracts: [],
    invoices: [],
    ...overrides,
  };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-1',
    title: 'Test Project',
    description: null,
    clientId: 'client-1',
    ownerId: 'user-1',
    status: ProjectStatus.ACTIVE,
    startDate: null,
    endDate: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    client: makeClient(),
    owner: makeUser(),
    tasks: [],
    ...overrides,
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Test Task',
    description: 'A test task',
    projectId: 'project-1',
    assigneeId: null,
    ownerId: 'user-1',
    status: TaskStatus.PENDING,
    dueDate: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    project: makeProject(),
    assignee: null,
    owner: makeUser(),
    ...overrides,
  };
}

// ─── Mock QueryBuilder ────────────────────────────────────────────────────────

function makeQB(tasks: Task[] = [], count = 0) {
  const qb: any = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([tasks, count]),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    whereInIds: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: tasks.length }),
  };
  return qb;
}

// ─── Mock Repos ───────────────────────────────────────────────────────────────

const mockTaskRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockProjectRepo = {
  findOne: jest.fn(),
};

const mockUserRepo = {
  findOne: jest.fn(),
};

const mockNotificationService = {
  createErpNotification: jest.fn().mockResolvedValue({}),
};

const mockEmailService = {
  queueTaskAssigned: jest.fn().mockResolvedValue(undefined),
  queueTaskDelayed:  jest.fn().mockResolvedValue(undefined),
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('TasksService', () => {
  let service: TasksService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: getRepositoryToken(Task),    useValue: mockTaskRepo    },
        { provide: getRepositoryToken(Project), useValue: mockProjectRepo },
        { provide: getRepositoryToken(User),    useValue: mockUserRepo    },
        { provide: NotificationService,         useValue: mockNotificationService },
        { provide: EmailService,                useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
  });

  // ─── findAll (6 tests) ───────────────────────────────────────────────────────

  describe('findAll', () => {
    it('ADMIN: returns all tasks with no ownership filter', async () => {
      const admin = makeUser({ id: 'admin-1', role: UserRole.ADMIN });
      const tasks = [makeTask(), makeTask({ id: 'task-2' })];
      const qb = makeQB(tasks, 2);
      mockTaskRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(admin, { page: 1, limit: 20 });

      expect(result.total).toBe(2);
      expect(result.tasks).toHaveLength(2);
      // ADMIN: no ownership andWhere
      const andWhereCalls = qb.andWhere.mock.calls.map((c: any[]) => c[0]);
      expect(andWhereCalls.some((s: string) => s.includes('ownerId'))).toBe(false);
    });

    it('EMPLOYEE: scopes results to own (owner or assigned) tasks', async () => {
      const employee = makeUser({ id: 'emp-1', role: UserRole.EMPLOYEE });
      const qb = makeQB([makeTask()], 1);
      mockTaskRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(employee, { page: 1, limit: 20 });

      expect(qb.andWhere).toHaveBeenCalledWith(
        '(t.ownerId = :userId OR t.assigneeId = :userId)',
        { userId: 'emp-1' },
      );
    });

    it('applies projectId filter when provided', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      const qb = makeQB([], 0);
      mockTaskRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(admin, { page: 1, limit: 20, projectId: 'project-1' });

      expect(qb.andWhere).toHaveBeenCalledWith('t.projectId = :projectId', { projectId: 'project-1' });
    });

    it('applies status filter when provided', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      const qb = makeQB([], 0);
      mockTaskRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(admin, { page: 1, limit: 20, status: TaskStatus.IN_PROGRESS });

      expect(qb.andWhere).toHaveBeenCalledWith('t.status = :status', { status: TaskStatus.IN_PROGRESS });
    });

    it('applies search filter on title ILIKE', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      const qb = makeQB([], 0);
      mockTaskRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(admin, { page: 1, limit: 20, search: 'homepage' });

      expect(qb.andWhere).toHaveBeenCalledWith('t.title ILIKE :search', { search: '%homepage%' });
    });

    it('returns correct pagination math', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      const qb = makeQB(Array(10).fill(makeTask()), 53);
      mockTaskRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(admin, { page: 2, limit: 10 });

      expect(result.page).toBe(2);
      expect(result.pages).toBe(Math.ceil(53 / 10));
      expect(result.total).toBe(53);
    });
  });

  // ─── findOne (6 tests) ───────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns task when found by ADMIN', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      const task = makeTask();
      mockTaskRepo.findOne.mockResolvedValue(task);

      const result = await service.findOne('task-1', admin);

      expect(result).toEqual(task);
    });

    it('throws ResourceNotFoundException when task does not exist', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      mockTaskRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('ghost-id', admin)).rejects.toThrow(ResourceNotFoundException);
    });

    it('EMPLOYEE throws OwnershipViolationException for task they do not own or are assigned to', async () => {
      const employee = makeUser({ id: 'emp-2', role: UserRole.EMPLOYEE });
      const task = makeTask({ ownerId: 'emp-1', assigneeId: null });
      mockTaskRepo.findOne.mockResolvedValue(task);

      await expect(service.findOne('task-1', employee)).rejects.toThrow(OwnershipViolationException);
    });

    it('EMPLOYEE succeeds when they are the owner', async () => {
      const employee = makeUser({ id: 'user-1', role: UserRole.EMPLOYEE });
      const task = makeTask({ ownerId: 'user-1' });
      mockTaskRepo.findOne.mockResolvedValue(task);

      const result = await service.findOne('task-1', employee);

      expect(result).toEqual(task);
    });

    it('EMPLOYEE succeeds when they are the assignee (not the owner)', async () => {
      const employee = makeUser({ id: 'assignee-1', role: UserRole.EMPLOYEE });
      const task = makeTask({ ownerId: 'owner-1', assigneeId: 'assignee-1' });
      mockTaskRepo.findOne.mockResolvedValue(task);

      const result = await service.findOne('task-1', employee);

      expect(result).toEqual(task);
    });

    it('CLIENT throws InsufficientPermissionsException for task not in their project', async () => {
      const clientUser = makeUser({ id: 'client-user-1', role: UserRole.CLIENT });
      const project = makeProject({
        client: makeClient({ userId: 'other-user' }), // different client user
      });
      const task = makeTask({ project });
      mockTaskRepo.findOne.mockResolvedValue(task);

      await expect(service.findOne('task-1', clientUser)).rejects.toThrow(InsufficientPermissionsException);
    });
  });

  // ─── findByProject (5 tests) ─────────────────────────────────────────────────

  describe('findByProject', () => {
    it('ADMIN can list tasks for any project', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      const project = makeProject();
      const tasks = [makeTask(), makeTask({ id: 'task-2' })];
      mockProjectRepo.findOne.mockResolvedValue(project);
      mockTaskRepo.find.mockResolvedValue(tasks);

      const result = await service.findByProject('project-1', admin);

      expect(result).toHaveLength(2);
    });

    it('EMPLOYEE succeeds when they own the project', async () => {
      const employee = makeUser({ id: 'user-1', role: UserRole.EMPLOYEE });
      const project = makeProject({ ownerId: 'user-1' });
      mockProjectRepo.findOne.mockResolvedValue(project);
      mockTaskRepo.find.mockResolvedValue([makeTask()]);

      const result = await service.findByProject('project-1', employee);

      expect(result).toHaveLength(1);
    });

    it('EMPLOYEE throws OwnershipViolationException for project they do not own', async () => {
      const employee = makeUser({ id: 'emp-2', role: UserRole.EMPLOYEE });
      const project = makeProject({ ownerId: 'emp-1' });
      mockProjectRepo.findOne.mockResolvedValue(project);

      await expect(service.findByProject('project-1', employee)).rejects.toThrow(
        OwnershipViolationException,
      );
    });

    it('CLIENT succeeds when project belongs to their client record', async () => {
      const clientUser = makeUser({ id: 'client-user-1', role: UserRole.CLIENT });
      const client = makeClient({ userId: 'client-user-1' });
      const project = makeProject({ client });
      mockProjectRepo.findOne.mockResolvedValue(project);
      mockTaskRepo.find.mockResolvedValue([makeTask()]);

      const result = await service.findByProject('project-1', clientUser);

      expect(result).toHaveLength(1);
    });

    it('throws ResourceNotFoundException when project does not exist', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      mockProjectRepo.findOne.mockResolvedValue(null);

      await expect(service.findByProject('ghost-id', admin)).rejects.toThrow(
        ResourceNotFoundException,
      );
    });
  });

  // ─── create (6 tests) ────────────────────────────────────────────────────────

  describe('create', () => {
    it('EMPLOYEE creates task with ownerId set to actingUser.id', async () => {
      const employee = makeUser({ id: 'emp-1', role: UserRole.EMPLOYEE });
      const project = makeProject({ ownerId: 'emp-1' });
      const savedTask = makeTask({ ownerId: 'emp-1' });

      mockProjectRepo.findOne.mockResolvedValue(project);
      mockTaskRepo.create.mockReturnValue(savedTask);
      mockTaskRepo.save.mockResolvedValue(savedTask);
      mockTaskRepo.findOne.mockResolvedValue(savedTask);

      const result = await service.create({ title: 'New Task', projectId: 'project-1' }, employee);

      expect(mockTaskRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ ownerId: 'emp-1' }),
      );
      expect(result).toEqual(savedTask);
    });

    it('ADMIN creates task with ownerId=null when not specified', async () => {
      const admin = makeUser({ id: 'admin-1', role: UserRole.ADMIN });
      const project = makeProject();
      const savedTask = makeTask({ ownerId: null });

      mockProjectRepo.findOne.mockResolvedValue(project);
      mockTaskRepo.create.mockReturnValue(savedTask);
      mockTaskRepo.save.mockResolvedValue(savedTask);
      mockTaskRepo.findOne.mockResolvedValue(savedTask);

      await service.create({ title: 'Admin Task', projectId: 'project-1' }, admin);

      expect(mockTaskRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ ownerId: null }),
      );
    });

    it('throws ResourceNotFoundException when projectId does not exist', async () => {
      const employee = makeUser({ role: UserRole.EMPLOYEE });
      mockProjectRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create({ title: 'X', projectId: 'ghost-project' }, employee),
      ).rejects.toThrow(ResourceNotFoundException);
    });

    it('EMPLOYEE throws AppException when they do not own the target project', async () => {
      const employee = makeUser({ id: 'emp-2', role: UserRole.EMPLOYEE });
      const project = makeProject({ ownerId: 'emp-1' });
      mockProjectRepo.findOne.mockResolvedValue(project);

      await expect(
        service.create({ title: 'X', projectId: 'project-1' }, employee),
      ).rejects.toThrow(AppException);
    });

    it('throws AppException when assigneeId is not an EMPLOYEE', async () => {
      const admin = makeUser({ id: 'admin-1', role: UserRole.ADMIN });
      const project = makeProject();
      const clientUser = makeUser({ id: 'client-1', role: UserRole.CLIENT });

      mockProjectRepo.findOne.mockResolvedValue(project);
      mockUserRepo.findOne.mockResolvedValue(clientUser);

      await expect(
        service.create({ title: 'Task', projectId: 'project-1', assigneeId: 'client-1' }, admin),
      ).rejects.toThrow(AppException);
    });

    it('creates task with valid assigneeId (EMPLOYEE user)', async () => {
      const admin = makeUser({ id: 'admin-1', role: UserRole.ADMIN });
      const project = makeProject();
      const assignee = makeUser({ id: 'emp-1', role: UserRole.EMPLOYEE });
      const savedTask = makeTask({ assigneeId: 'emp-1' });

      mockProjectRepo.findOne.mockResolvedValue(project);
      mockUserRepo.findOne.mockResolvedValue(assignee);
      mockTaskRepo.create.mockReturnValue(savedTask);
      mockTaskRepo.save.mockResolvedValue(savedTask);
      mockTaskRepo.findOne.mockResolvedValue(savedTask);

      const result = await service.create(
        { title: 'Task', projectId: 'project-1', assigneeId: 'emp-1' },
        admin,
      );

      expect(mockTaskRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ assigneeId: 'emp-1' }),
      );
      expect(result).toEqual(savedTask);
    });
  });

  // ─── update (5 tests) ────────────────────────────────────────────────────────

  describe('update', () => {
    it('EMPLOYEE can update own task', async () => {
      const employee = makeUser({ id: 'user-1', role: UserRole.EMPLOYEE });
      const task = makeTask({ ownerId: 'user-1' });
      const updated = makeTask({ title: 'Updated Title', ownerId: 'user-1' });

      mockTaskRepo.findOne
        .mockResolvedValueOnce(task)    // findOne() inside update()
        .mockResolvedValueOnce(updated); // findOne() after save
      mockTaskRepo.save.mockResolvedValue(updated);

      const result = await service.update('task-1', { title: 'Updated Title' }, employee);

      expect(result.title).toBe('Updated Title');
    });

    it('EMPLOYEE can update task they are assigned to (not owner)', async () => {
      const employee = makeUser({ id: 'assignee-1', role: UserRole.EMPLOYEE });
      const task = makeTask({ ownerId: 'owner-1', assigneeId: 'assignee-1' });
      const updated = makeTask({ status: TaskStatus.IN_PROGRESS });

      mockTaskRepo.findOne
        .mockResolvedValueOnce(task)
        .mockResolvedValueOnce(updated);
      mockTaskRepo.save.mockResolvedValue(updated);

      const result = await service.update('task-1', { status: TaskStatus.IN_PROGRESS }, employee);

      expect(result.status).toBe(TaskStatus.IN_PROGRESS);
    });

    it('EMPLOYEE throws OwnershipViolationException when updating unrelated task', async () => {
      const employee = makeUser({ id: 'emp-2', role: UserRole.EMPLOYEE });
      const task = makeTask({ ownerId: 'emp-1', assigneeId: null });
      mockTaskRepo.findOne.mockResolvedValue(task);

      await expect(
        service.update('task-1', { title: 'X' }, employee),
      ).rejects.toThrow(OwnershipViolationException);
    });

    it('ADMIN can update any task', async () => {
      const admin = makeUser({ id: 'admin-1', role: UserRole.ADMIN });
      const task = makeTask({ ownerId: 'emp-1' });
      const updated = makeTask({ status: TaskStatus.COMPLETED });

      mockTaskRepo.findOne
        .mockResolvedValueOnce(task)
        .mockResolvedValueOnce(updated);
      mockTaskRepo.save.mockResolvedValue(updated);

      const result = await service.update('task-1', { status: TaskStatus.COMPLETED }, admin);

      expect(result.status).toBe(TaskStatus.COMPLETED);
    });

    it('EMPLOYEE throws InsufficientPermissionsException when trying to change projectId', async () => {
      const employee = makeUser({ id: 'user-1', role: UserRole.EMPLOYEE });
      const task = makeTask({ ownerId: 'user-1' });
      mockTaskRepo.findOne.mockResolvedValue(task);

      await expect(
        service.update('task-1', { projectId: 'other-project' }, employee),
      ).rejects.toThrow(InsufficientPermissionsException);
    });
  });

  // ─── remove (3 tests) ────────────────────────────────────────────────────────

  describe('remove', () => {
    it('ADMIN can delete a task', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      const task = makeTask();
      mockTaskRepo.findOne.mockResolvedValue(task);
      mockTaskRepo.remove.mockResolvedValue(undefined);

      await expect(service.remove('task-1', admin)).resolves.toBeUndefined();
      expect(mockTaskRepo.remove).toHaveBeenCalledWith(task);
    });

    it('EMPLOYEE throws InsufficientPermissionsException on delete', async () => {
      const employee = makeUser({ role: UserRole.EMPLOYEE });

      await expect(service.remove('task-1', employee)).rejects.toThrow(
        InsufficientPermissionsException,
      );
      expect(mockTaskRepo.remove).not.toHaveBeenCalled();
    });

    it('throws ResourceNotFoundException when task does not exist', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      mockTaskRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('ghost-id', admin)).rejects.toThrow(ResourceNotFoundException);
    });
  });

  // ─── recalculateDelayedStatus (4 tests) ──────────────────────────────────────

  describe('recalculateDelayedStatus', () => {
    it('marks overdue non-completed tasks as DELAYED and returns count', async () => {
      const overdueTasks = [
        makeTask({ id: 't1', status: TaskStatus.PENDING,     dueDate: '2020-01-01' }),
        makeTask({ id: 't2', status: TaskStatus.IN_PROGRESS, dueDate: '2020-06-01' }),
      ];
      mockTaskRepo.find.mockResolvedValue(overdueTasks);

      const updateQB: any = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        whereInIds: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 2 }),
      };
      mockTaskRepo.createQueryBuilder.mockReturnValue(updateQB);

      const count = await service.recalculateDelayedStatus();

      expect(count).toBe(2);
      expect(updateQB.set).toHaveBeenCalledWith({ status: TaskStatus.DELAYED });
      expect(updateQB.whereInIds).toHaveBeenCalledWith(['t1', 't2']);
    });

    it('returns 0 when no overdue tasks exist', async () => {
      mockTaskRepo.find.mockResolvedValue([]);

      const count = await service.recalculateDelayedStatus();

      expect(count).toBe(0);
      // createQueryBuilder for update should NOT be called (short-circuit)
      expect(mockTaskRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('skips tasks that are already DELAYED (query filter)', async () => {
      // The repository.find() is called with Not(In([COMPLETED, DELAYED])) —
      // meaning already-DELAYED tasks are excluded from the query at the DB level.
      // This test verifies that only PENDING/IN_PROGRESS tasks are returned.
      const overduePending = makeTask({ id: 'p1', status: TaskStatus.PENDING, dueDate: '2020-01-01' });
      mockTaskRepo.find.mockResolvedValue([overduePending]);

      const updateQB: any = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        whereInIds: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      mockTaskRepo.createQueryBuilder.mockReturnValue(updateQB);

      const count = await service.recalculateDelayedStatus();

      expect(count).toBe(1);
      // Verify the IDs passed are only for the PENDING task
      expect(updateQB.whereInIds).toHaveBeenCalledWith(['p1']);
    });

    it('does not call update when no tasks found (idempotent on empty)', async () => {
      mockTaskRepo.find.mockResolvedValue([]);

      await service.recalculateDelayedStatus();

      // createQueryBuilder (for update) should not be called when 0 tasks
      expect(mockTaskRepo.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  // ─── ERP-9: Notification assertions ──────────────────────────────────────────

  describe('create — ERP-9 TASK_ASSIGNED notification', () => {
    it('should call createErpNotification with TASK_ASSIGNED when assigneeId is set', async () => {
      const admin   = makeUser({ id: 'admin-1', role: UserRole.ADMIN });
      const project = makeProject();
      const assignee = makeUser({ id: 'assignee-1' });
      const task    = makeTask({ assigneeId: 'assignee-1', assignee: assignee });

      mockProjectRepo.findOne.mockResolvedValue(project);
      mockUserRepo.findOne.mockResolvedValue(assignee);
      mockTaskRepo.create.mockReturnValue(task);
      mockTaskRepo.save.mockResolvedValue(task);

      await service.create(
        { title: 'Fix bug', projectId: 'project-1', assigneeId: 'assignee-1' },
        admin,
      );

      expect(mockNotificationService.createErpNotification).toHaveBeenCalledWith(
        'assignee-1',
        'TASK_ASSIGNED',
        expect.any(String),
        expect.any(String),
        task.id,
      );
    });
  });
});
