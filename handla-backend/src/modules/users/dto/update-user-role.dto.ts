import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../../common/enums';

export class UpdateUserRoleDto {
  @ApiProperty({ enum: UserRole, example: UserRole.CLIENT })
  @IsEnum(UserRole, { message: 'role must be one of: ADMIN, EMPLOYEE, CLIENT, LEAD' })
  role: UserRole;
}
