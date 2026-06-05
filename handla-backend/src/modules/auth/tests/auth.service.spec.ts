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

const mockUser: User = {
  id: 'uuid-1',
  email: 'test@example.com',
  passwordHash: '',
  name: 'Test User',
  // New signups default to LEAD (not CLIENT) since ERP-1
  role: UserRole.LEAD,
  createdAt: new Date(),
  updatedAt: new Date(),
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

describe('AuthService', () => {
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

  // ─── signUp ──────────────────────────────────────────────────────────────────
  describe('signUp()', () => {
    it('should create a new user and return tokens', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockReturnValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);

      const result = await service.signUp({
        email: 'test@example.com',
        name: 'Test User',
        password: 'SecurePass@123',
      });

      expect(result.user.email).toBe('test@example.com');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(mockUserRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should assign LEAD role to new signups (ERP-1 default)', async () => {
      // Capture what create() was called with to confirm role is LEAD
      let capturedCreateArg: Record<string, any> = {};
      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockImplementation((arg: Record<string, any>) => {
        capturedCreateArg = arg;
        return { ...mockUser, ...arg };
      });
      mockUserRepository.save.mockResolvedValue(mockUser);

      await service.signUp({
        email: 'newlead@example.com',
        name: 'New Lead',
        password: 'SecurePass@123',
      });

      expect(capturedCreateArg.role).toBe(UserRole.LEAD);
    });

    it('should throw EmailAlreadyExistsException if email taken', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      await expect(
        service.signUp({
          email: 'test@example.com',
          name: 'Test',
          password: 'SecurePass@123',
        }),
      ).rejects.toThrow(EmailAlreadyExistsException);
    });
  });

  // ─── signIn ──────────────────────────────────────────────────────────────────
  describe('signIn()', () => {
    it('should return tokens when credentials are valid', async () => {
      const hash = await bcrypt.hash('SecurePass@123', 10);
      mockUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        passwordHash: hash,
      });

      const result = await service.signIn({
        email: 'test@example.com',
        password: 'SecurePass@123',
      });

      expect(result.accessToken).toBeDefined();
      expect(result.user.email).toBe('test@example.com');
    });

    it('should throw InvalidCredentialsException when user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.signIn({ email: 'no@no.com', password: 'wrong' })).rejects.toThrow(
        InvalidCredentialsException,
      );
    });

    it('should throw InvalidCredentialsException when password is wrong', async () => {
      const hash = await bcrypt.hash('CorrectPass@123', 10);
      mockUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        passwordHash: hash,
      });

      await expect(
        service.signIn({ email: 'test@example.com', password: 'WrongPass@123' }),
      ).rejects.toThrow(InvalidCredentialsException);
    });
  });

  // ─── refresh ─────────────────────────────────────────────────────────────────
  describe('refresh()', () => {
    it('should return new tokens when refresh token is valid', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'uuid-1' });
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.refresh('valid_refresh_token');

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should throw UnauthorizedException when refresh token is invalid', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      await expect(service.refresh('bad_token')).rejects.toThrow(
        'Invalid or expired refresh token',
      );
    });
  });

  // ─── getMe ───────────────────────────────────────────────────────────────────
  describe('getMe()', () => {
    it('should return sanitized user', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.getMe('uuid-1');

      expect(result.email).toBe('test@example.com');
      expect((result as any).passwordHash).toBeUndefined();
    });
  });
});
