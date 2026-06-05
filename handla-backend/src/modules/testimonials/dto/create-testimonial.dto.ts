import {
  IsString,
  IsOptional,
  IsInt,
  IsUrl,
  Min,
  Max,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTestimonialDto {
  @ApiProperty({ description: 'Name of the client', maxLength: 100 })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  clientName: string;

  @ApiPropertyOptional({
    description: 'Company the client works for (null to clear)',
    maxLength: 150,
  })
  @IsOptional()
  @ValidateIf((o) => o.clientCompany !== null)
  @IsString()
  @MaxLength(150)
  clientCompany?: string | null;

  @ApiProperty({ description: 'Testimonial body text', minLength: 10 })
  @IsString()
  @MinLength(10)
  content: string;

  @ApiPropertyOptional({
    description: 'Public URL of the client avatar / photo (null to clear)',
    maxLength: 2048,
  })
  @IsOptional()
  @ValidateIf((o) => o.imageUrl !== null)
  @IsUrl({}, { message: 'imageUrl must be a valid URL' })
  @MaxLength(2048)
  imageUrl?: string | null;

  @ApiProperty({ description: 'Star rating (1–5)', minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;
}
