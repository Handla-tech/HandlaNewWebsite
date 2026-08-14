import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Notification } from './entities/notification.entity';
import { PushService } from './push.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { NotificationType } from '../../common/enums';
import { ResourceNotFoundException } from '../../utils/exceptions';

export interface PaginatedNotifications {
  notifications: Notification[];
  total: number;
  page: number;
  pages: number;
  unreadCount: number;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    private readonly pushService: PushService,
  ) {}

  // ─── Create Notification ─────────────────────────────────────────────────────
  async createNotification(dto: CreateNotificationDto): Promise<Notification> {
    const notification = this.notificationRepo.create({
      userId: dto.userId,
      type: dto.type,
      title: dto.title,
      message: dto.message,
      relatedMessageId: dto.relatedMessageId ?? null,
      relatedEntityId: dto.relatedEntityId ?? null,
      isRead: false,
    });

    const saved = await this.notificationRepo.save(notification);
    this.logger.log(
      `Notification created → user=${dto.userId} type=${dto.type} title="${dto.title}"`,
    );

    // Fire a native push to the recipient's registered devices. Best-effort:
    // PushService swallows its own errors so a delivery failure never breaks
    // notification creation. Includes the current unread count as the iOS badge.
    const unreadCount = await this.getUnreadCount(dto.userId).catch(() => undefined);
    void this.pushService.sendToUser(dto.userId, {
      title: dto.title,
      body: dto.message,
      badge: unreadCount,
      data: {
        type: dto.type,
        notificationId: saved.id,
        relatedEntityId: dto.relatedEntityId ?? null,
        relatedMessageId: dto.relatedMessageId ?? null,
      },
    });

    return saved;
  }

  // ─── Convenience factory methods ─────────────────────────────────────────────
  async createMessageNotification(
    recipientId: string,
    senderName: string,
    preview: string,
    relatedMessageId?: string,
    /**
     * Conversation the message belongs to. Stored on `relatedEntityId` so the
     * frontend can deep-link the notification click straight to that chat
     * (otherwise we'd lose the conversation context and could only ever
     * navigate to /dashboard).
     */
    conversationId?: string,
  ): Promise<Notification> {
    return this.createNotification({
      userId: recipientId,
      type: NotificationType.MESSAGE,
      title: `New message from ${senderName}`,
      message: preview.length > 200 ? `${preview.substring(0, 197)}…` : preview,
      relatedMessageId,
      relatedEntityId: conversationId,
    });
  }

  async createSystemNotification(
    userId: string,
    title: string,
    message: string,
  ): Promise<Notification> {
    return this.createNotification({
      userId,
      type: NotificationType.SYSTEM,
      title,
      message,
    });
  }

  // ─── ERP-9 typed factory methods ──────────────────────────────────────────────

  async createErpNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    relatedEntityId?: string,
  ): Promise<Notification> {
    return this.createNotification({ userId, type, title, message, relatedEntityId });
  }

  // ─── Get User Notifications ───────────────────────────────────────────────────
  async getUserNotifications(
    userId: string,
    query: NotificationQueryDto,
  ): Promise<PaginatedNotifications> {
    const { page = 1, limit = 20, isRead } = query;
    const skip = (page - 1) * limit;

    const qb = this.notificationRepo
      .createQueryBuilder('n')
      .where('n.userId = :userId', { userId })
      .orderBy('n.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (isRead !== undefined) {
      qb.andWhere('n.isRead = :isRead', { isRead });
    }

    const [notifications, total] = await qb.getManyAndCount();

    const unreadCount = await this.getUnreadCount(userId);

    return {
      notifications,
      total,
      page,
      pages: Math.ceil(total / limit),
      unreadCount,
    };
  }

  // ─── Get Single Notification (ownership-checked) ─────────────────────────────
  async getOne(notificationId: string, userId: string): Promise<Notification> {
    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new ResourceNotFoundException('Notification', notificationId);
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException('Cannot access this notification');
    }

    return notification;
  }

  // ─── Get Unread Count ─────────────────────────────────────────────────────────
  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepo.count({
      where: { userId, isRead: false },
    });
  }

  // ─── Mark Single Notification As Read ────────────────────────────────────────
  async markAsRead(notificationId: string, userId: string): Promise<Notification> {
    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new ResourceNotFoundException('Notification', notificationId);
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException('Cannot access this notification');
    }

    if (notification.isRead) {
      return notification; // Already read — idempotent
    }

    notification.isRead = true;
    const updated = await this.notificationRepo.save(notification);
    this.logger.debug(`Notification ${notificationId} marked as read by user ${userId}`);
    return updated;
  }

  // ─── Mark All As Read ─────────────────────────────────────────────────────────
  async markAllAsRead(userId: string): Promise<{ affected: number }> {
    const result = await this.notificationRepo
      .createQueryBuilder()
      .update(Notification)
      .set({ isRead: true })
      .where('userId = :userId', { userId })
      .andWhere('isRead = false')
      .execute();

    const affected = result.affected ?? 0;
    this.logger.log(`Marked ${affected} notifications as read for user ${userId}`);
    return { affected };
  }

  // ─── Delete Notification ──────────────────────────────────────────────────────
  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new ResourceNotFoundException('Notification', notificationId);
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException('Cannot delete this notification');
    }

    await this.notificationRepo.remove(notification);
    this.logger.debug(`Notification ${notificationId} deleted by user ${userId}`);
  }

  // ─── Delete All Read Notifications (cleanup) ──────────────────────────────────
  async deleteAllRead(userId: string): Promise<{ deleted: number }> {
    const result = await this.notificationRepo
      .createQueryBuilder()
      .delete()
      .from(Notification)
      .where('userId = :userId', { userId })
      .andWhere('isRead = true')
      .execute();

    return { deleted: result.affected ?? 0 };
  }
}
