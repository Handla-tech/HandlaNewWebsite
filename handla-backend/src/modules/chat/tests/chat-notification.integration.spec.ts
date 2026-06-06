/**
 * Cross-module integration test for the NOTIFICATION BELL FIX.
 *
 * Scenario: an ADMIN (or EMPLOYEE / CLIENT) sends a text message via the REST
 * fallback endpoint (`POST /chat/conversations/:id/messages`). The bug that
 * Request 1 fixed was that this REST path never created an in-app notification
 * or emitted the `notificationNew` websocket event — so the recipient's bell
 * badge never updated for plain text messages (it only worked when messages
 * went through the websocket gateway).
 *
 * Unlike `chat.controller.spec.ts` (which mocks the gateway entirely) and
 * `chat.gateway.spec.ts` (which calls the gateway methods directly), THIS
 * test exercises the real wiring between ChatController and ChatGateway:
 *  Controller.sendMessage() →
 *  Gateway.broadcastMessage() →
 *  Gateway.notifyMessageRecipient() →
 *  NotificationService.createMessageNotification() +
 *  server.to('user:<id>').emit('notificationNew', …) +
 *  EmailService.queueMessageNotification()
 *
 * It guards against regressions where the helper is renamed, the controller
 * stops calling it, or the gateway stops routing recipients correctly.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { ChatController } from '../chat.controller';
import { ChatGateway } from '../chat.gateway';
import { ChatService } from '../chat.service';
import { NotificationService } from '../../notifications/notification.service';
import { EmailService } from '../../email/email.service';
import { AwsService } from '../../aws/aws.service';
import { User } from '../../auth/entities/user.entity';
import { UserRole, ConversationStatus } from '../../../common/enums';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u-1',
    email: 'u@example.com',
    passwordHash: 'h',
    name: 'User',
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

describe('Chat → Notification bell integration', () => {
  let controller: ChatController;
  let gateway: ChatGateway;

  let chatService: any;
  let notificationService: any;
  let emailService: any;
  let userRepo: any;

  // Spy on what the gateway emits on the io server
  let emittedNotifications: Array<{ room: string; event: string; payload: any }>;
  let mockServer: any;

  const CONV_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

  beforeEach(async () => {
    emittedNotifications = [];

    // server.to(room).emit(event, payload) — recorder
    mockServer = {
      to: jest.fn((room: string) => ({
        emit: jest.fn((event: string, payload: any) => {
          emittedNotifications.push({ room, event, payload });
        }),
      })),
      emit: jest.fn(),
    };

    chatService = {
      sendMessage: jest.fn(),
      getConversations: jest.fn(),
      getConversationById: jest.fn(),
      getMessages: jest.fn(),
      findDefaultAdmin: jest.fn(),
      createOrGetConversation: jest.fn(),
      markMessageAsRead: jest.fn(),
      updateStatus: jest.fn(),
    };

    notificationService = {
      // Returns a fake notification so the gateway will emit it as the payload
      createMessageNotification: jest.fn().mockImplementation(async (userId, _name, preview, msgId) => ({
        id: 'notif-1',
        userId,
        type: 'MESSAGE',
        body: preview,
        messageId: msgId,
        isRead: false,
        createdAt: new Date(),
      })),
    };

    emailService = {
      queueMessageNotification: jest.fn().mockResolvedValue(undefined),
    };

    userRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        { provide: ChatService, useValue: chatService },
        { provide: NotificationService, useValue: notificationService },
        { provide: EmailService, useValue: emailService },
        { provide: JwtService, useValue: { verify: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: AwsService, useValue: { generatePresignedUrl: jest.fn() } },
        ChatGateway,
      ],
    }).compile();

    controller = module.get(ChatController);
    gateway = module.get(ChatGateway);

    // Inject the mock socket.io server (normally set by @WebSocketServer)
    (gateway as any).server = mockServer;
  });

  it('ADMIN → CLIENT: REST send-message creates a notification and emits notificationNew to client room', async () => {
    const admin = makeUser({ id: 'admin-1', role: UserRole.ADMIN, name: 'Admin Alice' });
    const conversation = {
      id: CONV_ID,
      adminId: 'admin-1',
      clientId: 'client-1',
      assignedEmployeeId: null,
      status: ConversationStatus.ACTIVE,
      client: { id: 'client-1', email: 'client@example.com', name: 'Client Bob' },
    };
    chatService.sendMessage.mockResolvedValue({
      message: { id: 'msg-99', content: 'Hello from REST' },
      conversation,
    });
    // Gateway looks up the recipient User to obtain their email for the queue
    userRepo.findOne.mockResolvedValue({
      id: 'client-1', email: 'client@example.com', name: 'Client Bob',
    });

    await controller.sendMessage(CONV_ID, 'Hello from REST', undefined, admin);

    // 1. Notification PERSISTED for the client (recipient)
    expect(notificationService.createMessageNotification).toHaveBeenCalledTimes(1);
    expect(notificationService.createMessageNotification).toHaveBeenCalledWith(
      'client-1',
      'Admin Alice',
      'Hello from REST',
      'msg-99',
      CONV_ID,
    );

    // 2. WS push: server.to('user:client-1').emit('notificationNew', { notification })
    // (broadcastMessage also fires; filter for the notificationNew event)
    const notifEmits = emittedNotifications.filter((e) => e.event === 'notificationNew');
    expect(notifEmits).toHaveLength(1);
    expect(notifEmits[0].room).toBe('user:client-1');
    expect(notifEmits[0].payload.notification.userId).toBe('client-1');
    expect(notifEmits[0].payload.notification.type).toBe('MESSAGE');

    // 3. Broadcast to conversation room ALSO happened (for live message UI)
    const msgEmits = emittedNotifications.filter((e) => e.event === 'messageReceived');
    expect(msgEmits).toHaveLength(1);
    expect(msgEmits[0].room).toBe(`conversation:${CONV_ID}`);

    // 4. Email queued for the recipient
    expect(emailService.queueMessageNotification).toHaveBeenCalledTimes(1);
  });

  it('ADMIN → ASSIGNED EMPLOYEE: routes to assigned employee when one is set, not to client', async () => {
    const admin = makeUser({ id: 'admin-1', role: UserRole.ADMIN, name: 'A' });
    const conversation = {
      id: CONV_ID,
      adminId: 'admin-1',
      clientId: 'client-1',
      assignedEmployeeId: 'emp-1',
      status: ConversationStatus.ACTIVE,
      assignedEmployee: { id: 'emp-1', email: 'emp@example.com', name: 'Emp' },
    };
    chatService.sendMessage.mockResolvedValue({
      message: { id: 'msg-100', content: 'For employee' },
      conversation,
    });

    await controller.sendMessage(CONV_ID, 'For employee', undefined, admin);

    // Recipient is the employee, NOT the client
    expect(notificationService.createMessageNotification).toHaveBeenCalledWith(
      'emp-1', 'A', 'For employee', 'msg-100', CONV_ID,
    );
    const notifEmits = emittedNotifications.filter((e) => e.event === 'notificationNew');
    expect(notifEmits).toHaveLength(1);
    expect(notifEmits[0].room).toBe('user:emp-1');
  });

  it('CLIENT → ADMIN (no employee): client message reaches admin bell', async () => {
    const client = makeUser({ id: 'client-1', role: UserRole.CLIENT, name: 'C' });
    const conversation = {
      id: CONV_ID,
      adminId: 'admin-1',
      clientId: 'client-1',
      assignedEmployeeId: null,
      status: ConversationStatus.ACTIVE,
      admin: { id: 'admin-1', email: 'admin@example.com', name: 'Admin' },
    };
    chatService.sendMessage.mockResolvedValue({
      message: { id: 'msg-101', content: 'Need help' },
      conversation,
    });

    await controller.sendMessage(CONV_ID, 'Need help', undefined, client);

    expect(notificationService.createMessageNotification).toHaveBeenCalledWith(
      'admin-1', 'C', 'Need help', 'msg-101', CONV_ID,
    );
    expect(emittedNotifications.find((e) => e.event === 'notificationNew')?.room)
      .toBe('user:admin-1');
  });

  it('CLIENT → ASSIGNED EMPLOYEE: client routes to employee not admin', async () => {
    const client = makeUser({ id: 'client-1', role: UserRole.CLIENT, name: 'C' });
    const conversation = {
      id: CONV_ID,
      adminId: 'admin-1',
      clientId: 'client-1',
      assignedEmployeeId: 'emp-1',
      status: ConversationStatus.ACTIVE,
      assignedEmployee: { id: 'emp-1', email: 'emp@example.com', name: 'Emp' },
    };
    chatService.sendMessage.mockResolvedValue({
      message: { id: 'msg-102', content: 'hi' },
      conversation,
    });

    await controller.sendMessage(CONV_ID, 'hi', undefined, client);

    expect(notificationService.createMessageNotification).toHaveBeenCalledWith(
      'emp-1', 'C', 'hi', 'msg-102', CONV_ID,
    );
  });

  it('EMPLOYEE → CLIENT: assigned employee always routes back to the client', async () => {
    const employee = makeUser({ id: 'emp-1', role: UserRole.EMPLOYEE, name: 'E' });
    const conversation = {
      id: CONV_ID,
      adminId: 'admin-1',
      clientId: 'client-1',
      assignedEmployeeId: 'emp-1',
      status: ConversationStatus.ACTIVE,
      client: { id: 'client-1', email: 'c@example.com', name: 'Client' },
    };
    chatService.sendMessage.mockResolvedValue({
      message: { id: 'msg-103', content: 'on it' },
      conversation,
    });

    await controller.sendMessage(CONV_ID, 'on it', undefined, employee);

    expect(notificationService.createMessageNotification).toHaveBeenCalledWith(
      'client-1', 'E', 'on it', 'msg-103', CONV_ID,
    );
  });

  it('FILE-ONLY MESSAGE: empty content still creates a notification with file-attachment preview', async () => {
    const admin = makeUser({ id: 'admin-1', role: UserRole.ADMIN, name: 'A' });
    const conversation = {
      id: CONV_ID,
      adminId: 'admin-1',
      clientId: 'client-1',
      assignedEmployeeId: null,
      status: ConversationStatus.ACTIVE,
      client: { id: 'client-1', email: 'c@example.com', name: 'C' },
    };
    chatService.sendMessage.mockResolvedValue({
      message: { id: 'msg-104', content: '', fileUrl: 'https://s3/file.pdf' },
      conversation,
    });

    await controller.sendMessage(CONV_ID, '', 'https://s3/file.pdf', admin);

    const call = notificationService.createMessageNotification.mock.calls[0];
    expect(call[0]).toBe('client-1');               // recipient
    expect(call[3]).toBe('msg-104');                // messageId
    // preview should be the file-attachment placeholder (gateway computes it)
    expect(call[2]).toMatch(/file/i);
  });

  it('REGRESSION GUARD: if notifyMessageRecipient is ever removed, this test fails', async () => {
    // This is essentially a contract test: ensure the controller actually
    // invokes the gateway method by name. If someone refactors the gateway
    // method away (and breaks the bell again), this catches it.
    expect(typeof gateway.notifyMessageRecipient).toBe('function');

    const spy = jest.spyOn(gateway, 'notifyMessageRecipient');
    const admin = makeUser({ id: 'admin-1', role: UserRole.ADMIN, name: 'A' });
    const conversation = {
      id: CONV_ID, adminId: 'admin-1', clientId: 'client-1', assignedEmployeeId: null,
      status: ConversationStatus.ACTIVE,
      client: { id: 'client-1', email: 'c@example.com', name: 'C' },
    };
    chatService.sendMessage.mockResolvedValue({
      message: { id: 'msg-200', content: 'guard' },
      conversation,
    });

    await controller.sendMessage(CONV_ID, 'guard', undefined, admin);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({
      conversation,
      senderUser: admin,
      messageId: 'msg-200',
      content: 'guard',
    });
  });

  it('DOES NOT notify when sender is somehow the recipient (defensive against self-routing)', async () => {
    // This case happens if a client is mis-set as both admin and client of the
    // same conversation (data integrity edge case). The helper should bail out.
    const admin = makeUser({ id: 'admin-1', role: UserRole.ADMIN, name: 'A' });
    const conversation = {
      id: CONV_ID,
      adminId: 'admin-1',
      clientId: 'admin-1', // ← same as adminId
      assignedEmployeeId: null,
      status: ConversationStatus.ACTIVE,
    };
    chatService.sendMessage.mockResolvedValue({
      message: { id: 'msg-300', content: 'echo' },
      conversation,
    });

    await controller.sendMessage(CONV_ID, 'echo', undefined, admin);

    expect(notificationService.createMessageNotification).not.toHaveBeenCalled();
    expect(emittedNotifications.filter((e) => e.event === 'notificationNew')).toHaveLength(0);
  });

  it('SWALLOWS notification-creation failures (does not surface to the caller)', async () => {
    notificationService.createMessageNotification.mockRejectedValue(new Error('DB down'));
    const admin = makeUser({ id: 'admin-1', role: UserRole.ADMIN, name: 'A' });
    const conversation = {
      id: CONV_ID, adminId: 'admin-1', clientId: 'client-1', assignedEmployeeId: null,
      status: ConversationStatus.ACTIVE,
      client: { id: 'client-1', email: 'c@example.com', name: 'C' },
    };
    chatService.sendMessage.mockResolvedValue({
      message: { id: 'msg-400', content: 'survive' },
      conversation,
    });

    // Should NOT throw — the message must still be delivered even if the
    // notification side-effect fails.
    await expect(controller.sendMessage(CONV_ID, 'survive', undefined, admin))
      .resolves.toEqual(expect.objectContaining({ message: 'Message sent' }));
  });
});
