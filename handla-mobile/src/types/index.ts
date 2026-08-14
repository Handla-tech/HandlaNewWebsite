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
