import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  Query,
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
import { VerifyOtpDto, ResendOtpDto } from './dto/verify-otp.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password-reset.dto';
import { GoogleOAuthService } from './google-oauth.service';
import { JwtAuthGuard, Public } from '../../common/guards/jwt.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { User } from './entities/user.entity';
import { ConfigService } from '@nestjs/config';

const OAUTH_STATE_COOKIE = 'g_oauth_state';

const COOKIE_NAME = 'access_token';
const REFRESH_COOKIE_NAME = 'refresh_token';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly googleOAuth: GoogleOAuthService,
  ) {}

  // ─── POST /api/auth/signup ─────────────────────────────────────────────────
  // Step 1 of 2: validate + email a 6-digit OTP. NO session is created here.
  @Public()
  @Post('signup')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Start signup — validates and sends an email OTP' })
  @ApiResponse({ status: 200, description: 'Verification code sent' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  async signUp(@Body() dto: SignUpDto) {
    const result = await this.authService.signUp(dto);
    return {
      message: 'Verification code sent to your email',
      data: result,
    };
  }

  // ─── POST /api/auth/signin ─────────────────────────────────────────────────
  // Verified accounts sign in directly (session cookies set here). Only accounts
  // whose email was never verified are routed to the OTP screen.
  @Public()
  @Post('signin')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @ApiOperation({ summary: 'Sign in — direct session for verified accounts, OTP only for unverified' })
  @ApiResponse({ status: 200, description: 'Signed in, or verification required' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async signIn(@Body() dto: SignInDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.signIn(dto);

    // Unverified account → verification required (no session).
    if ('status' in result && result.status === 'verification_required') {
      return { message: 'Verification code sent to your email', data: result };
    }

    // Verified account → create the session (cookies + body).
    const session = result as { user: unknown; accessToken: string; refreshToken: string };
    this.setCookies(res, session.accessToken, session.refreshToken);
    return {
      message: 'Signed in successfully',
      data: {
        user: session.user,
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
      },
    };
  }

  // ─── POST /api/auth/verify-otp ──────────────────────────────────────────────
  // Step 2 of 2: verify the code, THEN create the session (cookies + body).
  @Public()
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 300000 } })
  @ApiOperation({ summary: 'Verify an email OTP and complete authentication' })
  @ApiResponse({ status: 200, description: 'Verified — session created, cookies set' })
  @ApiResponse({ status: 400, description: 'Invalid or expired code' })
  async verifyOtp(@Body() dto: VerifyOtpDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.verifyOtp(dto);
    this.setCookies(res, result.accessToken, result.refreshToken);
    return {
      message: 'Verified successfully',
      data: {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
    };
  }

  // ─── POST /api/auth/resend-otp ──────────────────────────────────────────────
  @Public()
  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 300000 } })
  @ApiOperation({ summary: 'Resend the verification code (rate-limited + cooldown)' })
  async resendOtp(@Body() dto: ResendOtpDto & { locale?: string }) {
    const result = await this.authService.resendOtp({
      email: dto.email,
      purpose: dto.purpose,
      locale: (dto as { locale?: string }).locale,
    });
    return { message: 'A new verification code has been sent.', data: result };
  }

  // ─── GET /api/auth/google ───────────────────────────────────────────────────
  // Redirects the browser to Google's consent screen with an anti-CSRF state.
  @Public()
  @Get('google')
  @ApiOperation({ summary: 'Begin Google OAuth (redirect to consent screen)' })
  googleStart(@Res() res: Response) {
    const { url, state } = this.authService.startGoogle();
    const isProd = this.configService.get('NODE_ENV') === 'production';
    res.cookie(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/api/auth/google',
      maxAge: 10 * 60 * 1000,
    });
    return res.redirect(url);
  }

  // ─── GET /api/auth/google/callback ─────────────────────────────────────────
  // Google redirects here with ?code&state. We verify state, exchange the code,
  // issue a Handla OTP, then bounce back to the frontend /auth OTP screen.
  @Public()
  @Get('google/callback')
  @ApiOperation({ summary: 'Google OAuth callback — issues a Handla OTP' })
  async googleCallback(
    @Req() req: Request,
    @Res() res: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
  ) {
    const frontendUrl =
      this.configService.get<string>('auth.frontendUrl') || 'http://localhost:3000';
    const cookieState = req.cookies?.[OAUTH_STATE_COOKIE];
    res.clearCookie(OAUTH_STATE_COOKIE, { path: '/api/auth/google' });

    // Any failure → back to /auth with a generic error flag (no raw OAuth error).
    if (error || !code || !state || !cookieState || state !== cookieState) {
      return res.redirect(`${frontendUrl}/auth?error=google`);
    }

    try {
      const result = await this.authService.handleGoogleCallback(code);
      const params = new URLSearchParams({
        verify: '1',
        purpose: 'GOOGLE',
        email: result.email,
      });
      return res.redirect(`${frontendUrl}/auth?${params.toString()}`);
    } catch {
      return res.redirect(`${frontendUrl}/auth?error=google`);
    }
  }

  // ─── POST /api/auth/forgot-password ────────────────────────────────────────
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @ApiOperation({ summary: 'Request a password-reset code (anti-enumeration)' })
  async forgotPassword(@Body() dto: ForgotPasswordDto & { locale?: string }) {
    await this.authService.forgotPassword(dto.email, (dto as { locale?: string }).locale);
    // Always the same response whether or not the account exists.
    return {
      message: 'If an account exists for that email, a reset code has been sent.',
      data: { status: 'ok' },
    };
  }

  // ─── POST /api/auth/reset-password ─────────────────────────────────────────
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @ApiOperation({ summary: 'Reset password using an emailed code' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto);
    return { message: 'Your password has been reset. You can now sign in.', data: { status: 'ok' } };
  }

  // ─── POST /api/auth/refresh ────────────────────────────────────────────────
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token cookie' })
  @ApiResponse({ status: 200, description: 'New access token set in cookie' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body: { refreshToken?: string },
  ) {
    // Cookie first (browser), then body / X-Refresh-Token header (mobile app).
    const headerToken = req.headers['x-refresh-token'];
    const refreshToken =
      req.cookies?.[REFRESH_COOKIE_NAME] ||
      body?.refreshToken ||
      (typeof headerToken === 'string' ? headerToken : undefined);

    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const tokens = await this.authService.refresh(refreshToken);
    this.setCookies(res, tokens.accessToken, tokens.refreshToken);
    // New tokens ALSO in the body for the mobile app. Backward compatible.
    return {
      message: 'Token refreshed successfully',
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    };
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
