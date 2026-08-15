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
import { forwardRef, Inject, Logger, OnModuleInit, UseGuards } from '@nestjs/common';
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
import { ChatbotService } from '../ai/services/chatbot.service';

@WebSocketGateway({
  cors: {
    origin: (origin: string, callback: Function) => {
      callback(null, true); // Origin validation happens in CORS config
    },
    credentials: true,
  },
  namespace: '/',
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
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
    @Inject(forwardRef(() => ChatbotService))
    private readonly chatbotService: ChatbotService,
  ) {}

  // ─── Gateway Init ─────────────────────────────────────────────────────────────
  afterInit(server: Server) {
    this.logger.log('🔌 ChatGateway initialized');
  }

  // Register the AI reply delivery channel so the assistant pushes messages
  // through the SAME broadcast path human messages use (no parallel pipeline).
  onModuleInit() {
    this.chatbotService.registerBroadcast((conversationId, message) => {
      this.broadcastMessage(conversationId, message);
    });
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

    // Persist notification + emit real-time event to recipient + queue email
    await this.notifyMessageRecipient({
      conversation,
      senderUser: user,
      messageId: message.id,
      content: dto.content,
    });

    // AI-1: let the assistant react to this message (layered on top; never
    // blocks or breaks the chat flow — it gates internally on takeover/role/config).
    void this.chatbotService.handleIncomingMessage({
      conversation,
      senderUser: user,
      message,
    });

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

  // ─── Public helper: let the AI assistant react to a REST-sent message ────────
  //
  // Text messages are sent via the REST endpoint
  // `POST /chat/conversations/:id/messages` (only file uploads go over the
  // WebSocket `sendMessage` handler). The AI trigger originally lived ONLY in
  // the WebSocket handler, so text messages never invoked the assistant — the
  // bot appeared to "never reply". This passthrough gives the REST controller
  // the same hook. It never throws/blocks (fire-and-forget) and the chatbot
  // gates internally on takeover / role / config, so it's safe on every message.
  triggerAiReply(params: {
    conversation: import('./entities/conversation.entity').Conversation;
    senderUser: User;
    message: import('./entities/message.entity').Message;
  }): void {
    void this.chatbotService.handleIncomingMessage(params);
  }

  // ─── Public helper: notify the conversation recipient about a new message ───
  //
  // Used by BOTH the WebSocket `sendMessage` handler AND the REST
  // `POST /chat/conversations/:id/messages` endpoint so that the notification
  // bell updates in real time and an email gets queued regardless of which
  // transport the client used to send the message.
  //
  // Before this helper existed, only the WebSocket path created notifications,
  // which meant text messages (sent via REST) NEVER triggered the bell, while
  // file uploads (sent via socket) did — causing the "bell doesn't ring for
  // messages" bug.
  async notifyMessageRecipient(params: {
    conversation: { id: string; adminId: string; clientId: string; assignedEmployeeId?: string | null };
    senderUser: { id: string; name: string; email?: string };
    messageId: string;
    content?: string | null;
  }): Promise<void> {
    const { conversation, senderUser, messageId, content } = params;

    // Determine the recipient.
    //   - If sender is the client → recipient is the assigned employee if any,
    //     otherwise the admin.
    //   - If sender is the assigned employee → recipient is the client.
    //   - If sender is the admin → recipient is the assigned employee if any,
    //     otherwise the client.
    // This keeps the existing 1:1 bell-notification semantics while gracefully
    // routing to the EMPLOYEE who actually owns the conversation when present.
    let recipientId: string;
    if (senderUser.id === conversation.clientId) {
      recipientId = conversation.assignedEmployeeId || conversation.adminId;
    } else if (
      conversation.assignedEmployeeId &&
      senderUser.id === conversation.assignedEmployeeId
    ) {
      recipientId = conversation.clientId;
    } else if (senderUser.id === conversation.adminId) {
      recipientId = conversation.assignedEmployeeId || conversation.clientId;
    } else {
      // Sender is not a known participant — nothing sensible to notify.
      this.logger.warn(
        `notifyMessageRecipient: sender ${senderUser.id} is not a participant of conv ${conversation.id}`,
      );
      return;
    }

    // Don't notify yourself (defensive — shouldn't happen but guards against
    // future code paths that could feed back to the same user).
    if (recipientId === senderUser.id) return;

    const preview = content ? content.substring(0, 100) : '📎 File attachment';

    // 1. Persist in-app notification record (this is what feeds the bell list
    //    when the bell polls / re-fetches via React Query).
    let notification;
    try {
      notification = await this.notificationService.createMessageNotification(
        recipientId,
        senderUser.name,
        preview,
        messageId,
        conversation.id, // stored on relatedEntityId for deep-link navigation
      );
    } catch (err) {
      this.logger.error(
        `Failed to create message notification for user ${recipientId}: ${(err as Error).message}`,
      );
      return;
    }

    // 2. Real-time push to the recipient's personal socket room.
    //    The frontend's `useSocket` listens for `notificationNew` and pushes
    //    the new item into the Zustand store, which instantly updates the
    //    bell badge + unread count — no polling latency.
    this.server.to(`user:${recipientId}`).emit('notificationNew', {
      notification,
      conversationId: conversation.id,
      senderId: senderUser.id,
    });

    // 3. Fire-and-forget email notification.
    try {
      const recipient = await this.userRepository.findOne({ where: { id: recipientId } });
      if (recipient?.email) {
        const dashboardUrl = `${
          this.configService.get<string>('BASE_URL') || 'https://handla.com'
        }/dashboard/conversations/${conversation.id}`;

        await this.emailService.queueMessageNotification({
          recipientEmail: recipient.email,
          recipientName: recipient.name,
          senderName: senderUser.name,
          messagePreview: preview,
          conversationId: conversation.id,
          dashboardUrl,
        });
      }
    } catch (err) {
      // Non-fatal — log only. The in-app notification has already gone out.
      this.logger.warn(
        `Failed to queue message email for user ${recipientId}: ${(err as Error).message}`,
      );
    }
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
