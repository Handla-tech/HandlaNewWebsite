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

// ─── AI-1: Handla AI Assistant ────────────────────────────────────────────────

/**
 * Where a chat message originated. Layered on top of the existing chat system:
 * every message keeps its senderId, but origin tells the UI/orchestrator whether
 * a message was typed by a human, produced by the AI, or emitted by the system.
 *  - CLIENT : written by a CLIENT/LEAD (the customer side)
 *  - STAFF  : written by an ADMIN/EMPLOYEE human agent
 *  - AI     : generated by the Handla AI assistant
 *  - SYSTEM : automated system notices (takeover events, fallbacks)
 */
export enum MessageOrigin {
  CLIENT = 'CLIENT',
  STAFF  = 'STAFF',
  AI     = 'AI',
  SYSTEM = 'SYSTEM',
}

/**
 * Knowledge Base entry category — lets admins organise entries and lets the
 * retrieval layer bias toward the most relevant slice of the KB.
 */
export enum KnowledgeCategory {
  COMPANY  = 'COMPANY',   // about Handla, mission, positioning
  PRODUCT  = 'PRODUCT',   // Mudar / Matjari / Manara product facts
  PRICING  = 'PRICING',   // pricing guidance (NEVER final quotes)
  PROCESS  = 'PROCESS',   // how onboarding / provisioning works
  FAQ      = 'FAQ',       // frequent questions
  POLICY   = 'POLICY',    // business rules / restrictions
  OTHER    = 'OTHER',
}

/**
 * AI-driven lead qualification lifecycle. Independent of the chat conversation
 * status. Drives the admin lead panel and the Lead→Client→Tenant conversion path.
 *  - NEW        : conversation opened, nothing qualified yet
 *  - QUALIFYING : AI is actively collecting the required fields
 *  - QUALIFIED  : all required fields captured, ready for human/sales
 *  - DISQUALIFIED: not a fit (out of scope, spam, etc.)
 *  - CONVERTED  : promoted to a client/tenant
 */
export enum LeadStatus {
  NEW          = 'NEW',
  QUALIFYING   = 'QUALIFYING',
  QUALIFIED    = 'QUALIFIED',
  DISQUALIFIED = 'DISQUALIFIED',
  CONVERTED    = 'CONVERTED',
}

/**
 * Who is currently driving a conversation.
 *  - AI    : the assistant answers automatically
 *  - HUMAN : a staff member has taken over; the bot is muted
 */
export enum AiControlMode {
  AI    = 'AI',
  HUMAN = 'HUMAN',
}

/**
 * The structured "intent" the AI classifies each inbound client turn into.
 * Used for routing/analytics; the AI must always pick one of these.
 */
export enum AiIntent {
  GENERAL_QUESTION = 'GENERAL_QUESTION', // answerable from the KB
  LEAD_INQUIRY     = 'LEAD_INQUIRY',     // prospect interested in a product
  SUPPORT_REQUEST  = 'SUPPORT_REQUEST',  // existing customer needs help
  SMALL_TALK       = 'SMALL_TALK',
  OUT_OF_SCOPE     = 'OUT_OF_SCOPE',     // unrelated / cannot help
  HANDOFF_REQUEST  = 'HANDOFF_REQUEST',  // explicitly wants a human
}

// ─── SAAS-1: SaaS Control Plane (Phase 11) ────────────────────────────────────

/**
 * Tenant provisioning lifecycle (finite-state machine).
 *  PENDING      : created in Handla, not yet handed to the product
 *  PROVISIONING : a provisioning job is in flight against the product
 *  ACTIVE       : product confirmed the tenant is live (has external_tenant_id)
 *  SUSPENDED    : temporarily disabled (non-destructive) — reactivatable
 *  FAILED       : provisioning errored; inspect ProvisioningLogs, retry-safe
 *  ARCHIVED     : retired (retention window) before any guarded hard-delete
 */
export enum TenantStatus {
  PENDING      = 'PENDING',
  PROVISIONING = 'PROVISIONING',
  ACTIVE       = 'ACTIVE',
  SUSPENDED    = 'SUSPENDED',
  FAILED       = 'FAILED',
  ARCHIVED     = 'ARCHIVED',
}

/**
 * Subscription state — tracked SEPARATELY from the tenant lifecycle. A tenant
 * can be ACTIVE while its subscription is PAST_DUE, etc.
 */
export enum SubscriptionStatus {
  TRIAL     = 'TRIAL',
  ACTIVE    = 'ACTIVE',
  PAST_DUE  = 'PAST_DUE',
  EXPIRED   = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

/**
 * Billing cadence for a subscription.
 */
export enum BillingInterval {
  MONTHLY = 'MONTHLY',
  YEARLY  = 'YEARLY',
}

/**
 * A single provisioning operation requested against a product adapter.
 * Drives the idempotent, retry-safe ProductProvisioner interface.
 */
export enum ProvisioningAction {
  PROVISION     = 'PROVISION',
  SUSPEND       = 'SUSPEND',
  REACTIVATE    = 'REACTIVATE',
  UPDATE_PLAN   = 'UPDATE_PLAN',
  UPDATE_LIMITS = 'UPDATE_LIMITS',
  ARCHIVE       = 'ARCHIVE',
}

/**
 * Outcome/state of a provisioning job (one row per attempt in the log).
 */
export enum ProvisioningStatus {
  QUEUED     = 'QUEUED',
  RUNNING    = 'RUNNING',
  SUCCEEDED  = 'SUCCEEDED',
  FAILED     = 'FAILED',
}

/**
 * Known Handla products. The `code` is the stable key used by the provisioner
 * registry and the subdomain strategy (*.<code>.handla.tech).
 */
export enum ProductCode {
  MUDAR   = 'mudar',
  MATJARI = 'matjari',
  MANARA  = 'manara',
}
