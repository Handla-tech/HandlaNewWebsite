import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateConversationDto {
  @ApiProperty({ description: 'Client user UUID' })
  @IsUUID()
  clientId: string;

  @ApiProperty({ description: 'Admin user UUID' })
  @IsUUID()
  adminId: string;
}
