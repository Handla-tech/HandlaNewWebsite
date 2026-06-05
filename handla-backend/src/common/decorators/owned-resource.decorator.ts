import { SetMetadata } from '@nestjs/common';
import { Request } from 'express';

/**
 * Metadata key used by OwnershipGuard.
 */
export const IS_OWNED_RESOURCE = 'isOwnedResource';

/**
 * @OwnedResource()
 *
 * Apply to a controller method to enable ownership enforcement by
 * OwnershipGuard. When present, the guard will:
 *
 *  - ADMIN       → always passes (bypass).
 *  - EMPLOYEE    → passes only when the resolved `ownerId` matches user.id.
 *  - CLIENT/LEAD → always denied on mutating routes.
 *
 * The actual `ownerId` resolution is performed *inside the service layer*
 * (not in this decorator), so the guard acts as a gate that the service
 * result must satisfy. For routes where the body contains `ownerId` directly
 * (create operations), the guard is a no-op because the service itself
 * sets `ownerId = actingUser.id` — only update/delete routes need the guard
 * to block cross-employee access before the service is even reached.
 *
 * Usage:
 *   @Patch(':id')
 *   @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
 *   @OwnedResource()
 *   update(...) { ... }
 */
export const OwnedResource = () => SetMetadata(IS_OWNED_RESOURCE, true);

/**
 * Type for a function that extracts the `ownerId` from a request.
 * Used by modules that want to provide a custom extractor to OwnershipGuard.
 */
export type OwnerIdExtractor = (req: Request) => string | null | undefined;
