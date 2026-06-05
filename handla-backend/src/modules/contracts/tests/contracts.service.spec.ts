import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { ContractsService } from '../contracts.service';
import { Contract } from '../entities/contract.entity';
import { Client } from '../../clients/entities/client.entity';
import { User } from '../../auth/entities/user.entity';
import { Conversation } from '../../chat/entities/conversation.entity';
import { UserRole, ContractStatus, ClientStatus } from '../../../common/enums';
import {
  ResourceNotFoundException,
  OwnershipViolationException,
  InsufficientPermissionsException,
  AppException,
} from '../../../utils/exceptions';
import { NotificationService } from '../../notifications/notification.service';
import { EmailService } from '../../email/email.service';
import { ChatService } from '../../chat/chat.service';
import { AwsService } from '../../aws/aws.service';

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

function makeContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: 'contract-1',
    title: 'Service Agreement',
    body: 'This is the full body of the service agreement between the parties.',
    clientId: 'client-1',
    ownerId: 'user-1',
    status: ContractStatus.DRAFT,
    sentAt: null,
    signedAt: null,
    s3Key: null,
    pdfUrl: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    client: makeClient(),
    owner: makeUser(),
    ...overrides,
  };
}

// ─── Mock Repositories ────────────────────────────────────────────────────────

const mockContractRepo = {
  createQueryBuilder: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  find: jest.fn(),
};

const mockClientRepo = {
  findOne: jest.fn(),
};

const mockUserRepo = {
  find: jest.fn(),
};

const mockConversationRepo = {
  findOne: jest.fn(),
};

const mockNotificationService = {
  createSystemNotification: jest.fn(),
  createErpNotification: jest.fn().mockResolvedValue({}),
};

const mockEmailService = {
  queueContractSent:     jest.fn().mockResolvedValue(undefined),
  queueContractSigned:   jest.fn().mockResolvedValue(undefined),
  queueContractRejected: jest.fn().mockResolvedValue(undefined),
};

const mockChatService = {
  saveMessage: jest.fn(),
};

const mockAwsService = {
  uploadBuffer: jest.fn(),
  buildFileUrl: jest.fn().mockReturnValue('https://bucket.s3.region.amazonaws.com/contracts/contract-1.html'),
  generatePresignedUrl: jest.fn(),
};

// ─── QueryBuilder mock helper ─────────────────────────────────────────────────

