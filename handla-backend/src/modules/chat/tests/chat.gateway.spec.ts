import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { WsException } from '@nestjs/websockets';

import { ChatGateway } from '../chat.gateway';
import { ChatService } from '../chat.service';
import { User } from '../../auth/entities/user.entity';
import { NotificationService } from '../../notifications/notification.service';
import { EmailService } from '../../email/email.service';
import { ChatbotService } from '../../ai/services/chatbot.service';
import { UserRole, ConversationStatus } from '../../../common/enums';

// ─── Fixtures ────────────────────────────────────────────────────────────────
function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'user@example.com',
    passwordHash: 'hashed',
    name: 'Test User',
    role: UserRole.CLIENT,
    isArchived: false,
    archivedAt: null,
    isDisabled: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    adminConversations: [],
    clientConversations: [],
    assignedConversations: [],
    messages: [],
    notifications: [],
    testimonials: [],
    ...overrides,
  } as User;
}

function makeConversation(overrides: Partial<any> = {}) {
  return {
    id: 'conv-1',
    adminId: 'admin-1',
    clientId: 'client-1',
    assignedEmployeeId: null,
    status: ConversationStatus.ACTIVE,
    ...overrides,
  };
}

// ─── Mock socket helper ──────────────────────────────────────────────────────
function makeSocket(overrides: Partial<any> = {}) {
  const s: any = {
    id: 'sock-1',
    handshake: { headers: {}, auth: {} },
    data: {},
    rooms: new Set<string>(),
    connected: true,
    emit: jest.fn(),
    join: jest.fn(function (this: any, room: string) { this.rooms.add(room); }),
    leave: jest.fn(function (this: any, room: string) { this.rooms.delete(room); }),
    disconnect: jest.fn(),
    broadcast: { emit: jest.fn() },
    to: jest.fn(function () { return this; }),
    ...overrides,
  };
  return s;
}

// Helper to mock the server.to(...).emit chain
function makeServer() {
  const lastTarget: { room: string | null } = { room: null };
  const emitter = { emit: jest.fn() };
  const server: any = {
    emit: jest.fn(),
    to: jest.fn((room: string) => {
      lastTarget.room = room;
      return emitter;
    }),
    _lastTarget: lastTarget,
    _emitter: emitter,
  };
  return server;
}

