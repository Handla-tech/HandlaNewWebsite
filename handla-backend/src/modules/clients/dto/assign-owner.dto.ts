import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignOwnerDto {
  @ApiProperty({
    description: 'UUID of the new EMPLOYEE owner to assign',
    format: 'uuid',
  })
  @IsUUID()
  newOwnerId: string;
}
