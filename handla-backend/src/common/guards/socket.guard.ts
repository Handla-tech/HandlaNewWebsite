import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Injectable()
export class SocketJwtGuard implements CanActivate {
  private readonly logger = new Logger(SocketJwtGuard.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient();
    const token = this.extractToken(client);

    if (!token) {
      throw new WsException('Missing authentication token');
    }

    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('jwt.secret'),
      });
      // Attach user to the socket data
      client.data.user = payload;
      return true;
    } catch (err) {
      this.logger.warn(`Socket auth failed: ${err.message}`);
      throw new WsException('Invalid authentication token');
    }
  }

  private extractToken(client: Socket): string | undefined {
    // Try cookie first
    const cookieHeader = client.handshake.headers?.cookie;
    if (cookieHeader) {
      const cookies = Object.fromEntries(
        cookieHeader.split(';').map((c) => {
          const [k, ...v] = c.trim().split('=');
          return [k.trim(), v.join('=')];
        }),
      );
      if (cookies['access_token']) {
        return cookies['access_token'];
      }
    }

    // Fallback to auth header or handshake auth
    const authHeader = client.handshake.headers?.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }

    return client.handshake.auth?.token;
  }
}
