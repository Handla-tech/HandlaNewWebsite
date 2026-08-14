/**
 * Phase 19.2 — Auth Flow Tests (two-step OTP contract)
 *
 * Covers, adapted to the verification-first flow where signUp/signIn do NOT
 * mint a session — they issue an OTP and return `verification_required`; the
 * session is only produced by verifyOtp():
 *  19.2.1 — Successful registration issues a SIGNUP OTP (no user, no session yet)
 *           and verifyOtp(SIGNUP) creates the user + returns tokens with a
 *           hashed password that is never exposed.
 *  19.2.2 — Duplicate (verified) email registration → EmailAlreadyExistsException
 *  19.2.3 — Wrong credentials → InvalidCredentialsException; correct credentials
 *           return verification_required.
 *  19.2.4 — JWT expiry / invalid refresh token → UnauthorizedException
 *  19.2.5 — Unauthenticated getMe → UnauthorizedException
 *  19.2.6 — Token signing parameters (verifyOtp path)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

import { AuthService } from '../auth.service';
import { OtpService } from '../otp.service';
import { GoogleOAuthService } from '../google-oauth.service';
import { User } from '../entities/user.entity';
import { VerificationPurpose } from '../entities/email-verification.entity';
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
  emailVerifiedAt: new Date('2024-01-01'),
  provider: null,
  providerId: null,
  avatarUrl: null,
  bio: null,
  phoneNumber: null,
  jobTitle: null,
  company: null,
  location: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  isArchived: false,
  archivedAt: null,
  isDisabled: false,
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

const mockOtpService = {
  issueAndSend: jest.fn().mockResolvedValue(undefined),
  verify: jest.fn(),
  peekLastPayload: jest.fn().mockResolvedValue(null),
};

const mockGoogleOAuth = {
  generateState: jest.fn().mockReturnValue('state123'),
  buildAuthUrl: jest.fn().mockReturnValue('https://accounts.google.com/o/oauth2/auth'),
  exchangeCode: jest.fn(),
  isConfigured: jest.fn().mockReturnValue(true),
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('Phase 19.2 — Auth Flow Tests (two-step OTP)', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: OtpService, useValue: mockOtpService },
        { provide: GoogleOAuthService, useValue: mockGoogleOAuth },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  // ─── 19.2.1 — Successful registration ────────────────────────────────────────
  describe('19.2.1 — Successful registration flow', () => {
    it('step 1: signUp issues a SIGNUP OTP and creates NO user/session', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await service.signUp(VALID_SIGNUP);

      expect(result).toEqual({
        status: 'verification_required',
        email: VALID_SIGNUP.email,
        purpose: 'SIGNUP',
      });
      expect(mockUserRepository.save).not.toHaveBeenCalled();
      expect(mockOtpService.issueAndSend).toHaveBeenCalledWith(
        expect.objectContaining({
          email: VALID_SIGNUP.email,
          purpose: VerificationPurpose.SIGNUP,
        }),
      );
    });

    it('step 1: hashes the password before it is queued (not plain text)', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await service.signUp(VALID_SIGNUP);

      const otpCall = mockOtpService.issueAndSend.mock.calls[0][0];
      const queuedHash = otpCall?.payload?.passwordHash;
      expect(queuedHash).toBeDefined();
      // Must be a hash, never the raw password. (bcrypt is globally mocked in
      // this suite to `hashed_<input>`; the point is that hashing happened.)
      expect(queuedHash).not.toBe(VALID_SIGNUP.password);
      expect(queuedHash).toMatch(/^(hashed_|\$2[aby]?\$)/);
    });

    it('step 2: verifyOtp(SIGNUP) creates the user and returns tokens without passwordHash', async () => {
      mockOtpService.verify.mockResolvedValue({
        userId: null,
        payload: { name: VALID_SIGNUP.name, passwordHash: '$2b$10$hashedvalue' },
      });
      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockImplementation((arg: any) => ({ ...BASE_USER, ...arg }));
      mockUserRepository.save.mockImplementation((u: User) => Promise.resolve(u));

      const result = await service.verifyOtp({
        email: VALID_SIGNUP.email,
        code: '123456',
        purpose: 'SIGNUP',
      });

      expect(mockUserRepository.save).toHaveBeenCalledTimes(1);
      expect(result.user.email).toBe(VALID_SIGNUP.email);
      expect(result.accessToken).toBe('mock_jwt_token');
      expect(result.refreshToken).toBe('mock_jwt_token');
      expect((result.user as any).passwordHash).toBeUndefined();
    });
  });

  // ─── 19.2.2 — Duplicate email ─────────────────────────────────────────────────
  describe('19.2.2 — Duplicate email registration', () => {
    it('should throw EmailAlreadyExistsException when a verified email is taken', async () => {
      mockUserRepository.findOne.mockResolvedValue({ ...BASE_USER, emailVerifiedAt: new Date() });

      await expect(
        service.signUp({ ...VALID_SIGNUP, email: BASE_USER.email }),
      ).rejects.toThrow(EmailAlreadyExistsException);
    });

    it('should not issue an OTP when a verified duplicate email is detected', async () => {
      mockUserRepository.findOne.mockResolvedValue({ ...BASE_USER, emailVerifiedAt: new Date() });

      await service.signUp({ ...VALID_SIGNUP, email: BASE_USER.email }).catch(() => {});

      expect(mockOtpService.issueAndSend).not.toHaveBeenCalled();
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

    it('should sign a verified account in directly when credentials are correct (no OTP)', async () => {
      const hash = await bcrypt.hash('CorrectPass@123', 10);
      mockUserRepository.findOne.mockResolvedValue({
        ...BASE_USER,
        passwordHash: hash,
        emailVerifiedAt: new Date(),
      });

      const result = await service.signIn({
        email: BASE_USER.email,
        password: 'CorrectPass@123',
      });

      expect(result).toEqual(
        expect.objectContaining({
          user: expect.objectContaining({ email: BASE_USER.email }),
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
        }),
      );
      // A verified login must NOT issue an OTP.
      expect(mockOtpService.issueAndSend).not.toHaveBeenCalled();
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
    it('should throw when user not found by id', async () => {
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

  // ─── 19.2.6 — Token signing parameters (verifyOtp path) ──────────────────────
  describe('19.2.6 — Token signing calls correct params', () => {
    it('should call JwtService.sign with sub = user.id when verifyOtp completes a LOGIN', async () => {
      const user: User = { ...BASE_USER, id: 'sign-test-uuid' };
      mockOtpService.verify.mockResolvedValue({ userId: user.id, payload: null });
      mockUserRepository.findOne.mockResolvedValue(user);

      await service.verifyOtp({ email: user.email, code: '123456', purpose: 'LOGIN' });

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: user.id }),
        expect.any(Object),
      );
    });

    it('should read JWT expiry settings from ConfigService when signing tokens', async () => {
      mockOtpService.verify.mockResolvedValue({ userId: BASE_USER.id, payload: null });
      mockUserRepository.findOne.mockResolvedValue(BASE_USER);

      await service.verifyOtp({ email: BASE_USER.email, code: '123456', purpose: 'LOGIN' });

      expect(mockConfigService.get).toHaveBeenCalledWith('jwt.expiresIn');
    });
  });
});
