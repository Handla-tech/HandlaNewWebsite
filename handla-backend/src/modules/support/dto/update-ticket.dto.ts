import {
  IsOptional,
  IsEnum,
  IsUUID,
  IsString,
  Length,
} from 'class-validator';
import {
  TicketStatus,
  TicketPriority,
  TicketCategory,
} from '../../../common/enums';

/**
 * Staff-only ticket update: reclassify, reassign, set status, or edit subject.
 * Line-level ownership / access checks are enforced in the service.
 */
export class UpdateTicketDto {
  @IsOptional()
  @IsString()
  @Length(2, 255)
  subject?: string;

  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @IsOptional()
  @IsEnum(TicketCategory)
  category?: TicketCategory;

  @IsOptional()
  @IsUUID()
  assigneeId?: string | null;

  @IsOptional()
  @IsUUID()
  projectId?: string | null;
}
