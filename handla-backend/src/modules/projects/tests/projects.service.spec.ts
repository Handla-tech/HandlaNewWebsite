import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { ProjectsService } from '../projects.service';
import { Project } from '../entities/project.entity';
import { Client } from '../../clients/entities/client.entity';
import { User } from '../../auth/entities/user.entity';
import { Conversation } from '../../chat/entities/conversation.entity';
import { ChatService } from '../../chat/chat.service';
import { UserRole, ProjectStatus, ClientStatus } from '../../../common/enums';
import {
  ResourceNotFoundException,
  OwnershipViolationException,
  InsufficientPermissionsException,
  AppException,
} from '../../../utils/exceptions';

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
    userId: 'user-client-1',
    ownerId: 'user-1',
    company: 'Acme Corp',
    status: ClientStatus.ACTIVE,
    notes: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    user: makeUser({ id: 'user-client-1', role: UserRole.CLIENT }),
    owner: makeUser({ id: 'user-1', role: UserRole.EMPLOYEE }),
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
    description: 'A test project description',
    clientId: 'client-1',
    ownerId: 'user-1',
    status: ProjectStatus.PLANNING,
    startDate: null,
    endDate: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    client: makeClient(),
    owner: makeUser(),
    tasks: [],
    ...overrides,
  };
}

// ─── Mock QueryBuilder ────────────────────────────────────────────────────────

function makeQB(projects: Project[] = [], count = 0) {
  const qb: any = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([projects, count]),
  };
  return qb;
}

// ─── Mock Repos ───────────────────────────────────────────────────────────────

const mockProjectRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockClientRepo = {
  findOne: jest.fn(),
};

const mockUserRepo = {
  findOne: jest.fn(),
};

// ProjectsService also depends on ConversationRepository and ChatService
// because it posts a system-event message into the client's chat thread
// whenever a project is created. These mocks satisfy the DI container so
// the test module can compile; tests that don't exercise chat-side-effects
// simply ignore them.
const mockConversationRepo = {
  findOne: jest.fn().mockResolvedValue(null),
};

