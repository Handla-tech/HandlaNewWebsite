'use client';

/**
 * StatusBadge — generic colour-coded status pill for all ERP record types.
 *
 * Usage:
 *   <StatusBadge status="ACTIVE"     type="client" />
 *   <StatusBadge status="IN_PROGRESS" type="task"   />
 *   <StatusBadge status="SIGNED"     type="contract" />
 */

import { cn } from '@/lib/utils';
import type {
  ClientStatus,
  ProjectStatus,
  TaskStatus,
  ContractStatus,
  InvoicePaymentStatus,
  ExpenseType,
} from '@/types';

type StatusType = 'client' | 'project' | 'task' | 'contract' | 'invoice' | 'expense';

type AnyStatus =
  | ClientStatus
  | ProjectStatus
  | TaskStatus
  | ContractStatus
  | InvoicePaymentStatus
  | ExpenseType;

// ─── Colour maps ──────────────────────────────────────────────────────────────

const CLIENT_COLOURS: Record<ClientStatus, string> = {
  ACTIVE:   'border-emerald-400/30 bg-emerald-400/10 text-emerald-400',
  INACTIVE: 'border-slate-400/30   bg-slate-400/10   text-slate-400',
  CHURNED:  'border-red-400/30     bg-red-400/10     text-red-400',
};

const PROJECT_COLOURS: Record<ProjectStatus, string> = {
  PLANNING:  'border-blue-400/30    bg-blue-400/10    text-blue-400',
  ACTIVE:    'border-emerald-400/30 bg-emerald-400/10 text-emerald-400',
  ON_HOLD:   'border-amber-400/30   bg-amber-400/10   text-amber-400',
  COMPLETED: 'border-purple-400/30  bg-purple-400/10  text-purple-400',
  CANCELLED: 'border-red-400/30     bg-red-400/10     text-red-400',
};

const TASK_COLOURS: Record<TaskStatus, string> = {
  PENDING:     'border-slate-400/30  bg-slate-400/10  text-slate-400',
  IN_PROGRESS: 'border-blue-400/30   bg-blue-400/10   text-blue-400',
  COMPLETED:   'border-emerald-400/30 bg-emerald-400/10 text-emerald-400',
  DELAYED:     'border-amber-400/30  bg-amber-400/10  text-amber-400',
};

const CONTRACT_COLOURS: Record<ContractStatus, string> = {
  DRAFT:    'border-slate-400/30   bg-slate-400/10   text-slate-400',
  SENT:     'border-amber-400/30   bg-amber-400/10   text-amber-400',
  SIGNED:   'border-emerald-400/30 bg-emerald-400/10 text-emerald-400',
  REJECTED: 'border-red-400/30     bg-red-400/10     text-red-400',
};

const INVOICE_COLOURS: Record<InvoicePaymentStatus, string> = {
  UNPAID:  'border-slate-400/30   bg-slate-400/10   text-slate-400',
  PAID:    'border-emerald-400/30 bg-emerald-400/10 text-emerald-400',
  OVERDUE: 'border-red-400/30     bg-red-400/10     text-red-400',
};

const EXPENSE_COLOURS: Record<ExpenseType, string> = {
  INCOME:  'border-emerald-400/30 bg-emerald-400/10 text-emerald-400',
  EXPENSE: 'border-red-400/30     bg-red-400/10     text-red-400',
};

// ─── Human-readable labels ────────────────────────────────────────────────────

const LABELS: Record<string, string> = {
  // client
  ACTIVE:     'Active',
  INACTIVE:   'Inactive',
  CHURNED:    'Churned',
  // project
  PLANNING:   'Planning',
  ON_HOLD:    'On Hold',
  COMPLETED:  'Completed',
  CANCELLED:  'Cancelled',
  // task
  PENDING:    'Pending',
  IN_PROGRESS:'In Progress',
  DELAYED:    'Delayed',
  // contract
  DRAFT:      'Draft',
  SENT:       'Sent',
  SIGNED:     'Signed',
  REJECTED:   'Rejected',
  // invoice
  UNPAID:     'Unpaid',
  PAID:       'Paid',
  OVERDUE:    'Overdue',
  // expense
  INCOME:     'Income',
  EXPENSE:    'Expense',
};

function resolveColour(status: AnyStatus, type: StatusType): string {
  switch (type) {
    case 'client':   return CLIENT_COLOURS[status as ClientStatus]   ?? '';
    case 'project':  return PROJECT_COLOURS[status as ProjectStatus]  ?? '';
    case 'task':     return TASK_COLOURS[status as TaskStatus]        ?? '';
    case 'contract': return CONTRACT_COLOURS[status as ContractStatus] ?? '';
    case 'invoice':  return INVOICE_COLOURS[status as InvoicePaymentStatus] ?? '';
    case 'expense':  return EXPENSE_COLOURS[status as ExpenseType]    ?? '';
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface StatusBadgeProps {
  status: AnyStatus;
  type:   StatusType;
  size?:  'sm' | 'md';
  className?: string;
}

export default function StatusBadge({
  status,
  type,
  size = 'sm',
  className,
}: StatusBadgeProps) {
  const colour = resolveColour(status, type);
  const label  = LABELS[status] ?? status;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        colour,
        className,
      )}
    >
      {label}
    </span>
  );
}
