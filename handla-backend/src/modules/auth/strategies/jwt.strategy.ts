import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { User } from '../entities/user.entity';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    super({
      // ─── Extract JWT from httpOnly cookie first, then Authorization header ──
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          return req?.cookies?.['access_token'] ?? null;
        },
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret'),
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    // SECURITY: a token stays valid until it expires, so we must re-check the
    // account state on EVERY request — not just at login. Otherwise a user who
    // is disabled/archived (or whose role was revoked) keeps full access with
    // their existing access token until it happens to expire. Rejecting here
    // makes disable/archive take effect immediately.
    if (user.isDisabled || user.isArchived) {
      throw new UnauthorizedException('Your account has been disabled.');
    }

    return user;
  }
}
