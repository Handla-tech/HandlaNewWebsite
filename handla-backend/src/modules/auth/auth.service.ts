import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

import { User } from './entities/user.entity';
import { SignUpDto } from './dto/signup.dto';
import { SignInDto } from './dto/signin.dto';
import { UserRole } from '../../common/enums';
import { EmailAlreadyExistsException, InvalidCredentialsException } from '../../utils/exceptions';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: Omit<User, 'passwordHash'>;
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly BCRYPT_ROUNDS = 10;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // ─── Sign Up ─────────────────────────────────────────────────────────────────
  async signUp(dto: SignUpDto): Promise<AuthResponse> {
    const existing = await this.userRepository.findOne({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new EmailAlreadyExistsException(dto.email);
    }

    const passwordHash = await bcrypt.hash(dto.password, this.BCRYPT_ROUNDS);

    const user = this.userRepository.create({
      email: dto.email.toLowerCase(),
      passwordHash,
      name: dto.name,
      role: UserRole.LEAD,
    });

    await this.userRepository.save(user);
    this.logger.log(`New user registered: ${user.email} (${user.id})`);

    const tokens = this.generateTokens(user);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  // ─── Sign In ─────────────────────────────────────────────────────────────────
  async signIn(dto: SignInDto): Promise<AuthResponse> {
    const user = await this.userRepository.findOne({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      throw new InvalidCredentialsException();
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new InvalidCredentialsException();
    }

    // Block disabled or archived accounts from signing in.
    // Return a generic 401 — don't reveal *why* to the caller for security.
    if (user.isDisabled || user.isArchived) {
      this.logger.warn(`Blocked sign-in attempt for disabled/archived user: ${user.email} (${user.id})`);
      throw new UnauthorizedException('Your account has been disabled. Please contact support.');
    }

    this.logger.log(`User signed in: ${user.email} (${user.id})`);

    const tokens = this.generateTokens(user);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  // ─── Refresh Token ────────────────────────────────────────────────────────────
  async refresh(refreshToken: string): Promise<AuthTokens> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });

      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('User no longer exists');
      }

      // Invalidate refresh tokens for disabled/archived users immediately
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
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.sanitizeUser(user);
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
}
