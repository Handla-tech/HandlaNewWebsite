import { IsUUID, IsOptional, IsString, MaxLength, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClientStatus } from '../../../common/enums';

export class CreateClientDto {
  @ApiProperty({
    description: 'UUID of the User (role=CLIENT) to create a Client record for',
    format: 'uuid',
  })
  @IsUUID()
  userId: string;

  @ApiPropertyOptional({
    description: 'Company or organisation name',
    maxLength: 255,
  })
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
