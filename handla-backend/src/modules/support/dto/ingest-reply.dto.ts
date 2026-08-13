import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  Length,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AttachmentDto } from './attachment.dto';

/**
 * SUP-2 — payload for the API-key reply endpoint
 * (POST /api/support/tickets/:id/replies). The ticket must belong to the
 * client that owns the API key. Replies are always customer-visible (never
 * internal) and authored as the external reporter.
 */
export class IngestReplyDto {
  @IsString()
  @Length(1, 20000)
  body: string;

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
