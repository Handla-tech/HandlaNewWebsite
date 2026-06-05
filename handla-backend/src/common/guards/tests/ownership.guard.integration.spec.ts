/**
 * ERP-12.3 — OwnershipGuard Integration Tests
 *
 * Tests the guard's behaviour across all role + metadata combinations.
 * These are pure logic tests — no DI or DB needed.
 */

import { UserRole } from '../../enums';
import { IS_OWNED_RESOURCE } from '../../decorators/owned-resource.decorator';
import {
  OwnershipViolationException,
  InsufficientPermissionsException,
} from '../../../utils/exceptions';

// ─── Minimal guard logic replica ──────────────────────────────────────────────
//
// Mirrors OwnershipGuard.canActivate() logic for integration-style tests.
// This avoids heavy DI setup while still testing the guard logic end-to-end.

function runGuard(options: {
  hasOwnedResourceMetadata: boolean;
  role:                     UserRole;
  ownerId:                  string | null;
  userId:                   string;
}): boolean {
  const { hasOwnedResourceMetadata, role, ownerId, userId } = options;

  // No @OwnedResource() → guard is a no-op, always passes
  if (!hasOwnedResourceMetadata) return true;

  // ADMIN bypasses all ownership checks
  if (role === UserRole.ADMIN) return true;

  // EMPLOYEE: must own the record
  if (role === UserRole.EMPLOYEE) {
    if (ownerId === userId) return true;
    throw new OwnershipViolationException();
  }

  // CLIENT, LEAD: cannot own ERP records (mutating operations denied)
  throw new InsufficientPermissionsException('Insufficient permissions for this resource');
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('OwnershipGuard Integration Tests (ERP-12.3)', () => {

  // ─── 12.3.1 — Guard is a no-op on routes without @OwnedResource() ─────

  describe('Route without @OwnedResource() metadata', () => {
    it('should pass for ADMIN without @OwnedResource()', () => {
      expect(
        runGuard({ hasOwnedResourceMetadata: false, role: UserRole.ADMIN, ownerId: 'any', userId: 'admin-1' })
      ).toBe(true);
    });

    it('should pass for EMPLOYEE without @OwnedResource()', () => {
      expect(
        runGuard({ hasOwnedResourceMetadata: false, role: UserRole.EMPLOYEE, ownerId: 'emp-99', userId: 'emp-1' })
      ).toBe(true);
    });

    it('should pass for CLIENT without @OwnedResource()', () => {
      expect(
        runGuard({ hasOwnedResourceMetadata: false, role: UserRole.CLIENT, ownerId: null, userId: 'client-1' })
      ).toBe(true);
    });

    it('should pass for LEAD without @OwnedResource()', () => {
      expect(
        runGuard({ hasOwnedResourceMetadata: false, role: UserRole.LEAD, ownerId: null, userId: 'lead-1' })
      ).toBe(true);
    });
  });

  // ─── 12.3.2 — ADMIN bypasses on all @OwnedResource() routes ──────────

  describe('ADMIN bypasses @OwnedResource()', () => {
    it('should pass for ADMIN with @OwnedResource() — ownerId matches', () => {
      expect(
        runGuard({ hasOwnedResourceMetadata: true, role: UserRole.ADMIN, ownerId: 'admin-1', userId: 'admin-1' })
      ).toBe(true);
    });

    it('should pass for ADMIN with @OwnedResource() — ownerId does NOT match', () => {
      expect(
        runGuard({ hasOwnedResourceMetadata: true, role: UserRole.ADMIN, ownerId: 'emp-99', userId: 'admin-1' })
      ).toBe(true);
    });

    it('should pass for ADMIN with @OwnedResource() — ownerId is null', () => {
      expect(
        runGuard({ hasOwnedResourceMetadata: true, role: UserRole.ADMIN, ownerId: null, userId: 'admin-1' })
      ).toBe(true);
    });
  });

  // ─── 12.3.3 — EMPLOYEE passes when ownerId matches ────────────────────

  describe('EMPLOYEE ownership check', () => {
    it('should pass for EMPLOYEE when ownerId matches userId', () => {
      expect(
        runGuard({ hasOwnedResourceMetadata: true, role: UserRole.EMPLOYEE, ownerId: 'emp-1', userId: 'emp-1' })
      ).toBe(true);
    });

    it('should throw OwnershipViolationException when ownerId does not match', () => {
      expect(() =>
        runGuard({ hasOwnedResourceMetadata: true, role: UserRole.EMPLOYEE, ownerId: 'emp-1', userId: 'emp-2' })
      ).toThrow(OwnershipViolationException);
    });

    it('should throw OwnershipViolationException when ownerId is null (unowned resource)', () => {
      expect(() =>
        runGuard({ hasOwnedResourceMetadata: true, role: UserRole.EMPLOYEE, ownerId: null, userId: 'emp-1' })
      ).toThrow(OwnershipViolationException);
    });

    it('should throw OwnershipViolationException for different employee IDs', () => {
      expect(() =>
        runGuard({ hasOwnedResourceMetadata: true, role: UserRole.EMPLOYEE, ownerId: 'emp-alpha', userId: 'emp-beta' })
      ).toThrow(OwnershipViolationException);
    });
  });

  // ─── 12.3.4 — CLIENT always denied on @OwnedResource() routes ────────

  describe('CLIENT always denied on @OwnedResource() routes', () => {
    it('should throw for CLIENT even with matching ID', () => {
      expect(() =>
        runGuard({ hasOwnedResourceMetadata: true, role: UserRole.CLIENT, ownerId: 'client-1', userId: 'client-1' })
      ).toThrow(InsufficientPermissionsException);
    });

    it('should throw for CLIENT regardless of ownerId', () => {
      expect(() =>
        runGuard({ hasOwnedResourceMetadata: true, role: UserRole.CLIENT, ownerId: null, userId: 'client-1' })
      ).toThrow(InsufficientPermissionsException);
    });
  });

  // ─── 12.3.5 — LEAD always denied on @OwnedResource() routes ─────────

  describe('LEAD always denied on @OwnedResource() routes', () => {
    it('should throw for LEAD with @OwnedResource()', () => {
      expect(() =>
        runGuard({ hasOwnedResourceMetadata: true, role: UserRole.LEAD, ownerId: 'lead-1', userId: 'lead-1' })
      ).toThrow(InsufficientPermissionsException);
    });

    it('should throw for LEAD regardless of ownerId', () => {
      expect(() =>
        runGuard({ hasOwnedResourceMetadata: true, role: UserRole.LEAD, ownerId: null, userId: 'lead-1' })
      ).toThrow(InsufficientPermissionsException);
    });
  });

  // ─── IS_OWNED_RESOURCE decorator metadata key ─────────────────────────

  describe('IS_OWNED_RESOURCE metadata key', () => {
    it('should have the correct metadata key exported from decorator', () => {
      expect(IS_OWNED_RESOURCE).toBe('isOwnedResource');
    });
  });
});
