import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsDateString,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus } from '../../../common/enums';

export class CreateTaskDto {
  @ApiProperty({ example: 'Design homepage mockup', minLength: 2, maxLength: 255 })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({ example: 'Create Figma wireframes for the main landing page.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'uuid-of-project', format: 'uuid' })
  @IsUUID()
  projectId: string;

  @ApiPropertyOptional({
    example: 'uuid-of-employee',
    format: 'uuid',
    description: 'EMPLOYEE user to assign this task to (informational — does not change ownership)',
  })
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @ApiPropertyOptional({
    enum: TaskStatus,
    default: TaskStatus.PENDING,
    description: 'Initial status. Defaults to PENDING.',
  })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({ example: '2026-07-15', description: 'Due date in ISO 8601 date format' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
