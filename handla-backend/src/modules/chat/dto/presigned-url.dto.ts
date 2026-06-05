import { IsString, IsNotEmpty, MaxLength, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PresignedUrlDto {
  @ApiProperty({ example: 'project-brief.pdf' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName: string;

  @ApiProperty({ example: 'application/pdf' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  contentType: string;

  @ApiProperty({ example: 2048000, description: 'File size in bytes (max 20MB)' })
  @IsNumber()
  @Min(1)
  @Max(20 * 1024 * 1024) // 20 MB
  fileSize: number;
}
