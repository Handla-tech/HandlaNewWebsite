/**
 * Shared display metadata (labels + colors) for support ticket enums so the
 * list and detail screens stay visually consistent.
 */
import { colors } from '@/theme';
import type { TicketStatus, TicketPriority, TicketCategory } from '@/types';

export const STATUS_META: Record<
  TicketStatus,
  { label: string; color: string; soft: string }
> = {
  OPEN: { label: 'Open', color: colors.info, soft: 'rgba(96,165,250,0.15)' },
  IN_PROGRESS: { label: 'In Progress', color: colors.accent, soft: colors.accentSoft },
  WAITING_CUSTOMER: {
    label: 'Waiting',
    color: '#c084fc',
    soft: 'rgba(192,132,252,0.15)',
  },
  RESOLVED: { label: 'Resolved', color: colors.success, soft: colors.successSoft },
  CLOSED: { label: 'Closed', color: colors.textFaint, soft: 'rgba(255,255,255,0.06)' },
};

export const PRIORITY_META: Record<
  TicketPriority,
  { label: string; color: string; soft: string }
> = {
  URGENT: { label: 'Urgent', color: colors.danger, soft: colors.dangerSoft },
  HIGH: { label: 'High', color: '#fb923c', soft: 'rgba(251,146,60,0.15)' },
  MEDIUM: { label: 'Medium', color: colors.accent, soft: colors.accentSoft },
  LOW: { label: 'Low', color: colors.textFaint, soft: 'rgba(255,255,255,0.06)' },
};

export const CATEGORY_LABEL: Record<TicketCategory, string> = {
  BUG: 'Bug',
  FEATURE: 'Feature',
  QUESTION: 'Question',
  BILLING: 'Billing',
  OTHER: 'Other',
};

export const STATUS_ORDER: TicketStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'WAITING_CUSTOMER',
  'RESOLVED',
  'CLOSED',
];

export const PRIORITY_ORDER: TicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export const CATEGORY_ORDER: TicketCategory[] = [
  'QUESTION',
  'BUG',
  'FEATURE',
  'BILLING',
  'OTHER',
];
