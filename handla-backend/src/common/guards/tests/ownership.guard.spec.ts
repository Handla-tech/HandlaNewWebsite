import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { OwnershipGuard } from '../ownership.guard';
import { IS_OWNED_RESOURCE } from '../../decorators/owned-resource.decorator';
import { UserRole } from '../../enums';
import {
  InsufficientPermissionsException,
  OwnershipViolationException,
} from '../../../utils/exceptions';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildContext(
  user: { id: string; role: UserRole } | null,
  body: Record<string, any> = {},
  params: Record<string, any> = {},
): ExecutionContext {
  const request = { user, body, params };
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

function buildReflector(isOwnedResource: boolean): Reflector {
  return {
    getAllAndOverride: jest.fn().mockReturnValue(isOwnedResource),
  } as unknown as Reflector;
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('OwnershipGuard', () => {
  // ── 1. Non-owned route — guard is a no-op ────────────────────────────────
  it('passes when route is NOT decorated with @OwnedResource()', () => {
    const guard = new OwnershipGuard(buildReflector(false));
    const ctx = buildContext({ id: 'u1', role: UserRole.CLIENT });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  // ── 2. ADMIN always bypasses ──────────────────────────────────────────────
  it('passes for ADMIN regardless of ownerId', () => {
    const guard = new OwnershipGuard(buildReflector(true));
    const ctx = buildContext({ id: 'admin-1', role: UserRole.ADMIN }, { ownerId: 'someone-else' });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  // ── 3. EMPLOYEE with matching ownerId in body — passes ───────────────────
  it('passes for EMPLOYEE when body.ownerId matches user.id', () => {
    const guard = new OwnershipGuard(buildReflector(true));
    const ctx = buildContext({ id: 'emp-1', role: UserRole.EMPLOYEE }, { ownerId: 'emp-1' });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  // ── 4. EMPLOYEE with mismatched ownerId in body — throws ─────────────────
  it('throws OwnershipViolationException for EMPLOYEE when body.ownerId !== user.id', () => {
    const guard = new OwnershipGuard(buildReflector(true));
    const ctx = buildContext({ id: 'emp-1', role: UserRole.EMPLOYEE }, { ownerId: 'emp-2' });

    expect(() => guard.canActivate(ctx)).toThrow(OwnershipViolationException);
  });

  // ── 5. EMPLOYEE with no ownerId in request — defers to service layer ──────
  it('passes for EMPLOYEE when no ownerId is present in request (service-layer defer)', () => {
    const guard = new OwnershipGuard(buildReflector(true));
    const ctx = buildContext({ id: 'emp-1', role: UserRole.EMPLOYEE });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  // ── 6. CLIENT / LEAD are always blocked on owned-resource routes ──────────
  it.each([
    ['CLIENT', UserRole.CLIENT],
    ['LEAD', UserRole.LEAD],
  ])('throws InsufficientPermissionsException for %s on owned-resource route', (_label, role) => {
    const guard = new OwnershipGuard(buildReflector(true));
    const ctx = buildContext({ id: 'u1', role });

    expect(() => guard.canActivate(ctx)).toThrow(InsufficientPermissionsException);
  });
});
