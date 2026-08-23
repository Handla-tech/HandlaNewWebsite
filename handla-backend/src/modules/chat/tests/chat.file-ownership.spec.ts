import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { ChatService } from '../chat.service';
import { AwsService } from '../../aws/aws.service';
import { Conversation } from '../entities/conversation.entity';
import { Message } from '../entities/message.entity';
import { User } from '../../auth/entities/user.entity';
import { UserRole, ConversationStatus } from '../../../common/enums';
import {
  ResourceNotFoundException,
  ConversationAccessDeniedException,
} from '../../../utils/exceptions';

/**
 * PT-02 regression — file ownership MUST be validated before S3 signing.
 *
 * BEFORE the fix, a signing path re-signed ANY in-bucket key with no per-user
 * authorization, so any authenticated user could obtain a presigned GET URL for
 * another user's chat attachment (BOLA / IDOR). These tests exercise the real
 * `ChatService.getSignedFileUrlForMessage` authorization logic with two fully
 * isolated users/resources and assert that the actual S3 signing method is
 * NEVER reached when authorization fails.
 */
describe('PT-02 — file ownership before S3 signing', () => {
  let service: ChatService;

  // Two fully isolated users, each the client of their OWN conversation.
  const userA: User = { id: 'user-A', role: UserRole.CLIENT, name: 'A', email: 'a@h.tech' } as User;
  const userB: User = { id: 'user-B', role: UserRole.CLIENT, name: 'B', email: 'b@h.tech' } as User;
  const admin: User = { id: 'admin-1', role: UserRole.ADMIN, name: 'Admin', email: 'admin@h.tech' } as User;

  const convA: Conversation = {
    id: 'conv-A', adminId: admin.id, clientId: userA.id,
    assignedEmployeeId: null, status: ConversationStatus.ACTIVE,
    createdAt: new Date(), updatedAt: new Date(),
  } as Conversation;
  const convB: Conversation = {
    id: 'conv-B', adminId: admin.id, clientId: userB.id,
    assignedEmployeeId: null, status: ConversationStatus.ACTIVE,
    createdAt: new Date(), updatedAt: new Date(),
  } as Conversation;

  // A's file lives under A's chat namespace; B's under B's.
  const msgA: Message = {
    id: 'msg-A', conversationId: convA.id, senderId: userA.id, content: null,
    fileUrl: 'https://handla-uploads.s3.eu-north-1.amazonaws.com/chat/user-A/1-a.pdf',
    isRead: false, origin: null, createdAt: new Date(), updatedAt: new Date(),
  } as Message;
  const msgB: Message = {
    id: 'msg-B', conversationId: convB.id, senderId: userB.id, content: null,
    fileUrl: 'https://handla-uploads.s3.eu-north-1.amazonaws.com/chat/user-B/1-b.pdf',
    isRead: false, origin: null, createdAt: new Date(), updatedAt: new Date(),
  } as Message;

  // Real namespace logic, spy-able signer. resolveLogicalKey/isKeyInNamespace
  // use the ACTUAL implementations so the namespace guard is genuinely tested.
  const realAws = new AwsService({
    get: (k: string) =>
      ({
        'aws.region': 'eu-north-1',
        'aws.s3Bucket': 'handla-uploads',
        'aws.presignedUrlExpiry': 900,
        'aws.keyPrefix': '',
      } as Record<string, unknown>)[k],
  } as any);

  const signFileUrl = jest.fn(async (u: string) => `${u}?X-Amz-Signature=SIGNED`);
  const awsMock = {
    signFileUrl,
    resolveLogicalKey: realAws.resolveLogicalKey.bind(realAws),
    isKeyInNamespace: realAws.isKeyInNamespace.bind(realAws),
  };

  const messageRepo = { findOne: jest.fn() };
  const conversationRepo = { findOne: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: getRepositoryToken(Conversation), useValue: conversationRepo },
        { provide: getRepositoryToken(Message), useValue: messageRepo },
        { provide: AwsService, useValue: awsMock },
      ],
    }).compile();
    service = module.get(ChatService);
    jest.clearAllMocks();
  });

  // Route repo lookups by id so A/B resources stay isolated.
  const wireDb = () => {
    messageRepo.findOne.mockImplementation(({ where }: any) =>
      Promise.resolve({ 'msg-A': msgA, 'msg-B': msgB }[where.id] ?? null),
    );
    conversationRepo.findOne.mockImplementation(({ where }: any) =>
      Promise.resolve({ 'conv-A': convA, 'conv-B': convB }[where.id] ?? null),
    );
  };

  // ── Positive: each owner can sign their own file ─────────────────────────────
  it('User A CAN retrieve a signed URL for A’s own file', async () => {
    wireDb();
    const url = await service.getSignedFileUrlForMessage('msg-A', userA);
    expect(url).toContain('X-Amz-Signature=SIGNED');
    expect(signFileUrl).toHaveBeenCalledWith(msgA.fileUrl);
  });

  it('User B CAN retrieve a signed URL for B’s own file', async () => {
    wireDb();
    const url = await service.getSignedFileUrlForMessage('msg-B', userB);
    expect(url).toContain('X-Amz-Signature=SIGNED');
    expect(signFileUrl).toHaveBeenCalledWith(msgB.fileUrl);
  });

  it('ADMIN (authorized staff) CAN retrieve A’s file', async () => {
    wireDb();
    const url = await service.getSignedFileUrlForMessage('msg-A', admin);
    expect(url).toContain('X-Amz-Signature=SIGNED');
  });

  // ── Negative: cross-user access is rejected and NEVER signs ──────────────────
  it('User A CANNOT retrieve B’s file (BOLA) — and signing is never reached', async () => {
    wireDb();
    await expect(service.getSignedFileUrlForMessage('msg-B', userA)).rejects.toBeInstanceOf(
      ConversationAccessDeniedException,
    );
    expect(signFileUrl).not.toHaveBeenCalled();
  });

  it('User B CANNOT retrieve A’s file (BOLA) — and signing is never reached', async () => {
    wireDb();
    await expect(service.getSignedFileUrlForMessage('msg-A', userB)).rejects.toBeInstanceOf(
      ConversationAccessDeniedException,
    );
    expect(signFileUrl).not.toHaveBeenCalled();
  });

  // ── A nonexistent message id fails safe, never signs ─────────────────────────
  it('nonexistent messageId fails safely (404), never signs', async () => {
    wireDb();
    await expect(service.getSignedFileUrlForMessage('msg-DOES-NOT-EXIST', userA)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
    expect(signFileUrl).not.toHaveBeenCalled();
  });

  // ── A message with no attachment fails safe, never signs ─────────────────────
  it('message without a file fails safely, never signs', async () => {
    messageRepo.findOne.mockResolvedValue({ ...msgA, fileUrl: null });
    await expect(service.getSignedFileUrlForMessage('msg-A', userA)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
    expect(signFileUrl).not.toHaveBeenCalled();
  });

  // ── An arbitrary in-bucket key (outside chat namespace) is rejected ──────────
  it('arbitrary in-bucket key outside the chat namespace is rejected, never signs', async () => {
    // The stored key on an (authorized) message points at another namespace,
    // e.g. someone else's contract. Even though the user owns the conversation,
    // the namespace guard must refuse to sign it.
    const arbitrary = {
      ...msgA,
      fileUrl: 'https://handla-uploads.s3.eu-north-1.amazonaws.com/contracts/secret/leak.pdf',
    };
    messageRepo.findOne.mockResolvedValue(arbitrary);
    conversationRepo.findOne.mockResolvedValue(convA);

    await expect(service.getSignedFileUrlForMessage('msg-A', userA)).rejects.toBeInstanceOf(
      ConversationAccessDeniedException,
    );
    expect(signFileUrl).not.toHaveBeenCalled();
  });

  // ── An altered/traversal key is rejected ─────────────────────────────────────
  it('altered/path-traversal key is rejected, never signs', async () => {
    const altered = {
      ...msgA,
      fileUrl: 'https://handla-uploads.s3.eu-north-1.amazonaws.com/chat/user-A/../user-B/1-b.pdf',
    };
    messageRepo.findOne.mockResolvedValue(altered);
    conversationRepo.findOne.mockResolvedValue(convA);

    await expect(service.getSignedFileUrlForMessage('msg-A', userA)).rejects.toBeInstanceOf(
      ConversationAccessDeniedException,
    );
    expect(signFileUrl).not.toHaveBeenCalled();
  });

  // ── Orphaned message (conversation gone) fails safe ──────────────────────────
  it('orphaned message whose conversation is missing fails safely, never signs', async () => {
    messageRepo.findOne.mockResolvedValue(msgA);
    conversationRepo.findOne.mockResolvedValue(null);

    await expect(service.getSignedFileUrlForMessage('msg-A', userA)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
    expect(signFileUrl).not.toHaveBeenCalled();
  });
});