function makeQb(results: [Contract[], number]) {
  const qb = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    andWhere:          jest.fn().mockReturnThis(),
    orderBy:           jest.fn().mockReturnThis(),
    skip:              jest.fn().mockReturnThis(),
    take:              jest.fn().mockReturnThis(),
    getManyAndCount:   jest.fn().mockResolvedValue(results),
  };
  return qb;
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('ContractsService', () => {
  let service: ContractsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractsService,
        { provide: getRepositoryToken(Contract),     useValue: mockContractRepo },
        { provide: getRepositoryToken(Client),       useValue: mockClientRepo },
        { provide: getRepositoryToken(User),         useValue: mockUserRepo },
        { provide: getRepositoryToken(Conversation), useValue: mockConversationRepo },
        { provide: NotificationService,              useValue: mockNotificationService },
        { provide: EmailService,                      useValue: mockEmailService },
        { provide: ChatService,                      useValue: mockChatService },
        { provide: AwsService,                       useValue: mockAwsService },
      ],
    }).compile();

    service = module.get<ContractsService>(ContractsService);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // findAll
  // ──────────────────────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('ADMIN sees all contracts', async () => {
      const admin    = makeUser({ role: UserRole.ADMIN });
      const contract = makeContract();
      const qb       = makeQb([[contract], 1]);
      mockContractRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(admin, { page: 1, limit: 20 });

      expect(result.total).toBe(1);
      expect(result.contracts).toHaveLength(1);
      // no ownerId filter applied
      expect(qb.andWhere).not.toHaveBeenCalledWith(
        expect.stringContaining('ownerId'),
        expect.anything(),
      );
    });

    it('EMPLOYEE sees only own contracts', async () => {
      const employee = makeUser({ role: UserRole.EMPLOYEE });
      const contract = makeContract();
      const qb       = makeQb([[contract], 1]);
      mockContractRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(employee, { page: 1, limit: 20 });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'c.ownerId = :userId',
        { userId: employee.id },
      );
    });

    it('CLIENT sees only their own client contracts', async () => {
      const clientUser   = makeUser({ id: 'user-client-1', role: UserRole.CLIENT });
      const clientRecord = makeClient({ userId: 'user-client-1', id: 'client-1' });
      const contract     = makeContract();
      const qb           = makeQb([[contract], 1]);

      mockClientRepo.findOne.mockResolvedValue(clientRecord);
      mockContractRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(clientUser, { page: 1, limit: 20 });

      expect(qb.andWhere).toHaveBeenCalledWith('c.clientId = :clientId', { clientId: 'client-1' });
      expect(result.total).toBe(1);
    });

    it('CLIENT with no client record returns empty list', async () => {
      const clientUser = makeUser({ role: UserRole.CLIENT });
      mockClientRepo.findOne.mockResolvedValue(null);

      const result = await service.findAll(clientUser, { page: 1, limit: 20 });

      expect(result.contracts).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('applies status filter', async () => {
      const admin    = makeUser({ role: UserRole.ADMIN });
      const contract = makeContract({ status: ContractStatus.SENT });
      const qb       = makeQb([[contract], 1]);
      mockContractRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(admin, { status: ContractStatus.SENT });

      expect(qb.andWhere).toHaveBeenCalledWith('c.status = :status', { status: ContractStatus.SENT });
    });

    it('applies title search filter', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      const qb    = makeQb([[], 0]);
      mockContractRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(admin, { search: 'Service' });

      expect(qb.andWhere).toHaveBeenCalledWith('c.title ILIKE :search', { search: '%Service%' });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // findOne
  // ──────────────────────────────────────────────────────────────────────────
  describe('findOne', () => {
    it('returns contract for ADMIN', async () => {
      const admin    = makeUser({ role: UserRole.ADMIN });
      const contract = makeContract();
      mockContractRepo.findOne.mockResolvedValue(contract);

      const result = await service.findOne('contract-1', admin);
      expect(result.id).toBe('contract-1');
    });

    it('throws ResourceNotFoundException when contract not found', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      mockContractRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('bad-id', admin)).rejects.toBeInstanceOf(ResourceNotFoundException);
    });

    it('throws OwnershipViolationException when EMPLOYEE does not own contract', async () => {
      const employee = makeUser({ id: 'other-emp', role: UserRole.EMPLOYEE });
      const contract = makeContract({ ownerId: 'user-1' }); // owned by different user
      mockContractRepo.findOne.mockResolvedValue(contract);

      await expect(service.findOne('contract-1', employee)).rejects.toBeInstanceOf(OwnershipViolationException);
    });

    it('EMPLOYEE can access own contract', async () => {
      const employee = makeUser({ id: 'user-1', role: UserRole.EMPLOYEE });
      const contract = makeContract({ ownerId: 'user-1' });
      mockContractRepo.findOne.mockResolvedValue(contract);

      const result = await service.findOne('contract-1', employee);
      expect(result.id).toBe('contract-1');
    });

    it('CLIENT can access their own client contract', async () => {
      const clientUser   = makeUser({ id: 'user-client-1', role: UserRole.CLIENT });
      const clientRecord = makeClient({ userId: 'user-client-1', id: 'client-1' });
      const contract     = makeContract({ clientId: 'client-1' });

      mockContractRepo.findOne.mockResolvedValue(contract);
      mockClientRepo.findOne.mockResolvedValue(clientRecord);

      const result = await service.findOne('contract-1', clientUser);
      expect(result.id).toBe('contract-1');
    });

    it('CLIENT denied access to contract for different client', async () => {
      const clientUser   = makeUser({ id: 'user-client-2', role: UserRole.CLIENT });
      const clientRecord = makeClient({ userId: 'user-client-2', id: 'client-2' });
      const contract     = makeContract({ clientId: 'client-1' });

      mockContractRepo.findOne.mockResolvedValue(contract);
      mockClientRepo.findOne.mockResolvedValue(clientRecord);

      await expect(service.findOne('contract-1', clientUser))
        .rejects.toBeInstanceOf(InsufficientPermissionsException);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // create
  // ──────────────────────────────────────────────────────────────────────────
  describe('create', () => {
    it('creates a DRAFT contract and sets ownerId for EMPLOYEE', async () => {
      const employee = makeUser({ role: UserRole.EMPLOYEE });
      const client   = makeClient();
      const dto      = { title: 'Agreement', body: 'Contract body with enough text.', clientId: 'client-1' };
      const saved    = makeContract({ ownerId: employee.id });

      mockClientRepo.findOne.mockResolvedValue(client);
      mockContractRepo.create.mockReturnValue(saved);
      mockContractRepo.save.mockResolvedValue(saved);
      mockContractRepo.findOne.mockResolvedValue(saved);

      const result = await service.create(dto, employee);

      expect(mockContractRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: ContractStatus.DRAFT, ownerId: employee.id }),
      );
      expect(result.status).toBe(ContractStatus.DRAFT);
    });

    it('ADMIN creates contract with null ownerId', async () => {
      const admin  = makeUser({ role: UserRole.ADMIN });
      const client = makeClient();
      const dto    = { title: 'Agreement', body: 'Contract body with enough text.', clientId: 'client-1' };
      const saved  = makeContract({ ownerId: null });

      mockClientRepo.findOne.mockResolvedValue(client);
      mockContractRepo.create.mockReturnValue(saved);
      mockContractRepo.save.mockResolvedValue(saved);
      mockContractRepo.findOne.mockResolvedValue(saved);

      await service.create(dto, admin);

      expect(mockContractRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ ownerId: null }),
      );
    });

    it('throws ResourceNotFoundException when client does not exist', async () => {
      const employee = makeUser({ role: UserRole.EMPLOYEE });
      mockClientRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create({ title: 'T', body: 'Body text long enough.', clientId: 'bad-id' }, employee),
      ).rejects.toBeInstanceOf(ResourceNotFoundException);
    });

    it('throws AppException when EMPLOYEE does not own the client', async () => {
      const employee = makeUser({ id: 'emp-2', role: UserRole.EMPLOYEE });
      const client   = makeClient({ ownerId: 'emp-1' }); // owned by different employee

      mockClientRepo.findOne.mockResolvedValue(client);

      await expect(
        service.create({ title: 'T', body: 'Body text long enough.', clientId: 'client-1' }, employee),
      ).rejects.toBeInstanceOf(AppException);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // update
  // ──────────────────────────────────────────────────────────────────────────
  describe('update', () => {
    it('updates title and body of a DRAFT contract', async () => {
      const employee = makeUser({ role: UserRole.EMPLOYEE });
      const contract = makeContract({ status: ContractStatus.DRAFT });
      const updated  = makeContract({ title: 'New Title', body: 'New body text with enough content.', status: ContractStatus.DRAFT });

      mockContractRepo.findOne
        .mockResolvedValueOnce(contract)  // findOne in update→findOne
        .mockResolvedValueOnce(updated);  // reload after save
      mockContractRepo.save.mockResolvedValue(updated);

      const result = await service.update('contract-1', { title: 'New Title' }, employee);
      expect(result.title).toBe('New Title');
    });

    it('throws AppException when updating a SENT contract', async () => {
      const employee = makeUser({ role: UserRole.EMPLOYEE });
      const contract = makeContract({ status: ContractStatus.SENT });
      mockContractRepo.findOne.mockResolvedValue(contract);

      await expect(
        service.update('contract-1', { title: 'X' }, employee),
      ).rejects.toBeInstanceOf(AppException);
    });

    it('throws AppException when updating a SIGNED contract', async () => {
      const admin    = makeUser({ role: UserRole.ADMIN });
      const contract = makeContract({ status: ContractStatus.SIGNED });
      mockContractRepo.findOne.mockResolvedValue(contract);

      await expect(
        service.update('contract-1', { body: 'new body' }, admin),
      ).rejects.toBeInstanceOf(AppException);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // sendToClient
  // ──────────────────────────────────────────────────────────────────────────
  describe('sendToClient', () => {
    it('transitions DRAFT → SENT, sets sentAt, saves chat message, fires notifications', async () => {
      const employee   = makeUser({ role: UserRole.EMPLOYEE });
      const contract   = makeContract({ status: ContractStatus.DRAFT, ownerId: employee.id });
      const client     = makeClient();
      const sentResult = makeContract({ status: ContractStatus.SENT, sentAt: new Date() });
      const conversation = { id: 'conv-1', clientId: 'user-client-1' };

      // findOne called twice: initial check + reload
      mockContractRepo.findOne
        .mockResolvedValueOnce(contract)
        .mockResolvedValueOnce(sentResult);
      mockContractRepo.save.mockResolvedValue(sentResult);
      mockClientRepo.findOne.mockResolvedValue(client);
      mockConversationRepo.findOne.mockResolvedValue(conversation);
      mockChatService.saveMessage.mockResolvedValue({});
      mockNotificationService.createErpNotification.mockResolvedValue({});

      const result = await service.sendToClient('contract-1', employee);

      expect(result.status).toBe(ContractStatus.SENT);
      expect(mockChatService.saveMessage).toHaveBeenCalledWith(
        'conv-1',
        employee.id,
        expect.stringContaining('Contract Sent'),
      );
      expect(mockNotificationService.createErpNotification).toHaveBeenCalledTimes(2);
    });

    it('throws AppException when contract is not DRAFT', async () => {
      const employee = makeUser({ role: UserRole.EMPLOYEE });
      const contract = makeContract({ status: ContractStatus.SENT, ownerId: employee.id });
      mockContractRepo.findOne.mockResolvedValue(contract);

      await expect(service.sendToClient('contract-1', employee)).rejects.toBeInstanceOf(AppException);
    });

    it('continues even if chat save fails (non-fatal)', async () => {
      const employee   = makeUser({ role: UserRole.EMPLOYEE });
      const contract   = makeContract({ status: ContractStatus.DRAFT, ownerId: employee.id });
      const client     = makeClient();
      const sentResult = makeContract({ status: ContractStatus.SENT, sentAt: new Date() });

      mockContractRepo.findOne
        .mockResolvedValueOnce(contract)
        .mockResolvedValueOnce(sentResult);
      mockContractRepo.save.mockResolvedValue(sentResult);
      mockClientRepo.findOne.mockResolvedValue(client);
      mockConversationRepo.findOne.mockResolvedValue({ id: 'conv-1' });
      mockChatService.saveMessage.mockRejectedValue(new Error('chat down'));
      mockNotificationService.createErpNotification.mockResolvedValue({});

      const result = await service.sendToClient('contract-1', employee);
      expect(result.status).toBe(ContractStatus.SENT);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // acceptContract
  // ──────────────────────────────────────────────────────────────────────────
  describe('acceptContract', () => {
    it('transitions SENT → SIGNED, sets signedAt, fires notifications', async () => {
      const clientUser   = makeUser({ id: 'user-client-1', role: UserRole.CLIENT });
      const clientRecord = makeClient({ userId: 'user-client-1', id: 'client-1' });
      const contract     = makeContract({ status: ContractStatus.SENT, clientId: 'client-1' });
      const signedResult = makeContract({
        status: ContractStatus.SIGNED,
        signedAt: new Date(),
        client: { ...makeClient(), user: makeUser({ id: 'user-client-1' }) },
      });

      mockContractRepo.findOne
        .mockResolvedValueOnce(contract)
        .mockResolvedValueOnce(signedResult);
      mockContractRepo.save.mockResolvedValue(signedResult);
      mockClientRepo.findOne.mockResolvedValue(clientRecord);
      mockUserRepo.find.mockResolvedValue([makeUser({ role: UserRole.ADMIN, id: 'admin-1' })]);
      mockNotificationService.createErpNotification.mockResolvedValue({});
      mockAwsService.uploadBuffer.mockResolvedValue('https://s3.url');

      const result = await service.acceptContract('contract-1', clientUser);
      expect(result.status).toBe(ContractStatus.SIGNED);
      expect(mockNotificationService.createErpNotification).toHaveBeenCalled();
    });

    it('throws InsufficientPermissionsException when non-CLIENT tries to accept', async () => {
      const employee = makeUser({ role: UserRole.EMPLOYEE });
      await expect(service.acceptContract('contract-1', employee))
        .rejects.toBeInstanceOf(InsufficientPermissionsException);
    });

    it('throws ResourceNotFoundException when contract not found', async () => {
      const clientUser = makeUser({ role: UserRole.CLIENT });
      mockContractRepo.findOne.mockResolvedValue(null);
      await expect(service.acceptContract('bad-id', clientUser))
        .rejects.toBeInstanceOf(ResourceNotFoundException);
    });

    it('throws InsufficientPermissionsException when CLIENT does not own contract', async () => {
      const clientUser   = makeUser({ id: 'user-client-2', role: UserRole.CLIENT });
      const clientRecord = makeClient({ userId: 'user-client-2', id: 'client-2' });
      const contract     = makeContract({ clientId: 'client-1' }); // different client

      mockContractRepo.findOne.mockResolvedValue(contract);
      mockClientRepo.findOne.mockResolvedValue(clientRecord);

      await expect(service.acceptContract('contract-1', clientUser))
        .rejects.toBeInstanceOf(InsufficientPermissionsException);
    });

    it('throws AppException when contract is not SENT', async () => {
      const clientUser   = makeUser({ id: 'user-client-1', role: UserRole.CLIENT });
      const clientRecord = makeClient({ userId: 'user-client-1', id: 'client-1' });
      const contract     = makeContract({ status: ContractStatus.DRAFT, clientId: 'client-1' });

      mockContractRepo.findOne.mockResolvedValue(contract);
      mockClientRepo.findOne.mockResolvedValue(clientRecord);

      await expect(service.acceptContract('contract-1', clientUser)).rejects.toBeInstanceOf(AppException);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // rejectContract
  // ──────────────────────────────────────────────────────────────────────────
  describe('rejectContract', () => {
    it('transitions SENT → REJECTED, fires CONTRACT_REJECTED notification to owner', async () => {
      const clientUser    = makeUser({ id: 'user-client-1', role: UserRole.CLIENT });
      const clientRecord  = makeClient({ userId: 'user-client-1', id: 'client-1' });
      const contract      = makeContract({ status: ContractStatus.SENT, clientId: 'client-1', ownerId: 'user-1' });
      const rejectedResult = makeContract({ status: ContractStatus.REJECTED });

      mockContractRepo.findOne
        .mockResolvedValueOnce(contract)
        .mockResolvedValueOnce(rejectedResult);
      mockContractRepo.save.mockResolvedValue({ ...contract, status: ContractStatus.REJECTED });
      mockClientRepo.findOne.mockResolvedValue(clientRecord);
      mockNotificationService.createErpNotification.mockResolvedValue({});

      const result = await service.rejectContract('contract-1', clientUser);
      expect(result.status).toBe(ContractStatus.REJECTED);
      expect(mockNotificationService.createErpNotification).toHaveBeenCalledWith(
        'user-1',
        'CONTRACT_REJECTED',
        expect.any(String),
        expect.stringContaining('rejected'),
        'contract-1',
      );
    });

    it('throws InsufficientPermissionsException when non-CLIENT tries to reject', async () => {
      const employee = makeUser({ role: UserRole.EMPLOYEE });
      await expect(service.rejectContract('contract-1', employee))
        .rejects.toBeInstanceOf(InsufficientPermissionsException);
    });

    it('throws AppException when contract is not SENT', async () => {
      const clientUser   = makeUser({ id: 'user-client-1', role: UserRole.CLIENT });
      const clientRecord = makeClient({ userId: 'user-client-1', id: 'client-1' });
      const contract     = makeContract({ status: ContractStatus.DRAFT, clientId: 'client-1' });

      mockContractRepo.findOne.mockResolvedValue(contract);
      mockClientRepo.findOne.mockResolvedValue(clientRecord);

      await expect(service.rejectContract('contract-1', clientUser))
        .rejects.toBeInstanceOf(AppException);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // remove
  // ──────────────────────────────────────────────────────────────────────────
  describe('remove', () => {
    it('ADMIN can delete a DRAFT contract', async () => {
      const admin    = makeUser({ role: UserRole.ADMIN });
      const contract = makeContract({ status: ContractStatus.DRAFT });
      mockContractRepo.findOne.mockResolvedValue(contract);
      mockContractRepo.remove.mockResolvedValue(undefined);

      await expect(service.remove('contract-1', admin)).resolves.toBeUndefined();
      expect(mockContractRepo.remove).toHaveBeenCalledWith(contract);
    });

    it('throws InsufficientPermissionsException when EMPLOYEE tries to delete', async () => {
      const employee = makeUser({ role: UserRole.EMPLOYEE });
      await expect(service.remove('contract-1', employee))
        .rejects.toBeInstanceOf(InsufficientPermissionsException);
    });

    it('throws AppException when deleting a SIGNED contract', async () => {
      const admin    = makeUser({ role: UserRole.ADMIN });
      const contract = makeContract({ status: ContractStatus.SIGNED });
      mockContractRepo.findOne.mockResolvedValue(contract);

      await expect(service.remove('contract-1', admin))
        .rejects.toBeInstanceOf(AppException);
    });

    it('throws ResourceNotFoundException when contract not found', async () => {
      const admin = makeUser({ role: UserRole.ADMIN });
      mockContractRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('bad-id', admin))
        .rejects.toBeInstanceOf(ResourceNotFoundException);
    });
  });

  // ─── ERP-9: Notification assertions ──────────────────────────────────────────

  describe('sendToClient — ERP-9 notification', () => {
    it('should call createErpNotification with CONTRACT_SENT type', async () => {
      const admin    = makeUser({ role: UserRole.ADMIN });
      const contract = makeContract({ status: ContractStatus.DRAFT });
      mockContractRepo.findOne.mockResolvedValue(contract);
      mockContractRepo.save.mockResolvedValue({ ...contract, status: ContractStatus.SENT, sentAt: new Date() });

      await service.sendToClient('contract-1', admin);

      expect(mockNotificationService.createErpNotification).toHaveBeenCalledWith(
        expect.any(String),
        'CONTRACT_SENT',
        expect.any(String),
        expect.any(String),
        'contract-1',
      );
    });
  });

  describe('acceptContract — ERP-9 notification', () => {
    it('should call createErpNotification with CONTRACT_SIGNED type', async () => {
      const client   = makeUser({ id: 'user-client-1', role: UserRole.CLIENT });
      const contract = makeContract({ status: ContractStatus.SENT });
      mockContractRepo.findOne.mockResolvedValue(contract);
      mockContractRepo.save.mockResolvedValue({ ...contract, status: ContractStatus.SIGNED, signedAt: new Date() });

      await service.acceptContract('contract-1', client);

      expect(mockNotificationService.createErpNotification).toHaveBeenCalledWith(
        expect.any(String),
        'CONTRACT_SIGNED',
        expect.any(String),
        expect.any(String),
        'contract-1',
      );
    });
  });

  describe('rejectContract — ERP-9 notification', () => {
    it('should call createErpNotification with CONTRACT_REJECTED type', async () => {
      const client   = makeUser({ id: 'user-client-1', role: UserRole.CLIENT });
      const contract = makeContract({ status: ContractStatus.SENT });
      mockContractRepo.findOne.mockResolvedValue(contract);
      mockContractRepo.save.mockResolvedValue({ ...contract, status: ContractStatus.REJECTED });

      await service.rejectContract('contract-1', client);

      expect(mockNotificationService.createErpNotification).toHaveBeenCalledWith(
        expect.any(String),
        'CONTRACT_REJECTED',
        expect.any(String),
        expect.any(String),
        'contract-1',
      );
    });
  });
});
