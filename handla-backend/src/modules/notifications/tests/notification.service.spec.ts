import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException } from '@nestjs/common';

import { NotificationService } from '../notification.service';
import { Notification } from '../entities/notification.entity';
import { NotificationType } from '../../../common/enums';
import { ResourceNotFoundException } from '../../../utils/exceptions';
import { NotificationQueryDto } from '../dto/notification-query.dto';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const USER_ID = 'user-uuid-1';
const OTHER_USER_ID = 'user-uuid-2';

const mockNotification: Notification = {
  id: 'notif-uuid-1',
  userId: USER_ID,
  type: NotificationType.MESSAGE,
  title: 'New message from Admin',
  message: 'Hello there!',
  relatedMessageId: 'msg-uuid-1',
  relatedEntityId: null,
  isRead: false,
  createdAt: new Date(),
  user: null as any,
};

const mockReadNotification: Notification = {
  ...mockNotification,
  id: 'notif-uuid-2',
  isRead: true,
};

// ─── Repository Mock ─────────────────────────────────────────────────────────

const mockQb = {
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn().mockResolvedValue([[mockNotification], 1]),
  execute: jest.fn().mockResolvedValue({ affected: 1 }),
};

const mockNotificationRepository = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  remove: jest.fn(),
  count: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue(mockQb),
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: getRepositoryToken(Notification),
          useValue: mockNotificationRepository,
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    jest.clearAllMocks();
    // Re-attach the chainable mock after clearAllMocks
    mockNotificationRepository.createQueryBuilder.mockReturnValue(mockQb);
    mockQb.where.mockReturnThis();
    mockQb.andWhere.mockReturnThis();
    mockQb.orderBy.mockReturnThis();
    mockQb.skip.mockReturnThis();
    mockQb.take.mockReturnThis();
    mockQb.update.mockReturnThis();
    mockQb.set.mockReturnThis();
    mockQb.delete.mockReturnThis();
    mockQb.from.mockReturnThis();
    mockQb.getManyAndCount.mockResolvedValue([[mockNotification], 1]);
    mockQb.execute.mockResolvedValue({ affected: 1 });
  });

  // ─── createNotification ───────────────────────────────────────────────────────
  describe('createNotification()', () => {
    it('should create and return a notification', async () => {
      mockNotificationRepository.create.mockReturnValue(mockNotification);
      mockNotificationRepository.save.mockResolvedValue(mockNotification);

      const result = await service.createNotification({
        userId: USER_ID,
        type: NotificationType.MESSAGE,
        title: 'New message from Admin',
        message: 'Hello there!',
        relatedMessageId: 'msg-uuid-1',
  relatedEntityId: null,
      });

      expect(mockNotificationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_ID,
          type: NotificationType.MESSAGE,
          isRead: false,
        }),
      );
      expect(mockNotificationRepository.save).toHaveBeenCalledTimes(1);
      expect(result.id).toBe('notif-uuid-1');
    });

    it('should default relatedMessageId to null when not provided', async () => {
      const notifWithoutMsg = { ...mockNotification, relatedMessageId: null };
      mockNotificationRepository.create.mockReturnValue(notifWithoutMsg);
      mockNotificationRepository.save.mockResolvedValue(notifWithoutMsg);

      await service.createNotification({
        userId: USER_ID,
        type: NotificationType.SYSTEM,
        title: 'System alert',
        message: 'Maintenance at midnight',
      });

      expect(mockNotificationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ relatedMessageId: null }),
      );
    });
  });

  // ─── createMessageNotification ────────────────────────────────────────────────
  describe('createMessageNotification()', () => {
    it('should create a MESSAGE type notification with truncated preview', async () => {
      mockNotificationRepository.create.mockReturnValue(mockNotification);
      mockNotificationRepository.save.mockResolvedValue(mockNotification);

      await service.createMessageNotification(USER_ID, 'Alice', 'Hello!', 'msg-uuid-1');

      expect(mockNotificationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: NotificationType.MESSAGE,
          title: 'New message from Alice',
        }),
      );
    });

    it('should truncate preview longer than 200 chars', async () => {
      mockNotificationRepository.create.mockReturnValue(mockNotification);
      mockNotificationRepository.save.mockResolvedValue(mockNotification);

      const longPreview = 'A'.repeat(250);
      await service.createMessageNotification(USER_ID, 'Bob', longPreview);

      const createArg = mockNotificationRepository.create.mock.calls[0][0];
      expect(createArg.message.length).toBeLessThanOrEqual(203); // 200 chars + '…' (3 bytes but 1 char)
      expect(createArg.message.endsWith('…')).toBe(true);
    });

    it('stores the conversationId on relatedEntityId so the bell can deep-link', async () => {
      mockNotificationRepository.create.mockReturnValue(mockNotification);
      mockNotificationRepository.save.mockResolvedValue(mockNotification);

      await service.createMessageNotification(USER_ID, 'Alice', 'hi', 'msg-1', 'conv-42');

      expect(mockNotificationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: NotificationType.MESSAGE,
          relatedMessageId: 'msg-1',
          relatedEntityId:  'conv-42',
        }),
      );
    });
  });

  // ─── createSystemNotification ─────────────────────────────────────────────────
  describe('createSystemNotification()', () => {
    it('should create a SYSTEM type notification', async () => {
      mockNotificationRepository.create.mockReturnValue({
        ...mockNotification,
        type: NotificationType.SYSTEM,
        relatedMessageId: null,
      });
      mockNotificationRepository.save.mockResolvedValue(mockNotification);

      await service.createSystemNotification(USER_ID, 'Welcome!', 'Thanks for joining.');

      expect(mockNotificationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: NotificationType.SYSTEM }),
      );
    });
  });

  // ─── getUserNotifications ─────────────────────────────────────────────────────
  describe('getUserNotifications()', () => {
    it('should return paginated notifications with unread count', async () => {
      mockNotificationRepository.count.mockResolvedValue(3);

      const query: NotificationQueryDto = { page: 1, limit: 20 };
      const result = await service.getUserNotifications(USER_ID, query);

      expect(result.notifications).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pages).toBe(1);
      expect(result.unreadCount).toBe(3);
    });

    it('should apply isRead filter when provided', async () => {
      mockNotificationRepository.count.mockResolvedValue(0);

      const query: NotificationQueryDto = { page: 1, limit: 20, isRead: false };
      await service.getUserNotifications(USER_ID, query);

      expect(mockQb.andWhere).toHaveBeenCalledWith('n.isRead = :isRead', { isRead: false });
    });

    it('should not apply isRead filter when not provided', async () => {
      mockNotificationRepository.count.mockResolvedValue(0);

      const query: NotificationQueryDto = { page: 1, limit: 20 };
      await service.getUserNotifications(USER_ID, query);

      const andWhereCalls = mockQb.andWhere.mock.calls;
      const hasIsReadFilter = andWhereCalls.some(([sql]) => sql.includes('isRead'));
      expect(hasIsReadFilter).toBe(false);
    });
  });

  // ─── getUnreadCount ───────────────────────────────────────────────────────────
  describe('getUnreadCount()', () => {
    it('should return the count of unread notifications', async () => {
      mockNotificationRepository.count.mockResolvedValue(5);

      const count = await service.getUnreadCount(USER_ID);

      expect(count).toBe(5);
      expect(mockNotificationRepository.count).toHaveBeenCalledWith({
        where: { userId: USER_ID, isRead: false },
      });
    });
  });

  // ─── markAsRead ───────────────────────────────────────────────────────────────
  describe('markAsRead()', () => {
    it('should mark an unread notification as read', async () => {
      mockNotificationRepository.findOne.mockResolvedValue({ ...mockNotification });
      mockNotificationRepository.save.mockResolvedValue({ ...mockNotification, isRead: true });

      const result = await service.markAsRead(mockNotification.id, USER_ID);

      expect(result.isRead).toBe(true);
      expect(mockNotificationRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should return the notification unchanged if already read (idempotent)', async () => {
      mockNotificationRepository.findOne.mockResolvedValue({ ...mockReadNotification });

      const result = await service.markAsRead(mockReadNotification.id, USER_ID);

      expect(result.isRead).toBe(true);
      expect(mockNotificationRepository.save).not.toHaveBeenCalled();
    });

    it('should throw ResourceNotFoundException when notification does not exist', async () => {
      mockNotificationRepository.findOne.mockResolvedValue(null);

      await expect(service.markAsRead('bad-uuid', USER_ID)).rejects.toThrow(
        ResourceNotFoundException,
      );
    });

    it('should throw ForbiddenException when user does not own the notification', async () => {
      mockNotificationRepository.findOne.mockResolvedValue({ ...mockNotification });

      await expect(service.markAsRead(mockNotification.id, OTHER_USER_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ─── markAllAsRead ────────────────────────────────────────────────────────────
  describe('markAllAsRead()', () => {
    it('should bulk-update all unread notifications and return affected count', async () => {
      mockQb.execute.mockResolvedValue({ affected: 4 });

      const result = await service.markAllAsRead(USER_ID);

      expect(result.affected).toBe(4);
      expect(mockQb.execute).toHaveBeenCalledTimes(1);
    });

    it('should return 0 when there are no unread notifications', async () => {
      mockQb.execute.mockResolvedValue({ affected: 0 });

      const result = await service.markAllAsRead(USER_ID);

      expect(result.affected).toBe(0);
    });
  });

  // ─── deleteNotification ───────────────────────────────────────────────────────
  describe('deleteNotification()', () => {
    it('should delete a notification the user owns', async () => {
      mockNotificationRepository.findOne.mockResolvedValue({ ...mockNotification });
      mockNotificationRepository.remove.mockResolvedValue(undefined);

      await service.deleteNotification(mockNotification.id, USER_ID);

      expect(mockNotificationRepository.remove).toHaveBeenCalledTimes(1);
    });

    it('should throw ResourceNotFoundException when notification not found', async () => {
      mockNotificationRepository.findOne.mockResolvedValue(null);

      await expect(service.deleteNotification('bad-uuid', USER_ID)).rejects.toThrow(
        ResourceNotFoundException,
      );
    });

    it('should throw ForbiddenException when user does not own the notification', async () => {
      mockNotificationRepository.findOne.mockResolvedValue({ ...mockNotification });

      await expect(service.deleteNotification(mockNotification.id, OTHER_USER_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ─── deleteAllRead ────────────────────────────────────────────────────────────
  describe('deleteAllRead()', () => {
    it('should delete all read notifications and return deleted count', async () => {
      mockQb.execute.mockResolvedValue({ affected: 7 });

      const result = await service.deleteAllRead(USER_ID);

      expect(result.deleted).toBe(7);
      expect(mockQb.execute).toHaveBeenCalledTimes(1);
    });
  });
});
