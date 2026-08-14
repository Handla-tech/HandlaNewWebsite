/**
 * Shared types for the Handla mobile app. Mirrors the backend response envelope
 * and the core entities the app consumes.
 */

// ─── API envelope ─────────────────────────────────────────────────────────────
export interface ApiEnvelope<T> {
  message: string;
  data: T;
}

// ─── Auth / user ──────────────────────────────────────────────────────────────
export type UserRole = 'ADMIN' | 'EMPLOYEE' | 'CLIENT' | 'LEAD';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl: string | null;
  bio: string | null;
  phoneNumber: string | null;
  jobTitle: string | null;
  company: string | null;
  location: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResult {
  user: User;
  accessToken: string;
  refreshToken: string;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export interface DashboardStats {
  [key: string]: number | string | null | undefined;
}

// ─── Notifications ─────────────────────────────────────────────────────────────
export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  isRead: boolean;
  data?: Record<string, unknown> | null;
  createdAt: string;
}

export interface Paginated<T> {
  total: number;
  page: number;
  pages: number;
  [key: string]: unknown | T[];
}

// ─── Chat ──────────────────────────────────────────────────────────────────────
export type ConversationStatus = 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED' | string;

export interface ChatUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl: string | null;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string | null;
  fileUrl: string | null;
  isRead: boolean;
  createdAt: string;
  sender?: ChatUser;
}

export interface Conversation {
  id: string;
  adminId: string;
  clientId: string;
  assignedEmployeeId: string | null;
  status: ConversationStatus;
  createdAt: string;
  updatedAt: string;
  admin?: ChatUser;
  client?: ChatUser;
  // Enriched fields from the list endpoint
  unreadCount?: number;
  lastMessage?: Message | null;
  lastMessageAt?: string;
}

export interface PaginatedConversations {
  conversations: Conversation[];
  total: number;
  page: number;
  pages: number;
}

export interface ConversationDetail {
  conversation: Conversation;
  messages: Message[];
}

// ─── Support / Ticketing ─────────────────────────────────────────────────────
export type TicketStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'WAITING_CUSTOMER'
  | 'RESOLVED'
  | 'CLOSED';

export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type TicketCategory = 'BUG' | 'FEATURE' | 'QUESTION' | 'BILLING' | 'OTHER';

export type TicketSource = 'WEB' | 'API' | 'EMAIL';

export interface TicketAttachment {
  url: string;
  name?: string;
}

export interface TicketClient {
  id: string;
  company?: string | null;
  userId?: string | null;
  ownerId?: string | null;
  user?: ChatUser | null;
}

export interface TicketReply {
  id: string;
  ticketId: string;
  authorId: string | null;
  authorName: string | null;
  body: string;
  isInternal: boolean;
  attachments: TicketAttachment[] | null;
  createdAt: string;
  author?: ChatUser | null;
}

export interface Ticket {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  clientId: string;
  projectId: string | null;
  assigneeId: string | null;
  reporterId: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  source: TicketSource;
  attachments: TicketAttachment[] | null;
  firstResponseDueAt: string | null;
  resolveDueAt: string | null;
  firstRespondedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Relations / derived
  client?: TicketClient;
  assignee?: ChatUser | null;
  reporter?: ChatUser | null;
  replies?: TicketReply[];
  slaBreached?: boolean;
}

export interface PaginatedTickets {
  tickets: Ticket[];
  total: number;
  page: number;
  pages: number;
}

export interface SupportStats {
  total: number;
  open: number;
  slaBreached: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
}

// ─── Clients (minimal — for pickers) ─────────────────────────────────────────
export interface Client {
  id: string;
  userId: string;
  ownerId: string | null;
  company: string | null;
  status?: string;
  user?: ChatUser | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedClients {
  clients: Client[];
  total: number;
  page: number;
  pages: number;
}

// ─── Sales: Quotations / Contracts / Invoices ────────────────────────────────
export type QuotationStatus =
  | 'DRAFT'
  | 'SENT'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CONVERTED';

export type ContractStatus = 'DRAFT' | 'SENT' | 'SIGNED' | 'REJECTED';

export type InvoicePaymentStatus = 'UNPAID' | 'PAID' | 'OVERDUE';

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  sortOrder: number;
}

export interface Quotation {
  id: string;
  quoteNumber: string;
  title: string;
  clientId: string;
  ownerId: string | null;
  status: QuotationStatus;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  currency: string | null;
  validUntil: string | null;
  sentAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  notes: string | null;
  convertedContractId: string | null;
  convertedInvoiceId: string | null;
  createdAt: string;
  updatedAt: string;
  client?: TicketClient;
  owner?: ChatUser | null;
  lineItems?: LineItem[];
}

export interface PaginatedQuotations {
  quotations: Quotation[];
  total: number;
  page: number;
  pages: number;
}

export interface Contract {
  id: string;
  title: string;
  body: string;
  clientId: string;
  ownerId: string | null;
  status: ContractStatus;
  sentAt: string | null;
  signedAt: string | null;
  s3Key: string | null;
  pdfUrl: string | null;
  createdAt: string;
  updatedAt: string;
  client?: TicketClient;
  owner?: ChatUser | null;
}

export interface PaginatedContracts {
  contracts: Contract[];
  total: number;
  page: number;
  pages: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  ownerId: string | null;
  status?: string;
  paymentStatus: InvoicePaymentStatus;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  currency: string;
  dueDate: string | null;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  client?: TicketClient;
  owner?: ChatUser | null;
  lineItems?: LineItem[];
}

export interface PaginatedInvoices {
  invoices: Invoice[];
  total: number;
  page: number;
  pages: number;
}

