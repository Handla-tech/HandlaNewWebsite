import { IsString, IsUUID, IsOptional, Length } from 'class-validator';

/**
 * Staff creates an API key for a client. `clientId` required for ADMIN/EMPLOYEE.
 */
export class CreateApiKeyDto {
  @IsUUID()
  clientId: string;

  @IsOptional()
  @IsString()
  @Length(2, 100)
  label?: string;
}
