import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';

import { AuthService } from './auth.service';
import { SignUpDto } from './dto/signup.dto';
import { SignInDto } from './dto/signin.dto';
import { JwtAuthGuard, Public } from '../../common/guards/jwt.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { User } from './entities/user.entity';
import { ConfigService } from '@nestjs/config';

const COOKIE_NAME = 'access_token';
const REFRESH_COOKIE_NAME = 'refresh_token';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  // ─── POST /api/auth/signup ─────────────────────────────────────────────────
  @Public()
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Register a new client account' })
  @ApiResponse({ status: 201, description: 'User created and cookies set' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  async signUp(@Body() dto: SignUpDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.signUp(dto);
    this.setCookies(res, result.accessToken, result.refreshToken);
    return {
      message: 'Account created successfully',
      data: { user: result.user },
    };
  }

  // ─── POST /api/auth/signin ─────────────────────────────────────────────────
  @Public()
  @Post('signin')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @ApiOperation({ summary: 'Sign in with email and password' })
  @ApiResponse({ status: 200, description: 'Authenticated, cookies set' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async signIn(@Body() dto: SignInDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.signIn(dto);
    this.setCookies(res, result.accessToken, result.refreshToken);
    return {
      message: 'Signed in successfully',
      data: { user: result.user },
    };
  }

  // ─── POST /api/auth/refresh ────────────────────────────────────────────────
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token cookie' })
  @ApiResponse({ status: 200, description: 'New access token set in cookie' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const tokens = await this.authService.refresh(refreshToken);
    this.setCookies(res, tokens.accessToken, tokens.refreshToken);
    return { message: 'Token refreshed successfully', data: {} };
  }

  // ─── POST /api/auth/logout ────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Logout and clear auth cookies' })
  @ApiResponse({ status: 200, description: 'Logged out, cookies cleared' })
  logout(@Res({ passthrough: true }) res: Response) {
    this.clearCookies(res);
    return { message: 'Logged out successfully', data: {} };
  }

  // ─── GET /api/auth/me ─────────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiResponse({ status: 200, description: 'Current user data' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async getMe(@CurrentUser() user: User) {
    const fullUser = await this.authService.getMe(user.id);
    return { message: 'User retrieved', data: { user: fullUser } };
  }

  // ─── Cookie Helpers ───────────────────────────────────────────────────────
  private setCookies(res: Response, accessToken: string, refreshToken: string): void {
    const isProd = this.configService.get('NODE_ENV') === 'production';

    const baseOptions = {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? ('strict' as const) : ('lax' as const),
      path: '/',
    };

    res.cookie(COOKIE_NAME, accessToken, {
      ...baseOptions,
      maxAge: this.configService.get<number>('jwt.expiresIn') * 1000,
    });

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      ...baseOptions,
      maxAge: this.configService.get<number>('jwt.refreshExpiresIn') * 1000,
      path: '/api/auth/refresh',
    });
  }

  private clearCookies(res: Response): void {
    res.clearCookie(COOKIE_NAME, { path: '/' });
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth/refresh' });
  }
}
