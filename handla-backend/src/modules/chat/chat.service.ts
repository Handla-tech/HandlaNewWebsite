import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';

import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { User } from '../auth/entities/user.entity';
import { AwsService } from '../aws/aws.service';
import { UserRole, ConversationStatus, MessageOrigin } from '../../common/enums';
import {
  ResourceNotFoundException,
  ConversationAccessDeniedException,
} from '../../utils/exceptions';

/**
 * Returns true if the given error is a MySQL/MariaDB unique-constraint
 * violation (errno 1062 / code 'ER_DUP_ENTRY'). Used by createOrGetConversation
 * to recover from concurrent INSERTs racing for the same (clientId, adminId).
 */
function isDuplicateKeyError(err: unknown): boolean {
  if (!err) return false;
  const e = err as { code?: string; errno?: number; driverError?: { code?: string; errno?: number } };
  // TypeORM wraps the native driver error in QueryFailedError; check both layers
  const code  = e.code  ?? e.driverError?.code;
  const errno = e.errno ?? e.driverError?.errno;
  return code === 'ER_DUP_ENTRY' || errno === 1062;
}

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
    private readonly awsService: AwsService,
  ) {}

  /**
   * Replace a message's stored (plain/private) fileUrl with a short-lived
   * presigned GET URL so the browser can actually view the attachment. Mutates
   * and returns the same message object. Safe when fileUrl is null.
   */
  private async withSignedFileUrl<T extends { fileUrl?: string | null } | null>(
    message: T,
  ): Promise<T> {
    if (message && message.fileUrl) {
      message.fileUrl = await this.awsService.signFileUrl(message.fileUrl);
    }
    return message;
  }

  /** Sign fileUrl on every message in a list (in place). */
  private async signMessages<T extends { fileUrl?: string | null }>(messages: T[]): Promise<T[]> {
    await Promise.all(messages.map((m) => this.withSignedFileUrl(m)));
    return messages;
  }

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
        await this.withSignedFileUrl(lastMessage);

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
    await this.signMessages(messages);

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

    const messages = await this.messageRepo.find({
      where: { conversationId: id },
      relations: ['sender'],
      order: { createdAt: 'ASC' },
    });
    return this.signMessages(messages);
  }

  // ─── Send Message (REST fallback) ─────────────────────────────────────────────
  //
  // Returns BOTH the saved message AND the conversation row so the caller
  // (ChatController) can broadcast + notify the recipient without re-querying
  // the conversation a second time.
  async sendMessage(
    conversationId: string,
    user: User,
    content?: string,
    fileUrl?: string,
  ): Promise<{ message: Message; conversation: Conversation }> {
    const conversation = await this.conversationRepo.findOne({
      where: { id: conversationId },
      relations: ['admin', 'client'],
    });

    if (!conversation) {
      throw new ResourceNotFoundException('Conversation', conversationId);
    }

    this.assertAccess(conversation, user);

    const message = await this.saveMessage(conversationId, user.id, content, fileUrl);
    return { message, conversation };
  }

  // ─── Create or Get Conversation ───────────────────────────────────────────────
  //
  // Race-safe upsert for the (clientId, adminId) pair guarded by the unique
  // index `uq_conversations_client_admin`.
  //
  // Why the previous "findOne + transaction + re-check" pattern was NOT enough:
  //   MySQL's default isolation level is REPEATABLE READ. A SELECT inside a
  //   transaction reads from the snapshot taken when the transaction began
  //   and therefore CANNOT see rows that another concurrent transaction has
  //   inserted (committed or not). If two requests race — which happens on
  //   first signup when the dashboard mounts twice in React strict-mode, or
  //   when two tabs are opened back-to-back — both transactions see "no row
  //   exists", both try to INSERT, and the second one explodes with
  //   ER_DUP_ENTRY for `uq_conversations_client_admin`.
  //
  // The fix below has THREE layers of defence:
  //   1. Fast path:    a plain findOne outside any tx returns the row in
  //                    99% of calls (the common case after first signup).
  //   2. Try-INSERT:   we attempt the INSERT directly. If it succeeds we win
  //                    the race. If it fails with ER_DUP_ENTRY we know
  //                    SOMEONE ELSE just committed the row.
  //   3. Recover:      after a duplicate-key failure we re-read the row that
  //                    the other transaction committed and return it as if
  //                    we had created it ourselves. This makes the endpoint
  //                    idempotent — callers never see a 500.
  async createOrGetConversation(clientId: string, adminId: string): Promise<Conversation> {
    // 1. Fast path — existing row.
    const existing = await this.conversationRepo.findOne({
      where: { clientId, adminId },
      relations: ['admin', 'client'],
    });
    if (existing) {
      this.logger.log(
        `Conversation already exists: client=${clientId}, admin=${adminId}, id=${existing.id}`,
      );
      return existing;
    }

    // 2. Try to INSERT. If two callers race in here at the same time, ONE
    //    of them will succeed and the other will hit the unique constraint.
    const conversation = this.conversationRepo.create({
      clientId,
      adminId,
      status: ConversationStatus.ACTIVE,
    });

    try {
      await this.conversationRepo.save(conversation);
      this.logger.log(
        `Conversation created: client=${clientId}, admin=${adminId}, id=${conversation.id}`,
      );
      // Reload with participant relations so callers (e.g. the client's first
      // dashboard load) immediately get `admin`/`client` populated. Without
      // this, a freshly-saved entity has no relations and the chat header
      // renders "Loading…" until a manual refresh hits a join-based endpoint.
      return await this.reloadWithParticipants(conversation.id);
    } catch (err) {
      // 3. Recover from race: another request just won the INSERT — re-read.
      if (err instanceof QueryFailedError && isDuplicateKeyError(err)) {
        const winner = await this.conversationRepo.findOne({
          where: { clientId, adminId },
          relations: ['admin', 'client'],
        });
        if (winner) {
          this.logger.log(
            `Conversation race resolved (recovered from ER_DUP_ENTRY): ` +
            `client=${clientId}, admin=${adminId}, id=${winner.id}`,
          );
          return winner;
        }
        // Extremely unlikely: duplicate-key error but row not found on re-read.
        // Fall through to rethrow with extra context.
        this.logger.error(
          `ER_DUP_ENTRY raised for client=${clientId}, admin=${adminId} but ` +
          `no matching row was found on re-read. This indicates a corrupted ` +
          `unique index or a non-conversation table conflict.`,
        );
      }
      // Not a duplicate-key error (or recovery failed): propagate.
      throw err;
    }
  }

  // Reload a conversation with its participant relations populated. Used after
  // an INSERT so the returned entity carries `admin`/`client` (the chat header
  // needs the other participant's name/avatar immediately, not after refresh).
  // Falls back to a relation-less findOneByOrFail-equivalent if the row somehow
  // can't be re-read (should never happen right after a successful save).
  private async reloadWithParticipants(id: string): Promise<Conversation> {
    const reloaded = await this.conversationRepo.findOne({
      where: { id },
      relations: ['admin', 'client'],
    });
    if (reloaded) return reloaded;
    // Extremely defensive: return the bare row rather than throwing.
    return this.conversationRepo.findOneByOrFail({ id });
  }

  // ─── Save Message ─────────────────────────────────────────────────────────────
  async saveMessage(
    conversationId: string,
    senderId: string,
    content?: string,
    fileUrl?: string,
    origin?: MessageOrigin,
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
      origin: origin ?? null,
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

    // Return a presigned GET URL (the DB keeps the raw/private URL). This covers
    // BOTH the REST sendMessage path and the WebSocket gateway broadcast, so the
    // sender and recipient can view the attachment immediately without a refetch.
    return this.withSignedFileUrl(saved!);
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

  // ─── Public membership assertion (lightweight) ───────────────────────────────
  //
  // Loads ONLY the conversation row (no messages / no signed URLs) and throws
  // if `user` is not a participant. Used by real-time WebSocket handlers
  // (markAsRead, typing) that must enforce room membership on the server
  // BEFORE acting, but do not need the full message list that
  // getConversationById() returns. Prevents cross-conversation IDOR/BOLA:
  // an authenticated user cannot mark another user's conversation as read or
  // inject a typing indicator into a room they are not part of.
  async assertConversationMembership(conversationId: string, user: User): Promise<void> {
    const conversation = await this.conversationRepo.findOne({
      where: { id: conversationId },
    });
    if (!conversation) {
      throw new ResourceNotFoundException('Conversation', conversationId);
    }
    this.assertAccess(conversation, user);
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
