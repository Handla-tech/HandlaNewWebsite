import { PartialType } from '@nestjs/swagger';
import { CreateExpenseDto } from './create-expense.dto';

/**
 * Update DTO for expenses.
 *
 * All fields are optional. Invoice-linked entries (invoiceId IS NOT NULL)
 * are read-only and will throw AppException('Cannot edit auto-generated income entries')
 * if an update is attempted — enforced in ExpensesService.update().
 */
export class UpdateExpenseDto extends PartialType(CreateExpenseDto) {}
