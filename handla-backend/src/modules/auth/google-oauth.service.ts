import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import * as crypto from 'crypto';

export interface GoogleIdentity {
  /** Google's stable subject id — the ONLY safe key to match accounts on. */
  providerId: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
}

/**
 * Server-side Google OAuth 2.0 (authorization-code flow).
 *
 * We build the consent URL with an anti-CSRF `state`, exchange the returned
 * code for tokens, and cryptographically verify the `id_token` signature and
 * audience with google-auth-library. No frontend-only trust: the browser only
 * ever carries the opaque code + state.
 */
@Injectable()
export class GoogleOAuthService {
  private readonly logger = new Logger(GoogleOAuthService.name);
  private readonly client: OAuth2Client;
  private readonly clientId: string;
  private readonly redirectUri: string;

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get<string>('auth.google.clientId') || '';
    const clientSecret = this.configService.get<string>('auth.google.clientSecret') || '';
    this.redirectUri = this.configService.get<string>('auth.google.redirectUri') || '';
    this.client = new OAuth2Client({
      clientId: this.clientId,
      clientSecret,
      redirectUri: this.redirectUri,
    });
  }

  /** True only when Google credentials are configured. */
  isConfigured(): boolean {
    return Boolean(this.clientId && this.redirectUri);
  }

  /** Random opaque anti-CSRF state token. */
  generateState(): string {
    return crypto.randomBytes(24).toString('hex');
  }

  /** Build the Google consent-screen URL for the given state. */
  buildAuthUrl(state: string): string {
    if (!this.isConfigured()) {
      throw new BadRequestException('Google sign-in is not configured on this server.');
    }
    return this.client.generateAuthUrl({
      access_type: 'online',
      prompt: 'select_account',
      scope: ['openid', 'email', 'profile'],
      state,
      redirect_uri: this.redirectUri,
    });
  }

  /**
   * Exchange the authorization `code` for tokens and verify the id_token.
   * Returns the verified Google identity. Throws on any failure.
   */
  async exchangeCode(code: string): Promise<GoogleIdentity> {
    if (!this.isConfigured()) {
      throw new BadRequestException('Google sign-in is not configured on this server.');
    }
    try {
      const { tokens } = await this.client.getToken({ code, redirect_uri: this.redirectUri });
      if (!tokens.id_token) {
        throw new Error('No id_token returned by Google');
      }
      const ticket = await this.client.verifyIdToken({
        idToken: tokens.id_token,
        audience: this.clientId,
      });
      const p = ticket.getPayload();
      if (!p || !p.sub || !p.email) {
        throw new Error('Incomplete Google id_token payload');
      }
      return {
        providerId: p.sub,
        email: p.email.toLowerCase(),
        emailVerified: Boolean(p.email_verified),
        name: p.name ?? null,
        picture: p.picture ?? null,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Google code exchange failed: ${msg}`);
      // Generic message to the caller — never leak OAuth internals.
      throw new BadRequestException('Google authentication failed. Please try again.');
    }
  }
}
