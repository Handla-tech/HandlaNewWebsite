import {
  IsString,
  IsUUID,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateContractDto {
  @ApiProperty({ example: 'Service Agreement — Acme Corp', minLength: 2, maxLength: 255 })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  title: string;

  @ApiProperty({ example: 'This agreement is made between Handla Tech and the Client...', minLength: 10 })
  @IsString()
  @MinLength(10)
  body: string;

  @ApiProperty({ example: 'a1b2c3d4-...', description: 'UUID of the client this contract belongs to' })
  @IsUUID()
  clientId: string;
}