// ─── Finance: Purchases / Expenses / Accounting ──────────────────────────────
export type PurchaseStatus = 'DRAFT' | 'ORDERED' | 'RECEIVED' | 'CANCELLED';
export type PurchasePaymentStatus = 'UNPAID' | 'PAID' | 'OVERDUE';
export type ExpenseType = 'INCOME' | 'EXPENSE';
export type LedgerDirection = 'IN' | 'OUT';
export type LedgerSourceType =
  | 'INVOICE'
  | 'EXPENSE'
  | 'PURCHASE'
  | 'QUOTATION'
  | 'MANUAL';

export interface Supplier {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  taxId?: string | null;
  isActive?: boolean;
  createdAt?: string;
}

export interface PaginatedSuppliers {
  suppliers: Supplier[];
  total: number;
  page: number;
  pages: number;
}

// ─── Projects ────────────────────────────────────────────────────────────────
export type ProjectStatus =
  | 'PLANNING'
  | 'ACTIVE'
  | 'ON_HOLD'
  | 'COMPLETED'
  | 'CANCELLED'
  | string;

export interface Project {
  id: string;
  title: string;
  description: string | null;
  clientId: string;
  ownerId: string | null;
  status: ProjectStatus;
  startDate: string | null;
  endDate: string | null;
  client?: { id: string; company: string | null; user?: ChatUser | null } | null;
  owner?: ChatUser | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedProjects {
  projects: Project[];
  total: number;
  page: number;
  pages: number;
}

// ─── Tasks ───────────────────────────────────────────────────────────────────
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'DELAYED' | string;

export interface Task {
  id: string;
  title: string;
  description: string | null;
  projectId: string;
  assigneeId: string | null;
  ownerId: string | null;
  status: TaskStatus;
  dueDate: string | null;
  project?: { id: string; title: string } | null;
  assignee?: ChatUser | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedTasks {
  tasks: Task[];
  total: number;
  page: number;
  pages: number;
}

export interface Purchase {
  id: string;
  purchaseNumber: string;
  supplierId: string;
  ownerId: string | null;
  status: PurchaseStatus;
  paymentStatus: PurchasePaymentStatus;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  currency: string | null;
  accountCode: string | null;
  orderDate: string | null;
  dueDate: string | null;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  supplier?: Supplier;
  owner?: ChatUser | null;
  lineItems?: LineItem[];
}

export interface PaginatedPurchases {
  purchases: Purchase[];
  total: number;
  page: number;
  pages: number;
}

export interface Expense {
  id: string;
  type: ExpenseType;
  category: string;
  amount: number;
  currency: string;
  description: string | null;
  expenseDate: string;
  invoiceId: string | null;
  purchaseId: string | null;
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
  owner?: ChatUser | null;
}

export interface PaginatedExpenses {
  expenses: Expense[];
  total: number;
  page: number;
  pages: number;
}

export interface FinancialSummary {
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  paidInvoicesIncome: number;
  manualIncome: number;
  outstandingInvoices: number;
  periodFrom?: string;
  periodTo?: string;
}

export interface LedgerAccount {
  id: string;
  code: string;
  name: string;
  currency: string | null;
}

export interface LedgerEntry {
  id: string;
  entryDate: string;
  accountId: string;
  clientId: string | null;
  direction: LedgerDirection;
  amount: number;
  currency: string | null;
  sourceType: LedgerSourceType;
  sourceId: string;
  description: string | null;
  ownerId: string | null;
  createdAt: string;
  account?: LedgerAccount;
  client?: TicketClient;
}

export interface PaginatedLedger {
  entries: LedgerEntry[];
  total: number;
  page: number;
  pages: number;
}

// ─── Analytics ────────────────────────────────────────────────────────────────
export interface AnalyticsOverview {
  pageviews: number;
  events: number;
  uniqueVisitors: number;
  sessions: number;
  bounceRate: number;
  viewsPerSession: number;
}

export type AnalyticsInterval = 'hour' | 'day' | 'month';

export interface TimeseriesPoint {
  bucket: string;
  pageviews: number;
  visitors: number;
  sessions: number;
}

export interface AnalyticsTimeseries {
  interval: AnalyticsInterval;
  series: TimeseriesPoint[];
}

export interface TopRow {
  key: string;
  count: number;
  visitors: number;
}

export interface AnalyticsTopResult {
  rows: TopRow[];
}

// ─── Admin: Team (users) ──────────────────────────────────────────────────────
export interface TeamMember {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isArchived?: boolean;
  archivedAt?: string | null;
  isDisabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedUsers {
  users: TeamMember[];
  total: number;
  page: number;
  pages: number;
}

// ─── Admin: Testimonials ──────────────────────────────────────────────────────
export interface Testimonial {
  id: string;
  clientName: string;
  clientCompany: string | null;
  content: string;
  imageUrl: string | null;
  rating: number;
  createdByAdminId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedTestimonials {
  testimonials: Testimonial[];
  total: number;
  page: number;
  pages: number;
}

// ─── Admin: SaaS Tenants ──────────────────────────────────────────────────────
export type TenantStatus =
  | 'PENDING'
  | 'PROVISIONING'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'FAILED'
  | 'ARCHIVED';

export interface Tenant {
  id: string;
  clientId: string;
  productId: string;
  slug: string;
  name: string;
  status: TenantStatus;
  externalTenantId: string | null;
  lastError: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  product?: { id: string; name: string } | null;
  client?: { id: string; user?: { name?: string; email?: string } | null } | null;
}

export interface PaginatedTenants {
  tenants: Tenant[];
  total: number;
  page: number;
  pages: number;
}
