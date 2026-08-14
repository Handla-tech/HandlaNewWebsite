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

// Full User fixture — kept in sync with the entity (email verification +
// provider + profile + archive/disable fields).
const mockUser: User = {
  id: 'uuid-1',
  email: 'test@example.com',
  passwordHash: '',
  name: 'Test User',
  role: UserRole.LEAD,
  emailVerifiedAt: new Date(),
  provider: null,
  providerId: null,
  avatarUrl: null,
  bio: null,
  phoneNumber: null,
  jobTitle: null,
  company: null,
  location: null,
  createdAt: new Date(),
  updatedAt: new Date(),
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

const mockUserRepository = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock_token'),
  verify: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    const config: Record<string, any> = {
      'jwt.secret': 'test_secret',
      'jwt.refreshSecret': 'test_refresh_secret',
      'jwt.expiresIn': 900,
      'jwt.refreshExpiresIn': 604800,
    };
    return config[key];
  }),
};

// OTP + Google are collaborators of the two-step flow — mock their surface.
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

describe('AuthService (two-step OTP flow)', () => {
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

  // ─── signUp: step 1 issues an OTP, creates NO user, no session ────────────────
  describe('signUp()', () => {
    it('issues a SIGNUP OTP and returns verification_required (no session yet)', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await service.signUp({
        email: 'Test@example.com',
        name: 'Test User',
        password: 'SecurePass@123',
      });

      expect(result).toEqual({
        status: 'verification_required',
        email: 'test@example.com',
        purpose: 'SIGNUP',
      });
      // Critically: NO user row is created before verification.
      expect(mockUserRepository.save).not.toHaveBeenCalled();
      expect(mockOtpService.issueAndSend).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'test@example.com', purpose: VerificationPurpose.SIGNUP }),
      );
    });

    it('throws EmailAlreadyExistsException for a verified existing email', async () => {
      mockUserRepository.findOne.mockResolvedValue({ ...mockUser, emailVerifiedAt: new Date() });

      await expect(
        service.signUp({ email: 'test@example.com', name: 'Test', password: 'SecurePass@123' }),
      ).rejects.toThrow(EmailAlreadyExistsException);
    });
  });

  // ─── signIn: step 1 validates credentials + issues OTP, no session ────────────
  describe('signIn()', () => {
    it('returns verification_required when credentials are valid', async () => {
      const hash = await bcrypt.hash('SecurePass@123', 10);
      mockUserRepository.findOne.mockResolvedValue({ ...mockUser, passwordHash: hash });

      const result = await service.signIn({ email: 'test@example.com', password: 'SecurePass@123' });

      expect(result).toEqual({
        status: 'verification_required',
        email: 'test@example.com',
        purpose: 'LOGIN',
      });
      expect(mockOtpService.issueAndSend).toHaveBeenCalledWith(
        expect.objectContaining({ purpose: VerificationPurpose.LOGIN }),
      );
    });

    it('throws InvalidCredentialsException when user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      await expect(service.signIn({ email: 'no@no.com', password: 'wrong' })).rejects.toThrow(
        InvalidCredentialsException,
      );
    });

    it('throws InvalidCredentialsException when password is wrong', async () => {
      const hash = await bcrypt.hash('CorrectPass@123', 10);
      mockUserRepository.findOne.mockResolvedValue({ ...mockUser, passwordHash: hash });
      await expect(
        service.signIn({ email: 'test@example.com', password: 'WrongPass@123' }),
      ).rejects.toThrow(InvalidCredentialsException);
    });
  });

  // ─── verifyOtp: step 2 completes the flow → real session ──────────────────────
  describe('verifyOtp()', () => {
    it('LOGIN: completes an existing user session after a valid code', async () => {
      mockOtpService.verify.mockResolvedValue({ userId: 'uuid-1', payload: null });
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.verifyOtp({
        email: 'test@example.com',
        code: '123456',
        purpose: 'LOGIN',
      });

      expect(result.user.email).toBe('test@example.com');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('SIGNUP: creates the verified user only after a valid code', async () => {
      mockOtpService.verify.mockResolvedValue({
        userId: null,
        payload: { name: 'New User', passwordHash: 'hashed' },
      });
      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockImplementation((arg: any) => ({ ...mockUser, ...arg }));
      mockUserRepository.save.mockResolvedValue(mockUser);

      const result = await service.verifyOtp({
        email: 'new@example.com',
        code: '123456',
        purpose: 'SIGNUP',
      });

      expect(mockUserRepository.save).toHaveBeenCalledTimes(1);
      const created = mockUserRepository.create.mock.calls[0][0];
      expect(created.role).toBe(UserRole.LEAD);
      expect(created.emailVerifiedAt).toBeInstanceOf(Date);
      expect(result.accessToken).toBeDefined();
    });
  });

  // ─── Google callback resolves by verified EMAIL, never a duplicate ────────────
  describe('handleGoogleCallback()', () => {
    it('links an existing account (no duplicate) and issues a GOOGLE OTP', async () => {
      mockGoogleOAuth.exchangeCode.mockResolvedValue({
        providerId: 'g-sub-1',
        email: 'test@example.com',
        emailVerified: true,
        name: 'Test User',
        picture: null,
      });
      mockUserRepository.findOne.mockResolvedValue({ ...mockUser, provider: null });
      mockUserRepository.save.mockResolvedValue(mockUser);

      const result = await service.handleGoogleCallback('auth-code');

      expect(result).toEqual({
        status: 'verification_required',
        email: 'test@example.com',
        purpose: 'GOOGLE',
      });
      expect(mockOtpService.issueAndSend).toHaveBeenCalledWith(
        expect.objectContaining({ purpose: VerificationPurpose.GOOGLE, userId: 'uuid-1' }),
      );
    });

    it('does NOT create a user for a brand-new Google account before OTP', async () => {
      mockGoogleOAuth.exchangeCode.mockResolvedValue({
        providerId: 'g-sub-2',
        email: 'brand@new.com',
        emailVerified: true,
        name: 'Brand New',
        picture: null,
      });
      mockUserRepository.findOne.mockResolvedValue(null);

      await service.handleGoogleCallback('auth-code');

      expect(mockUserRepository.save).not.toHaveBeenCalled();
      expect(mockOtpService.issueAndSend).toHaveBeenCalledWith(
        expect.objectContaining({ purpose: VerificationPurpose.GOOGLE }),
      );
    });
  });

  // ─── refresh ─────────────────────────────────────────────────────────────────
  describe('refresh()', () => {
    it('returns new tokens when refresh token is valid', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'uuid-1' });
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.refresh('valid_refresh_token');

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('throws UnauthorizedException when refresh token is invalid', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });
      await expect(service.refresh('bad_token')).rejects.toThrow('Invalid or expired refresh token');
    });
  });

  // ─── getMe ───────────────────────────────────────────────────────────────────
  describe('getMe()', () => {
    it('returns a sanitized user (no passwordHash)', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      const result = await service.getMe('uuid-1');
      expect(result.email).toBe('test@example.com');
      expect((result as any).passwordHash).toBeUndefined();
    });
  });
});
