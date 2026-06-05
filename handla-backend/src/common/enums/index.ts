export enum UserRole {
  ADMIN = 'ADMIN',
  EMPLOYEE = 'EMPLOYEE',
  CLIENT = 'CLIENT',
  LEAD = 'LEAD',
}

export enum ConversationStatus {
  ACTIVE = 'ACTIVE',
  ON_HOLD = 'ON_HOLD',
  COMPLETED = 'COMPLETED',
}

export enum NotificationType {
  MESSAGE  = 'MESSAGE',
  SYSTEM   = 'SYSTEM',

  // ─── ERP-9: New ERP event types ───────────────────────────────────────────
  CONTRACT_SENT     = 'CONTRACT_SENT',
  CONTRACT_SIGNED   = 'CONTRACT_SIGNED',
  CONTRACT_REJECTED = 'CONTRACT_REJECTED',
  INVOICE_CREATED   = 'INVOICE_CREATED',
  INVOICE_OVERDUE   = 'INVOICE_OVERDUE',
  LEAD_ASSIGNED     = 'LEAD_ASSIGNED',
  LEAD_PROMOTED     = 'LEAD_PROMOTED',
  TASK_ASSIGNED     = 'TASK_ASSIGNED',
  TASK_DELAYED      = 'TASK_DELAYED',
}

// ─── ERP-3: Clients ───────────────────────────────────────────────────────────

export enum ClientStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  CHURNED = 'CHURNED',
}

// ─── ERP-4: Projects ──────────────────────────────────────────────────────────

export enum ProjectStatus {
  PLANNING   = 'PLANNING',
  ACTIVE     = 'ACTIVE',
  ON_HOLD    = 'ON_HOLD',
  COMPLETED  = 'COMPLETED',
  CANCELLED  = 'CANCELLED',
}

// ─── ERP-5: Tasks ─────────────────────────────────────────────────────────────

export enum TaskStatus {
  PENDING     = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED   = 'COMPLETED',
  DELAYED     = 'DELAYED',
}

// ─── ERP-6: Contracts ─────────────────────────────────────────────────────────

export enum ContractStatus {
  DRAFT    = 'DRAFT',
  SENT     = 'SENT',
  SIGNED   = 'SIGNED',
  REJECTED = 'REJECTED',
}

// ─── ERP-7: Invoices ──────────────────────────────────────────────────────────

export enum InvoicePaymentStatus {
  UNPAID  = 'UNPAID',
  PAID    = 'PAID',
  OVERDUE = 'OVERDUE',
}

// ─── ERP-8: Expenses ──────────────────────────────────────────────────────────

export enum ExpenseType {
  INCOME  = 'INCOME',
  EXPENSE = 'EXPENSE',
}
