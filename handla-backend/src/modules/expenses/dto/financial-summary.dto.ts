import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FinancialSummaryDto {
  @ApiProperty({ description: 'Total income (all INCOME entries) in the period' })
  totalIncome: number;

  @ApiProperty({ description: 'Total expenses (all EXPENSE entries) in the period' })
  totalExpenses: number;

  @ApiProperty({ description: 'Net balance = totalIncome − totalExpenses' })
  netBalance: number;

  @ApiProperty({ description: 'Sum of paid invoice totals in the period (from invoices table)' })
  paidInvoicesIncome: number;

  @ApiProperty({ description: 'Sum of manually-entered income (invoiceId IS NULL)' })
  manualIncome: number;

  @ApiProperty({ description: 'Sum of outstanding invoice totals (UNPAID + OVERDUE, unfiltered by date)' })
  outstandingInvoices: number;

  @ApiPropertyOptional({ description: 'Period start date (ISO, if filtered)' })
  periodFrom?: string;

  @ApiPropertyOptional({ description: 'Period end date (ISO, if filtered)' })
  periodTo?: string;
}
