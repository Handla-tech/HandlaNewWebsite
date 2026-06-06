import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

import { ProfilesService } from '../profiles.service';
import { User } from '../../auth/entities/user.entity';
import { UserRole } from '../../../common/enums';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'user@example.com',
    passwordHash: 'hashed',
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
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-02T00:00:00Z'),
    adminConversations: [],
    clientConversations: [],
    assignedConversations: [],
    messages: [],
    notifications: [],
    testimonials: [],
    ...overrides,
  } as User;
}

describe('ProfilesService', () => {
  let service: ProfilesService;
  let userRepo: { findOne: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    userRepo = { findOne: jest.fn(), save: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfilesService,
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();

    service = module.get<ProfilesService>(ProfilesService);
  });

  // ── getMe / findById ──────────────────────────────────────────────────────
  describe('getMe', () => {
    it('returns sanitized profile for the user', async () => {
      const user = makeUser({ avatarUrl: 'https://cdn/a.png', bio: 'hi' });
      userRepo.findOne.mockResolvedValue(user);

      const res = await service.getMe(user.id);

      expect(userRepo.findOne).toHaveBeenCalledWith({ where: { id: user.id } });
      expect(res).toMatchObject({
        id: 'user-1',
        email: 'user@example.com',
        name: 'Test User',
        avatarUrl: 'https://cdn/a.png',
        bio: 'hi',
      });
      expect(res).not.toHaveProperty('passwordHash');
    });

    it('throws NotFoundException when the user does not exist', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.getMe('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findById', () => {
    it('returns the profile when found', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ id: 'other-1' }));
      const res = await service.findById('other-1');
      expect(res.id).toBe('other-1');
    });

    it('throws NotFoundException when user is not found', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.findById('nope')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ── assertSelfOrAdmin ─────────────────────────────────────────────────────
  describe('assertSelfOrAdmin', () => {
    it('allows the user themself', () => {
      const u = makeUser({ id: 'u-1', role: UserRole.CLIENT });
      expect(() => service.assertSelfOrAdmin(u, 'u-1')).not.toThrow();
    });

    it('allows ADMIN to access anyone', () => {
      const admin = makeUser({ id: 'a-1', role: UserRole.ADMIN });
      expect(() => service.assertSelfOrAdmin(admin, 'someone-else')).not.toThrow();
    });

    it('throws ForbiddenException for non-ADMIN accessing someone else', () => {
      const emp = makeUser({ id: 'e-1', role: UserRole.EMPLOYEE });
      expect(() => service.assertSelfOrAdmin(emp, 'other')).toThrow(ForbiddenException);
    });

    it('CLIENT cannot access another CLIENT', () => {
      const c = makeUser({ id: 'c-1', role: UserRole.CLIENT });
      expect(() => service.assertSelfOrAdmin(c, 'c-2')).toThrow(ForbiddenException);
    });

    it('LEAD cannot access another user', () => {
      const l = makeUser({ id: 'l-1', role: UserRole.LEAD });
      expect(() => service.assertSelfOrAdmin(l, 'l-2')).toThrow(ForbiddenException);
    });
  });

  // ── update ────────────────────────────────────────────────────────────────
  describe('update', () => {
    it('updates only the provided fields and leaves the rest untouched', async () => {
      const user = makeUser({ name: 'Old Name', bio: 'old bio' });
      userRepo.findOne.mockResolvedValue(user);
      userRepo.save.mockImplementation(async (u) => u);

      const res = await service.update(user.id, { name: 'New Name', avatarUrl: 'https://cdn/x.png' });

      expect(res.name).toBe('New Name');
      expect(res.avatarUrl).toBe('https://cdn/x.png');
      expect(res.bio).toBe('old bio'); // untouched
    });

    it('null clears the field (vs undefined which leaves it alone)', async () => {
      const user = makeUser({ avatarUrl: 'https://old.png' });
      userRepo.findOne.mockResolvedValue(user);
      userRepo.save.mockImplementation(async (u) => u);

      const res = await service.update(user.id, { avatarUrl: null });

      expect(res.avatarUrl).toBeNull();
    });

    it('throws NotFoundException when the target does not exist', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.update('missing', { name: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('checks email uniqueness BEFORE saving and throws ConflictException on duplicate', async () => {
      const user = makeUser({ email: 'me@example.com' });
      userRepo.findOne
        .mockResolvedValueOnce(user)                                  // initial fetch
        .mockResolvedValueOnce(makeUser({ id: 'other', email: 'taken@example.com' })); // dup check

      await expect(
        service.update(user.id, { email: 'taken@example.com' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(userRepo.save).not.toHaveBeenCalled();
    });

    it('allows changing email to a not-in-use address', async () => {
      const user = makeUser({ email: 'me@example.com' });
      userRepo.findOne
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce(null); // no duplicate
      userRepo.save.mockImplementation(async (u) => u);

      const res = await service.update(user.id, { email: 'new@example.com' });
      expect(res.email).toBe('new@example.com');
    });

    it('does not run the duplicate-check when email is unchanged', async () => {
      const user = makeUser({ email: 'me@example.com' });
      userRepo.findOne.mockResolvedValue(user);
      userRepo.save.mockImplementation(async (u) => u);

      await service.update(user.id, { email: 'me@example.com', name: 'New' });

      // Only ONE findOne call (the initial fetch); no second uniqueness lookup.
      expect(userRepo.findOne).toHaveBeenCalledTimes(1);
    });

    it('translates a late ER_DUP_ENTRY into ConflictException (race-safe)', async () => {
      const user = makeUser({ email: 'me@example.com' });
      userRepo.findOne
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce(null); // no duplicate at check time

      const innerErr = new Error('Duplicate entry') as Error & { code?: string; errno?: number };
      innerErr.code = 'ER_DUP_ENTRY';
      innerErr.errno = 1062;
      const wrapped = new QueryFailedError('UPDATE users', [], innerErr);
      (wrapped as any).driverError = innerErr;
      userRepo.save.mockRejectedValue(wrapped);

      await expect(
        service.update(user.id, { email: 'new@example.com' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('re-throws non-duplicate-key DB errors unchanged', async () => {
      const user = makeUser();
      userRepo.findOne.mockResolvedValue(user);

      const innerErr = new Error('connection lost') as Error & { code?: string };
      innerErr.code = 'PROTOCOL_CONNECTION_LOST';
      const wrapped = new QueryFailedError('UPDATE users', [], innerErr);
      (wrapped as any).driverError = innerErr;
      userRepo.save.mockRejectedValue(wrapped);

      await expect(service.update(user.id, { name: 'x' })).rejects.toBe(wrapped);
    });
  });

  // ── setAvatarUrl ──────────────────────────────────────────────────────────
  describe('setAvatarUrl', () => {
    it('updates avatarUrl and returns the new profile', async () => {
      const user = makeUser();
      userRepo.findOne.mockResolvedValue(user);
      userRepo.save.mockImplementation(async (u) => u);

      const res = await service.setAvatarUrl(user.id, 'https://cdn/avatar.png');

      expect(res.avatarUrl).toBe('https://cdn/avatar.png');
    });

    it('null clears the avatar', async () => {
      const user = makeUser({ avatarUrl: 'https://old.png' });
      userRepo.findOne.mockResolvedValue(user);
      userRepo.save.mockImplementation(async (u) => u);

      const res = await service.setAvatarUrl(user.id, null);
      expect(res.avatarUrl).toBeNull();
    });

    it('throws NotFoundException when the user does not exist', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.setAvatarUrl('nope', 'x')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ── toResponse ────────────────────────────────────────────────────────────
  describe('toResponse', () => {
    it('does not include passwordHash in the response shape', () => {
      const u = makeUser();
      const res = service.toResponse(u);
      expect(res).not.toHaveProperty('passwordHash');
    });

    it('serialises Date timestamps to ISO strings', () => {
      const u = makeUser({
        createdAt: new Date('2024-05-01T10:00:00Z'),
        updatedAt: new Date('2024-05-02T10:00:00Z'),
        archivedAt: new Date('2024-05-03T10:00:00Z'),
      });
      const res = service.toResponse(u);
      expect(res.createdAt).toBe('2024-05-01T10:00:00.000Z');
      expect(res.updatedAt).toBe('2024-05-02T10:00:00.000Z');
      expect(res.archivedAt).toBe('2024-05-03T10:00:00.000Z');
    });

    it('exposes profile fields with sensible null defaults', () => {
      const u = makeUser();
      const res = service.toResponse(u);
      expect(res.avatarUrl).toBeNull();
      expect(res.bio).toBeNull();
      expect(res.phoneNumber).toBeNull();
      expect(res.jobTitle).toBeNull();
      expect(res.company).toBeNull();
      expect(res.location).toBeNull();
    });
  });
});
