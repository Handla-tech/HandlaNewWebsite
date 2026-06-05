import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReassignOwnershipDto {
  @ApiProperty({
    description: 'UUID of the EMPLOYEE user who will receive all owned records',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsUUID('4', { message: 'newOwnerId must be a valid UUID' })
  newOwnerId: string;
}
