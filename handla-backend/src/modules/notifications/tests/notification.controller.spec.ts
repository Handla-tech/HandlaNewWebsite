import { Test, TestingModule } from '@nestjs/testing';
import { ParseUUIDPipe, ArgumentMetadata, BadRequestException } from '@nestjs/common';

import { NotificationController } from '../notification.controller';
import { NotificationService } from '../notification.service';
import { PushService } from '../push.service';
import { User } from '../../auth/entities/user.entity';
import { UserRole } from '../../../common/enums';

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

describe('NotificationController', () => {
  let controller: NotificationController;
  let service: {
    getUserNotifications: jest.Mock;
    getUnreadCount: jest.Mock;
    markAllAsRead: jest.Mock;
    deleteAllRead: jest.Mock;
    markAsRead: jest.Mock;
    getOne: jest.Mock;
    deleteNotification: jest.Mock;
  };
  let pushService: {
    registerToken: jest.Mock;
    unregisterToken: jest.Mock;
  };

  const validUuid = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

  beforeEach(async () => {
    service = {
      getUserNotifications: jest.fn(),
      getUnreadCount: jest.fn(),
      markAllAsRead: jest.fn(),
      deleteAllRead: jest.fn(),
      markAsRead: jest.fn(),
      getOne: jest.fn(),
      deleteNotification: jest.fn(),
    };
    pushService = {
      registerToken: jest.fn(),
      unregisterToken: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        { provide: NotificationService, useValue: service },
        { provide: PushService, useValue: pushService },
      ],
    }).compile();

    controller = module.get(NotificationController);
  });

  // ── GET / ─────────────────────────────────────────────────────────────────
  describe('GET /notifications', () => {
    it('passes user.id and query through to the service and wraps the result', async () => {
      const user = makeUser();
      const payload = {
        notifications: [{ id: 'n1' }],
        total: 1,
        unreadCount: 0,
        page: 1,
        limit: 20,
      };
      service.getUserNotifications.mockResolvedValue(payload);

      const res = await controller.getNotifications(user, { page: 2, limit: 10 } as any);

      expect(service.getUserNotifications).toHaveBeenCalledWith(user.id, { page: 2, limit: 10 });
      expect(res).toEqual({ message: 'Notifications retrieved', data: payload });
    });
  });

  // ── GET /unread-count ─────────────────────────────────────────────────────
  describe('GET /notifications/unread-count', () => {
    it('returns { unreadCount } shape', async () => {
      const user = makeUser();
      service.getUnreadCount.mockResolvedValue(7);

      const res = await controller.getUnreadCount(user);

      expect(service.getUnreadCount).toHaveBeenCalledWith(user.id);
      expect(res).toEqual({ message: 'Unread count retrieved', data: { unreadCount: 7 } });
    });

    it('handles 0 unread count', async () => {
      const user = makeUser();
      service.getUnreadCount.mockResolvedValue(0);

      const res = await controller.getUnreadCount(user);

      expect(res.data.unreadCount).toBe(0);
    });
  });

  // ── PATCH /read-all ───────────────────────────────────────────────────────
  describe('PATCH /notifications/read-all', () => {
    it('marks all as read and returns the affected count in the message', async () => {
      const user = makeUser();
      service.markAllAsRead.mockResolvedValue({ affected: 5 });

      const res = await controller.markAllAsRead(user);

      expect(service.markAllAsRead).toHaveBeenCalledWith(user.id);
      expect(res.message).toContain('5');
      expect(res.data).toEqual({ affected: 5 });
    });

    it('handles affected=0 gracefully', async () => {
      const user = makeUser();
      service.markAllAsRead.mockResolvedValue({ affected: 0 });

      const res = await controller.markAllAsRead(user);

      expect(res.message).toContain('0');
    });
  });

  // ── DELETE /read ──────────────────────────────────────────────────────────
  describe('DELETE /notifications/read', () => {
    it('deletes all read notifications and includes count in the message', async () => {
      const user = makeUser();
      service.deleteAllRead.mockResolvedValue({ deleted: 3 });

      const res = await controller.deleteAllRead(user);

      expect(service.deleteAllRead).toHaveBeenCalledWith(user.id);
      expect(res.message).toContain('3');
      expect(res.data).toEqual({ deleted: 3 });
    });
  });

  // ── PATCH /:id/read ───────────────────────────────────────────────────────
  describe('PATCH /notifications/:id/read', () => {
    it('marks a specific notification as read', async () => {
      const user = makeUser();
      service.markAsRead.mockResolvedValue({ id: validUuid, isRead: true });

      const res = await controller.markAsRead(validUuid, user);

      expect(service.markAsRead).toHaveBeenCalledWith(validUuid, user.id);
      expect(res.data.notification.isRead).toBe(true);
    });
  });

  // ── GET /:id ──────────────────────────────────────────────────────────────
  describe('GET /notifications/:id', () => {
    it('returns the requested notification', async () => {
      const user = makeUser();
      service.getOne.mockResolvedValue({ id: validUuid, title: 'Hi' });

      const res = await controller.getOne(validUuid, user);

      expect(service.getOne).toHaveBeenCalledWith(validUuid, user.id);
      expect(res.data.notification).toEqual({ id: validUuid, title: 'Hi' });
    });
  });

  // ── DELETE /:id ───────────────────────────────────────────────────────────
  describe('DELETE /notifications/:id', () => {
    it('deletes a notification by id', async () => {
      const user = makeUser();
      service.deleteNotification.mockResolvedValue(undefined);

      const res = await controller.deleteNotification(validUuid, user);

      expect(service.deleteNotification).toHaveBeenCalledWith(validUuid, user.id);
      expect(res).toEqual({ message: 'Notification deleted' });
    });
  });

  // ── Param validation (regression guard for the literal-before-:id ordering)
  describe('ParseUUIDPipe rejects literal segments', () => {
    const meta: ArgumentMetadata = { type: 'param', metatype: String, data: 'id' };

    it('rejects "unread-count" (would only reach :id route if literal route missing)', async () => {
      const pipe = new ParseUUIDPipe();
      await expect(pipe.transform('unread-count', meta)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects "read-all"', async () => {
      const pipe = new ParseUUIDPipe();
      await expect(pipe.transform('read-all', meta)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects "read"', async () => {
      const pipe = new ParseUUIDPipe();
      await expect(pipe.transform('read', meta)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts a real UUID', async () => {
      const pipe = new ParseUUIDPipe();
      await expect(pipe.transform(validUuid, meta)).resolves.toBe(validUuid);
    });
  });
});
