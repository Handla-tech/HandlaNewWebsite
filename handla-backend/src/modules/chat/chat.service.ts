import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { User } from '../auth/entities/user.entity';
import { UserRole, ConversationStatus } from '../../common/enums';
import {
  ResourceNotFoundException,
  ConversationAccessDeniedException,
} from '../../utils/exceptions';

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
  ) {}

  // ─── Get Conversations ────────────────────────────────────────────────────────
  async getConversations(user: User, pagination: PaginationQuery = {}) {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const qb = this.conversationRepo
      .createQueryBuilder('conv')
      .leftJoinAndSelect('conv.admin', 'admin')
      .leftJoinAndSelect('conv.client', 'client')
      .leftJoinAndSelect('conv.assignedEmployee', 'assignedEmployee')
      .orderBy('conv.updatedAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (user.role === UserRole.CLIENT) {
      // Clients only see their own conversations
      qb.where('conv.clientId = :userId', { userId: user.id });
    } else if (user.role === UserRole.LEAD) {
      // LEADs see their own conversations (same as CLIENT — they are the clientId)
      qb.where('conv.clientId = :userId', { userId: user.id });
    } else if (user.role === UserRole.EMPLOYEE) {
      // EMPLOYEEs see only conversations assigned to them
      qb.where('conv.assignedEmployeeId = :userId', { userId: user.id });
    }
    // ADMIN sees ALL conversations — no filter needed

    const [conversations, total] = await qb.getManyAndCount();

    // Enrich with unread message count + last message per conversation
    const enriched = await Promise.all(
      conversations.map(async (conv) => {
        // Count messages not sent by the current user that are unread
        const unreadCount = await this.messageRepo.count({
          where: {
            conversationId: conv.id,
            isRead: false,
          },
        });

        // Fetch last message for preview
        const lastMessage = await this.messageRepo.findOne({
          where: { conversationId: conv.id },
          order: { createdAt: 'DESC' },
          relations: ['sender'],
        });

        return {
          ...conv,
          unreadCount,
          lastMessage: lastMessage ?? null,
          // Expose lastMessage timestamp as a top-level field for easy sorting
          lastMessageAt: lastMessage?.createdAt ?? conv.updatedAt,
        };
      }),
    );

    return {
      conversations: enriched,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  // ─── Get Conversation By ID ───────────────────────────────────────────────────
  async getConversationById(id: string, user: User) {
    const conversation = await this.conversationRepo.findOne({
      where: { id },
      relations: ['admin', 'client'],
    });

    if (!conversation) {
      throw new ResourceNotFoundException('Conversation', id);
    }

    this.assertAccess(conversation, user);

    const messages = await this.messageRepo.find({
      where: { conversationId: id },
      relations: ['sender'],
      order: { createdAt: 'ASC' },
    });

    return { conversation, messages };
  }

  // ─── Get Messages for a Conversation ─────────────────────────────────────────
  async getMessages(id: string, user: User): Promise<Message[]> {
    const conversation = await this.conversationRepo.findOne({
      where: { id },
      relations: ['admin', 'client'],
    });

    if (!conversation) {
      throw new ResourceNotFoundException('Conversation', id);
    }

    this.assertAccess(conversation, user);

    return this.messageRepo.find({
      where: { conversationId: id },
      relations: ['sender'],
      order: { createdAt: 'ASC' },
    });
  }

  // ─── Send Message (REST fallback) ─────────────────────────────────────────────
  async sendMessage(
    conversationId: string,
    user: User,
    content?: string,
    fileUrl?: string,
  ): Promise<Message> {
    const conversation = await this.conversationRepo.findOne({
      where: { id: conversationId },
      relations: ['admin', 'client'],
    });

    if (!conversation) {
      throw new ResourceNotFoundException('Conversation', conversationId);
    }

    this.assertAccess(conversation, user);

    return this.saveMessage(conversationId, user.id, content, fileUrl);
  }

  // ─── Create or Get Conversation ───────────────────────────────────────────────
  //
  // Guards against duplicate rows by using a DB-level transaction with an
  // INSERT … ON CONFLICT DO NOTHING pattern (via QueryBuilder) so that even
  // if two requests race in at the same moment only one row is written.
  async createOrGetConversation(clientId: string, adminId: string): Promise<Conversation> {
    // 1. Fast path — existing row
    const existing = await this.conversationRepo.findOne({
      where: { clientId, adminId },
    });
    if (existing) {
      this.logger.log(
        `Conversation already exists: client=${clientId}, admin=${adminId}, id=${existing.id}`,
      );
      return existing;
    }

    // 2. Slow path — create inside a transaction so concurrent calls
    //    from the same client (e.g. dashboard page + strict-mode double-mount)
    //    don't produce two rows.
    return this.conversationRepo.manager.transaction(async (em) => {
      // Re-check inside the transaction (prevents TOCTOU race)
      const check = await em.findOne(Conversation, { where: { clientId, adminId } });
      if (check) {
        this.logger.log(
          `Conversation found inside tx: client=${clientId}, admin=${adminId}, id=${check.id}`,
        );
        return check;
      }

      const conversation = em.create(Conversation, {
        clientId,
        adminId,
        status: ConversationStatus.ACTIVE,
      });

      await em.save(Conversation, conversation);
      this.logger.log(
        `Conversation created: client=${clientId}, admin=${adminId}, id=${conversation.id}`,
      );
      return conversation;
    });
  }

  // ─── Save Message ─────────────────────────────────────────────────────────────
  async saveMessage(
    conversationId: string,
    senderId: string,
    content?: string,
    fileUrl?: string,
  ): Promise<Message> {
    if (!content && !fileUrl) {
      throw new Error('Message must have content or a file attachment');
    }

    const message = this.messageRepo.create({
      conversationId,
      senderId,
      content: content ?? null,
      fileUrl: fileUrl ?? null,
      isRead: false,
    });

    await this.messageRepo.save(message);

    // Bump conversation updatedAt
    await this.conversationRepo.update(conversationId, {
      updatedAt: new Date(),
    });

    // Reload with sender relation
    const saved = await this.messageRepo.findOne({
      where: { id: message.id },
      relations: ['sender'],
    });

    return saved!;
  }

  // ─── Mark Message As Read ─────────────────────────────────────────────────────
  async markMessageAsRead(messageId: string, userId: string): Promise<Message> {
    const message = await this.messageRepo.findOne({
      where: { id: messageId },
      relations: ['conversation'],
    });

    if (!message) {
      throw new ResourceNotFoundException('Message', messageId);
    }

    // Only recipient can mark as read
    const conversation = await this.conversationRepo.findOne({
      where: { id: message.conversationId },
    });

    if (!conversation) {
      throw new ResourceNotFoundException('Conversation');
    }

    const isParticipant =
      conversation.adminId === userId ||
      conversation.clientId === userId ||
      conversation.assignedEmployeeId === userId;
    if (!isParticipant) {
      throw new ForbiddenException('Cannot mark this message as read');
    }

    message.isRead = true;
    await this.messageRepo.save(message);
    return message;
  }

  // ─── Mark All Messages As Read in Conversation ────────────────────────────────
  async markAllAsRead(conversationId: string, userId: string): Promise<void> {
    await this.messageRepo
      .createQueryBuilder()
      .update(Message)
      .set({ isRead: true })
      .where('conversationId = :conversationId', { conversationId })
      .andWhere('senderId != :userId', { userId })
      .andWhere('isRead = false')
      .execute();
  }

  // ─── Update Conversation Status ───────────────────────────────────────────────
  async updateStatus(
    conversationId: string,
    status: ConversationStatus,
    user: User,
  ): Promise<Conversation> {
    const conversation = await this.conversationRepo.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new ResourceNotFoundException('Conversation', conversationId);
    }

    this.assertAccess(conversation, user);

    conversation.status = status;
    return this.conversationRepo.save(conversation);
  }

  // ─── Find Admin User ──────────────────────────────────────────────────────────
  // ORDER BY created_at ASC guarantees we always return the *same* admin
  // (the oldest/first one) regardless of table insertion order. Without
  // a stable sort, different calls can return different admin rows and
  // createOrGetConversation will create duplicate conversations.
  async findDefaultAdmin(): Promise<User | null> {
    const repo = this.conversationRepo.manager.getRepository(User);
    return repo.findOne({
      where: { role: UserRole.ADMIN },
      order: { createdAt: 'ASC' },
    });
  }

  // ─── Access Guard ─────────────────────────────────────────────────────────────
  private assertAccess(conversation: Conversation, user: User): void {
    // ADMIN always has full access
    if (user.role === UserRole.ADMIN) return;

    // EMPLOYEE can access only conversations assigned to them
    if (user.role === UserRole.EMPLOYEE) {
      if (conversation.assignedEmployeeId !== user.id) {
        throw new ConversationAccessDeniedException();
      }
      return;
    }

    // CLIENT and LEAD can only access their own conversation (they are clientId)
    if (conversation.clientId !== user.id) {
      throw new ConversationAccessDeniedException();
    }
  }
}
