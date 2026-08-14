import { InternalApiKeyGuard } from '../guards/internal-api-key.guard';

function ctx(headers: Record<string, string>) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  } as any;
}

function guardWith(inboundKey: string) {
  const cfgService = { get: () => ({ inboundKey }) } as any;
  return new InternalApiKeyGuard(cfgService);
}

describe('InternalApiKeyGuard', () => {
  it('fails closed when no inbound key is configured', () => {
    const guard = guardWith('');
    expect(() => guard.canActivate(ctx({ authorization: 'Bearer x' }))).toThrow();
  });

  it('accepts a matching key via Authorization: Bearer', () => {
    const guard = guardWith('s3cr3t');
    expect(guard.canActivate(ctx({ authorization: 'Bearer s3cr3t' }))).toBe(true);
  });

  it('accepts a matching key via X-Internal-Key', () => {
    const guard = guardWith('s3cr3t');
    expect(guard.canActivate(ctx({ 'x-internal-key': 's3cr3t' }))).toBe(true);
  });

  it('rejects a wrong key', () => {
    const guard = guardWith('s3cr3t');
    expect(() => guard.canActivate(ctx({ authorization: 'Bearer nope' }))).toThrow();
  });

  it('rejects a missing key', () => {
    const guard = guardWith('s3cr3t');
    expect(() => guard.canActivate(ctx({}))).toThrow();
  });
});
