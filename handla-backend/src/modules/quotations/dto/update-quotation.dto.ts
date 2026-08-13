import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateQuotationDto } from './create-quotation.dto';

/** Editable only while DRAFT. clientId cannot change after creation. */
export class UpdateQuotationDto extends PartialType(
  OmitType(CreateQuotationDto, ['clientId'] as const),
) {}
