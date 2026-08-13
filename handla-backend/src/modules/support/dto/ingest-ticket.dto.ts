import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
  Length,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  TicketPriority,
  TicketCategory,
} from '../../../common/enums';
import { AttachmentDto } from './attachment.dto';

/**
 * SUP-2 — payload for the API-key ingest endpoint (POST /api/support/tickets).
 * The client is resolved from the API key, NOT from the body. External
 * platforms may pass an optional `externalReporter` label for context.
 */
export class IngestTicketDto {
  @IsString()
  @Length(2, 255)
  subject: string;

  @IsString()
  @Length(1, 20000)
  description: string;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @IsOptional()
  @IsEnum(TicketCategory)
  category?: TicketCategory;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  externalReporter?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];
}
