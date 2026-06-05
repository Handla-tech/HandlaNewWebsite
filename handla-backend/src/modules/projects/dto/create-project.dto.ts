import {
  IsString,
  IsUUID,
  IsOptional,
  IsEnum,
  IsDateString,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectStatus } from '../../../common/enums';

export class CreateProjectDto {
  @ApiProperty({
    description: 'Project title',
    minLength: 2,
    maxLength: 255,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({ description: 'Detailed description of the project' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'UUID of the Client this project belongs to',
    format: 'uuid',
  })
  @IsUUID()
  clientId: string;

  @ApiPropertyOptional({
    description: 'Initial project status (defaults to PLANNING)',
    enum: ProjectStatus,
    default: ProjectStatus.PLANNING,
  })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @ApiPropertyOptional({
    description: 'Project start date (ISO 8601 date string, e.g. 2026-01-15)',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Project end / deadline date (ISO 8601 date string)',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