describe('ChatGateway', () => {
  let gateway: ChatGateway;
  let chatService: { getConversationById: jest.Mock; saveMessage: jest.Mock; markAllAsRead: jest.Mock; markMessageAsRead: jest.Mock };
  let jwtService: { verify: jest.Mock };
  let configService: { get: jest.Mock };
  let notificationService: { createMessageNotification: jest.Mock };
  let emailService: { queueMessageNotification: jest.Mock };
  let userRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    chatService = {
      getConversationById: jest.fn(),
      saveMessage: jest.fn(),
      markAllAsRead: jest.fn().mockResolvedValue(undefined),
      markMessageAsRead: jest.fn(),
    };
    jwtService = { verify: jest.fn() };
    configService = { get: jest.fn() };
    notificationService = {
      createMessageNotification: jest.fn().mockResolvedValue({ id: 'notif-1', type: 'MESSAGE' }),
    };
    emailService = { queueMessageNotification: jest.fn().mockResolvedValue(undefined) };
    userRepo = { findOne: jest.fn() };
    // AI-1: the gateway now depends on ChatbotService (assistant layered on top).
    // A no-op double keeps these chat tests focused on chat behaviour.
    const chatbotService = {
      registerBroadcast: jest.fn(),
      handleIncomingMessage: jest.fn().mockResolvedValue({ handled: false }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        { provide: ChatService,            useValue: chatService         },
        { provide: JwtService,             useValue: jwtService          },
        { provide: ConfigService,          useValue: configService       },
        { provide: NotificationService,    useValue: notificationService },
        { provide: EmailService,           useValue: emailService        },
        { provide: getRepositoryToken(User), useValue: userRepo          },
        { provide: ChatbotService,         useValue: chatbotService      },
      ],
    }).compile();

    gateway = module.get<ChatGateway>(ChatGateway);
    // Inject mock server (would normally be set by @WebSocketServer())
    gateway.server = makeServer() as any;
  });

  // ── handleConnection ──────────────────────────────────────────────────────
  describe('handleConnection', () => {
    it('disconnects sockets without a token', async () => {
      const sock = makeSocket();
      await gateway.handleConnection(sock);
      expect(sock.disconnect).toHaveBeenCalledWith(true);
    });

    it('disconnects sockets when JWT verify fails', async () => {
      const sock = makeSocket({ handshake: { headers: {}, auth: { token: 'bad' } } });
      jwtService.verify.mockImplementation(() => { throw new Error('bad'); });
      await gateway.handleConnection(sock);
      expect(sock.disconnect).toHaveBeenCalledWith(true);
    });

    it('disconnects sockets when JWT is valid but user does not exist', async () => {
      const sock = makeSocket({ handshake: { headers: {}, auth: { token: 'good' } } });
      jwtService.verify.mockReturnValue({ sub: 'missing-user' });
      userRepo.findOne.mockResolvedValue(null);
      await gateway.handleConnection(sock);
      expect(sock.disconnect).toHaveBeenCalledWith(true);
    });

    it('accepts valid auth, joins personal room, broadcasts userOnline', async () => {
      const user = makeUser({ id: 'u-1', email: 'a@b.c' });
      const sock = makeSocket({ handshake: { headers: {}, auth: { token: 'good' } } });
      jwtService.verify.mockReturnValue({ sub: user.id });
      userRepo.findOne.mockResolvedValue(user);

      await gateway.handleConnection(sock);

      expect(sock.disconnect).not.toHaveBeenCalled();
      expect(sock.join).toHaveBeenCalledWith(`user:${user.id}`);
      expect(sock.broadcast.emit).toHaveBeenCalledWith('userOnline', { userId: user.id, online: true });
    });

    it('extracts token from cookie header', async () => {
      const user = makeUser({ id: 'u-2' });
      const sock = makeSocket({
        handshake: { headers: { cookie: 'foo=bar; access_token=abc.def.ghi; baz=qux' }, auth: {} },
      });
      jwtService.verify.mockReturnValue({ sub: user.id });
      userRepo.findOne.mockResolvedValue(user);

      await gateway.handleConnection(sock);

      // verify() should have been called with the cookie token (not undefined)
      expect(jwtService.verify).toHaveBeenCalledWith('abc.def.ghi', expect.any(Object));
      expect(sock.disconnect).not.toHaveBeenCalled();
    });

    it('extracts token from Bearer authorization header', async () => {
      const user = makeUser({ id: 'u-3' });
      const sock = makeSocket({
        handshake: { headers: { authorization: 'Bearer my-token-123' }, auth: {} },
      });
      jwtService.verify.mockReturnValue({ sub: user.id });
      userRepo.findOne.mockResolvedValue(user);

      await gateway.handleConnection(sock);

      expect(jwtService.verify).toHaveBeenCalledWith('my-token-123', expect.any(Object));
    });
  });

  // ── handleDisconnect ──────────────────────────────────────────────────────
  describe('handleDisconnect', () => {
    it('emits userOnline=false when all of a user\'s sockets disconnect', async () => {
      const user = makeUser({ id: 'u-4' });
      const sock = makeSocket({ id: 'sock-A', handshake: { headers: {}, auth: { token: 't' } } });
      jwtService.verify.mockReturnValue({ sub: user.id });
      userRepo.findOne.mockResolvedValue(user);
      await gateway.handleConnection(sock);

      gateway.handleDisconnect(sock);

      expect((gateway.server as any).emit).toHaveBeenCalledWith('userOnline', { userId: user.id, online: false });
    });

    it('does NOT emit userOnline=false while another socket from the same user remains', async () => {
      const user = makeUser({ id: 'u-5' });
      const s1 = makeSocket({ id: 'sock-X', handshake: { headers: {}, auth: { token: 't' } } });
      const s2 = makeSocket({ id: 'sock-Y', handshake: { headers: {}, auth: { token: 't' } } });
      jwtService.verify.mockReturnValue({ sub: user.id });
      userRepo.findOne.mockResolvedValue(user);
      await gateway.handleConnection(s1);
      await gateway.handleConnection(s2);

      gateway.handleDisconnect(s1);

      // Server-wide emit should NOT have been called with userOnline=false yet
      const calls = (gateway.server as any).emit.mock.calls;
      expect(calls.some((c: any[]) => c[0] === 'userOnline' && c[1].online === false)).toBe(false);
    });

    it('is safe to call for an unknown socket', () => {
      const ghost = makeSocket({ id: 'ghost' });
      expect(() => gateway.handleDisconnect(ghost)).not.toThrow();
    });
  });

  // ── notifyMessageRecipient ────────────────────────────────────────────────
  //
  // This helper is the heart of the notification-bell fix and must work the
  // same regardless of whether the original message was sent via REST or WS.
  describe('notifyMessageRecipient', () => {
    it('routes admin → client when no assignedEmployee', async () => {
      const conv  = makeConversation({ adminId: 'admin-1', clientId: 'client-1' });
      const admin = makeUser({ id: 'admin-1', role: UserRole.ADMIN, name: 'A' });

      await gateway.notifyMessageRecipient({
        conversation: conv,
        senderUser: admin,
        messageId: 'msg-1',
        content: 'hello',
      });

      expect(notificationService.createMessageNotification).toHaveBeenCalledWith(
        'client-1',
        'A',
        'hello',
        'msg-1',
        'conv-1',
      );
      expect((gateway.server as any).to).toHaveBeenCalledWith('user:client-1');
      expect((gateway.server as any)._emitter.emit).toHaveBeenCalledWith(
        'notificationNew',
        expect.objectContaining({ conversationId: 'conv-1', senderId: 'admin-1' }),
      );
    });

    it('routes admin → assignedEmployee when one exists', async () => {
      const conv = makeConversation({ adminId: 'admin-1', clientId: 'client-1', assignedEmployeeId: 'emp-9' });
      const admin = makeUser({ id: 'admin-1', role: UserRole.ADMIN });
      await gateway.notifyMessageRecipient({
        conversation: conv, senderUser: admin, messageId: 'm', content: 'hi',
      });
      expect(notificationService.createMessageNotification).toHaveBeenCalledWith('emp-9', expect.any(String), 'hi', 'm', expect.any(String));
    });

    it('routes client → assignedEmployee when one exists (not admin)', async () => {
      const conv = makeConversation({ adminId: 'admin-1', clientId: 'client-1', assignedEmployeeId: 'emp-9' });
      const client = makeUser({ id: 'client-1', role: UserRole.CLIENT });
      await gateway.notifyMessageRecipient({
        conversation: conv, senderUser: client, messageId: 'm', content: 'hi',
      });
      expect(notificationService.createMessageNotification).toHaveBeenCalledWith('emp-9', expect.any(String), 'hi', 'm', expect.any(String));
    });

    it('routes client → admin when no assignedEmployee', async () => {
      const conv = makeConversation({ adminId: 'admin-1', clientId: 'client-1', assignedEmployeeId: null });
      const client = makeUser({ id: 'client-1', role: UserRole.CLIENT });
      await gateway.notifyMessageRecipient({
        conversation: conv, senderUser: client, messageId: 'm', content: 'hi',
      });
      expect(notificationService.createMessageNotification).toHaveBeenCalledWith('admin-1', expect.any(String), 'hi', 'm', expect.any(String));
    });

    it('routes assignedEmployee → client', async () => {
      const conv = makeConversation({ adminId: 'admin-1', clientId: 'client-1', assignedEmployeeId: 'emp-9' });
      const emp  = makeUser({ id: 'emp-9', role: UserRole.EMPLOYEE });
      await gateway.notifyMessageRecipient({
        conversation: conv, senderUser: emp, messageId: 'm', content: 'hi',
      });
      expect(notificationService.createMessageNotification).toHaveBeenCalledWith('client-1', expect.any(String), 'hi', 'm', expect.any(String));
    });

    it('uses file-attachment placeholder preview when content is empty', async () => {
      const conv = makeConversation();
      const client = makeUser({ id: 'client-1', role: UserRole.CLIENT });
      await gateway.notifyMessageRecipient({
        conversation: conv, senderUser: client, messageId: 'm', content: undefined,
      });
      expect(notificationService.createMessageNotification).toHaveBeenCalledWith(
        'admin-1',
        expect.any(String),
        '📎 File attachment',
        'm',
        expect.any(String),
      );
    });

    it('truncates the preview to 100 characters', async () => {
      const conv = makeConversation();
      const client = makeUser({ id: 'client-1', role: UserRole.CLIENT });
      const long = 'x'.repeat(250);

      await gateway.notifyMessageRecipient({
        conversation: conv, senderUser: client, messageId: 'm', content: long,
      });
      const preview = notificationService.createMessageNotification.mock.calls[0][2] as string;
      expect(preview.length).toBe(100);
    });

    it('queues an email when recipient has an email', async () => {
      const conv = makeConversation();
      const client = makeUser({ id: 'client-1', role: UserRole.CLIENT });
      userRepo.findOne.mockResolvedValue(makeUser({ id: 'admin-1', email: 'admin@x.io', name: 'Admin' }));
      configService.get.mockReturnValue('https://prod.example.com');

      await gateway.notifyMessageRecipient({
        conversation: conv, senderUser: client, messageId: 'm', content: 'hi',
      });

      expect(emailService.queueMessageNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientEmail: 'admin@x.io',
          dashboardUrl: 'https://prod.example.com/dashboard/conversations/conv-1',
        }),
      );
    });

    it('does NOT queue an email when recipient has no email', async () => {
      const conv = makeConversation();
      const client = makeUser({ id: 'client-1', role: UserRole.CLIENT });
      userRepo.findOne.mockResolvedValue(null);
      await gateway.notifyMessageRecipient({
        conversation: conv, senderUser: client, messageId: 'm', content: 'hi',
      });
      expect(emailService.queueMessageNotification).not.toHaveBeenCalled();
    });

    it('does NOT notify when sender is not a participant', async () => {
      const conv = makeConversation({ adminId: 'admin-1', clientId: 'client-1' });
      const stranger = makeUser({ id: 'random-9' });
      await gateway.notifyMessageRecipient({
        conversation: conv, senderUser: stranger, messageId: 'm', content: 'hi',
      });
      expect(notificationService.createMessageNotification).not.toHaveBeenCalled();
      expect((gateway.server as any)._emitter.emit).not.toHaveBeenCalled();
    });

    it('does NOT notify yourself (defensive against routing degenerate to sender)', async () => {
      // Self-routing can only happen if adminId === clientId, which is invalid
      // data, but the helper should still degrade safely.
      const conv = makeConversation({ adminId: 'same', clientId: 'same' });
      const user = makeUser({ id: 'same' });
      await gateway.notifyMessageRecipient({
        conversation: conv, senderUser: user, messageId: 'm', content: 'hi',
      });
      expect(notificationService.createMessageNotification).not.toHaveBeenCalled();
    });

    it('swallows notification-create failures (does not throw)', async () => {
      const conv = makeConversation();
      const client = makeUser({ id: 'client-1', role: UserRole.CLIENT });
      notificationService.createMessageNotification.mockRejectedValueOnce(new Error('db down'));

      await expect(
        gateway.notifyMessageRecipient({
          conversation: conv, senderUser: client, messageId: 'm', content: 'hi',
        }),
      ).resolves.toBeUndefined();
      // No socket emit when DB write failed
      expect((gateway.server as any)._emitter.emit).not.toHaveBeenCalled();
    });

    it('swallows email-queue failures (still emits in-app notification)', async () => {
      const conv = makeConversation();
      const client = makeUser({ id: 'client-1', role: UserRole.CLIENT });
      userRepo.findOne.mockResolvedValue(makeUser({ id: 'admin-1', email: 'a@b.c' }));
      emailService.queueMessageNotification.mockRejectedValueOnce(new Error('queue full'));

      await expect(
        gateway.notifyMessageRecipient({
          conversation: conv, senderUser: client, messageId: 'm', content: 'hi',
        }),
      ).resolves.toBeUndefined();
      // In-app notification still emitted
      expect((gateway.server as any)._emitter.emit).toHaveBeenCalledWith(
        'notificationNew',
        expect.any(Object),
      );
    });
  });

  // ── broadcastMessage ──────────────────────────────────────────────────────
  describe('broadcastMessage', () => {
    it('emits messageReceived to the conversation room', () => {
      const msg = { id: 'm-1', content: 'hi' };
      gateway.broadcastMessage('conv-1', msg);
      expect((gateway.server as any).to).toHaveBeenCalledWith('conversation:conv-1');
      expect((gateway.server as any)._emitter.emit).toHaveBeenCalledWith('messageReceived', {
        message: msg,
        conversationId: 'conv-1',
      });
    });
  });

  // ── handleSendMessage (WebSocket path) ────────────────────────────────────
  describe('handleSendMessage', () => {
    it('throws WsException when sender is not authenticated', async () => {
      const sock = makeSocket();
      await expect(
        gateway.handleSendMessage(sock, { conversationId: 'conv-1', content: 'hi' }),
      ).rejects.toBeInstanceOf(WsException);
    });

    it('validates payload via class-validator', async () => {
      // Connect user first
      const user = makeUser({ id: 'admin-1', role: UserRole.ADMIN });
      const sock = makeSocket({ handshake: { headers: {}, auth: { token: 't' } } });
      jwtService.verify.mockReturnValue({ sub: user.id });
      userRepo.findOne.mockResolvedValue(user);
      await gateway.handleConnection(sock);

      // Missing conversationId → DTO validation should fail
      await expect(
        gateway.handleSendMessage(sock, { content: 'no conv id' } as any),
      ).rejects.toBeInstanceOf(WsException);
    });

    it('happy path: saves message, broadcasts, calls notifyMessageRecipient', async () => {
      // Must be a valid v4 UUID for @IsUUID() to pass
      const CONV_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
      const user = makeUser({ id: 'admin-1', role: UserRole.ADMIN });
      const sock = makeSocket({ handshake: { headers: {}, auth: { token: 't' } } });
      jwtService.verify.mockReturnValue({ sub: user.id });
      userRepo.findOne.mockResolvedValue(user);
      await gateway.handleConnection(sock);

      const conv = makeConversation({ id: CONV_ID, adminId: 'admin-1', clientId: 'client-1' });
      chatService.getConversationById.mockResolvedValue({ conversation: conv, messages: [] });
      chatService.saveMessage.mockResolvedValue({ id: 'msg-7', content: 'hello' });

      const res = await gateway.handleSendMessage(sock, {
        conversationId: CONV_ID,
        content: 'hello',
      });

      expect(chatService.saveMessage).toHaveBeenCalledWith(CONV_ID, 'admin-1', 'hello', undefined);
      // Broadcast: server.to('conversation:<uuid>').emit('messageReceived', …)
      const toCalls = ((gateway.server as any).to as jest.Mock).mock.calls.map((c) => c[0]);
      expect(toCalls).toContain(`conversation:${CONV_ID}`);
      // Notification emitted to recipient (client-1)
      expect(notificationService.createMessageNotification).toHaveBeenCalledWith(
        'client-1', user.name, 'hello', 'msg-7', CONV_ID,
      );
      expect(res).toEqual({ success: true, message: { id: 'msg-7', content: 'hello' } });
    });
  });

  // ── handleMarkAsRead ──────────────────────────────────────────────────────
  describe('handleMarkAsRead', () => {
    it('throws when not authenticated', async () => {
      const sock = makeSocket();
      await expect(
        gateway.handleMarkAsRead(sock, { conversationId: 'c-1' }),
      ).rejects.toBeInstanceOf(WsException);
    });

    it('marks all as read for the conversation when conversationId given', async () => {
      const user = makeUser({ id: 'u' });
      const sock = makeSocket({ handshake: { headers: {}, auth: { token: 't' } } });
      jwtService.verify.mockReturnValue({ sub: user.id });
      userRepo.findOne.mockResolvedValue(user);
      await gateway.handleConnection(sock);

      const res = await gateway.handleMarkAsRead(sock, { conversationId: 'c-1' });

      expect(chatService.markAllAsRead).toHaveBeenCalledWith('c-1', user.id);
      expect((gateway.server as any).to).toHaveBeenCalledWith('conversation:c-1');
      expect(res).toEqual({ success: true });
    });

    it('marks a single message when messageId is given', async () => {
      const user = makeUser({ id: 'u' });
      const sock = makeSocket({ handshake: { headers: {}, auth: { token: 't' } } });
      jwtService.verify.mockReturnValue({ sub: user.id });
      userRepo.findOne.mockResolvedValue(user);
      await gateway.handleConnection(sock);

      chatService.markMessageAsRead.mockResolvedValue({ id: 'msg-9', conversationId: 'c-1' });
      await gateway.handleMarkAsRead(sock, { messageId: 'msg-9' });
      expect(chatService.markMessageAsRead).toHaveBeenCalledWith('msg-9', user.id);
    });
  });

  // ── emitToUser ────────────────────────────────────────────────────────────
  describe('emitToUser', () => {
    it('emits to the correct personal room', () => {
      gateway.emitToUser('u-99', 'customEvent', { ok: true });
      expect((gateway.server as any).to).toHaveBeenCalledWith('user:u-99');
      expect((gateway.server as any)._emitter.emit).toHaveBeenCalledWith('customEvent', { ok: true });
    });
  });

  // ── handleJoinConversation / handleLeaveConversation ──────────────────────
  describe('join/leave conversation', () => {
    it('joinConversation requires auth', async () => {
      const sock = makeSocket();
      await expect(
        gateway.handleJoinConversation(sock, { conversationId: 'c-1' }),
      ).rejects.toBeInstanceOf(WsException);
    });

    it('joins room, marks all read, returns success', async () => {
      const user = makeUser({ id: 'u', role: UserRole.CLIENT });
      const sock = makeSocket({ handshake: { headers: {}, auth: { token: 't' } } });
      jwtService.verify.mockReturnValue({ sub: user.id });
      userRepo.findOne.mockResolvedValue(user);
      await gateway.handleConnection(sock);

      chatService.getConversationById.mockResolvedValue({ conversation: makeConversation(), messages: [] });

      const res = await gateway.handleJoinConversation(sock, { conversationId: 'c-1' });

      expect(sock.join).toHaveBeenCalledWith('conversation:c-1');
      expect(chatService.markAllAsRead).toHaveBeenCalledWith('c-1', user.id);
      expect(res).toEqual({ success: true });
    });

    it('leaveConversation always succeeds (no auth required at handler level)', () => {
      const sock = makeSocket();
      const res = gateway.handleLeaveConversation(sock, { conversationId: 'c-1' });
      expect(sock.leave).toHaveBeenCalledWith('conversation:c-1');
      expect(res).toEqual({ success: true });
    });
  });
});
