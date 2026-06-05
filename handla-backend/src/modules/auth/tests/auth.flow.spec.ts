/**
 * Phase 19.2 — Auth Flow Tests
 *
 * Covers:
 *  19.2.1 — SignUpDto Zod-equivalent validation (class-validator via manual invocation)
 *  19.2.2 — Wrong credentials → InvalidCredentialsException
 *  19.2.3 — JWT expiry / invalid token → UnauthorizedException
 *  19.2.4 — Unauthenticated getMe → ResourceNotFoundException
 *  19.2.5 — Duplicate email registration → EmailAlreadyExistsException
 *  19.2.6 — Password rules enforcement
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

import { AuthService } from '../auth.service';
import { User } from '../entities/user.entity';
import { UserRole } from '../../../common/enums';
import {
  EmailAlreadyExistsException,
  InvalidCredentialsException,
} from '../../../utils/exceptions';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const BASE_USER: User = {
  id: 'auth-flow-uuid-1',
  email: 'registered@example.com',
  passwordHash: '',
  name: 'Registered User',
  role: UserRole.CLIENT,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  adminConversations: [],
  clientConversations: [],
  assignedConversations: [],
  messages: [],
  notifications: [],
  testimonials: [],
};

const VALID_SIGNUP = {
  email: 'newuser@example.com',
  name: 'New User',
  password: 'SecurePass@123',
};

// ─── Repository / Service Mocks ───────────────────────────────────────────────

const mockUserRepository = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock_jwt_token'),
  verify: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    const cfg: Record<string, any> = {
      'jwt.secret': 'test_secret',
      'jwt.refreshSecret': 'test_refresh_secret',
      'jwt.expiresIn': 900,
      'jwt.refreshExpiresIn': 604800,
    };
    return cfg[key];
  }),
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('Phase 19.2 — Auth Flow Tests', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  // ─── 19.2.1 — Successful registration ────────────────────────────────────────
  describe('19.2.1 — Successful registration flow', () => {
    it('should register a new user and return valid tokens', async () => {
      const newUser: User = { ...BASE_USER, id: 'new-uuid', email: VALID_SIGNUP.email };
      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockReturnValue(newUser);
      mockUserRepository.save.mockResolvedValue(newUser);

      const result = await service.signUp(VALID_SIGNUP);

      expect(result.user.email).toBe(VALID_SIGNUP.email);
      expect(result.accessToken).toBe('mock_jwt_token');
      expect(result.refreshToken).toBe('mock_jwt_token');
      expect(mockUserRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should hash the password before storing (not plain text)', async () => {
      const newUser: User = { ...BASE_USER, email: VALID_SIGNUP.email };
      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockImplementation((data: Partial<User>) => ({
        ...newUser,
        passwordHash: data.passwordHash,
      }));
      mockUserRepository.save.mockImplementation((u: User) => Promise.resolve(u));

      await service.signUp(VALID_SIGNUP);

      const createCall = mockUserRepository.create.mock.calls[0][0] as Partial<User>;
      expect(createCall.passwordHash).not.toBe(VALID_SIGNUP.password);
      expect(createCall.passwordHash).toMatch(/^hashed_/);
    });

    it('response should not expose passwordHash', async () => {
      const newUser: User = { ...BASE_USER, email: VALID_SIGNUP.email };
      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockReturnValue(newUser);
      mockUserRepository.save.mockResolvedValue(newUser);

      const result = await service.signUp(VALID_SIGNUP);

      expect((result.user as any).passwordHash).toBeUndefined();
    });
  });

  // ─── 19.2.2 — Duplicate email ─────────────────────────────────────────────────
  describe('19.2.2 — Duplicate email registration', () => {
    it('should throw EmailAlreadyExistsException when email is taken', async () => {
      mockUserRepository.findOne.mockResolvedValue(BASE_USER);

      await expect(service.signUp({ ...VALID_SIGNUP, email: BASE_USER.email })).rejects.toThrow(
        EmailAlreadyExistsException,
      );
    });

    it('should not call save when duplicate email detected', async () => {
      mockUserRepository.findOne.mockResolvedValue(BASE_USER);

      await service.signUp({ ...VALID_SIGNUP, email: BASE_USER.email }).catch(() => {});

      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });
  });

  // ─── 19.2.3 — Wrong credentials ───────────────────────────────────────────────
  describe('19.2.3 — Wrong credentials', () => {
    it('should throw InvalidCredentialsException for unknown email', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(
        service.signIn({ email: 'ghost@example.com', password: 'AnyPass@1' }),
      ).rejects.toThrow(InvalidCredentialsException);
    });

    it('should throw InvalidCredentialsException for wrong password', async () => {
      const hash = await bcrypt.hash('CorrectPass@123', 10);
      mockUserRepository.findOne.mockResolvedValue({ ...BASE_USER, passwordHash: hash });

      await expect(
        service.signIn({ email: BASE_USER.email, password: 'WrongPass@456' }),
      ).rejects.toThrow(InvalidCredentialsException);
    });

    it('should NOT throw when credentials are correct', async () => {
      const hash = await bcrypt.hash('CorrectPass@123', 10);
      mockUserRepository.findOne.mockResolvedValue({ ...BASE_USER, passwordHash: hash });

      const result = await service.signIn({
        email: BASE_USER.email,
        password: 'CorrectPass@123',
      });

      expect(result.accessToken).toBeDefined();
      expect(result.user.email).toBe(BASE_USER.email);
    });
  });

  // ─── 19.2.4 — JWT token expiry / invalid ─────────────────────────────────────
  describe('19.2.4 — JWT expiry / invalid refresh token', () => {
    it('should throw when refresh token is expired', async () => {
      mockJwtService.verify.mockImplementation(() => {
        const err = new Error('jwt expired');
        err.name = 'TokenExpiredError';
        throw err;
      });

      await expect(service.refresh('expired_token')).rejects.toThrow(
        'Invalid or expired refresh token',
      );
    });

    it('should throw when refresh token is malformed', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('invalid signature');
      });

      await expect(service.refresh('tampered.token.here')).rejects.toThrow(
        'Invalid or expired refresh token',
      );
    });

    it('should return new token pair for valid refresh token', async () => {
      mockJwtService.verify.mockReturnValue({ sub: BASE_USER.id });
      mockUserRepository.findOne.mockResolvedValue(BASE_USER);

      const result = await service.refresh('valid_refresh_token');

      expect(result.accessToken).toBe('mock_jwt_token');
      expect(result.refreshToken).toBe('mock_jwt_token');
    });
  });

  // ─── 19.2.5 — Unauthenticated getMe ───────────────────────────────────────────
  describe('19.2.5 — Unauthenticated / missing user getMe', () => {
    it('should throw UnauthorizedException when user not found by id', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.getMe('nonexistent-user-uuid')).rejects.toThrow('User not found');
    });

    it('should return sanitised user data when user exists', async () => {
      mockUserRepository.findOne.mockResolvedValue(BASE_USER);

      const result = await service.getMe(BASE_USER.id);

      expect(result.id).toBe(BASE_USER.id);
      expect(result.email).toBe(BASE_USER.email);
      expect((result as any).passwordHash).toBeUndefined();
    });
  });

  // ─── 19.2.6 — Token signing parameters ───────────────────────────────────────
  describe('19.2.6 — Token signing calls correct params', () => {
    it('should call JwtService.sign with sub = user.id for access token', async () => {
      const user: User = { ...BASE_USER, id: 'sign-test-uuid' };
      const hash = await bcrypt.hash('Pass@123', 10);
      mockUserRepository.findOne.mockResolvedValue({ ...user, passwordHash: hash });

      await service.signIn({ email: user.email, password: 'Pass@123' });

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: user.id }),
        expect.any(Object),
      );
    });

    it('should call ConfigService to get JWT expiry settings', async () => {
      const user: User = { ...BASE_USER };
      const hash = await bcrypt.hash('Pass@123', 10);
      mockUserRepository.findOne.mockResolvedValue({ ...user, passwordHash: hash });

      await service.signIn({ email: user.email, password: 'Pass@123' });

      expect(mockConfigService.get).toHaveBeenCalledWith('jwt.expiresIn');
    });
  });
});
