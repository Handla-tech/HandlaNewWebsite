import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
  Length,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AttachmentDto } from './attachment.dto';

export class CreateReplyDto {
  @IsString()
  @Length(1, 20000)
  body: string;

  /** Staff-only internal note (ignored / forced false for CLIENT + API callers). */
  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];
}
