import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';

import { ClientApiKey } from '../entities/client-api-key.entity';

/**
 * SUP-2 — ApiKeyGuard
 *
 * Authenticates external ticket-ingest requests using a per-client API key.
 * The key is read from either:
 *   - `Authorization: Bearer <key>`  (preferred)
 *   - `X-Api-Key: <key>`             (fallback)
 *
 * On success, the resolved ClientApiKey (with its clientId) is attached to
 * `request.apiKey` and `lastUsedAt` is bumped asynchronously.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    @InjectRepository(ClientApiKey)
    private readonly apiKeyRepo: Repository<ClientApiKey>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const raw = this.extractKey(request);
    if (!raw) {
      throw new UnauthorizedException('Missing API key');
    }

    const keyHash = createHash('sha256').update(raw).digest('hex');
    const record = await this.apiKeyRepo.findOne({ where: { keyHash } });

    if (!record || !record.isActive) {
      throw new UnauthorizedException('Invalid or revoked API key');
    }

    request.apiKey = record;

    // Bump last-used timestamp without blocking the request.
    void this.apiKeyRepo
      .update({ id: record.id }, { lastUsedAt: new Date() })
      .catch(() => undefined);

    return true;
  }

  private extractKey(request: any): string | null {
    const authz: string | undefined = request.headers?.authorization;
    if (authz && authz.toLowerCase().startsWith('bearer ')) {
      return authz.slice(7).trim() || null;
    }
    const headerKey = request.headers?.['x-api-key'];
    if (typeof headerKey === 'string' && headerKey.trim()) {
      return headerKey.trim();
    }
    return null;
  }
}

/**
 * Param decorator: injects the ClientApiKey resolved by ApiKeyGuard.
 * Usage: `@ApiKeyClient() apiKey: ClientApiKey`
 */
export const ApiKeyClient = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext): any => {
    const request = ctx.switchToHttp().getRequest();
    const apiKey = request.apiKey;
    return data ? apiKey?.[data] : apiKey;
  },
);
