import { IsEnum, IsString, IsUUID, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '../../../common/enums';

export class CreateNotificationDto {
  @ApiProperty({ description: 'Recipient user UUID' })
  @IsUUID()
  userId: string;

  @ApiProperty({ enum: NotificationType, description: 'Notification type' })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({ description: 'Short notification title', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiProperty({ description: 'Notification body text' })
  @IsString()
  message: string;

  @ApiPropertyOptional({ description: 'Related message UUID (if type = MESSAGE)' })
  @IsOptional()
  @IsUUID()
  relatedMessageId?: string;

  @ApiPropertyOptional({
    description:
      'Related ERP entity UUID (contract/invoice/task/client ID) — used by ERP-9 ' +
      'notification types for deep-link routing on the frontend.',
  })
  @IsOptional()
  @IsUUID()
  relatedEntityId?: string;
}
