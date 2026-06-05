import { IsString, IsUUID, IsOptional, IsUrl, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({ description: 'Conversation UUID' })
  @IsUUID()
  conversationId: string;

  @ApiPropertyOptional({ description: 'Text content of the message' })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  content?: string;

  @ApiPropertyOptional({ description: 'S3 file URL attached to message' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  fileUrl?: string;
}
