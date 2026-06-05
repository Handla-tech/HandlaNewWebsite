import { IsOptional, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateInvoiceDto } from './create-invoice.dto';

/**
 * Update DTO for an invoice.
 * Only UNPAID invoices can be updated.
 * clientId cannot be changed after creation.
 * lineItems (if provided) replace the existing set wholesale.
 */
export class UpdateInvoiceDto extends PartialType(
  OmitType(CreateInvoiceDto, ['clientId'] as const),
) {}
