import { SetMetadata } from '@nestjs/common';
export { UserRole } from '../enums';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
