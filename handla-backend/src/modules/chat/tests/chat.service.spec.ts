import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException } from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';

import { ChatService } from '../chat.service';
import { Conversation } from '../entities/conversation.entity';
import { Message } from '../entities/message.entity';
import { User } from '../../auth/entities/user.entity';
import { UserRole, ConversationStatus } from '../../../common/enums';
import {
  ResourceNotFoundException,
  ConversationAccessDeniedException,
} from '../../../utils/exceptions';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const adminUser: User = {
  id: 'admin-uuid',
  email: 'admin@handla.com',
  passwordHash: 'hashed',
  name: 'Admin User',
  role: UserRole.ADMIN,
  createdAt: new Date(),
  updatedAt: new Date(),
  adminConversations: [],
  clientConversations: [],
  assignedConversations: [],
  messages: [],
  notifications: [],
  testimonials: [],
};

const clientUser: User = {
  id: 'client-uuid',
  email: 'client@handla.com',
  passwordHash: 'hashed',
  name: 'Client User',
  role: UserRole.CLIENT,
  createdAt: new Date(),
  updatedAt: new Date(),
  adminConversations: [],
  clientConversations: [],
  assignedConversations: [],
  messages: [],
  notifications: [],
  testimonials: [],
};

const mockConversation: Conversation = {
  id: 'conv-uuid',
  adminId: adminUser.id,
  clientId: clientUser.id,
  status: ConversationStatus.ACTIVE,
  createdAt: new Date(),
  updatedAt: new Date(),
  admin: adminUser,
  client: clientUser,
  assignedEmployeeId: null,
  assignedEmployee: null,
  messages: [],
};

const mockMessage: Message = {
  id: 'msg-uuid',
  conversationId: mockConversation.id,
  senderId: adminUser.id,
  content: 'Hello!',
  fileUrl: null,
  isRead: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  conversation: mockConversation,
  sender: adminUser,
};

// ─── Repository Mocks ────────────────────────────────────────────────────────

// EntityManager mock used inside manager.transaction callback
const mockEntityManager = {
  findOne:  jest.fn(),
  create:   jest.fn(),
  save:     jest.fn(),
};

const mockConversationRepository = {
  createQueryBuilder: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  manager: {
    getRepository: jest.fn().mockReturnValue({
      findOne: jest.fn().mockResolvedValue(adminUser),
    }),
    // Execute the callback synchronously with the mockEntityManager
    transaction: jest.fn().mockImplementation((cb: (em: typeof mockEntityManager) => Promise<unknown>) =>
      cb(mockEntityManager),
    ),
  },
};

