import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { IS_OWNED_RESOURCE } from '../decorators/owned-resource.decorator';
import { UserRole } from '../enums';
import {
  InsufficientPermissionsException,
  OwnershipViolationException,
} from '../../utils/exceptions';

/**
 * OwnershipGuard — ERP ownership enforcement.
 *
 * Applies only to routes decorated with @OwnedResource(). When present:
 *
 *  ADMIN       → always passes (bypasses all ownership checks).
 *  EMPLOYEE    → passes when request.body.ownerId or request.params._ownerId
 *                equals the authenticated user's id. For update/delete
 *                operations the service layer is responsible for setting up
 *                the ownerId check; this guard acts as a pre-flight check
 *                using the body/param ownerId when available.
 *                If ownerId is not resolvable from the request (e.g., it must
 *                be loaded from the DB), the guard passes and the service
 *                itself enforces the ownership check via the service layer.
 *  CLIENT/LEAD → always denied — they cannot own ERP records.
 *
 * NOTE: For routes where ownerId must be resolved from the database (e.g.,
 * PATCH /projects/:id), the service layer MUST call its own ownership check
 * using the `user` parameter. This guard provides an early-exit for requests
 * that carry ownerId in the body, and for CLIENT/LEAD role blocking.
 *
 * Register order: JwtAuthGuard → RolesGuard → OwnershipGuard.
 */
@Injectable()
export class OwnershipGuard implements CanActivate {
  private readonly logger = new Logger(OwnershipGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Only run on routes explicitly marked with @OwnedResource()
    const isOwnedResource = this.reflector.getAllAndOverride<boolean>(IS_OWNED_RESOURCE, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!isOwnedResource) {
      return true; // Guard is a no-op on non-owned routes
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new InsufficientPermissionsException('access this resource');
    }

    // ADMIN always bypasses ownership
    if (user.role === UserRole.ADMIN) {
      return true;
    }

    // CLIENT and LEAD can never mutate ERP records they "own"
    if (user.role === UserRole.CLIENT || user.role === UserRole.LEAD) {
      this.logger.warn(
        `OwnershipGuard: ${user.role} user ${user.id} denied on owned-resource route`,
      );
      throw new InsufficientPermissionsException('modify ERP records');
    }

    // EMPLOYEE — if ownerId is present in the request body or params, check it
    // now as a fast-path. Otherwise, the service layer will enforce it.
    if (user.role === UserRole.EMPLOYEE) {
      const ownerId: string | undefined = request.body?.ownerId ?? request.params?._ownerId;

      if (ownerId && ownerId !== user.id) {
        this.logger.warn(
          `OwnershipGuard: EMPLOYEE ${user.id} attempted to access resource owned by ${ownerId}`,
        );
        throw new OwnershipViolationException();
      }

      // ownerId not in request → defer to service-layer ownership check
      return true;
    }

    // Unknown role — deny by default
    throw new InsufficientPermissionsException('access this resource');
  }
}