const mockChatService = {
  saveMessage: jest.fn().mockResolvedValue({}),
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('ProjectsService', () => {
  let service: ProjectsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: getRepositoryToken(Project),      useValue: mockProjectRepo      },
        { provide: getRepositoryToken(Client),       useValue: mockClientRepo       },
        { provide: getRepositoryToken(User),         useValue: mockUserRepo         },
        { provide: getRepositoryToken(Conversation), useValue: mockConversationRepo },
        { provide: ChatService,                      useValue: mockChatService      },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  // ─── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('ADMIN: returns all projects with no ownership filter', async () => {
      const admin = makeUser({ id: 'admin-1', role: UserRole.ADMIN });
      const projects = [makeProject(), makeProject({ id: 'project-2' })];
      const qb = makeQB(projects, 2);
      mockProjectRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(admin, { page: 1, limit: 20 });

      expect(result.total).toBe(2);
      expect(result.projects).toHaveLength(2);
      // ADMIN: no ownership andWhere added
      const andWhereCalls = qb.andWhere.mock.calls.map((c: any[]) => c[0]);
      expect(andWhereCalls).not.toContain(expect.stringContaining('ownerId'));
    });

    it('EMPLOYEE: scopes results to own projects only', async () => {
      const employee = makeUser({ id: 'emp-1', role: UserRole.EMPLOYEE });
      const qb = makeQB([makeProject()], 1);
      mockProjectRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(employee, { page: 1, limit: 20 });

      // Should call andWhere with ownerId = emp-1
      expect(qb.andWhere).toHaveBeenCalledWith('p.ownerId = :userId', { userId: 'emp-1' });
    });

    it('applies clientId filter when provided', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      const qb = makeQB([], 0);
      mockProjectRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(admin, { page: 1, limit: 20, clientId: 'client-1' });

      expect(qb.andWhere).toHaveBeenCalledWith('p.clientId = :clientId', { clientId: 'client-1' });
    });

    it('applies status filter when provided', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      const qb = makeQB([], 0);
      mockProjectRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(admin, { page: 1, limit: 20, status: ProjectStatus.ACTIVE });

      expect(qb.andWhere).toHaveBeenCalledWith('p.status = :status', { status: ProjectStatus.ACTIVE });
    });

    it('applies search filter on title LIKE', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      const qb = makeQB([], 0);
      mockProjectRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(admin, { page: 1, limit: 20, search: 'acme' });

      // MySQL uses LIKE (case-insensitive on utf8mb4_unicode_ci collation),
      // not Postgres ILIKE.
      expect(qb.andWhere).toHaveBeenCalledWith('p.title LIKE :search', { search: '%acme%' });
    });

    it('returns correct pagination math', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      const qb = makeQB(Array(5).fill(makeProject()), 47);
      mockProjectRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(admin, { page: 2, limit: 5 });

      expect(result.page).toBe(2);
      expect(result.pages).toBe(Math.ceil(47 / 5));
      expect(result.total).toBe(47);
    });
  });

  // ─── findOne ────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns project when found by ADMIN', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      const project = makeProject();
      mockProjectRepo.findOne.mockResolvedValue(project);

      const result = await service.findOne('project-1', admin);

      expect(result).toEqual(project);
    });

    it('throws ResourceNotFoundException when project does not exist', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      mockProjectRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('ghost-id', admin)).rejects.toThrow(ResourceNotFoundException);
    });

    it('EMPLOYEE throws OwnershipViolationException when they do not own the project', async () => {
      const employee = makeUser({ id: 'emp-2', role: UserRole.EMPLOYEE });
      const project = makeProject({ ownerId: 'emp-1' }); // owned by different employee
      mockProjectRepo.findOne.mockResolvedValue(project);

      await expect(service.findOne('project-1', employee)).rejects.toThrow(OwnershipViolationException);
    });

    it('EMPLOYEE succeeds when they own the project', async () => {
      const employee = makeUser({ id: 'user-1', role: UserRole.EMPLOYEE });
      const project = makeProject({ ownerId: 'user-1' });
      mockProjectRepo.findOne.mockResolvedValue(project);

      const result = await service.findOne('project-1', employee);

      expect(result).toEqual(project);
    });

    it('CLIENT throws InsufficientPermissionsException for unrelated project', async () => {
      const client = makeUser({ id: 'client-user-1', role: UserRole.CLIENT });
      const project = makeProject({ clientId: 'client-99' });
      mockProjectRepo.findOne.mockResolvedValue(project);
      // Client record not found for this user
      mockClientRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('project-1', client)).rejects.toThrow(InsufficientPermissionsException);
    });

    it('CLIENT succeeds when the project belongs to their client record', async () => {
      const client = makeUser({ id: 'client-user-1', role: UserRole.CLIENT });
      const clientRecord = makeClient({ id: 'client-1', userId: 'client-user-1' });
      const project = makeProject({ clientId: 'client-1' });
      mockProjectRepo.findOne.mockResolvedValue(project);
      mockClientRepo.findOne.mockResolvedValue(clientRecord);

      const result = await service.findOne('project-1', client);

      expect(result).toEqual(project);
    });
  });

  // ─── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('EMPLOYEE creates project with ownerId set to actingUser.id', async () => {
      const employee = makeUser({ id: 'emp-1', role: UserRole.EMPLOYEE });
      const client = makeClient({ id: 'client-1', ownerId: 'emp-1' });
      const dto = { title: 'New Project', clientId: 'client-1' };
      const savedProject = makeProject({ id: 'new-proj', ownerId: 'emp-1' });

      mockClientRepo.findOne.mockResolvedValue(client);
      mockProjectRepo.create.mockReturnValue(savedProject);
      mockProjectRepo.save.mockResolvedValue(savedProject);
      mockProjectRepo.findOne.mockResolvedValue(savedProject);

      const result = await service.create(dto as any, employee);

      expect(mockProjectRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ ownerId: 'emp-1' }),
      );
      expect(result).toEqual(savedProject);
    });

    it('ADMIN creates project with ownerId=null when not specified', async () => {
      const admin = makeUser({ id: 'admin-1', role: UserRole.ADMIN });
      const client = makeClient({ id: 'client-1' });
      const dto = { title: 'Admin Project', clientId: 'client-1' };
      const savedProject = makeProject({ ownerId: null });

      mockClientRepo.findOne.mockResolvedValue(client);
      mockProjectRepo.create.mockReturnValue(savedProject);
      mockProjectRepo.save.mockResolvedValue(savedProject);
      mockProjectRepo.findOne.mockResolvedValue(savedProject);

      await service.create(dto as any, admin);

      expect(mockProjectRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ ownerId: null }),
      );
    });

    it('throws ResourceNotFoundException when clientId does not exist', async () => {
      const employee = makeUser({ role: UserRole.EMPLOYEE });
      mockClientRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create({ title: 'X', clientId: 'ghost-client' } as any, employee),
      ).rejects.toThrow(ResourceNotFoundException);
    });

    it('EMPLOYEE throws AppException when they do not own the target client', async () => {
      const employee = makeUser({ id: 'emp-2', role: UserRole.EMPLOYEE });
      const client = makeClient({ id: 'client-1', ownerId: 'emp-1' }); // different owner
      mockClientRepo.findOne.mockResolvedValue(client);

      await expect(
        service.create({ title: 'X', clientId: 'client-1' } as any, employee),
      ).rejects.toThrow(AppException);
    });

    it('sets default status to PLANNING when not provided', async () => {
      const employee = makeUser({ id: 'emp-1', role: UserRole.EMPLOYEE });
      const client = makeClient({ ownerId: 'emp-1' });
      const dto = { title: 'Proj', clientId: 'client-1' };
      const saved = makeProject({ status: ProjectStatus.PLANNING });

      mockClientRepo.findOne.mockResolvedValue(client);
      mockProjectRepo.create.mockReturnValue(saved);
      mockProjectRepo.save.mockResolvedValue(saved);
      mockProjectRepo.findOne.mockResolvedValue(saved);

      await service.create(dto as any, employee);

      expect(mockProjectRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: ProjectStatus.PLANNING }),
      );
    });
  });

  // ─── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('EMPLOYEE can update own project', async () => {
      const employee = makeUser({ id: 'user-1', role: UserRole.EMPLOYEE });
      const project = makeProject({ ownerId: 'user-1' });
      const updated = makeProject({ title: 'Updated Title', ownerId: 'user-1' });

      mockProjectRepo.findOne
        .mockResolvedValueOnce(project)  // findOne in findOne()
        .mockResolvedValueOnce(updated); // findOne after save
      mockProjectRepo.save.mockResolvedValue(updated);

      const result = await service.update('project-1', { title: 'Updated Title' }, employee);

      expect(result.title).toBe('Updated Title');
    });

    it('EMPLOYEE throws OwnershipViolationException when updating others project', async () => {
      const employee = makeUser({ id: 'emp-2', role: UserRole.EMPLOYEE });
      const project = makeProject({ ownerId: 'emp-1' });
      mockProjectRepo.findOne.mockResolvedValue(project);

      await expect(
        service.update('project-1', { title: 'X' }, employee),
      ).rejects.toThrow(OwnershipViolationException);
    });

    it('ADMIN can update any project', async () => {
      const admin = makeUser({ id: 'admin-1', role: UserRole.ADMIN });
      const project = makeProject({ ownerId: 'emp-1' });
      const updated = makeProject({ status: ProjectStatus.COMPLETED });

      mockProjectRepo.findOne
        .mockResolvedValueOnce(project)
        .mockResolvedValueOnce(updated);
      mockProjectRepo.save.mockResolvedValue(updated);

      const result = await service.update('project-1', { status: ProjectStatus.COMPLETED }, admin);

      expect(result.status).toBe(ProjectStatus.COMPLETED);
    });

    it('EMPLOYEE throws InsufficientPermissionsException when trying to change clientId', async () => {
      const employee = makeUser({ id: 'user-1', role: UserRole.EMPLOYEE });
      const project = makeProject({ ownerId: 'user-1' });
      mockProjectRepo.findOne.mockResolvedValue(project);

      await expect(
        service.update('project-1', { clientId: 'other-client' }, employee),
      ).rejects.toThrow(InsufficientPermissionsException);
    });
  });

  // ─── remove ─────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('ADMIN can delete a project', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      const project = makeProject();
      mockProjectRepo.findOne.mockResolvedValue(project);
      mockProjectRepo.remove.mockResolvedValue(undefined);

      await expect(service.remove('project-1', admin)).resolves.toBeUndefined();
      expect(mockProjectRepo.remove).toHaveBeenCalledWith(project);
    });

    it('EMPLOYEE throws InsufficientPermissionsException on delete', async () => {
      const employee = makeUser({ role: UserRole.EMPLOYEE });

      await expect(service.remove('project-1', employee)).rejects.toThrow(
        InsufficientPermissionsException,
      );
      expect(mockProjectRepo.remove).not.toHaveBeenCalled();
    });

    it('throws ResourceNotFoundException when project does not exist', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      mockProjectRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('ghost-id', admin)).rejects.toThrow(ResourceNotFoundException);
    });
  });

  // ─── findByClient ────────────────────────────────────────────────────────────

  describe('findByClient', () => {
    it('ADMIN can list projects for any client', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      const projects = [makeProject(), makeProject({ id: 'p2' })];
      mockClientRepo.findOne.mockResolvedValue(makeClient());
      mockProjectRepo.find.mockResolvedValue(projects);

      const result = await service.findByClient('client-1', admin);

      expect(result).toHaveLength(2);
    });

    it('EMPLOYEE succeeds when they own the client', async () => {
      const employee = makeUser({ id: 'user-1', role: UserRole.EMPLOYEE });
      const client = makeClient({ ownerId: 'user-1' });
      const projects = [makeProject()];
      mockClientRepo.findOne.mockResolvedValue(client);
      mockProjectRepo.find.mockResolvedValue(projects);

      const result = await service.findByClient('client-1', employee);

      expect(result).toHaveLength(1);
    });

    it('EMPLOYEE throws OwnershipViolationException for a client they do not own', async () => {
      const employee = makeUser({ id: 'emp-2', role: UserRole.EMPLOYEE });
      const client = makeClient({ ownerId: 'emp-1' }); // different owner
      mockClientRepo.findOne.mockResolvedValue(client);

      await expect(service.findByClient('client-1', employee)).rejects.toThrow(
        OwnershipViolationException,
      );
    });

    it('CLIENT succeeds for their own client record', async () => {
      const clientUser = makeUser({ id: 'client-user-1', role: UserRole.CLIENT });
      const clientRecord = makeClient({ id: 'client-1', userId: 'client-user-1' });
      const projects = [makeProject()];
      mockClientRepo.findOne
        .mockResolvedValueOnce(clientRecord) // findByClient - verify client exists
        .mockResolvedValueOnce(clientRecord); // findByClient - verify client owns record
      mockProjectRepo.find.mockResolvedValue(projects);

      const result = await service.findByClient('client-1', clientUser);

      expect(result).toHaveLength(1);
    });

    it('CLIENT throws InsufficientPermissionsException for another client', async () => {
      const clientUser = makeUser({ id: 'client-user-1', role: UserRole.CLIENT });
      const otherClient = makeClient({ id: 'client-99', userId: 'other-user' });
      const myClientRecord = makeClient({ id: 'client-1', userId: 'client-user-1' });
      mockClientRepo.findOne
        .mockResolvedValueOnce(otherClient)   // client being accessed (exists)
        .mockResolvedValueOnce(myClientRecord); // user's own record

      await expect(service.findByClient('client-99', clientUser)).rejects.toThrow(
        InsufficientPermissionsException,
      );
    });

    it('throws ResourceNotFoundException when client does not exist', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      mockClientRepo.findOne.mockResolvedValue(null);

      await expect(service.findByClient('ghost-id', admin)).rejects.toThrow(
        ResourceNotFoundException,
      );
    });
  });
});
