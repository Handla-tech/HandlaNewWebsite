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

  // ─── NEW: Purchases / Quotations / Support event types ─────────────────────
  PURCHASE_CREATED   = 'PURCHASE_CREATED',
  PURCHASE_OVERDUE   = 'PURCHASE_OVERDUE',
  QUOTATION_SENT     = 'QUOTATION_SENT',
  QUOTATION_ACCEPTED = 'QUOTATION_ACCEPTED',
  QUOTATION_REJECTED = 'QUOTATION_REJECTED',
  TICKET_CREATED     = 'TICKET_CREATED',
  TICKET_REPLIED     = 'TICKET_REPLIED',
  TICKET_STATUS      = 'TICKET_STATUS',
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

// ─── ACC-1: Accounting Hub ────────────────────────────────────────────────────

/**
 * Account category for the Chart of Accounts.
 * Standard 5 accounting buckets.
 */
export enum AccountType {
  ASSET     = 'ASSET',
  LIABILITY = 'LIABILITY',
  INCOME    = 'INCOME',
  EXPENSE   = 'EXPENSE',
  EQUITY    = 'EQUITY',
}

/**
 * Direction of a ledger entry from the business's perspective.
 * IN  = money coming into the business (revenue, deposits)
 * OUT = money leaving the business (costs, purchases, payouts)
 */
export enum LedgerDirection {
  IN  = 'IN',
  OUT = 'OUT',
}

/**
 * What generated a ledger entry. Used for idempotency (sourceType + sourceId)
 * and for tracing an entry back to its origin document.
 */
export enum LedgerSourceType {
  INVOICE   = 'INVOICE',
  EXPENSE   = 'EXPENSE',
  PURCHASE  = 'PURCHASE',
  QUOTATION = 'QUOTATION',
  MANUAL    = 'MANUAL',
}

// ─── PUR-1: Purchases ─────────────────────────────────────────────────────────

export enum PurchaseStatus {
  DRAFT     = 'DRAFT',
  ORDERED   = 'ORDERED',
  RECEIVED  = 'RECEIVED',
  CANCELLED = 'CANCELLED',
}

export enum PurchasePaymentStatus {
  UNPAID  = 'UNPAID',
  PAID    = 'PAID',
  OVERDUE = 'OVERDUE',
}

// ─── QUO-1: Quotations ────────────────────────────────────────────────────────

export enum QuotationStatus {
  DRAFT     = 'DRAFT',
  SENT      = 'SENT',
  ACCEPTED  = 'ACCEPTED',
  REJECTED  = 'REJECTED',
  EXPIRED   = 'EXPIRED',
  CONVERTED = 'CONVERTED',
}

// ─── SUP-1: Support / Ticketing ───────────────────────────────────────────────

export enum TicketStatus {
  OPEN              = 'OPEN',
  IN_PROGRESS       = 'IN_PROGRESS',
  WAITING_CUSTOMER  = 'WAITING_CUSTOMER',
  RESOLVED          = 'RESOLVED',
  CLOSED            = 'CLOSED',
}

export enum TicketPriority {
  LOW    = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH   = 'HIGH',
  URGENT = 'URGENT',
}

export enum TicketCategory {
  BUG      = 'BUG',
  FEATURE  = 'FEATURE',
  QUESTION = 'QUESTION',
  BILLING  = 'BILLING',
  OTHER    = 'OTHER',
}

export enum TicketSource {
  WEB   = 'WEB',
  API   = 'API',
  EMAIL = 'EMAIL',
}

// ─── ANL-1: Analytics ─────────────────────────────────────────────────────────

export enum AnalyticsEventType {
  PAGEVIEW = 'PAGEVIEW',
  EVENT    = 'EVENT',
}
