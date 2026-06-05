import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { TypingDto } from './dto/typing.dto';
import { User } from '../auth/entities/user.entity';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { NotificationService } from '../notifications/notification.service';
import { EmailService } from '../email/email.service';

@WebSocketGateway({
  cors: {
    origin: (origin: string, callback: Function) => {
      callback(null, true); // Origin validation happens in CORS config
    },
    credentials: true,
  },
  namespace: '/',
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  // socket.id → User mapping
  private readonly socketUserMap = new Map<string, User>();
  // userId → Set of socket.ids (user can have multiple tabs open)
  private readonly userSocketsMap = new Map<string, Set<string>>();
  // conversationId → typing timer
  private readonly typingTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly notificationService: NotificationService,
    private readonly emailService: EmailService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  // ─── Gateway Init ─────────────────────────────────────────────────────────────
  afterInit(server: Server) {
    this.logger.log('🔌 ChatGateway initialized');
  }

  // ─── Handle Connection ────────────────────────────────────────────────────────
  async handleConnection(client: Socket) {
    try {
      const user = await this.authenticateSocket(client);
      if (!user) {
        client.emit('error', { message: 'Authentication failed' });
        client.disconnect(true);
        return;
      }

      // Store mappings
      this.socketUserMap.set(client.id, user);
      if (!this.userSocketsMap.has(user.id)) {
        this.userSocketsMap.set(user.id, new Set());
      }
      this.userSocketsMap.get(user.id)!.add(client.id);

      this.logger.log(`Client connected: ${client.id} → user ${user.email}`);

      // Notify others that user is online
      client.broadcast.emit('userOnline', { userId: user.id, online: true });

      // Join a personal room for targeted notifications
      client.join(`user:${user.id}`);
    } catch (err) {
      this.logger.warn(`Connection rejected: ${err.message}`);
      client.disconnect(true);
    }
  }

  // ─── Handle Disconnect ────────────────────────────────────────────────────────
  handleDisconnect(client: Socket) {
    const user = this.socketUserMap.get(client.id);

    if (user) {
      this.socketUserMap.delete(client.id);
      const sockets = this.userSocketsMap.get(user.id);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.userSocketsMap.delete(user.id);
          // All tabs closed — notify others
          this.server.emit('userOnline', { userId: user.id, online: false });
        }
      }
    }

    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // ─── Send Message ─────────────────────────────────────────────────────────────
  @SubscribeMessage('sendMessage')
  async handleSendMessage(@ConnectedSocket() client: Socket, @MessageBody() payload: any) {
    const user = this.socketUserMap.get(client.id);
    if (!user) throw new WsException('Not authenticated');

    // Validate payload
    const dto = plainToInstance(SendMessageDto, payload);
    const errors = await validate(dto);
    if (errors.length) {
      throw new WsException(errors.map((e) => Object.values(e.constraints || {})).flat());
    }

    // Verify sender is participant
    const { conversation } = await this.chatService.getConversationById(dto.conversationId, user);

    // Join room if not already joined
    client.join(`conversation:${conversation.id}`);

    // Save message to DB
    const message = await this.chatService.saveMessage(
      dto.conversationId,
      user.id,
      dto.content,
      dto.fileUrl,
    );

    // Broadcast to the room
    this.server.to(`conversation:${conversation.id}`).emit('messageReceived', {
      message,
      conversationId: conversation.id,
    });

    // Persist notification + emit real-time event to recipient
    const recipientId =
      user.id === conversation.adminId ? conversation.clientId : conversation.adminId;

    const preview = dto.content ? dto.content.substring(0, 100) : '📎 File attachment';

    const notification = await this.notificationService.createMessageNotification(
      recipientId,
      user.name,
      preview,
      message.id,
    );

    this.server.to(`user:${recipientId}`).emit('notificationNew', {
      notification,
      conversationId: conversation.id,
      senderId: user.id,
    });

    // Queue email notification (fire-and-forget — errors logged by EmailProcessor)
    const recipient = await this.userRepository.findOne({ where: { id: recipientId } });
    if (recipient?.email) {
      const dashboardUrl = `${this.configService.get<string>('BASE_URL') || 'https://handla.com'}/dashboard/conversations/${conversation.id}`;

      await this.emailService.queueMessageNotification({
        recipientEmail: recipient.email,
        recipientName: recipient.name,
        senderName: user.name,
        messagePreview: preview,
        conversationId: conversation.id,
        dashboardUrl,
      });
    }

    this.logger.log(`Message from ${user.email} in conv ${conversation.id}`);
    return { success: true, message };
  }

  // ─── Mark As Read ─────────────────────────────────────────────────────────────
  @SubscribeMessage('markAsRead')
  async handleMarkAsRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { messageId?: string; conversationId?: string },
  ) {
    const user = this.socketUserMap.get(client.id);
    if (!user) throw new WsException('Not authenticated');

    if (payload.conversationId) {
      await this.chatService.markAllAsRead(payload.conversationId, user.id);
      this.server
        .to(`conversation:${payload.conversationId}`)
        .emit('messagesRead', { conversationId: payload.conversationId, userId: user.id });
    } else if (payload.messageId) {
      const message = await this.chatService.markMessageAsRead(payload.messageId, user.id);
      this.server
        .to(`conversation:${message.conversationId}`)
        .emit('messageRead', { messageId: message.id, userId: user.id });
    }

    return { success: true };
  }

  // ─── Typing Indicator ─────────────────────────────────────────────────────────
  @SubscribeMessage('typing')
  async handleTyping(@ConnectedSocket() client: Socket, @MessageBody() payload: any) {
    const user = this.socketUserMap.get(client.id);
    if (!user) throw new WsException('Not authenticated');

    const dto = plainToInstance(TypingDto, payload);
    const errors = await validate(dto);
    if (errors.length) return;

    const key = `${user.id}:${dto.conversationId}`;

    // Broadcast to conversation room (excluding sender)
    client.to(`conversation:${dto.conversationId}`).emit('userTyping', {
      userId: user.id,
      userName: user.name,
      conversationId: dto.conversationId,
      isTyping: dto.isTyping,
    });

    // Auto-clear typing indicator after 3 seconds
    if (dto.isTyping) {
      if (this.typingTimers.has(key)) {
        clearTimeout(this.typingTimers.get(key)!);
      }
      const timer = setTimeout(() => {
        client.to(`conversation:${dto.conversationId}`).emit('userTyping', {
          userId: user.id,
          userName: user.name,
          conversationId: dto.conversationId,
          isTyping: false,
        });
        this.typingTimers.delete(key);
      }, 3000);
      this.typingTimers.set(key, timer);
    } else {
      if (this.typingTimers.has(key)) {
        clearTimeout(this.typingTimers.get(key)!);
        this.typingTimers.delete(key);
      }
    }
  }

  // ─── Join Conversation Room ───────────────────────────────────────────────────
  @SubscribeMessage('joinConversation')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ) {
    const user = this.socketUserMap.get(client.id);
    if (!user) throw new WsException('Not authenticated');

    // Validate access
    await this.chatService.getConversationById(payload.conversationId, user);

    client.join(`conversation:${payload.conversationId}`);

    // Mark all unread messages as read
    await this.chatService.markAllAsRead(payload.conversationId, user.id);

    this.logger.log(`${user.email} joined room conversation:${payload.conversationId}`);
    return { success: true };
  }

  // ─── Leave Conversation Room ──────────────────────────────────────────────────
  @SubscribeMessage('leaveConversation')
  handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ) {
    client.leave(`conversation:${payload.conversationId}`);
    return { success: true };
  }

  // ─── Public helper: emit to a user's personal room ───────────────────────────
  emitToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  // ─── Public helper: broadcast a message to a conversation room ───────────────
  // Called by ChatController after a REST-based message save so that all
  // participants in the room receive the real-time push without the gateway
  // saving the message a second time (which would cause the double-send bug).
  broadcastMessage(conversationId: string, message: any) {
    this.server
      .to(`conversation:${conversationId}`)
      .emit('messageReceived', { message, conversationId });
  }

  // ─── Auth helper ─────────────────────────────────────────────────────────────
  private async authenticateSocket(client: Socket): Promise<User | null> {
    let token: string | undefined;

    // Try cookie
    const cookieHeader = client.handshake.headers?.cookie;
    if (cookieHeader) {
      const cookies: Record<string, string> = {};
      cookieHeader.split(';').forEach((c) => {
        const [k, ...v] = c.trim().split('=');
        cookies[k.trim()] = v.join('=');
      });
      token = cookies['access_token'];
    }

    // Try auth header / handshake.auth
    if (!token) {
      const authHeader = client.handshake.headers?.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.slice(7);
      }
    }
    if (!token) {
      token = client.handshake.auth?.token;
    }

    if (!token) return null;

    try {
      const payload: JwtPayload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('jwt.secret'),
      });

      const user = await this.userRepository.findOne({ where: { id: payload.sub } });
      return user ?? null;
    } catch {
      return null;
    }
  }
}
