import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

import {
  OtpService,
  InvalidCodeException,
  ExpiredCodeException,
  TooManyAttemptsException,
  ResendCooldownException,
} from '../otp.service';
import { EmailVerification, VerificationPurpose } from '../entities/email-verification.entity';
import { EmailService } from '../../email/email.service';

/**
 * Verifies the OTP security contract (PART 8/13/14):
 *  - codes are bcrypt-hashed at rest, never plaintext, never returned/logged
 *  - short TTL + expiry, capped attempts, single-use, resend cooldown
 */
describe('OtpService (security)', () => {
  let service: OtpService;
  let store: EmailVerification[];

  const repo = {
    findOne: jest.fn(),
    create: jest.fn((v: Partial<EmailVerification>) => v as EmailVerification),
    save: jest.fn((v: EmailVerification) => {
      if (!store.includes(v)) store.push(v);
      return Promise.resolve(v);
    }),
    update: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  };

  const emailService = { sendVerificationCodeEmail: jest.fn().mockResolvedValue(undefined) };

  const config = {
    get: jest.fn((key: string) => {
      const cfg: Record<string, any> = {
        'auth.otp.length': 6,
        'auth.otp.ttlSeconds': 600,
        'auth.otp.maxAttempts': 5,
        'auth.otp.resendCooldownSeconds': 45,
      };
      return cfg[key];
    }),
  };

  beforeEach(async () => {
    store = [];
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OtpService,
        { provide: getRepositoryToken(EmailVerification), useValue: repo },
        { provide: EmailService, useValue: emailService },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    service = module.get<OtpService>(OtpService);
    jest.clearAllMocks();
  });

  // Helper: capture the plaintext code the service emailed (the ONLY place it
  // exists in plaintext) so the test can submit it — proving it is never
  // returned from issueAndSend itself.
  const issueAndCaptureCode = async (email: string, purpose: VerificationPurpose) => {
    let sentCode = '';
    emailService.sendVerificationCodeEmail.mockImplementationOnce((args: { code: string }) => {
      sentCode = args.code;
      return Promise.resolve();
    });
    const ret = await service.issueAndSend({ email, purpose });
    expect(ret).toBeUndefined(); // never returns the code to the caller
    return sentCode;
  };

  it('generates a 6-digit numeric code and stores only a bcrypt hash', async () => {
    const code = await issueAndCaptureCode('a@b.com', VerificationPurpose.LOGIN);
    expect(code).toMatch(/^\d{6}$/);
    const rec = store[0];
    expect(rec.codeHash).not.toBe(code); // never plaintext
    expect(await bcrypt.compare(code, rec.codeHash)).toBe(true);
  });

  it('verifies a correct code once (single-use) and returns its payload', async () => {
    const code = await issueAndCaptureCode('a@b.com', VerificationPurpose.SIGNUP);
    const rec = store[0];
    rec.payload = JSON.stringify({ name: 'X' });
    repo.findOne.mockResolvedValue(rec);

    const res = await service.verify({ email: 'a@b.com', code, purpose: VerificationPurpose.SIGNUP });
    expect(res.payload).toEqual({ name: 'X' });
    expect(rec.consumedAt).toBeInstanceOf(Date); // burned after use
  });

  it('rejects an incorrect code and increments the attempt counter', async () => {
    await issueAndCaptureCode('a@b.com', VerificationPurpose.LOGIN);
    const rec = store[0];
    repo.findOne.mockResolvedValue(rec);

    await expect(
      service.verify({ email: 'a@b.com', code: '000000', purpose: VerificationPurpose.LOGIN }),
    ).rejects.toThrow(InvalidCodeException);
    expect(rec.attemptCount).toBe(1);
  });

  it('rejects an expired code', async () => {
    await issueAndCaptureCode('a@b.com', VerificationPurpose.LOGIN);
    const rec = store[0];
    rec.expiresAt = new Date(Date.now() - 1000); // already expired
    repo.findOne.mockResolvedValue(rec);

    await expect(
      service.verify({ email: 'a@b.com', code: '123456', purpose: VerificationPurpose.LOGIN }),
    ).rejects.toThrow(ExpiredCodeException);
  });

  it('burns the code after too many attempts', async () => {
    await issueAndCaptureCode('a@b.com', VerificationPurpose.LOGIN);
    const rec = store[0];
    rec.attemptCount = 5; // at the cap
    repo.findOne.mockResolvedValue(rec);

    await expect(
      service.verify({ email: 'a@b.com', code: '123456', purpose: VerificationPurpose.LOGIN }),
    ).rejects.toThrow(TooManyAttemptsException);
    expect(rec.consumedAt).toBeInstanceOf(Date);
  });

  it('treats a missing/consumed record as expired (no state leak)', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(
      service.verify({ email: 'a@b.com', code: '123456', purpose: VerificationPurpose.LOGIN }),
    ).rejects.toThrow(ExpiredCodeException);
  });

  it('enforces the resend cooldown', async () => {
    const recent = { createdAt: new Date(), email: 'a@b.com', purpose: VerificationPurpose.LOGIN };
    repo.findOne.mockResolvedValue(recent);
    await expect(
      service.issueAndSend({ email: 'a@b.com', purpose: VerificationPurpose.LOGIN, enforceCooldown: true }),
    ).rejects.toThrow(ResendCooldownException);
  });
});
