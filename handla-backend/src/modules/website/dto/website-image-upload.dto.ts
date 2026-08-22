import { IsString, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Request body for requesting a presigned S3 URL to upload a WEBSITE image
 * (project cover / product image managed from the ERP admin).
 *
 * Security: the contentType is restricted to common image MIME types only, so a
 * presigned URL issued by this endpoint can NOT be used to upload arbitrary file
 * types (e.g. executable scripts or HTML). SVG is intentionally excluded to
 * avoid stored-XSS via inline scripts in SVG markup.
 */
export class WebsiteImageUploadDto {
  @ApiProperty({ description: 'Original file name (used to derive extension only)' })
  @IsString()
  @MaxLength(255)
  fileName: string;

  @ApiProperty({
    description: 'MIME type of the image — must be a raster image format',
    example: 'image/png',
  })
  @IsString()
  @MaxLength(50)
  @Matches(/^image\/(jpeg|png|webp|gif)$/, {
    message: 'contentType must be one of: image/jpeg, image/png, image/webp, image/gif',
  })
  contentType: string;
}