const mockMessageRepository = {
  createQueryBuilder: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  count: jest.fn().mockResolvedValue(0),
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('ChatService', () => {
  let service: ChatService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: getRepositoryToken(Conversation),
          useValue: mockConversationRepository,
        },
        {
          provide: getRepositoryToken(Message),
          useValue: mockMessageRepository,
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
    jest.clearAllMocks();
    // Restore manager.transaction after clearAllMocks wipes it
    mockConversationRepository.manager.transaction = jest.fn().mockImplementation(
      (cb: (em: typeof mockEntityManager) => Promise<unknown>) => cb(mockEntityManager),
    );
    mockConversationRepository.manager.getRepository = jest.fn().mockReturnValue({
      findOne: jest.fn().mockResolvedValue(adminUser),
    });
  });

  // ─── createOrGetConversation ─────────────────────────────────────────────────
  describe('createOrGetConversation()', () => {
    it('should return existing conversation if one already exists', async () => {
      mockConversationRepository.findOne.mockResolvedValue(mockConversation);

      const result = await service.createOrGetConversation(clientUser.id, adminUser.id);

      expect(result).toEqual(mockConversation);
      expect(mockConversationRepository.create).not.toHaveBeenCalled();
    });

    it('should create and return a new conversation when none exists', async () => {
      // Outer findOne (fast-path check) returns null
      mockConversationRepository.findOne.mockResolvedValue(null);
      // Inside the transaction: re-check also returns null (no race)
      mockEntityManager.findOne.mockResolvedValue(null);
      // em.create + em.save
      mockEntityManager.create.mockReturnValue(mockConversation);
      mockEntityManager.save.mockResolvedValue(mockConversation);

      const result = await service.createOrGetConversation(clientUser.id, adminUser.id);

      // The service now uses em.create / em.save inside manager.transaction
      expect(mockEntityManager.create).toHaveBeenCalledWith(
        expect.any(Function), // Conversation class
        expect.objectContaining({
          clientId: clientUser.id,
          adminId:  adminUser.id,
          status:   ConversationStatus.ACTIVE,
        }),
      );
      expect(mockEntityManager.save).toHaveBeenCalledTimes(1);
      expect(result.clientId).toBe(clientUser.id);
    });
  });

  // ─── getConversationById ─────────────────────────────────────────────────────
  describe('getConversationById()', () => {
    it('should return conversation + messages for an admin user', async () => {
      mockConversationRepository.findOne.mockResolvedValue(mockConversation);
      mockMessageRepository.find.mockResolvedValue([mockMessage]);

      const result = await service.getConversationById(mockConversation.id, adminUser);

      expect(result.conversation).toEqual(mockConversation);
      expect(result.messages).toEqual([mockMessage]);
    });

    it('should return conversation for the owning client user', async () => {
      mockConversationRepository.findOne.mockResolvedValue(mockConversation);
      mockMessageRepository.find.mockResolvedValue([mockMessage]);

      const result = await service.getConversationById(mockConversation.id, clientUser);

      expect(result.conversation.id).toBe(mockConversation.id);
    });

    it('should throw ResourceNotFoundException when conversation does not exist', async () => {
      mockConversationRepository.findOne.mockResolvedValue(null);

      await expect(service.getConversationById('nonexistent-id', adminUser)).rejects.toThrow(
        ResourceNotFoundException,
      );
    });

    it('should throw ConversationAccessDeniedException for a non-participant client', async () => {
      const otherClient: User = {
        ...clientUser,
        id: 'other-client-uuid',
        email: 'other@handla.com',
      };

      mockConversationRepository.findOne.mockResolvedValue(mockConversation);

      await expect(service.getConversationById(mockConversation.id, otherClient)).rejects.toThrow(
        ConversationAccessDeniedException,
      );
    });
  });

  // ─── saveMessage ─────────────────────────────────────────────────────────────
  describe('saveMessage()', () => {
    it('should create and return a message with content', async () => {
      const savedMsg = { ...mockMessage, id: 'new-msg-uuid' };
      mockMessageRepository.create.mockReturnValue(savedMsg);
      mockMessageRepository.save.mockResolvedValue(savedMsg);
      mockMessageRepository.findOne.mockResolvedValue({ ...savedMsg, sender: adminUser });
      mockConversationRepository.update.mockResolvedValue(undefined);

      const result = await service.saveMessage(mockConversation.id, adminUser.id, 'Hello World');

      expect(mockMessageRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: mockConversation.id,
          senderId: adminUser.id,
          content: 'Hello World',
          isRead: false,
        }),
      );
      expect(result.sender).toEqual(adminUser);
    });

    it('should create a message with a file URL (no content)', async () => {
      const fileMsg = { ...mockMessage, content: null, fileUrl: 'https://s3.example.com/file.pdf' };
      mockMessageRepository.create.mockReturnValue(fileMsg);
      mockMessageRepository.save.mockResolvedValue(fileMsg);
      mockMessageRepository.findOne.mockResolvedValue({ ...fileMsg, sender: adminUser });
      mockConversationRepository.update.mockResolvedValue(undefined);

      const result = await service.saveMessage(
        mockConversation.id,
        adminUser.id,
        undefined,
        'https://s3.example.com/file.pdf',
      );

      expect(result.fileUrl).toBe('https://s3.example.com/file.pdf');
    });

    it('should throw an error when neither content nor fileUrl is provided', async () => {
      await expect(service.saveMessage(mockConversation.id, adminUser.id)).rejects.toThrow(
        'Message must have content or a file attachment',
      );
    });
  });

  // ─── markMessageAsRead ───────────────────────────────────────────────────────
  describe('markMessageAsRead()', () => {
    it('should mark the message as read for a participant', async () => {
      const unreadMsg = { ...mockMessage, isRead: false, conversationId: mockConversation.id };
      mockMessageRepository.findOne.mockResolvedValue(unreadMsg);
      mockConversationRepository.findOne.mockResolvedValue(mockConversation);
      mockMessageRepository.save.mockResolvedValue({ ...unreadMsg, isRead: true });

      const result = await service.markMessageAsRead(unreadMsg.id, adminUser.id);

      expect(result.isRead).toBe(true);
    });

    it('should throw ResourceNotFoundException when message does not exist', async () => {
      mockMessageRepository.findOne.mockResolvedValue(null);

      await expect(service.markMessageAsRead('bad-msg-uuid', adminUser.id)).rejects.toThrow(
        ResourceNotFoundException,
      );
    });

    it('should throw ForbiddenException when user is not a conversation participant', async () => {
      const outsider: User = { ...clientUser, id: 'outsider-uuid' };
      mockMessageRepository.findOne.mockResolvedValue(mockMessage);
      mockConversationRepository.findOne.mockResolvedValue(mockConversation);

      await expect(service.markMessageAsRead(mockMessage.id, outsider.id)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ─── markAllAsRead ────────────────────────────────────────────────────────────
  describe('markAllAsRead()', () => {
    it('should execute a bulk update query', async () => {
      // Build a proper chainable query builder mock
      const qbMock = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 3 }),
      };
      mockMessageRepository.createQueryBuilder.mockReturnValue(qbMock);

      await service.markAllAsRead(mockConversation.id, clientUser.id);

      expect(qbMock.execute).toHaveBeenCalledTimes(1);
    });
  });

  // ─── updateStatus ─────────────────────────────────────────────────────────────
  describe('updateStatus()', () => {
    it('should update and return the conversation status', async () => {
      const updatedConv = { ...mockConversation, status: ConversationStatus.COMPLETED };
      mockConversationRepository.findOne.mockResolvedValue(mockConversation);
      mockConversationRepository.save.mockResolvedValue(updatedConv);

      const result = await service.updateStatus(
        mockConversation.id,
        ConversationStatus.COMPLETED,
        adminUser,
      );

      expect(result.status).toBe(ConversationStatus.COMPLETED);
    });

    it('should throw ResourceNotFoundException when conversation not found', async () => {
      mockConversationRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateStatus('bad-conv-uuid', ConversationStatus.COMPLETED, adminUser),
      ).rejects.toThrow(ResourceNotFoundException);
    });
  });

  // ─── findDefaultAdmin ─────────────────────────────────────────────────────────
  describe('findDefaultAdmin()', () => {
    it('should return the first admin user', async () => {
      mockConversationRepository.manager.getRepository.mockReturnValue({
        findOne: jest.fn().mockResolvedValue(adminUser),
      });

      const result = await service.findDefaultAdmin();

      expect(result).toEqual(adminUser);
      expect(result?.role).toBe(UserRole.ADMIN);
    });
  });
});
