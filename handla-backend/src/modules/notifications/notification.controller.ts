import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth, ApiQuery } from '@nestjs/swagger';

import { NotificationService } from './notification.service';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { User } from '../auth/entities/user.entity';

@ApiTags('notifications')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  // ─── GET /api/notifications ───────────────────────────────────────────────────
  // IMPORTANT: all literal-path routes (unread-count, read-all, read) MUST be
  // declared BEFORE /:id so that NestJS/Express does not swallow them as a UUID
  // param and feed "unread-count" / "read-all" / "read" into ParseUUIDPipe.
  @Get()
  @ApiOperation({ summary: 'Get paginated notifications for the current user' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'isRead', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Paginated notifications with unread count' })
  async getNotifications(@CurrentUser() user: User, @Query() query: NotificationQueryDto) {
    const result = await this.notificationService.getUserNotifications(user.id, query);
    return { message: 'Notifications retrieved', data: result };
  }

  // ─── GET /api/notifications/unread-count ─────────────────────────────────────
  // MUST be before /:id — otherwise "unread-count" is parsed as a UUID and fails
  @Get('unread-count')
  @ApiOperation({ summary: 'Get count of unread notifications (for badge)' })
  @ApiResponse({ status: 200, description: 'Unread notification count' })
  async getUnreadCount(@CurrentUser() user: User) {
    const count = await this.notificationService.getUnreadCount(user.id);
    return { message: 'Unread count retrieved', data: { unreadCount: count } };
  }

  // ─── PATCH /api/notifications/read-all ───────────────────────────────────────
  // MUST be before /:id/read — otherwise "read-all" is parsed as a UUID
  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all unread notifications as read' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  async markAllAsRead(@CurrentUser() user: User) {
    const result = await this.notificationService.markAllAsRead(user.id);
    return {
      message: `${result.affected} notification(s) marked as read`,
      data: result,
    };
  }

  // ─── DELETE /api/notifications/read ──────────────────────────────────────────
  // MUST be before /:id — otherwise "read" is parsed as a UUID and fails
  @Delete('read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete all read notifications for the current user' })
  @ApiResponse({ status: 200, description: 'Read notifications deleted' })
  async deleteAllRead(@CurrentUser() user: User) {
    const result = await this.notificationService.deleteAllRead(user.id);
    return {
      message: `${result.deleted} read notification(s) deleted`,
      data: result,
    };
  }

  // ─── PATCH /api/notifications/:id/read ───────────────────────────────────────
  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a specific notification as read' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async markAsRead(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    const notification = await this.notificationService.markAsRead(id, user.id);
    return { message: 'Notification marked as read', data: { notification } };
  }

  // ─── GET /api/notifications/:id ──────────────────────────────────────────────
  // NOTE: keep param routes LAST so literal paths win
  @Get(':id')
  @ApiOperation({ summary: 'Get a single notification by ID' })
  @ApiResponse({ status: 200, description: 'Notification retrieved' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async getOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    const notification = await this.notificationService.getOne(id, user.id);
    return { message: 'Notification retrieved', data: { notification } };
  }

  // ─── DELETE /api/notifications/:id ───────────────────────────────────────────
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a specific notification' })
  @ApiResponse({ status: 200, description: 'Notification deleted' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async deleteNotification(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    await this.notificationService.deleteNotification(id, user.id);
    return { message: 'Notification deleted' };
  }
}
