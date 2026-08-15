import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClientStatus } from '../../../common/enums';

/**
 * Create a brand-new CLIENT user AND its Client record in one atomic call.
 *
 * Unlike CreateClientDto (which requires an existing CLIENT userId and is used
 * to attach a record to an already-provisioned user), this DTO carries the new
 * user's credentials so staff (ADMIN + EMPLOYEE) can onboard a client without
 * touching the ADMIN-only /users controller.
 */
export class ProvisionClientDto {
  @ApiProperty({ description: "New client contact's full name", maxLength: 255 })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @ApiProperty({ description: "New client's login email (must be unique)" })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({
    description: 'Temporary password for the new client account',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @ApiPropertyOptional({ description: 'Company or organisation name', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  company?: string;

  @ApiPropertyOptional({
    description: 'Initial client status',
    enum: ClientStatus,
    default: ClientStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(ClientStatus)
  status?: ClientStatus;

  @ApiPropertyOptional({ description: 'Internal notes about this client' })
  @IsOptional()
  @IsString()
  notes?: string;
}
