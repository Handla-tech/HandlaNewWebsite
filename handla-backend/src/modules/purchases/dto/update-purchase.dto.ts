import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreatePurchaseDto } from './create-purchase.dto';

/**
 * Only editable while UNPAID. supplierId cannot change after creation.
 */
export class UpdatePurchaseDto extends PartialType(
  OmitType(CreatePurchaseDto, ['supplierId'] as const),
) {}
