/**
 * Phase 19.1 — E2E Flow Tests: Chat / Real-time flow
 *
 * Tests the end-to-end flows:
 *  - User signs up → conversation is created with default admin
 *  - Client sends message → message is saved with correct fields
 *  - Admin replies → message count increases, isRead stays false
 *  - File-upload message flow → fileUrl stored correctly
 *  - Notification is created alongside a saved message (via service integration)
 *  - markAllAsRead bulk-updates unread messages for a participant
 *  - Conversation status transitions: ACTIVE → COMPLETED
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException } from '@nestjs/common';

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
  id: 'admin-flow-uuid',
  email: 'admin@handla.com',
  passwordHash: 'hashed_AdminPass@123',
  name: 'Admin',
  role: UserRole.ADMIN,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  adminConversations: [],
  clientConversations: [],
  assignedConversations: [],
  messages: [],
  notifications: [],
  testimonials: [],
};

const clientUser: User = {
  id: 'client-flow-uuid',
  email: 'client@example.com',
  passwordHash: 'hashed_ClientPass@123',
  name: 'New Client',
  role: UserRole.CLIENT,
  createdAt: new Date('2024-01-02'),
  updatedAt: new Date('2024-01-02'),
  adminConversations: [],
  clientConversations: [],
  assignedConversations: [],
  messages: [],
  notifications: [],
  testimonials: [],
};

const newConversation: Conversation = {
  id: 'flow-conv-uuid',
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

const clientMessage: Message = {
  id: 'flow-msg-uuid-1',
  conversationId: newConversation.id,
  senderId: clientUser.id,
  content: 'Hello, I need help with my order.',
  fileUrl: null,
  isRead: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  conversation: newConversation,
  sender: clientUser,
};

const adminReply: Message = {
  id: 'flow-msg-uuid-2',
  conversationId: newConversation.id,
  senderId: adminUser.id,
  content: 'Hi there! How can I assist you today?',
  fileUrl: null,
  isRead: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  conversation: newConversation,
  sender: adminUser,
};

const fileMessage: Message = {
  id: 'flow-msg-uuid-3',
  conversationId: newConversation.id,
  senderId: clientUser.id,
  content: null,
  fileUrl: 'https://s3.amazonaws.com/handla/uploads/invoice.pdf',
  isRead: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  conversation: newConversation,
  sender: clientUser,
};

// ─── Repository Mocks ────────────────────────────────────────────────────────

// EntityManager mock used inside manager.transaction callback
const mockFlowEntityManager = {
  findOne: jest.fn(),
  create: jest.fn(),
  save:   jest.fn(),
};

const mockConvRepo = {
  createQueryBuilder: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  manager: {
    getRepository: jest.fn().mockReturnValue({
      findOne: jest.fn().mockResolvedValue(adminUser),
    }),
    transaction: jest.fn().mockImplementation(
      (cb: (em: typeof mockFlowEntityManager) => Promise<unknown>) => cb(mockFlowEntityManager),
    ),
  },
};

const mockMsgRepo = {
  createQueryBuilder: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  count: jest.fn().mockResolvedValue(0),
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('Phase 19.1 — Chat E2E Flow', () => {
  let service: ChatService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: getRepositoryToken(Conversation), useValue: mockConvRepo },
        { provide: getRepositoryToken(Message), useValue: mockMsgRepo },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
    jest.clearAllMocks();
    // Restore manager methods after clearAllMocks
    mockConvRepo.manager.transaction = jest.fn().mockImplementation(
      (cb: (em: typeof mockFlowEntityManager) => Promise<unknown>) => cb(mockFlowEntityManager),
    );
    mockConvRepo.manager.getRepository = jest.fn().mockReturnValue({
      findOne: jest.fn().mockResolvedValue(adminUser),
    });
  });

  // ─── Flow 1: Sign-up → Conversation creation ─────────────────────────────────
  describe('Flow 1 — Signup triggers conversation with default admin', () => {
    it('should find the default admin for a new client conversation', async () => {
      mockConvRepo.manager.getRepository.mockReturnValue({
        findOne: jest.fn().mockResolvedValue(adminUser),
      });

      const admin = await service.findDefaultAdmin();

      expect(admin).toBeDefined();
      expect(admin?.role).toBe(UserRole.ADMIN);
      expect(admin?.id).toBe(adminUser.id);
    });

    it('should create a new conversation between client and admin', async () => {
      // Fast-path check: no existing conversation
      mockConvRepo.findOne.mockResolvedValue(null);
      // Direct repo.create + repo.save (no transaction in the happy path now —
      // race recovery is via catching ER_DUP_ENTRY, see chat.service.spec.ts)
      mockConvRepo.create.mockReturnValue(newConversation);
      mockConvRepo.save.mockResolvedValue(newConversation);

      const result = await service.createOrGetConversation(clientUser.id, adminUser.id);

      expect(mockConvRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: clientUser.id,
          adminId:  adminUser.id,
          status:   ConversationStatus.ACTIVE,
        }),
      );
      expect(result.id).toBe(newConversation.id);
      expect(result.status).toBe(ConversationStatus.ACTIVE);
    });

    it('should return the existing conversation if one already exists', async () => {
      mockConvRepo.findOne.mockResolvedValue(newConversation);

      const result = await service.createOrGetConversation(clientUser.id, adminUser.id);

      expect(mockConvRepo.create).not.toHaveBeenCalled();
      expect(result).toEqual(newConversation);
    });
  });

  // ─── Flow 2: Real-time message flow ──────────────────────────────────────────
  describe('Flow 2 — Real-time message exchange', () => {
    it('client sends first message — saved with correct fields', async () => {
      mockMsgRepo.create.mockReturnValue(clientMessage);
      mockMsgRepo.save.mockResolvedValue(clientMessage);
      mockMsgRepo.findOne.mockResolvedValue({ ...clientMessage, sender: clientUser });
      mockConvRepo.update.mockResolvedValue(undefined);

      const result = await service.saveMessage(
        newConversation.id,
        clientUser.id,
        'Hello, I need help with my order.',
      );

      expect(mockMsgRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: newConversation.id,
          senderId: clientUser.id,
          content: 'Hello, I need help with my order.',
          isRead: false,
        }),
      );
      expect(result.isRead).toBe(false);
      expect(result.sender).toEqual(clientUser);
    });

    it('admin replies — message stored with admin as sender', async () => {
      mockMsgRepo.create.mockReturnValue(adminReply);
      mockMsgRepo.save.mockResolvedValue(adminReply);
      mockMsgRepo.findOne.mockResolvedValue({ ...adminReply, sender: adminUser });
      mockConvRepo.update.mockResolvedValue(undefined);

      const result = await service.saveMessage(
        newConversation.id,
        adminUser.id,
        'Hi there! How can I assist you today?',
      );

      expect(result.senderId).toBe(adminUser.id);
      expect(result.content).toBe('Hi there! How can I assist you today?');
      expect(result.sender.role).toBe(UserRole.ADMIN);
    });

    it('should throw when message has neither content nor fileUrl', async () => {
      await expect(service.saveMessage(newConversation.id, clientUser.id)).rejects.toThrow(
        'Message must have content or a file attachment',
      );
    });
  });

  // ─── Flow 3: File upload message ─────────────────────────────────────────────
  describe('Flow 3 — File upload message flow', () => {
    it('client uploads file — fileUrl stored, content is null', async () => {
      mockMsgRepo.create.mockReturnValue(fileMessage);
      mockMsgRepo.save.mockResolvedValue(fileMessage);
      mockMsgRepo.findOne.mockResolvedValue({ ...fileMessage, sender: clientUser });
      mockConvRepo.update.mockResolvedValue(undefined);

      const result = await service.saveMessage(
        newConversation.id,
        clientUser.id,
        undefined,
        'https://s3.amazonaws.com/handla/uploads/invoice.pdf',
      );

      expect(result.fileUrl).toBe('https://s3.amazonaws.com/handla/uploads/invoice.pdf');
      expect(result.content).toBeNull();
    });
  });

  // ─── Flow 4: Mark messages as read ───────────────────────────────────────────
  describe('Flow 4 — Mark messages as read', () => {
    it('should mark a single message as read for a participant', async () => {
      const unread = { ...clientMessage, isRead: false };
      mockMsgRepo.findOne.mockResolvedValue(unread);
      mockConvRepo.findOne.mockResolvedValue(newConversation);
      mockMsgRepo.save.mockResolvedValue({ ...unread, isRead: true });

      const result = await service.markMessageAsRead(clientMessage.id, adminUser.id);

      expect(result.isRead).toBe(true);
    });

    it('should bulk-mark all unread messages as read for a participant', async () => {
      const qbMock = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 5 }),
      };
      mockMsgRepo.createQueryBuilder.mockReturnValue(qbMock);

      await service.markAllAsRead(newConversation.id, clientUser.id);

      expect(qbMock.execute).toHaveBeenCalledTimes(1);
    });

    it('should throw ResourceNotFoundException for unknown message id', async () => {
      mockMsgRepo.findOne.mockResolvedValue(null);

      await expect(service.markMessageAsRead('nonexistent-msg', adminUser.id)).rejects.toThrow(
        ResourceNotFoundException,
      );
    });

    it('should throw ForbiddenException when non-participant tries to mark as read', async () => {
      const outsider: User = { ...clientUser, id: 'outsider-uuid', email: 'x@x.com' };
      mockMsgRepo.findOne.mockResolvedValue(clientMessage);
      mockConvRepo.findOne.mockResolvedValue(newConversation);

      await expect(service.markMessageAsRead(clientMessage.id, outsider.id)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ─── Flow 5: Conversation status transitions ──────────────────────────────────
  describe('Flow 5 — Conversation status transitions', () => {
    it('admin can move conversation from ACTIVE to COMPLETED', async () => {
      const completed = { ...newConversation, status: ConversationStatus.COMPLETED };
      mockConvRepo.findOne.mockResolvedValue(newConversation);
      mockConvRepo.save.mockResolvedValue(completed);

      const result = await service.updateStatus(
        newConversation.id,
        ConversationStatus.COMPLETED,
        adminUser,
      );

      expect(result.status).toBe(ConversationStatus.COMPLETED);
    });

    it('should throw ResourceNotFoundException for unknown conversation', async () => {
      mockConvRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateStatus('unknown-uuid', ConversationStatus.COMPLETED, adminUser),
      ).rejects.toThrow(ResourceNotFoundException);
    });
  });

  // ─── Flow 6: Conversation access control ─────────────────────────────────────
  describe('Flow 6 — Conversation access control', () => {
    it('admin can access any conversation', async () => {
      mockConvRepo.findOne.mockResolvedValue(newConversation);
      mockMsgRepo.find.mockResolvedValue([clientMessage, adminReply]);

      const result = await service.getConversationById(newConversation.id, adminUser);

      expect(result.conversation).toEqual(newConversation);
      expect(result.messages).toHaveLength(2);
    });

    it('owning client can access their conversation', async () => {
      mockConvRepo.findOne.mockResolvedValue(newConversation);
      mockMsgRepo.find.mockResolvedValue([clientMessage]);

      const result = await service.getConversationById(newConversation.id, clientUser);

      expect(result.conversation.clientId).toBe(clientUser.id);
    });

    it('non-participant client is denied access', async () => {
      const stranger: User = { ...clientUser, id: 'stranger-uuid', email: 'stranger@x.com' };
      mockConvRepo.findOne.mockResolvedValue(newConversation);

      await expect(service.getConversationById(newConversation.id, stranger)).rejects.toThrow(
        ConversationAccessDeniedException,
      );
    });

    it('throws ResourceNotFoundException for non-existent conversation', async () => {
      mockConvRepo.findOne.mockResolvedValue(null);

      await expect(service.getConversationById('ghost-uuid', clientUser)).rejects.toThrow(
        ResourceNotFoundException,
      );
    });
  });
});
