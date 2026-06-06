import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { RolesGuard } from '../roles.guard';
import { ROLES_KEY } from '../../decorators/roles.decorator';
import { UserRole } from '../../enums';

// Helper to build a fake ExecutionContext that exposes the bits the guard touches.
function makeContext(user: any, handler = () => undefined, klass: any = class {}): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => klass,
    switchToHttp: () => ({
      getRequest: () => ({ user }),
      getResponse: () => ({}),
      getNext: () => ({}),
    }),
    switchToRpc: () => ({} as any),
    switchToWs: () => ({} as any),
    getArgs: () => [] as any,
    getArgByIndex: () => undefined,
    getType: () => 'http',
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('passes when no @Roles() decorator is set on the route', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const ctx = makeContext({ id: 'u', role: UserRole.CLIENT });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('passes when @Roles() is set but the metadata is an empty array', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([]);
    const ctx = makeContext({ id: 'u', role: UserRole.CLIENT });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws ForbiddenException when roles are required but request has no user', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);
    const ctx = makeContext(undefined);

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(ctx)).toThrow(/No user found/i);
  });

  it('throws ForbiddenException when user role does not match required roles', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);
    const ctx = makeContext({ id: 'u', role: UserRole.CLIENT });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    try {
      guard.canActivate(ctx);
    } catch (err: any) {
      expect(err.message).toContain('Access denied');
      expect(err.message).toContain(UserRole.ADMIN);
    }
  });

  it('passes when user role exactly matches the single required role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);
    const ctx = makeContext({ id: 'u', role: UserRole.ADMIN });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('passes when user role matches one of multiple required roles', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN, UserRole.EMPLOYEE]);
    const ctx = makeContext({ id: 'u', role: UserRole.EMPLOYEE });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('looks up metadata under ROLES_KEY on both handler and class', () => {
    const spy = jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);
    const handler = () => undefined;
    const klass = class FakeController {};
    const ctx = makeContext({ id: 'u', role: UserRole.ADMIN }, handler, klass);

    guard.canActivate(ctx);

    expect(spy).toHaveBeenCalledWith(ROLES_KEY, [handler, klass]);
  });

  it('LEAD users are blocked from ADMIN-only routes', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);
    const ctx = makeContext({ id: 'u', role: UserRole.LEAD });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
