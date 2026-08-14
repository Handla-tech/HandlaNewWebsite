import {
  HttpException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  ServiceUnavailableException as NestServiceUnavailableException,
} from '@nestjs/common';

export class EmailAlreadyExistsException extends ConflictException {
  constructor(email: string) {
    super(`User with email "${email}" already exists`);
  }
}

export class InvalidCredentialsException extends UnauthorizedException {
  constructor() {
    super('Invalid email or password');
  }
}

export class TokenExpiredException extends UnauthorizedException {
  constructor() {
    super('Authentication token has expired');
  }
}

export class ResourceNotFoundException extends NotFoundException {
  constructor(resource: string, id?: string | number) {
    super(id ? `${resource} with id "${id}" not found` : `${resource} not found`);
  }
}

export class InsufficientPermissionsException extends ForbiddenException {
  constructor(action?: string) {
    super(action ? `Insufficient permissions to ${action}` : 'Insufficient permissions');
  }
}

export class InvalidFileTypeException extends BadRequestException {
  constructor(allowed?: string[]) {
    super(allowed ? `Invalid file type. Allowed: ${allowed.join(', ')}` : 'Invalid file type');
  }
}

export class FileTooLargeException extends BadRequestException {
  constructor(maxSizeMb: number) {
    super(`File size exceeds the maximum allowed size of ${maxSizeMb}MB`);
  }
}

export class ConversationAccessDeniedException extends ForbiddenException {
  constructor() {
    super('You do not have access to this conversation');
  }
}

export class AppException extends HttpException {
  constructor(message: string, statusCode: HttpStatus = HttpStatus.BAD_REQUEST) {
    super({ message, statusCode }, statusCode);
  }
}

/**
 * Thrown when a verification / OTP email cannot be sent (e.g. the SMTP server
 * rejects our credentials with 535 BadCredentials, or the mail host is
 * unreachable). We surface a clean, user-facing message instead of leaking the
 * raw nodemailer/SMTP error as a 500. The underlying cause is logged upstream.
 */
export class EmailDeliveryException extends NestServiceUnavailableException {
  constructor() {
    super(
      'We could not send your verification email right now. Please try again in a moment.',
    );
  }
}

// ─── ERP-specific exceptions ──────────────────────────────────────────────────

/**
 * Thrown by OwnershipGuard when an EMPLOYEE attempts to mutate a resource
 * they do not own (resolved ownerId !== user.id).
 */
export class OwnershipViolationException extends ForbiddenException {
  constructor() {
    super('You do not own this resource');
  }
}

/**
 * Thrown when an invalid role transition is attempted, e.g. promoting a user
 * from CLIENT → ADMIN directly or demoting below LEAD.
 */
export class RolePromotionException extends BadRequestException {
  constructor(message?: string) {
    super(message ?? 'Invalid role transition');
  }
}

/**
 * Thrown when a LEAD user attempts to access a resource that requires an
 * assigned EMPLOYEE and none has been assigned yet.
 */
export class LeadNotAssignedException extends BadRequestException {
  constructor() {
    super('Lead has no assigned employee');
  }
}
