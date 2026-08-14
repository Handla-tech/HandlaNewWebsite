import {
  Injectable,
  Logger,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository, LessThan } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

import {
  EmailVerification,
  VerificationPurpose,
} from './entities/email-verification.entity';
import { EmailService } from '../email/email.service';

/** Thrown when a resend is requested before the cooldown window elapses. */
export class ResendCooldownException extends HttpException {
  constructor(public readonly retryAfterSeconds: number) {
    super(
      {
        message: 'Please wait before requesting another code.',
        code: 'RESEND_COOLDOWN',
        retryAfterSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

/** Thrown when the submitted code is wrong (but the record is still alive). */
export class InvalidCodeException extends BadRequestException {
  constructor() {
    super({ message: 'The verification code is incorrect.', code: 'OTP_INVALID' });
  }
}

/** Thrown when the code is expired / consumed / never existed. */
export class ExpiredCodeException extends BadRequestException {
  constructor() {
    super({ message: 'This verification code has expired.', code: 'OTP_EXPIRED' });
  }
}

/** Thrown when the attempt cap is hit — the code is burned. */
export class TooManyAttemptsException extends HttpException {
  constructor() {
    super(
      { message: 'Too many attempts. Please request a new code.', code: 'OTP_TOO_MANY_ATTEMPTS' },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

interface OtpConfig {
  length: number;
  ttlSeconds: number;
  maxAttempts: number;
  resendCooldownSeconds: number;
}

/**
 * Single source of truth for one-time codes across ALL auth flows
 * (signup, login, google, password reset). There is exactly one OtpService and
 * one `email_verifications` table — no parallel systems.
 *
 * Security:
 *  - Codes are cryptographically random, bcrypt-hashed at rest (never plaintext).
 *  - Short TTL; capped attempts; single-use (`consumedAt`); resend cooldown.
 *  - Issuing a new code invalidates any older un-consumed code for the same
 *    (email, purpose).
 *  - The plaintext code is returned ONLY to the internal caller so it can email
 *    it — it is never returned from any controller or logged.
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly cfg: OtpConfig;

  constructor(
    @InjectRepository(EmailVerification)
    private readonly repo: Repository<EmailVerification>,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {
    this.cfg = {
      length: this.configService.get<number>('auth.otp.length') ?? 6,
      ttlSeconds: this.configService.get<number>('auth.otp.ttlSeconds') ?? 600,
      maxAttempts: this.configService.get<number>('auth.otp.maxAttempts') ?? 5,
      resendCooldownSeconds:
        this.configService.get<number>('auth.otp.resendCooldownSeconds') ?? 45,
    };
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Issue a fresh code for (email, purpose), invalidating older ones, and email
   * it. `payload` is opaque server-side data used to complete the flow on
   * verify. Enforces the resend cooldown.
   */
  async issueAndSend(params: {
    email: string;
    purpose: VerificationPurpose;
    userId?: string | null;
    recipientName?: string | null;
    payload?: Record<string, unknown> | null;
    locale?: string;
    /** When true, throws ResendCooldownException if still cooling down. */
    enforceCooldown?: boolean;
  }): Promise<void> {
    const email = params.email.toLowerCase();

    if (params.enforceCooldown) {
      const last = await this.repo.findOne({
        where: { email, purpose: params.purpose },
        order: { createdAt: 'DESC' },
      });
      if (last) {
        const elapsed = (Date.now() - new Date(last.createdAt).getTime()) / 1000;
        const remaining = Math.ceil(this.cfg.resendCooldownSeconds - elapsed);
        if (remaining > 0) throw new ResendCooldownException(remaining);
      }
    }

    // Invalidate all previous un-consumed codes for this (email, purpose).
    await this.repo.update(
      { email, purpose: params.purpose, consumedAt: null as unknown as Date },
      { consumedAt: new Date() },
    );

    const code = this.generateNumericCode(this.cfg.length);
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + this.cfg.ttlSeconds * 1000);

    const record = this.repo.create({
      email,
      userId: params.userId ?? null,
      codeHash,
      purpose: params.purpose,
      payload: params.payload ? JSON.stringify(params.payload) : null,
      attemptCount: 0,
      expiresAt,
      consumedAt: null,
    });
    await this.repo.save(record);

    await this.emailService.sendVerificationCodeEmail({
      recipientEmail: email,
      recipientName: params.recipientName ?? null,
      code,
      expiresInMinutes: Math.round(this.cfg.ttlSeconds / 60),
      purpose: this.purposeToEmailKind(params.purpose),
      locale: params.locale,
    });

    // NEVER log the code.
    this.logger.log(`Issued ${params.purpose} OTP → ${email} (expires ${expiresAt.toISOString()})`);
  }

  /**
   * Verify a submitted code for (email, purpose). On success returns the stored
   * payload (parsed) and marks the record consumed (single-use). On failure
   * throws a typed exception and increments the attempt counter.
   */
  async verify(params: {
    email: string;
    purpose: VerificationPurpose;
    code: string;
  }): Promise<{ userId: string | null; payload: Record<string, unknown> | null }> {
    const email = params.email.toLowerCase();

    const record = await this.repo.findOne({
      where: { email, purpose: params.purpose, consumedAt: null as unknown as Date },
      order: { createdAt: 'DESC' },
    });

    // Generic "expired" for missing/consumed to avoid leaking which state applies.
    if (!record) throw new ExpiredCodeException();

    if (new Date(record.expiresAt).getTime() < Date.now()) {
      throw new ExpiredCodeException();
    }

    if (record.attemptCount >= this.cfg.maxAttempts) {
      // Burn it so it can't be brute-forced further.
      record.consumedAt = new Date();
      await this.repo.save(record);
      throw new TooManyAttemptsException();
    }

    const ok = await bcrypt.compare(params.code, record.codeHash);
    if (!ok) {
      record.attemptCount += 1;
      if (record.attemptCount >= this.cfg.maxAttempts) {
        record.consumedAt = new Date();
        await this.repo.save(record);
        throw new TooManyAttemptsException();
      }
      await this.repo.save(record);
      throw new InvalidCodeException();
    }

    // Success → single-use consume.
    record.consumedAt = new Date();
    await this.repo.save(record);

    return {
      userId: record.userId,
      payload: record.payload ? (JSON.parse(record.payload) as Record<string, unknown>) : null,
    };
  }

  /**
   * Return the payload of the most-recent un-consumed code for (email, purpose)
   * so a resend can carry over the pending signup/google data. Returns null if
   * none. Does NOT expose the code.
   */
  async peekLastPayload(
    email: string,
    purpose: VerificationPurpose,
  ): Promise<Record<string, unknown> | null> {
    const record = await this.repo.findOne({
      where: { email: email.toLowerCase(), purpose, consumedAt: null as unknown as Date },
      order: { createdAt: 'DESC' },
    });
    if (!record?.payload) return null;
    try {
      return JSON.parse(record.payload) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  /** Best-effort cleanup of expired/consumed rows (called opportunistically). */
  async purgeExpired(): Promise<void> {
    try {
      await this.repo.delete({ expiresAt: LessThan(new Date(Date.now() - 60 * 60 * 1000)) });
    } catch {
      /* non-critical */
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /** Cryptographically-secure numeric code, zero-padded to `length` digits. */
  private generateNumericCode(length: number): string {
    const max = 10 ** length;
    // rejection-free: read a big enough random integer then mod
    const buf = crypto.randomBytes(6);
    const n = parseInt(buf.toString('hex'), 16) % max;
    return n.toString().padStart(length, '0');
  }

  private purposeToEmailKind(
    p: VerificationPurpose,
  ): 'signup' | 'login' | 'google' | 'reset' {
    switch (p) {
      case VerificationPurpose.SIGNUP:
        return 'signup';
      case VerificationPurpose.LOGIN:
        return 'login';
      case VerificationPurpose.GOOGLE:
        return 'google';
      case VerificationPurpose.PASSWORD_RESET:
        return 'reset';
    }
  }
}
