/**
 * Display metadata for Finance (purchase / expense / ledger) enums.
 */
import { colors } from '@/theme';
import type {
  PurchaseStatus,
  PurchasePaymentStatus,
  ExpenseType,
  LedgerDirection,
  LedgerSourceType,
} from '@/types';

type Meta = { label: string; color: string; soft: string };

export const PURCHASE_STATUS_META: Record<PurchaseStatus, Meta> = {
  DRAFT: { label: 'Draft', color: colors.textFaint, soft: 'rgba(255,255,255,0.06)' },
  ORDERED: { label: 'Ordered', color: colors.info, soft: 'rgba(96,165,250,0.15)' },
  RECEIVED: { label: 'Received', color: colors.success, soft: colors.successSoft },
  CANCELLED: { label: 'Cancelled', color: colors.danger, soft: colors.dangerSoft },
};

export const PURCHASE_PAYMENT_META: Record<PurchasePaymentStatus, Meta> = {
  UNPAID: { label: 'Unpaid', color: '#fb923c', soft: 'rgba(251,146,60,0.15)' },
  PAID: { label: 'Paid', color: colors.success, soft: colors.successSoft },
  OVERDUE: { label: 'Overdue', color: colors.danger, soft: colors.dangerSoft },
};

export const EXPENSE_TYPE_META: Record<ExpenseType, Meta> = {
  INCOME: { label: 'Income', color: colors.success, soft: colors.successSoft },
  EXPENSE: { label: 'Expense', color: colors.danger, soft: colors.dangerSoft },
};

export const LEDGER_DIRECTION_META: Record<LedgerDirection, Meta> = {
  IN: { label: 'In', color: colors.success, soft: colors.successSoft },
  OUT: { label: 'Out', color: colors.danger, soft: colors.dangerSoft },
};

export const LEDGER_SOURCE_LABEL: Record<LedgerSourceType, string> = {
  INVOICE: 'Invoice',
  EXPENSE: 'Expense',
  PURCHASE: 'Purchase',
  QUOTATION: 'Quotation',
  MANUAL: 'Manual',
};

export const PURCHASE_STATUS_ORDER: PurchaseStatus[] = [
  'DRAFT',
  'ORDERED',
  'RECEIVED',
  'CANCELLED',
];
