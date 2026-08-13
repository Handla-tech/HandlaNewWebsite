import {
  IsString,
  IsUUID,
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
 * Staff / client create-ticket payload.
 * `clientId` is required for staff; for a CLIENT it is derived from the token
 * and ignored if supplied.
 */
export class CreateTicketDto {
  @IsString()
  @Length(2, 255)
  subject: string;

  @IsString()
  @Length(1, 20000)
  description: string;

  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @IsOptional()
  @IsEnum(TicketCategory)
  category?: TicketCategory;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];
}
