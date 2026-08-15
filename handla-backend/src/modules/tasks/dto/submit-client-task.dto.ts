import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  IsUrl,
  IsInt,
  Min,
  ValidateNested,
  ArrayMaxSize,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** One uploaded file the client attaches when submitting a client task. */
export class TaskAttachmentDto {
  @ApiProperty({ description: 'URL of the uploaded file (from the presigned upload)' })
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  url: string;

  @ApiProperty({ description: 'Original file name' })
  @IsString()
  @MaxLength(512)
  name: string;

  @ApiPropertyOptional({ description: 'File size in bytes' })
  @IsOptional()
  @IsInt()
  @Min(0)
  size?: number;
}

/**
 * Body for a CLIENT submitting a client-directed task. The client attaches any
 * uploaded files and optionally a note; the backend marks the task COMPLETED.
 */
export class SubmitClientTaskDto {
  @ApiPropertyOptional({
    type: [TaskAttachmentDto],
    description: 'Files the client uploaded for this deliverable',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => TaskAttachmentDto)
  attachments?: TaskAttachmentDto[];

  @ApiPropertyOptional({ description: 'Optional note from the client' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
