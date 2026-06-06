import { ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { WsException } from '@nestjs/websockets';

import { SocketJwtGuard } from '../socket.guard';

function makeWsContext(client: any): ExecutionContext {
  return {
    switchToWs: () => ({
      getClient: () => client,
      getData: () => ({}),
      getPattern: () => '',
    }),
    switchToHttp: () => ({} as any),
    switchToRpc: () => ({} as any),
    getHandler: () => () => undefined,
    getClass: () => class {},
    getArgs: () => [] as any,
    getArgByIndex: () => undefined,
    getType: () => 'ws',
  } as unknown as ExecutionContext;
}

function makeClient(overrides: Partial<any> = {}) {
  return {
    id: 'sock-1',
    handshake: {
      headers: {},
      auth: {},
      ...((overrides as any).handshake ?? {}),
    },
    data: {},
    ...overrides,
  };
}

describe('SocketJwtGuard', () => {
  let jwt: { verify: jest.Mock };
  let cfg: { get: jest.Mock };
  let guard: SocketJwtGuard;

  beforeEach(() => {
    jwt = { verify: jest.fn() };
    cfg = { get: jest.fn().mockReturnValue('super-secret') };
    guard = new SocketJwtGuard(jwt as unknown as JwtService, cfg as unknown as ConfigService);
  });

  // ── Token extraction ──────────────────────────────────────────────────────
  describe('token extraction', () => {
    it('throws WsException when no token is provided anywhere', () => {
      const ctx = makeWsContext(makeClient());

      expect(() => guard.canActivate(ctx)).toThrow(WsException);
      expect(() => guard.canActivate(ctx)).toThrow(/Missing authentication token/i);
    });

    it('reads token from access_token cookie', () => {
      const client = makeClient({
        handshake: {
          headers: { cookie: 'foo=bar; access_token=cookie-jwt; other=baz' },
          auth: {},
        },
      });
      jwt.verify.mockReturnValue({ sub: 'u-1' });

      const ok = guard.canActivate(makeWsContext(client));

      expect(ok).toBe(true);
      expect(jwt.verify).toHaveBeenCalledWith('cookie-jwt', { secret: 'super-secret' });
      expect(client.data.user).toEqual({ sub: 'u-1' });
    });

    it('reads token from Bearer Authorization header', () => {
      const client = makeClient({
        handshake: {
          headers: { authorization: 'Bearer header-jwt' },
          auth: {},
        },
      });
      jwt.verify.mockReturnValue({ sub: 'u-2' });

      guard.canActivate(makeWsContext(client));

      expect(jwt.verify).toHaveBeenCalledWith('header-jwt', { secret: 'super-secret' });
    });

    it('reads token from handshake.auth.token when no header/cookie', () => {
      const client = makeClient({
        handshake: { headers: {}, auth: { token: 'auth-jwt' } },
      });
      jwt.verify.mockReturnValue({ sub: 'u-3' });

      guard.canActivate(makeWsContext(client));

      expect(jwt.verify).toHaveBeenCalledWith('auth-jwt', { secret: 'super-secret' });
    });

    it('prefers cookie over header over handshake.auth.token', () => {
      const client = makeClient({
        handshake: {
          headers: {
            cookie: 'access_token=from-cookie',
            authorization: 'Bearer from-header',
          },
          auth: { token: 'from-auth' },
        },
      });
      jwt.verify.mockReturnValue({ sub: 'u-4' });

      guard.canActivate(makeWsContext(client));

      expect(jwt.verify).toHaveBeenCalledWith('from-cookie', { secret: 'super-secret' });
    });

    it('ignores Authorization header that does not start with "Bearer "', () => {
      const client = makeClient({
        handshake: {
          headers: { authorization: 'Basic abc:def' },
          auth: { token: 'auth-jwt' },
        },
      });
      jwt.verify.mockReturnValue({ sub: 'u-5' });

      guard.canActivate(makeWsContext(client));

      expect(jwt.verify).toHaveBeenCalledWith('auth-jwt', { secret: 'super-secret' });
    });

    it('handles cookie strings with extra spaces and equals in values', () => {
      const client = makeClient({
        handshake: {
          headers: { cookie: '  access_token=ab.cd=ef ;  other=1 ' },
          auth: {},
        },
      });
      jwt.verify.mockReturnValue({ sub: 'u-6' });

      guard.canActivate(makeWsContext(client));

      expect(jwt.verify).toHaveBeenCalledWith('ab.cd=ef', { secret: 'super-secret' });
    });
  });

  // ── Verification ─────────────────────────────────────────────────────────
  describe('JWT verification', () => {
    it('attaches the decoded payload to client.data.user on success', () => {
      const client = makeClient({ handshake: { headers: {}, auth: { token: 't' } } });
      jwt.verify.mockReturnValue({ sub: 'u-7', role: 'ADMIN' });

      expect(guard.canActivate(makeWsContext(client))).toBe(true);
      expect(client.data.user).toEqual({ sub: 'u-7', role: 'ADMIN' });
    });

    it('throws WsException with "Invalid authentication token" when verify fails', () => {
      const client = makeClient({ handshake: { headers: {}, auth: { token: 'bad' } } });
      jwt.verify.mockImplementation(() => { throw new Error('jwt malformed'); });

      expect(() => guard.canActivate(makeWsContext(client))).toThrow(WsException);
      expect(() => guard.canActivate(makeWsContext(client))).toThrow(/Invalid authentication token/i);
    });

    it('uses jwt.secret from ConfigService', () => {
      cfg.get.mockReturnValue('my-secret');
      const client = makeClient({ handshake: { headers: {}, auth: { token: 't' } } });
      jwt.verify.mockReturnValue({ sub: 'u' });

      guard.canActivate(makeWsContext(client));

      expect(cfg.get).toHaveBeenCalledWith('jwt.secret');
      expect(jwt.verify).toHaveBeenCalledWith('t', { secret: 'my-secret' });
    });
  });
});
