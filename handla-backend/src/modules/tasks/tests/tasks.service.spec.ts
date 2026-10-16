import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

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
import { AwsService } from '../../aws/aws.service';
import { FileUpload, FileUploadResourceType, FileUploadStatus } from '../../uploads/entities/file-upload.entity';

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
    assignedToClient: false,
    requiresUpload: false,
    attachments: null,
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

const mockFileUploadRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn().mockImplementation((dto) => ({ id: 'upload-uuid-1', ...dto })),
  save: jest.fn().mockImplementation(async (r) => r),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
};

const mockProjectRepo = {
  findOne: jest.fn(),
};

const mockUserRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
};

const mockNotificationService = {
  createErpNotification: jest.fn().mockResolvedValue({}),
};

const mockEmailService = {
  queueTaskAssigned: jest.fn().mockResolvedValue(undefined),
  queueTaskDelayed:  jest.fn().mockResolvedValue(undefined),
};

const mockAwsService = {
  uploadBuffer: jest.fn().mockResolvedValue('https://cdn.example.com/tasks/task-1/file.pdf'),
  resolveLogicalKey: jest.fn().mockImplementation((url: string) => {
    if (!url || !url.startsWith('https://cdn.example.com/')) return null;
    return url.replace('https://cdn.example.com/', '');
  }),
  isKeyInNamespace: jest.fn().mockImplementation((key: string, namespaces: string[]) => {
    if (!key) return false;
    return namespaces.some((ns) => key.startsWith(ns));
  }),
  fileExists: jest.fn().mockResolvedValue(true),
  signFileUrl: jest.fn().mockImplementation(async (u) => (u ? `${u}?signed=true` : u)),
  generateGetUrl: jest.fn().mockImplementation(async (k) => `https://cdn.example.com/${k}?signed=true`),
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('TasksService', () => {
  let service: TasksService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const mockDataSource = {
      transaction: jest.fn().mockImplementation(async (cb) => {
        const manager = {
          getRepository: jest.fn().mockImplementation((entity) => {
            if (entity === Task) return mockTaskRepo;
            if (entity === FileUpload) return mockFileUploadRepo;
            return {};
          }),
        };
        return cb(manager);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: getRepositoryToken(Task),       useValue: mockTaskRepo       },
        { provide: getRepositoryToken(Project),    useValue: mockProjectRepo    },
        { provide: getRepositoryToken(User),       useValue: mockUserRepo       },
        { provide: getRepositoryToken(FileUpload), useValue: mockFileUploadRepo },
        { provide: NotificationService,            useValue: mockNotificationService },
        { provide: EmailService,                   useValue: mockEmailService },
        { provide: AwsService,                     useValue: mockAwsService },
        { provide: DataSource,                     useValue: mockDataSource },
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

    it('applies search filter on title LIKE', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      const qb = makeQB([], 0);
      mockTaskRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(admin, { page: 1, limit: 20, search: 'homepage' });

      // MySQL uses LIKE (case-insensitive on utf8mb4_unicode_ci), not Postgres ILIKE.
      expect(qb.andWhere).toHaveBeenCalledWith('t.title LIKE :search', { search: '%homepage%' });
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

  // ─── findAssignableStaff ───────────────────────────────────────────────────────

  describe('findAssignableStaff', () => {
    it('returns only non-archived/non-disabled ADMIN+EMPLOYEE users, mapped to picker fields', async () => {
      const staff = [
        makeUser({ id: 'admin-1', name: 'Alice', email: 'a@x.com', role: UserRole.ADMIN }),
        makeUser({ id: 'emp-1', name: 'Bob', email: 'b@x.com', role: UserRole.EMPLOYEE }),
      ];
      mockUserRepo.find.mockResolvedValue(staff);

      const result = await service.findAssignableStaff();

      expect(mockUserRepo.find).toHaveBeenCalledWith({
        where: [
          { role: UserRole.ADMIN, isArchived: false, isDisabled: false },
          { role: UserRole.EMPLOYEE, isArchived: false, isDisabled: false },
        ],
        select: ['id', 'name', 'email', 'role'],
        order: { name: 'ASC' },
      });
      expect(result).toEqual([
        { id: 'admin-1', name: 'Alice', email: 'a@x.com', role: UserRole.ADMIN },
        { id: 'emp-1', name: 'Bob', email: 'b@x.com', role: UserRole.EMPLOYEE },
      ]);
    });

    it('returns an empty array when no staff exist', async () => {
      mockUserRepo.find.mockResolvedValue([]);
      const result = await service.findAssignableStaff();
      expect(result).toEqual([]);
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

  // ─── submitClientTask ─────────────────────────────────────────────────────────

  describe('submitClientTask', () => {
    const clientUser = makeUser({ id: 'client-user-1', role: UserRole.CLIENT });

    // A client-directed task owned by the client-user-1's project.
    function makeClientTask(overrides: Partial<Task> = {}): Task {
      return makeTask({
        assignedToClient: true,
        requiresUpload: false,
        attachments: null,
        ownerId: 'staff-1',
        project: makeProject({ client: makeClient({ userId: 'client-user-1' }) }),
        ...overrides,
      });
    }

    it('throws InsufficientPermissionsException for a non-CLIENT user', async () => {
      const employee = makeUser({ role: UserRole.EMPLOYEE });
      await expect(
        service.submitClientTask('task-1', { attachments: [] }, employee),
      ).rejects.toThrow(InsufficientPermissionsException);
    });

    it('throws AppException (403) when the task is not assigned to the client', async () => {
      const task = makeClientTask({ assignedToClient: false });
      mockTaskRepo.findOne.mockResolvedValueOnce(task);

      await expect(
        service.submitClientTask('task-1', { attachments: [] }, clientUser),
      ).rejects.toThrow(AppException);
    });

    it('throws AppException (400) when requiresUpload but no attachments provided', async () => {
      const task = makeClientTask({ requiresUpload: true });
      mockTaskRepo.findOne.mockResolvedValueOnce(task);

      await expect(
        service.submitClientTask('task-1', { attachments: [] }, clientUser),
      ).rejects.toThrow(AppException);
      expect(mockTaskRepo.save).not.toHaveBeenCalled();
    });

    it('uploads attachments, marks COMPLETED, and notifies the owner', async () => {
      const task = makeClientTask({ requiresUpload: true });
      // findOne (ownership) then reload after save.
      mockTaskRepo.findOne
        .mockResolvedValueOnce(task)
        .mockResolvedValueOnce({ ...task, status: TaskStatus.COMPLETED });
      mockTaskRepo.save.mockImplementation(async (t: Task) => t);
      mockFileUploadRepo.findOne.mockResolvedValueOnce({
        id: 'up-1',
        userId: clientUser.id,
        resourceType: FileUploadResourceType.TASK,
        resourceId: 'task-1',
        s3Key: 'tasks/task-1/a.pdf',
        fileUrl: 'https://cdn.example.com/tasks/task-1/a.pdf',
        originalName: 'a.pdf',
        sizeBytes: 1234,
        status: FileUploadStatus.PENDING,
      });

      const result = await service.submitClientTask(
        'task-1',
        {
          attachments: [{ url: 'https://cdn.example.com/tasks/task-1/a.pdf', name: 'tampered-name.exe', size: 999999 }],
          note: 'Here are my files',
        },
        clientUser,
      );

      // Saved task became COMPLETED with the attachment merged in using trusted server record metadata
      const savedArg = mockTaskRepo.save.mock.calls[0][0] as Task;
      expect(savedArg.status).toBe(TaskStatus.COMPLETED);
      expect(savedArg.attachments).toHaveLength(1);
      expect(savedArg.attachments![0]).toEqual(
        expect.objectContaining({ url: 'https://cdn.example.com/tasks/task-1/a.pdf', name: 'a.pdf', size: 1234 }),
      );
      expect(savedArg.attachments![0].uploadedAt).toEqual(expect.any(String));

      expect(mockNotificationService.createErpNotification).toHaveBeenCalledWith(
        'staff-1',
        'SYSTEM',
        expect.any(String),
        expect.any(String),
        task.id,
      );
      expect(result.status).toBe(TaskStatus.COMPLETED);
      expect(mockFileUploadRepo.update).toHaveBeenCalledWith(
        { id: 'up-1', status: FileUploadStatus.PENDING },
        expect.objectContaining({ status: FileUploadStatus.CONSUMED }),
      );
    });

    it('merges new attachments onto previously-submitted ones', async () => {
      const existing = { url: 'https://cdn.example.com/tasks/task-1/old.pdf', name: 'old.pdf', uploadedAt: '2024-01-01T00:00:00.000Z' };
      const task = makeClientTask({ requiresUpload: false, attachments: [existing] });
      mockTaskRepo.findOne
        .mockResolvedValueOnce(task)
        .mockResolvedValueOnce(task);
      mockTaskRepo.save.mockImplementation(async (t: Task) => t);
      mockFileUploadRepo.findOne.mockResolvedValueOnce({
        id: 'up-2',
        userId: clientUser.id,
        resourceType: FileUploadResourceType.TASK,
        resourceId: 'task-1',
        s3Key: 'tasks/task-1/new.pdf',
        fileUrl: 'https://cdn.example.com/tasks/task-1/new.pdf',
        originalName: 'new.pdf',
        sizeBytes: 5678,
        status: FileUploadStatus.PENDING,
      });

      await service.submitClientTask(
        'task-1',
        { attachments: [{ url: 'https://cdn.example.com/tasks/task-1/new.pdf', name: 'new.pdf' }] },
        clientUser,
      );

      const savedArg = mockTaskRepo.save.mock.calls[0][0] as Task;
      expect(savedArg.attachments).toHaveLength(2);
      expect(savedArg.attachments!.map((a) => a.name)).toEqual(['old.pdf', 'new.pdf']);
    });

    it('allows completion with no files when requiresUpload is false', async () => {
      const task = makeClientTask({ requiresUpload: false });
      mockTaskRepo.findOne
        .mockResolvedValueOnce(task)
        .mockResolvedValueOnce({ ...task, status: TaskStatus.COMPLETED });
      mockTaskRepo.save.mockImplementation(async (t: Task) => t);

      const result = await service.submitClientTask('task-1', { attachments: [] }, clientUser);
      expect(result.status).toBe(TaskStatus.COMPLETED);
    });

    it('rejects external URL attachment not hosted in storage', async () => {
      const task = makeClientTask({ requiresUpload: false });
      mockTaskRepo.findOne.mockResolvedValueOnce(task);

      await expect(
        service.submitClientTask(
          'task-1',
          { attachments: [{ url: 'https://evil.com/malware.pdf', name: 'evil.pdf' }] },
          clientUser,
        ),
      ).rejects.toThrow(AppException);
    });

    it('rejects attachment belonging to a different task namespace', async () => {
      const task = makeClientTask({ requiresUpload: false });
      mockTaskRepo.findOne.mockResolvedValueOnce(task);

      await expect(
        service.submitClientTask(
          'task-1',
          { attachments: [{ url: 'https://cdn.example.com/tasks/other-task-id/file.pdf', name: 'file.pdf' }] },
          clientUser,
        ),
      ).rejects.toThrow(AppException);
    });

    it('rejects attachment when upload record does not exist in DB', async () => {
      const task = makeClientTask({ requiresUpload: false });
      mockTaskRepo.findOne.mockResolvedValueOnce(task);
      mockFileUploadRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.submitClientTask(
          'task-1',
          { attachments: [{ url: 'https://cdn.example.com/tasks/task-1/untracked.pdf', name: 'untracked.pdf' }] },
          clientUser,
        ),
      ).rejects.toThrow(AppException);
    });

    it('rejects attachment uploaded by a different user (cross-user reuse)', async () => {
      const task = makeClientTask({ requiresUpload: false });
      mockTaskRepo.findOne.mockResolvedValueOnce(task);
      mockFileUploadRepo.findOne.mockResolvedValueOnce({
        id: 'up-cross',
        userId: 'other-user-999',
        resourceType: FileUploadResourceType.TASK,
        resourceId: 'task-1',
        s3Key: 'tasks/task-1/cross.pdf',
        fileUrl: 'https://cdn.example.com/tasks/task-1/cross.pdf',
        originalName: 'cross.pdf',
        sizeBytes: 100,
        status: FileUploadStatus.PENDING,
      });

      await expect(
        service.submitClientTask(
          'task-1',
          { attachments: [{ url: 'https://cdn.example.com/tasks/task-1/cross.pdf', name: 'cross.pdf' }] },
          clientUser,
        ),
      ).rejects.toThrow(AppException);
    });

    it('rejects attachment uploaded for a different task (cross-task reuse)', async () => {
      const task = makeClientTask({ requiresUpload: false });
      mockTaskRepo.findOne.mockResolvedValueOnce(task);
      mockFileUploadRepo.findOne.mockResolvedValueOnce({
        id: 'up-other',
        userId: clientUser.id,
        resourceType: FileUploadResourceType.TASK,
        resourceId: 'task-different',
        s3Key: 'tasks/task-1/cross-task.pdf',
        fileUrl: 'https://cdn.example.com/tasks/task-1/cross-task.pdf',
        originalName: 'cross-task.pdf',
        sizeBytes: 100,
        status: FileUploadStatus.PENDING,
      });

      await expect(
        service.submitClientTask(
          'task-1',
          { attachments: [{ url: 'https://cdn.example.com/tasks/task-1/cross-task.pdf', name: 'cross-task.pdf' }] },
          clientUser,
        ),
      ).rejects.toThrow(AppException);
    });

    it('rejects already-consumed attachment (replay / double consumption)', async () => {
      const task = makeClientTask({ requiresUpload: false });
      mockTaskRepo.findOne.mockResolvedValueOnce(task);
      mockFileUploadRepo.findOne.mockResolvedValueOnce({
        id: 'up-consumed',
        userId: clientUser.id,
        resourceType: FileUploadResourceType.TASK,
        resourceId: 'task-1',
        s3Key: 'tasks/task-1/consumed.pdf',
        fileUrl: 'https://cdn.example.com/tasks/task-1/consumed.pdf',
        originalName: 'consumed.pdf',
        sizeBytes: 100,
        status: FileUploadStatus.CONSUMED,
      });

      await expect(
        service.submitClientTask(
          'task-1',
          { attachments: [{ url: 'https://cdn.example.com/tasks/task-1/consumed.pdf', name: 'consumed.pdf' }] },
          clientUser,
        ),
      ).rejects.toThrow(AppException);
    });

    it('rejects attachment when object does not exist in S3', async () => {
      const task = makeClientTask({ requiresUpload: false });
      mockTaskRepo.findOne.mockResolvedValueOnce(task);
      mockFileUploadRepo.findOne.mockResolvedValueOnce({
        id: 'up-s3',
        userId: clientUser.id,
        resourceType: FileUploadResourceType.TASK,
        resourceId: 'task-1',
        s3Key: 'tasks/task-1/missing.pdf',
        fileUrl: 'https://cdn.example.com/tasks/task-1/missing.pdf',
        originalName: 'missing.pdf',
        sizeBytes: 100,
        status: FileUploadStatus.PENDING,
      });
      mockAwsService.fileExists.mockResolvedValueOnce(false);

      await expect(
        service.submitClientTask(
          'task-1',
          { attachments: [{ url: 'https://cdn.example.com/tasks/task-1/missing.pdf', name: 'missing.pdf' }] },
          clientUser,
        ),
      ).rejects.toThrow(AppException);
    });

    it('rolls back and throws CONFLICT when an attachment was consumed concurrently', async () => {
      const task = makeClientTask({ requiresUpload: false });
      mockTaskRepo.findOne.mockResolvedValueOnce(task);
      mockFileUploadRepo.findOne.mockResolvedValueOnce({
        id: 'up-concurrent',
        userId: clientUser.id,
        resourceType: FileUploadResourceType.TASK,
        resourceId: 'task-1',
        s3Key: 'tasks/task-1/concurrent.pdf',
        fileUrl: 'https://cdn.example.com/tasks/task-1/concurrent.pdf',
        originalName: 'concurrent.pdf',
        sizeBytes: 100,
        status: FileUploadStatus.PENDING,
      });
      mockAwsService.fileExists.mockResolvedValueOnce(true);
      // Simulate concurrent update where affected count is 0
      mockFileUploadRepo.update.mockResolvedValueOnce({ affected: 0 });

      await expect(
        service.submitClientTask(
          'task-1',
          { attachments: [{ url: 'https://cdn.example.com/tasks/task-1/concurrent.pdf', name: 'concurrent.pdf' }] },
          clientUser,
        ),
      ).rejects.toThrow(AppException);
    });

    it('rolls back transaction if task save fails during submission', async () => {
      const task = makeClientTask({ requiresUpload: false });
      mockTaskRepo.findOne.mockResolvedValueOnce(task);
      mockFileUploadRepo.findOne.mockResolvedValueOnce({
        id: 'up-save-fail',
        userId: clientUser.id,
        resourceType: FileUploadResourceType.TASK,
        resourceId: 'task-1',
        s3Key: 'tasks/task-1/save-fail.pdf',
        fileUrl: 'https://cdn.example.com/tasks/task-1/save-fail.pdf',
        originalName: 'save-fail.pdf',
        sizeBytes: 100,
        status: FileUploadStatus.PENDING,
      });
      mockAwsService.fileExists.mockResolvedValueOnce(true);
      mockFileUploadRepo.update.mockResolvedValueOnce({ affected: 1 });
      mockTaskRepo.save.mockRejectedValueOnce(new Error('DB deadlock / write failure'));

      await expect(
        service.submitClientTask(
          'task-1',
          { attachments: [{ url: 'https://cdn.example.com/tasks/task-1/save-fail.pdf', name: 'save-fail.pdf' }] },
          clientUser,
        ),
      ).rejects.toThrow('DB deadlock / write failure');
    });
  });

  describe('uploadAttachment', () => {
    const clientUser = makeUser({ id: 'client-user-1', role: UserRole.CLIENT });

    function makeClientTask(overrides: Partial<Task> = {}): Task {
      return makeTask({
        assignedToClient: true,
        project: makeProject({ client: makeClient({ userId: 'client-user-1' }) }),
        ...overrides,
      });
    }

    const tinyPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n');

    it('rejects non-CLIENT users', async () => {
      const employee = makeUser({ role: UserRole.EMPLOYEE });
      const file = { buffer: tinyPdf, originalname: 'doc.pdf' } as Express.Multer.File;

      await expect(
        service.uploadAttachment('task-1', file, employee),
      ).rejects.toThrow(InsufficientPermissionsException);
    });

    it('rejects upload when task is not assigned to client', async () => {
      const task = makeClientTask({ assignedToClient: false });
      mockTaskRepo.findOne.mockResolvedValueOnce(task);
      const file = { buffer: tinyPdf, originalname: 'doc.pdf' } as Express.Multer.File;

      await expect(
        service.uploadAttachment('task-1', file, clientUser),
      ).rejects.toThrow(AppException);
    });

    it('rejects empty or missing file buffer', async () => {
      const task = makeClientTask({ assignedToClient: true });
      mockTaskRepo.findOne.mockResolvedValueOnce(task);
      const file = { buffer: Buffer.from(''), originalname: 'empty.pdf' } as Express.Multer.File;

      await expect(
        service.uploadAttachment('task-1', file, clientUser),
      ).rejects.toThrow(AppException);
    });

    it('rejects file buffer exceeding 10MB limit in service directly', async () => {
      const task = makeClientTask({ assignedToClient: true });
      mockTaskRepo.findOne.mockResolvedValueOnce(task);
      const oversizedBuffer = Buffer.alloc(11 * 1024 * 1024);
      const file = { buffer: oversizedBuffer, originalname: 'big.pdf' } as Express.Multer.File;

      await expect(
        service.uploadAttachment('task-1', file, clientUser),
      ).rejects.toThrow(AppException);
    });

    it('rejects disguised executable disguised as PDF', async () => {
      const task = makeClientTask({ assignedToClient: true });
      mockTaskRepo.findOne.mockResolvedValueOnce(task);
      const fakePdf = { buffer: Buffer.from('MZ\x90\x00\x03\x00\x00\x00'), originalname: 'trojan.pdf' } as Express.Multer.File;

      await expect(
        service.uploadAttachment('task-1', fakePdf, clientUser),
      ).rejects.toThrow(AppException);
    });

    it('uploads valid PDF and creates PENDING FileUpload record', async () => {
      const task = makeClientTask({ assignedToClient: true });
      mockTaskRepo.findOne.mockResolvedValueOnce(task);
      const validPdfFile = { buffer: tinyPdf, originalname: '../../../etc/passwd.pdf' } as Express.Multer.File;

      const res = await service.uploadAttachment('task-1', validPdfFile, clientUser);
      expect(res.contentType).toBe('application/pdf');
      expect(mockAwsService.uploadBuffer).toHaveBeenCalledWith(
        tinyPdf,
        expect.stringMatching(/^tasks\/task-1\/[0-9]+-[a-f0-9-]+\.pdf$/),
        'application/pdf',
      );
      expect(mockFileUploadRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: clientUser.id,
          resourceType: FileUploadResourceType.TASK,
          resourceId: task.id,
          status: FileUploadStatus.PENDING,
          sizeBytes: tinyPdf.length,
          originalName: '.._.._.._etc_passwd.pdf',
        }),
      );
      expect(mockFileUploadRepo.save).toHaveBeenCalled();
      expect(res.uploadId).toBe('upload-uuid-1');
    });
  });

  describe('getSignedAttachmentUrl', () => {
    const clientUser = makeUser({ id: 'client-user-1', role: UserRole.CLIENT });

    function makeClientTask(overrides: Partial<Task> = {}): Task {
      return makeTask({
        assignedToClient: true,
        project: makeProject({ client: makeClient({ userId: 'client-user-1' }) }),
        attachments: [
          { url: 'https://cdn.example.com/tasks/task-1/file-1.pdf', name: 'file-1.pdf', uploadedAt: '2024-01-01' },
        ],
        ...overrides,
      });
    }

    it('generates signed download URL when client has access and attachment belongs to task', async () => {
      const task = makeClientTask();
      mockTaskRepo.findOne.mockResolvedValueOnce(task);

      const url = await service.getSignedAttachmentUrl('task-1', 'https://cdn.example.com/tasks/task-1/file-1.pdf', clientUser);
      expect(url).toContain('https://cdn.example.com/tasks/task-1/file-1.pdf?signed=true');
    });

    it('rejects access if key is in another task namespace', async () => {
      const task = makeClientTask();
      mockTaskRepo.findOne.mockResolvedValueOnce(task);

      await expect(
        service.getSignedAttachmentUrl('task-1', 'https://cdn.example.com/tasks/other-task/secret.pdf', clientUser),
      ).rejects.toThrow(AppException);
    });

    it('rejects access if attachment does not exist on the task record', async () => {
      const task = makeClientTask({ attachments: [] });
      mockTaskRepo.findOne.mockResolvedValueOnce(task);

      await expect(
        service.getSignedAttachmentUrl('task-1', 'https://cdn.example.com/tasks/task-1/nonexistent.pdf', clientUser),
      ).rejects.toThrow(ResourceNotFoundException);
    });
  });
  });
});
