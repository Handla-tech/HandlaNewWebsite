import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'crypto';

import type { SaasConfig } from '../../../config/saas.config';

/**
 * SAAS-1 — Authenticates INBOUND service-to-service callbacks from products
 * (e.g. a product reporting provisioning status back to Handla). Guards the
 * @Public() internal endpoints so they bypass JWT but still require a shared
 * secret.
 *
 * The key is read from `Authorization: Bearer` or `X-Internal-Key` and compared
 * (constant-time) against the SHA-256 of the configured inbound secret.
 */
@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  private readonly cfg: SaasConfig;

  constructor(private readonly configService: ConfigService) {
    this.cfg = this.configService.get<SaasConfig>('saas')!;
  }

  canActivate(context: ExecutionContext): boolean {
    const expected = this.cfg.inboundKey;
    if (!expected) {
      // Fail closed: if no inbound key is configured the endpoint is disabled.
      throw new UnauthorizedException('Internal API is not configured');
    }

    const req = context.switchToHttp().getRequest();
    const provided = this.extractKey(req);
    if (!provided) {
      throw new UnauthorizedException('Missing internal API key');
    }

    const a = createHash('sha256').update(provided).digest();
    const b = createHash('sha256').update(expected).digest();
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid internal API key');
    }
    return true;
  }

  private extractKey(req: any): string | null {
    const authz: string | undefined = req.headers?.authorization;
    if (authz && authz.toLowerCase().startsWith('bearer ')) {
      return authz.slice(7).trim() || null;
    }
    const header = req.headers?.['x-internal-key'];
    if (typeof header === 'string' && header.trim()) return header.trim();
    return null;
  }
}
