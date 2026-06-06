import { Test, TestingModule } from '@nestjs/testing';
import { ParseUUIDPipe, ArgumentMetadata, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { ProfilesController } from '../profiles.controller';
import { ProfilesService } from '../profiles.service';
import { AwsService } from '../../aws/aws.service';
import { User } from '../../auth/entities/user.entity';
import { UserRole } from '../../../common/enums';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { AvatarUploadDto } from '../dto/avatar-upload.dto';

/**
 * Helper to construct a fully-typed User entity for tests without having to
 * spell out every relation field. Mirrors the helper used in other
 * controller specs.
 */
function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'user@example.com',
    passwordHash: 'h',
    name: 'Test User',
    role: UserRole.CLIENT,
    avatarUrl: null,
    bio: null,
    phoneNumber: null,
    jobTitle: null,
    company: null,
    location: null,
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

function makeProfile(overrides: Record<string, any> = {}) {
  return {
    id: 'user-1',
    email: 'user@example.com',
    name: 'Test User',
    role: UserRole.CLIENT,
    avatarUrl: null,
    bio: null,
    phoneNumber: null,
    jobTitle: null,
    company: null,
    location: null,
    isArchived: false,
    archivedAt: null,
    isDisabled: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('ProfilesController', () => {
  let controller: ProfilesController;
  let service: {
    getMe: jest.Mock;
    findById: jest.Mock;
    update: jest.Mock;
    setAvatarUrl: jest.Mock;
    assertSelfOrAdmin: jest.Mock;
    toResponse: jest.Mock;
  };
  let aws: { generatePresignedUrl: jest.Mock };

  const validUuid = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  const otherUuid = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff';

  beforeEach(async () => {
    service = {
      getMe: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      setAvatarUrl: jest.fn(),
      assertSelfOrAdmin: jest.fn(),
      toResponse: jest.fn(),
    };
    aws = { generatePresignedUrl: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfilesController],
      providers: [
        { provide: ProfilesService, useValue: service },
        { provide: AwsService, useValue: aws },
      ],
    }).compile();

    controller = module.get(ProfilesController);
  });

  // ── GET /profiles/me ──────────────────────────────────────────────────────
  describe('GET /profiles/me', () => {
    it('returns own profile wrapped in { message, data: { profile } }', async () => {
      const user = makeUser();
      const profile = makeProfile();
      service.getMe.mockResolvedValue(profile);

      const res = await controller.getMe(user);

      expect(service.getMe).toHaveBeenCalledWith(user.id);
      expect(res).toEqual({ message: 'Profile retrieved', data: { profile } });
    });

    it('propagates NotFoundException from the service', async () => {
      const user = makeUser();
      service.getMe.mockRejectedValue(new NotFoundException('User not found'));

      await expect(controller.getMe(user)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ── PATCH /profiles/me ────────────────────────────────────────────────────
  describe('PATCH /profiles/me', () => {
    it('forwards user.id and DTO to service.update and wraps the result', async () => {
      const user = makeUser();
      const dto: UpdateProfileDto = { name: 'New Name', bio: 'Hello' };
      const updated = makeProfile({ name: 'New Name', bio: 'Hello' });
      service.update.mockResolvedValue(updated);

      const res = await controller.updateMe(user, dto);

      expect(service.update).toHaveBeenCalledWith(user.id, dto);
      expect(res).toEqual({ message: 'Profile updated', data: { profile: updated } });
    });

    it('does not call assertSelfOrAdmin for the /me route', async () => {
      const user = makeUser();
      service.update.mockResolvedValue(makeProfile());

      await controller.updateMe(user, {} as UpdateProfileDto);

      expect(service.assertSelfOrAdmin).not.toHaveBeenCalled();
    });
  });

  // ── POST /profiles/me/avatar-upload ───────────────────────────────────────
  describe('POST /profiles/me/avatar-upload', () => {
    it('builds a per-user key, sanitises the filename and forwards to AwsService', async () => {
      const user = makeUser({ id: 'user-42' });
      const dto: AvatarUploadDto = { fileName: 'my photo.jpg', contentType: 'image/jpeg' };
      aws.generatePresignedUrl.mockResolvedValue({
        url: 'https://s3/presigned',
        bucket: 'b',
        key: 'k',
        expiresIn: 900,
        fileUrl: 'https://cdn/avatar.jpg',
      });

      const res = await controller.getAvatarUploadUrl(user, dto);

      expect(aws.generatePresignedUrl).toHaveBeenCalledTimes(1);
      const [keyArg, ctArg] = aws.generatePresignedUrl.mock.calls[0];
      // Per-user prefix to prevent cross-user overwrite
      expect(keyArg).toMatch(/^avatars\/user-42\/\d+-my_photo\.jpg$/);
      expect(ctArg).toBe('image/jpeg');
      expect(res.message).toBe('Avatar upload URL generated');
      expect(res.data).toMatchObject({ url: 'https://s3/presigned', fileUrl: 'https://cdn/avatar.jpg' });
    });

    it('strips dangerous characters from the filename (no slashes, no spaces)', async () => {
      const user = makeUser({ id: 'user-7' });
      const dto: AvatarUploadDto = {
        fileName: '../../etc/passwd attack name.png',
        contentType: 'image/png',
      };
      aws.generatePresignedUrl.mockResolvedValue({
        url: 'u', bucket: 'b', key: 'k', expiresIn: 1, fileUrl: 'f',
      });

      await controller.getAvatarUploadUrl(user, dto);

      const [keyArg] = aws.generatePresignedUrl.mock.calls[0];
      // No path-traversal segments survive — sanitiser replaces them with _
      expect(keyArg).not.toContain('../');
      expect(keyArg).not.toContain(' ');
      expect(keyArg).toMatch(/^avatars\/user-7\/\d+-[A-Za-z0-9._-]+$/);
    });

    it('uses a per-request timestamp so the URL changes between uploads', async () => {
      const user = makeUser({ id: 'user-1' });
      const dto: AvatarUploadDto = { fileName: 'a.png', contentType: 'image/png' };
      aws.generatePresignedUrl.mockResolvedValue({
        url: 'u', bucket: 'b', key: 'k', expiresIn: 1, fileUrl: 'f',
      });

      // First call
      await controller.getAvatarUploadUrl(user, dto);
      const firstKey = aws.generatePresignedUrl.mock.calls[0][0];

      // Tiny wait to guarantee Date.now() advances
      await new Promise((r) => setTimeout(r, 5));

      // Second call
      await controller.getAvatarUploadUrl(user, dto);
      const secondKey = aws.generatePresignedUrl.mock.calls[1][0];

      expect(firstKey).not.toBe(secondKey);
    });
  });

  // ── GET /profiles/:id ─────────────────────────────────────────────────────
  describe('GET /profiles/:id', () => {
    it('runs assertSelfOrAdmin BEFORE fetching, then fetches by id', async () => {
      const user = makeUser({ id: validUuid });
      const profile = makeProfile({ id: validUuid });
      service.assertSelfOrAdmin.mockReturnValue(undefined);
      service.findById.mockResolvedValue(profile);

      const res = await controller.findOne(validUuid, user);

      // Order matters — if findById ran first an unauthorised user could
      // observe existence of accounts.
      const calls: any[] = [
        ...service.assertSelfOrAdmin.mock.invocationCallOrder,
        ...service.findById.mock.invocationCallOrder,
      ];
      expect(service.assertSelfOrAdmin.mock.invocationCallOrder[0])
        .toBeLessThan(service.findById.mock.invocationCallOrder[0]);

      expect(service.assertSelfOrAdmin).toHaveBeenCalledWith(user, validUuid);
      expect(service.findById).toHaveBeenCalledWith(validUuid);
      expect(res).toEqual({ message: 'Profile retrieved', data: { profile } });
      void calls;
    });

    it('blocks non-ADMIN from fetching someone else (service throws)', async () => {
      const user = makeUser({ id: validUuid, role: UserRole.CLIENT });
      service.assertSelfOrAdmin.mockImplementation(() => {
        throw new ForbiddenException('You can only access your own profile');
      });

      await expect(controller.findOne(otherUuid, user)).rejects.toBeInstanceOf(ForbiddenException);
      // Critically — service.findById must NOT have been called
      expect(service.findById).not.toHaveBeenCalled();
    });

    it('allows ADMIN to fetch any profile', async () => {
      const admin = makeUser({ id: validUuid, role: UserRole.ADMIN });
      const profile = makeProfile({ id: otherUuid });
      service.assertSelfOrAdmin.mockReturnValue(undefined);
      service.findById.mockResolvedValue(profile);

      const res = await controller.findOne(otherUuid, admin);

      expect(service.assertSelfOrAdmin).toHaveBeenCalledWith(admin, otherUuid);
      expect(res.data.profile).toBe(profile);
    });
  });

  // ── PATCH /profiles/:id ───────────────────────────────────────────────────
  describe('PATCH /profiles/:id', () => {
    it('runs assertSelfOrAdmin BEFORE update', async () => {
      const user = makeUser({ id: validUuid });
      const dto: UpdateProfileDto = { name: 'New' };
      service.assertSelfOrAdmin.mockReturnValue(undefined);
      service.update.mockResolvedValue(makeProfile({ id: validUuid, name: 'New' }));

      await controller.update(validUuid, dto, user);

      expect(service.assertSelfOrAdmin.mock.invocationCallOrder[0])
        .toBeLessThan(service.update.mock.invocationCallOrder[0]);
      expect(service.assertSelfOrAdmin).toHaveBeenCalledWith(user, validUuid);
      expect(service.update).toHaveBeenCalledWith(validUuid, dto);
    });

    it('blocks non-ADMIN from updating someone else', async () => {
      const user = makeUser({ id: validUuid, role: UserRole.EMPLOYEE });
      service.assertSelfOrAdmin.mockImplementation(() => {
        throw new ForbiddenException();
      });

      await expect(controller.update(otherUuid, {} as UpdateProfileDto, user))
        .rejects.toBeInstanceOf(ForbiddenException);
      expect(service.update).not.toHaveBeenCalled();
    });

    it('allows ADMIN to update any profile and wraps the response', async () => {
      const admin = makeUser({ id: validUuid, role: UserRole.ADMIN });
      const dto: UpdateProfileDto = { jobTitle: 'Engineer' };
      const updated = makeProfile({ id: otherUuid, jobTitle: 'Engineer' });
      service.assertSelfOrAdmin.mockReturnValue(undefined);
      service.update.mockResolvedValue(updated);

      const res = await controller.update(otherUuid, dto, admin);

      expect(service.update).toHaveBeenCalledWith(otherUuid, dto);
      expect(res).toEqual({ message: 'Profile updated', data: { profile: updated } });
    });
  });

  // ── ParseUUIDPipe — literal-before-:id regression guard ────────────────────
  //
  // If any future refactor reorders the routes so that /:id is declared
  // BEFORE /me or /me/avatar-upload, requests to GET /profiles/me would
  // hit ParseUUIDPipe('me') and produce a 400 instead of returning the
  // current user's profile. These tests assert ParseUUIDPipe really does
  // reject those literal segments — so we know route-ordering is the
  // only thing protecting us.
  describe('ParseUUIDPipe rejects literal segments (route-ordering guard)', () => {
    const meta: ArgumentMetadata = { type: 'param', metatype: String, data: 'id' };

    it('rejects "me"', async () => {
      const pipe = new ParseUUIDPipe();
      await expect(pipe.transform('me', meta)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects "me/avatar-upload" segment', async () => {
      const pipe = new ParseUUIDPipe();
      await expect(pipe.transform('me', meta)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects "avatar-upload"', async () => {
      const pipe = new ParseUUIDPipe();
      await expect(pipe.transform('avatar-upload', meta)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts a real UUID', async () => {
      const pipe = new ParseUUIDPipe();
      await expect(pipe.transform(validUuid, meta)).resolves.toBe(validUuid);
    });
  });
});
