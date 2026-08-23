import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole, ConversationStatus, MessageOrigin } from '../../../common/enums';
import type { User } from '../../auth/entities/user.entity';
import type { Conversation } from '../entities/conversation.entity';
import type { Message } from '../entities/message.entity';

/**
 * PT-01 — Chat response data minimization.
 *
 * The chat REST endpoints used to serialize raw TypeORM `User` entities as the
 * conversation `admin`/`client`/`assignedEmployee` relations and as each
 * `message.sender`. Those raw entities carried EVERY column, including the
 * credential-bearing `passwordHash` (its `@Exclude()` decorator was inert
 * because no `ClassSerializerInterceptor` was active). Any authenticated
 * participant — including a self-signup LEAD — therefore received the
 * bcrypt `passwordHash` and other internal account state of the other
 * participants in every conversation/message response.
 *
 * These explicit projection DTOs are the PRIMARY fix: chat responses now
 * return ONLY the minimum participant fields the Handla frontend actually
 * renders. Credential material, verification/OAuth state, soft-delete/disable
 * flags and internal timestamps are structurally impossible to leak because
 * the mapper never copies them.
 *
 * Fields kept were derived from the real frontend consumers:
 *   - id, name, role                → chat header + message author label
 *   - avatarUrl                     → chat avatars
 *   - email                         → ERP admin conversation search
 *   - jobTitle, company             → participant presentation (EMPLOYEE/CLIENT)
 *
 * Explicitly NEVER exposed: passwordHash, emailVerifiedAt, provider,
 * providerId, isArchived, archivedAt, isDisabled, bio, phoneNumber, location,
 * createdAt/updatedAt, and all ORM relations.
 */
export class ChatParticipantDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: UserRole })
  role: UserRole;

  @ApiPropertyOptional({ nullable: true })
  email?: string | null;

  @ApiPropertyOptional({ nullable: true })
  avatarUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  jobTitle?: string | null;

  @ApiPropertyOptional({ nullable: true })
  company?: string | null;
}

export class ChatMessageDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  conversationId: string;

  @ApiProperty()
  senderId: string;

  @ApiPropertyOptional({ nullable: true })
  content: string | null;

  @ApiPropertyOptional({ nullable: true })
  fileUrl: string | null;

  @ApiProperty()
  isRead: boolean;

  @ApiPropertyOptional({ enum: MessageOrigin, nullable: true })
  origin: MessageOrigin | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({ type: () => ChatParticipantDto, nullable: true })
  sender?: ChatParticipantDto | null;
}

export class ChatConversationDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  adminId: string;

  @ApiProperty()
  clientId: string;

  @ApiPropertyOptional({ nullable: true })
  assignedEmployeeId: string | null;

  @ApiProperty({ enum: ConversationStatus })
  status: ConversationStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({ type: () => ChatParticipantDto, nullable: true })
  admin?: ChatParticipantDto | null;

  @ApiPropertyOptional({ type: () => ChatParticipantDto, nullable: true })
  client?: ChatParticipantDto | null;

  @ApiPropertyOptional({ type: () => ChatParticipantDto, nullable: true })
  assignedEmployee?: ChatParticipantDto | null;
}

export class ChatConversationListItemDto extends ChatConversationDto {
  @ApiProperty()
  unreadCount: number;

  @ApiPropertyOptional({ type: () => ChatMessageDto, nullable: true })
  lastMessage: ChatMessageDto | null;

  @ApiProperty()
  lastMessageAt: Date;
}

export class ChatConversationDetailDto {
  @ApiProperty({ type: () => ChatConversationDto })
  conversation: ChatConversationDto;

  @ApiProperty({ type: () => ChatMessageDto, isArray: true })
  messages: ChatMessageDto[];
}

// ─── Mappers ──────────────────────────────────────────────────────────────────
//
// Pure, allocation-only projections. They copy an explicit allow-list of
// fields, so no future column added to the User/Message/Conversation entity
// can silently leak through a chat response. `undefined`/`null` participants
// map to null (a conversation may legitimately have no assigned employee).

export function toChatParticipant(
  user: Partial<User> | null | undefined,
): ChatParticipantDto | null {
  if (!user) return null;
  return {
    id: user.id!,
    name: user.name!,
    role: user.role!,
    email: user.email ?? null,
    avatarUrl: user.avatarUrl ?? null,
    jobTitle: user.jobTitle ?? null,
    company: user.company ?? null,
  };
}

export function toChatMessage(
  message: (Partial<Message> & { sender?: Partial<User> | null }) | null | undefined,
): ChatMessageDto | null {
  if (!message) return null;
  return {
    id: message.id!,
    conversationId: message.conversationId!,
    senderId: message.senderId!,
    content: message.content ?? null,
    fileUrl: message.fileUrl ?? null,
    isRead: message.isRead ?? false,
    origin: message.origin ?? null,
    createdAt: message.createdAt!,
    updatedAt: message.updatedAt!,
    sender: toChatParticipant(message.sender ?? null),
  };
}

export function toChatConversation(
  conv: Partial<Conversation> | null | undefined,
): ChatConversationDto | null {
  if (!conv) return null;
  return {
    id: conv.id!,
    adminId: conv.adminId!,
    clientId: conv.clientId!,
    assignedEmployeeId: conv.assignedEmployeeId ?? null,
    status: conv.status!,
    createdAt: conv.createdAt!,
    updatedAt: conv.updatedAt!,
    admin: toChatParticipant((conv as Conversation).admin ?? null),
    client: toChatParticipant((conv as Conversation).client ?? null),
    assignedEmployee: toChatParticipant((conv as Conversation).assignedEmployee ?? null),
  };
}
