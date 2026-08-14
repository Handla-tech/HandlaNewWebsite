import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

import { User } from './entities/user.entity';
import { VerificationPurpose } from './entities/email-verification.entity';
import { SignUpDto } from './dto/signup.dto';
import { SignInDto } from './dto/signin.dto';
import { UserRole } from '../../common/enums';
import { BCRYPT_ROUNDS } from '../../common/constants/security.constants';
import { EmailAlreadyExistsException, InvalidCredentialsException } from '../../utils/exceptions';
import { OtpService } from './otp.service';
import { GoogleOAuthService, GoogleIdentity } from './google-oauth.service';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: Omit<User, 'passwordHash'>;
  accessToken: string;
  refreshToken: string;
}

/** Returned when a flow needs an OTP step before a session can be created. */
export interface PendingVerificationResponse {
  status: 'verification_required';
  email: string;
  purpose: 'SIGNUP' | 'LOGIN' | 'GOOGLE';
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly BCRYPT_ROUNDS = BCRYPT_ROUNDS;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly otpService: OtpService,
    private readonly googleOAuth: GoogleOAuthService,
  ) {}

  // ─── Sign Up (step 1: validate + issue OTP, NO session yet) ──────────────────
  async signUp(dto: SignUpDto): Promise<PendingVerificationResponse> {
    const email = dto.email.toLowerCase();
    const existing = await this.userRepository.findOne({ where: { email } });

    // If a fully-verified account exists, block. If a stale UNVERIFIED row
    // exists (user abandoned a prior signup), allow re-issuing a code for it.
    if (existing && existing.emailVerifiedAt) {
      throw new EmailAlreadyExistsException(dto.email);
    }

    const passwordHash = await bcrypt.hash(dto.password, this.BCRYPT_ROUNDS);

    // Do NOT create the user yet. Stash everything needed to create it in the
    // OTP payload; the row is only created after the code is verified.
    await this.otpService.issueAndSend({
      email,
      purpose: VerificationPurpose.SIGNUP,
      userId: existing?.id ?? null,
      recipientName: dto.name,
      locale: dto.locale,
      payload: { name: dto.name, passwordHash },
    });

    this.logger.log(`Signup OTP issued for pending account: ${email}`);
    return { status: 'verification_required', email, purpose: 'SIGNUP' };
  }

  // ─── Sign In (step 1: validate credentials + issue OTP, NO session yet) ──────
  async signIn(dto: SignInDto): Promise<PendingVerificationResponse> {
    const email = dto.email.toLowerCase();
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user || !user.passwordHash) {
      throw new InvalidCredentialsException();
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new InvalidCredentialsException();
    }

    if (user.isDisabled || user.isArchived) {
      this.logger.warn(`Blocked sign-in attempt for disabled/archived user: ${email} (${user.id})`);
      throw new UnauthorizedException('Your account has been disabled. Please contact support.');
    }

    // Credentials are valid — but issue an OTP as a mandatory second step
    // BEFORE creating any session.
    await this.otpService.issueAndSend({
      email,
      purpose: VerificationPurpose.LOGIN,
      userId: user.id,
      recipientName: user.name,
      locale: dto.locale,
    });

    this.logger.log(`Login OTP issued: ${email} (${user.id})`);
    return { status: 'verification_required', email, purpose: 'LOGIN' };
  }

  // ─── Verify OTP (step 2: complete the flow → session) ────────────────────────
  async verifyOtp(params: {
    email: string;
    code: string;
    purpose: 'SIGNUP' | 'LOGIN' | 'GOOGLE';
  }): Promise<AuthResponse> {
    const purpose = VerificationPurpose[params.purpose];
    const { userId, payload } = await this.otpService.verify({
      email: params.email,
      code: params.code,
      purpose,
    });

    if (params.purpose === 'SIGNUP') {
      return this.completeSignup(params.email, payload);
    }

    if (params.purpose === 'GOOGLE') {
      return this.completeGoogle(params.email, payload);
    }

    // LOGIN — the account already exists and was verified during signIn.
    const user = userId
      ? await this.userRepository.findOne({ where: { id: userId } })
      : await this.userRepository.findOne({ where: { email: params.email.toLowerCase() } });

    if (!user) throw new UnauthorizedException('Account not found');
    if (user.isDisabled || user.isArchived) {
      throw new UnauthorizedException('Your account has been disabled. Please contact support.');
    }

    const tokens = this.generateTokens(user);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  // ─── Resend OTP ──────────────────────────────────────────────────────────────
  async resendOtp(params: {
    email: string;
    purpose: 'SIGNUP' | 'LOGIN' | 'GOOGLE';
    locale?: string;
  }): Promise<{ status: 'resent' }> {
    const email = params.email.toLowerCase();
    const purpose = VerificationPurpose[params.purpose];

    // Re-issue using the most-recent record's payload so the pending
    // signup/google data survives the resend. Enforce the cooldown.
    const user = await this.userRepository.findOne({ where: { email } });

    // We need the last payload for SIGNUP/GOOGLE; pull it from OtpService's store
    // indirectly by re-issuing with the same payload the record already holds.
    // OtpService.issueAndSend invalidates old codes, so grab the payload first.
    const lastPayload = await this.getLastPendingPayload(email, purpose);

    await this.otpService.issueAndSend({
      email,
      purpose,
      userId: user?.id ?? null,
      recipientName: user?.name ?? (lastPayload?.name as string | undefined) ?? null,
      locale: params.locale,
      payload: lastPayload,
      enforceCooldown: true,
    });

    return { status: 'resent' };
  }

  // ─── Google OAuth ──────────────────────────────────────────────────────────
  /** Build the Google consent URL + anti-CSRF state. */
  startGoogle(): { url: string; state: string } {
    const state = this.googleOAuth.generateState();
    return { url: this.googleOAuth.buildAuthUrl(state), state };
  }

  /**
   * Handle the Google callback: verify the code → resolve/create-pending user →
   * issue a Handla OTP. Returns the email to verify (session only after OTP).
   */
  async handleGoogleCallback(code: string, locale?: string): Promise<PendingVerificationResponse> {
    const identity = await this.googleOAuth.exchangeCode(code);
    if (!identity.emailVerified) {
      throw new BadRequestException('Your Google email is not verified.');
    }

    const existing = await this.userRepository.findOne({
      where: { email: identity.email },
    });

    if (existing) {
      if (existing.isDisabled || existing.isArchived) {
        throw new UnauthorizedException('Your account has been disabled. Please contact support.');
      }
      // Link provider id to the existing account (matched by verified EMAIL,
      // never display name). Never creates a duplicate user.
      if (!existing.provider) {
        existing.provider = 'google';
        existing.providerId = identity.providerId;
        await this.userRepository.save(existing);
      }
      await this.otpService.issueAndSend({
        email: identity.email,
        purpose: VerificationPurpose.GOOGLE,
        userId: existing.id,
        recipientName: existing.name,
        locale,
      });
    } else {
      // New Google user → create ONLY after OTP. Stash the identity in payload.
      await this.otpService.issueAndSend({
        email: identity.email,
        purpose: VerificationPurpose.GOOGLE,
        recipientName: identity.name,
        locale,
        payload: {
          name: identity.name || identity.email.split('@')[0],
          providerId: identity.providerId,
          avatarUrl: identity.picture,
        },
      });
    }

    return { status: 'verification_required', email: identity.email, purpose: 'GOOGLE' };
  }

  // ─── Forgot / Reset Password ─────────────────────────────────────────────────
  /** Always returns success shape (anti-enumeration); only sends if user exists. */
  async forgotPassword(email: string, locale?: string): Promise<{ status: 'ok' }> {
    const lower = email.toLowerCase();
    const user = await this.userRepository.findOne({ where: { email: lower } });
    if (user && !user.isDisabled && !user.isArchived) {
      await this.otpService.issueAndSend({
        email: lower,
        purpose: VerificationPurpose.PASSWORD_RESET,
        userId: user.id,
        recipientName: user.name,
        locale,
      });
    }
    return { status: 'ok' };
  }

  async resetPassword(params: {
    email: string;
    code: string;
    password: string;
  }): Promise<{ status: 'ok' }> {
    const { userId } = await this.otpService.verify({
      email: params.email,
      code: params.code,
      purpose: VerificationPurpose.PASSWORD_RESET,
    });

    const user = userId
      ? await this.userRepository.findOne({ where: { id: userId } })
      : await this.userRepository.findOne({ where: { email: params.email.toLowerCase() } });
    if (!user) throw new BadRequestException('Account not found');

    user.passwordHash = await bcrypt.hash(params.password, this.BCRYPT_ROUNDS);
    // A successful reset also confirms ownership of the email.
    if (!user.emailVerifiedAt) user.emailVerifiedAt = new Date();
    await this.userRepository.save(user);
    this.logger.log(`Password reset completed for ${user.email} (${user.id})`);
    return { status: 'ok' };
  }

  // ─── Refresh Token ────────────────────────────────────────────────────────────
  async refresh(refreshToken: string): Promise<AuthTokens> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });

      const user = await this.userRepository.findOne({ where: { id: payload.sub } });
      if (!user) {
        throw new UnauthorizedException('User no longer exists');
      }
      if (user.isDisabled || user.isArchived) {
        throw new UnauthorizedException('Your account has been disabled. Please contact support.');
      }
      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  // ─── Get Me ───────────────────────────────────────────────────────────────────
  async getMe(userId: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return this.sanitizeUser(user);
  }

  // ─── Private: flow completion ─────────────────────────────────────────────────

  /** Create/activate the user after a verified SIGNUP OTP. */
  private async completeSignup(
    email: string,
    payload: Record<string, unknown> | null,
  ): Promise<AuthResponse> {
    const lower = email.toLowerCase();
    let user = await this.userRepository.findOne({ where: { email: lower } });

    if (!user) {
      if (!payload?.passwordHash || !payload?.name) {
        throw new BadRequestException('Signup session expired. Please start again.');
      }
      user = this.userRepository.create({
        email: lower,
        passwordHash: payload.passwordHash as string,
        name: payload.name as string,
        role: UserRole.LEAD,
        emailVerifiedAt: new Date(),
      });
      await this.userRepository.save(user);
      this.logger.log(`New verified user created: ${user.email} (${user.id})`);
    } else if (!user.emailVerifiedAt) {
      // Re-verifying a previously abandoned unverified row.
      user.emailVerifiedAt = new Date();
      if (payload?.passwordHash) user.passwordHash = payload.passwordHash as string;
      if (payload?.name) user.name = payload.name as string;
      await this.userRepository.save(user);
    }

    const tokens = this.generateTokens(user);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  /** Create/link the user after a verified GOOGLE OTP. */
  private async completeGoogle(
    email: string,
    payload: Record<string, unknown> | null,
  ): Promise<AuthResponse> {
    const lower = email.toLowerCase();
    let user = await this.userRepository.findOne({ where: { email: lower } });

    if (!user) {
      user = this.userRepository.create({
        email: lower,
        name: (payload?.name as string) || lower.split('@')[0],
        role: UserRole.LEAD,
        provider: 'google',
        providerId: (payload?.providerId as string) || null,
        avatarUrl: (payload?.avatarUrl as string) || null,
        passwordHash: null,
        emailVerifiedAt: new Date(),
      });
      await this.userRepository.save(user);
      this.logger.log(`New Google user created: ${user.email} (${user.id})`);
    } else {
      // Existing account — ensure verified + provider linked.
      if (!user.emailVerifiedAt) user.emailVerifiedAt = new Date();
      if (!user.provider) {
        user.provider = 'google';
        user.providerId = (payload?.providerId as string) || user.providerId;
      }
      await this.userRepository.save(user);
    }

    if (user.isDisabled || user.isArchived) {
      throw new UnauthorizedException('Your account has been disabled. Please contact support.');
    }

    const tokens = this.generateTokens(user);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────
  private generateTokens(user: User): AuthTokens {
    const payload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.secret'),
      expiresIn: this.configService.get<number>('jwt.expiresIn'),
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.refreshSecret'),
      expiresIn: this.configService.get<number>('jwt.refreshExpiresIn'),
    });

    return { accessToken, refreshToken };
  }

  private sanitizeUser(user: User): Omit<User, 'passwordHash'> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...safe } = user as any;
    return safe;
  }

  /** Fetch the payload of the last un-consumed OTP for resend continuity. */
  private async getLastPendingPayload(
    email: string,
    purpose: VerificationPurpose,
  ): Promise<Record<string, unknown> | null> {
    return this.otpService.peekLastPayload(email, purpose);
  }
}
