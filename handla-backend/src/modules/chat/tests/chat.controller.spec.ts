import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';

import { ChatController } from '../chat.controller';
import { ChatService } from '../chat.service';
import { ChatGateway } from '../chat.gateway';
import { AwsService } from '../../aws/aws.service';
import { User } from '../../auth/entities/user.entity';
import { UserRole, ConversationStatus } from '../../../common/enums';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'user@example.com',
    passwordHash: 'h',
    name: 'Test User',
    role: UserRole.CLIENT,
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

describe('ChatController', () => {
  let controller: ChatController;
  let chatService: {
    getConversations: jest.Mock;
    getConversationById: jest.Mock;
    sendMessage: jest.Mock;
    getMessages: jest.Mock;
    findDefaultAdmin: jest.Mock;
    createOrGetConversation: jest.Mock;
    markMessageAsRead: jest.Mock;
    updateStatus: jest.Mock;
  };
  let chatGateway: {
    broadcastMessage: jest.Mock;
    notifyMessageRecipient: jest.Mock;
    triggerAiReply: jest.Mock;
  };
  let awsService: { generatePresignedUrl: jest.Mock };

  const validUuid = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

  beforeEach(async () => {
    chatService = {
      getConversations: jest.fn(),
      getConversationById: jest.fn(),
      sendMessage: jest.fn(),
      getMessages: jest.fn(),
      findDefaultAdmin: jest.fn(),
      createOrGetConversation: jest.fn(),
      markMessageAsRead: jest.fn(),
      updateStatus: jest.fn(),
    };
    chatGateway = {
      broadcastMessage: jest.fn(),
      notifyMessageRecipient: jest.fn().mockResolvedValue(undefined),
      triggerAiReply: jest.fn(),
    };
    awsService = { generatePresignedUrl: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        { provide: ChatService, useValue: chatService },
        { provide: ChatGateway, useValue: chatGateway },
        { provide: AwsService, useValue: awsService },
      ],
    }).compile();

    controller = module.get(ChatController);
  });

  // ── GET /conversations ────────────────────────────────────────────────────
  describe('getConversations', () => {
    it('passes pagination through and wraps the result', async () => {
      const user = makeUser();
      chatService.getConversations.mockResolvedValue({ items: [], total: 0 });

      const res = await controller.getConversations(user, 2, 10);

      expect(chatService.getConversations).toHaveBeenCalledWith(user, { page: 2, limit: 10 });
      expect(res).toEqual({ message: 'Conversations retrieved', data: { items: [], total: 0 } });
    });
  });

  // ── GET /conversations/:id ────────────────────────────────────────────────
  describe('getConversationById', () => {
    it('forwards the request to the service', async () => {
      const user = makeUser();
      const payload = { conversation: { id: validUuid }, messages: [] };
      chatService.getConversationById.mockResolvedValue(payload);

      const res = await controller.getConversationById(validUuid, user);

      expect(chatService.getConversationById).toHaveBeenCalledWith(validUuid, user);
      expect(res).toEqual({ message: 'Conversation retrieved', data: payload });
    });
  });

  // ── POST /conversations/:id/messages ──────────────────────────────────────
  // This is the CRITICAL path for the notification-bell bug fix.
  describe('sendMessage (REST) — notification bell path', () => {
    it('saves, broadcasts, and triggers notifyMessageRecipient with the right payload', async () => {
      const user = makeUser({ id: 'admin-1', role: UserRole.ADMIN, name: 'Adminy' });
      const message = { id: 'msg-1', content: 'hello world' };
      const conversation = { id: validUuid, adminId: 'admin-1', clientId: 'client-1' };
      chatService.sendMessage.mockResolvedValue({ message, conversation });

      const res = await controller.sendMessage(validUuid, 'hello world', undefined, user);

      // 1. Service persisted the message
      expect(chatService.sendMessage).toHaveBeenCalledWith(validUuid, user, 'hello world', undefined);

      // 2. Realtime broadcast to the conversation room
      expect(chatGateway.broadcastMessage).toHaveBeenCalledWith(validUuid, message);

      // 3. ★ The whole reason the bell fix exists ★
      expect(chatGateway.notifyMessageRecipient).toHaveBeenCalledWith({
        conversation,
        senderUser: user,
        messageId: 'msg-1',
        content: 'hello world',
      });

      expect(res).toEqual({ message: 'Message sent', data: { message } });
    });

    it('still triggers notifyMessageRecipient for file-only messages (empty content)', async () => {
      const user = makeUser({ id: 'admin-1', role: UserRole.ADMIN });
      const message = { id: 'msg-2', content: '', fileUrl: 'https://s3/file.pdf' };
      const conversation = { id: validUuid, adminId: 'admin-1', clientId: 'client-1' };
      chatService.sendMessage.mockResolvedValue({ message, conversation });

      await controller.sendMessage(validUuid, '', 'https://s3/file.pdf', user);

      expect(chatGateway.notifyMessageRecipient).toHaveBeenCalledWith({
        conversation,
        senderUser: user,
        messageId: 'msg-2',
        content: '',
      });
      // fileUrl passed to service for persistence
      expect(chatService.sendMessage).toHaveBeenCalledWith(validUuid, user, '', 'https://s3/file.pdf');
    });

    it('calls broadcast BEFORE notification so listeners see the message first', async () => {
      const user = makeUser({ id: 'admin-1', role: UserRole.ADMIN });
      const message = { id: 'msg-3', content: 'order' };
      const conversation = { id: validUuid, adminId: 'admin-1', clientId: 'client-1' };
      chatService.sendMessage.mockResolvedValue({ message, conversation });

      const order: string[] = [];
      chatGateway.broadcastMessage.mockImplementation(() => { order.push('broadcast'); });
      chatGateway.notifyMessageRecipient.mockImplementation(async () => { order.push('notify'); });

      await controller.sendMessage(validUuid, 'order', undefined, user);

      expect(order).toEqual(['broadcast', 'notify']);
    });
  });

  // ── GET /conversations/:id/messages ───────────────────────────────────────
  describe('getMessages', () => {
    it('returns the messages list', async () => {
      const user = makeUser();
      chatService.getMessages.mockResolvedValue([{ id: 'm1' }]);

      const res = await controller.getMessages(validUuid, user);

      expect(chatService.getMessages).toHaveBeenCalledWith(validUuid, user);
      expect(res.data).toEqual([{ id: 'm1' }]);
    });
  });

  // ── POST /conversations (create) ──────────────────────────────────────────
  describe('createConversation', () => {
    it('returns the existing/created conversation when an admin is present', async () => {
      const user = makeUser({ id: 'client-1' });
      chatService.findDefaultAdmin.mockResolvedValue({ id: 'admin-1' });
      chatService.createOrGetConversation.mockResolvedValue({ id: 'conv-1' });

      const res = await controller.createConversation(user);

      expect(chatService.createOrGetConversation).toHaveBeenCalledWith('client-1', 'admin-1');
      expect(res).toEqual({ message: 'Conversation ready', data: { conversation: { id: 'conv-1' } } });
    });

    it('throws NotFoundException when no admin account exists', async () => {
      const user = makeUser({ id: 'client-1' });
      chatService.findDefaultAdmin.mockResolvedValue(null);

      await expect(controller.createConversation(user)).rejects.toBeInstanceOf(NotFoundException);
      expect(chatService.createOrGetConversation).not.toHaveBeenCalled();
    });
  });

  // ── POST /presigned-url ───────────────────────────────────────────────────
  describe('getPresignedUrl', () => {
    it('builds a sanitized S3 key with user id + timestamp and returns the result', async () => {
      const user = makeUser({ id: 'u-99' });
      awsService.generatePresignedUrl.mockResolvedValue({ url: 'https://s3', fileUrl: 'https://cdn' });
      const dto = { fileName: 'My Big File.pdf', contentType: 'application/pdf' } as any;

      const res = await controller.getPresignedUrl(dto, user);

      expect(awsService.generatePresignedUrl).toHaveBeenCalledTimes(1);
      const [keyArg, ctArg] = awsService.generatePresignedUrl.mock.calls[0];
      expect(keyArg).toMatch(/^chat\/u-99\/\d+-My_Big_File\.pdf$/);
      expect(ctArg).toBe('application/pdf');
      expect(res.data).toEqual({ url: 'https://s3', fileUrl: 'https://cdn' });
    });
  });

  // ── PATCH /messages/:id/read ──────────────────────────────────────────────
  describe('markMessageRead', () => {
    it('marks a message as read', async () => {
      const user = makeUser({ id: 'u-1' });
      chatService.markMessageAsRead.mockResolvedValue({ id: validUuid, isRead: true });

      const res = await controller.markMessageRead(validUuid, user);

      expect(chatService.markMessageAsRead).toHaveBeenCalledWith(validUuid, 'u-1');
      expect(res.data.message.isRead).toBe(true);
    });
  });

  // ── PATCH /conversations/:id/status ───────────────────────────────────────
  describe('updateStatus', () => {
    it('passes the status enum to the service', async () => {
      const user = makeUser({ id: 'admin-1', role: UserRole.ADMIN });
      chatService.updateStatus.mockResolvedValue({ id: validUuid, status: ConversationStatus.RESOLVED });

      const res = await controller.updateStatus(validUuid, ConversationStatus.RESOLVED, user);

      expect(chatService.updateStatus).toHaveBeenCalledWith(validUuid, ConversationStatus.RESOLVED, user);
      expect(res.data.conversation.status).toBe(ConversationStatus.RESOLVED);
    });
  });
});
