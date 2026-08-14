// =============================================================================
// Handla — Shared TypeScript Interfaces
// =============================================================================

// ─── Enums (mirror backend) ───────────────────────────────────────────────────

export type UserRole = 'ADMIN' | 'EMPLOYEE' | 'CLIENT' | 'LEAD';
export type ConversationStatus = 'ACTIVE' | 'ON_HOLD' | 'COMPLETED';
export type NotificationType =
  | 'MESSAGE'
  | 'SYSTEM'
  // ERP-9 event types
  | 'CONTRACT_SENT'
  | 'CONTRACT_SIGNED'
  | 'CONTRACT_REJECTED'
  | 'INVOICE_CREATED'
  | 'INVOICE_OVERDUE'
  | 'LEAD_ASSIGNED'
  | 'LEAD_PROMOTED'
  | 'TASK_ASSIGNED'
  | 'TASK_DELAYED';
export type Theme = 'light' | 'dark';
export type Locale = 'en' | 'ar';

// ─── ERP Enums ────────────────────────────────────────────────────────────────
export type ClientStatus        = 'ACTIVE' | 'INACTIVE' | 'CHURNED';
export type ProjectStatus       = 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
export type TaskStatus          = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'DELAYED';
export type InvoicePaymentStatus = 'UNPAID' | 'PAID' | 'OVERDUE';
export type ExpenseType          = 'INCOME' | 'EXPENSE';

// ─── Core Domain Entities ─────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  // ─── Profile fields (added 2026-06 with Profiles module) ──────────────
  // All optional / nullable — pre-existing users may have NULL.
  avatarUrl?: string | null;
  bio?: string | null;
  phoneNumber?: string | null;
  jobTitle?: string | null;
  company?: string | null;
  location?: string | null;
  isArchived: boolean;
  archivedAt: string | null;
  isDisabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Payload for PATCH /profiles/me and PATCH /profiles/:id — all fields optional. */
export interface UpdateProfilePayload {
  name?: string;
  email?: string;
  avatarUrl?: string | null;
  bio?: string | null;
  phoneNumber?: string | null;
  jobTitle?: string | null;
  company?: string | null;
  location?: string | null;
}

export interface Conversation {
  id: string;
  adminId: string;
  clientId: string;
  /** Nullable FK — the EMPLOYEE assigned to this conversation (ERP-1). */
  assignedEmployeeId?: string | null;
  status: ConversationStatus;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
  admin?: User;
  client?: User;
  assignedEmployee?: User | null;
  messages?: Message[];
  unreadCount?: number;
  /** Last message in the conversation (populated by getConversations enrichment) */
  lastMessage?: Message | null;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string | null;
  fileUrl: string | null;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
  sender?: User;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  relatedMessageId: string | null;
  relatedEntityId: string | null;
  createdAt: string;
}

export interface Testimonial {
  id: string;
  clientName: string;
  clientCompany: string | null;
  content: string;
  imageUrl: string | null;
  rating: number;
  createdAt: string;
  updatedAt: string;
}

// ─── ERP-3: Client Entity ─────────────────────────────────────────────────────

export interface Client {
  id: string;
  userId: string;
  ownerId: string | null;
  company: string | null;
  status: ClientStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  user?: User;
  owner?: User | null;
}

export interface PaginatedClients {
  clients: Client[];
  total: number;
  page: number;
  pages: number;
}

// ─── ERP-4: Project Entity ────────────────────────────────────────────────────

export interface Project {
  id: string;
  title: string;
  description: string | null;
  clientId: string;
  ownerId: string | null;
  status: ProjectStatus;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  client?: Client & { user?: User };
  owner?: User | null;
}

export interface PaginatedProjects {
  projects: Project[];
  total: number;
  page: number;
  pages: number;
}

// ─── ERP-5: Task Entity ───────────────────────────────────────────────────────

export interface Task {
  id: string;
  title: string;
  description: string | null;
  projectId: string;
  assigneeId: string | null;
  ownerId: string | null;
  status: TaskStatus;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  project?: Project & { client?: Client };
  assignee?: User | null;
  owner?: User | null;
}

export interface PaginatedTasks {
  tasks: Task[];
  total: number;
  page: number;
  pages: number;
}

// ─── ERP-6: Contracts ─────────────────────────────────────────────────────────

export type ContractStatus = 'DRAFT' | 'SENT' | 'SIGNED' | 'REJECTED';

export type ContractType =
  | 'FIXED_PRICE'
  | 'HOURLY'
  | 'RETAINER'
  | 'MILESTONE'
  | 'MAINTENANCE'
  | 'CONSULTATION';

export type OwnershipType =
  | 'CLIENT_OWNS_EVERYTHING'
  | 'OWNERSHIP_TRANSFERS_AFTER_PAYMENT'
  | 'SHARED_OWNERSHIP';

export interface PaymentMilestone {
  name: string;
  percentage?: number;
  amount?: number;
  dueDate?: string;
}

/** Structured contract data — all optional, mirrors backend ContractDetailsDto. */
export interface ContractDetails {
  contractNumber?:        string;
  contractType?:          ContractType;
  projectName?:           string;
  clientName?:            string;
  clientCompany?:         string;
  clientEmail?:           string;
  clientPhone?:           string;
  clientAddress?:         string;
  projectDescription?:    string;
  scopeOfWork?:           string;
  deliverables?:          string[];
  excludedServices?:      string[];
  startDate?:             string;
  endDate?:               string;
  estimatedDuration?:     string;
  currency?:              string;
  totalValue?:            number;
  paymentMilestones?:     PaymentMilestone[];
  freeRevisions?:         number;
  additionalRevisionCost?: number;
  warrantyPeriod?:        string;
  supportPeriod?:         string;
  ownershipType?:         OwnershipType;
  ndaIncluded?:           boolean;
  hostingIncluded?:       boolean;
  domainIncluded?:        boolean;
  sslIncluded?:           boolean;
  deploymentIncluded?:    boolean;
  latePaymentPenalty?:    string;
  terminationTerms?:      string;
  acceptancePeriodDays?:  number;
  termsAndConditions?:    string;
}

export interface Contract {
  id: string;
  title: string;
  body: string;
  details?: ContractDetails | null;
  clientId: string;
  ownerId: string | null;
  status: ContractStatus;
  sentAt: string | null;
  signedAt: string | null;
  s3Key: string | null;
  pdfUrl: string | null;
  createdAt: string;
  updatedAt: string;
  client?: Client & { user?: User };
  owner?: User | null;
}

export interface PaginatedContracts {
  contracts: Contract[];
  total: number;
  page: number;
  pages: number;
}

// ─── ERP-7: Invoices ──────────────────────────────────────────────────────────

export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  sortOrder: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  ownerId: string | null;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  currency: string;
  paymentStatus: InvoicePaymentStatus;
  dueDate: string | null;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  client?: Client & { user?: User };
  owner?: User | null;
  lineItems?: InvoiceLineItem[];
}

export interface PaginatedInvoices {
  invoices: Invoice[];
  total: number;
  page: number;
  pages: number;
}

// ─── ERP-8: Expenses ──────────────────────────────────────────────────────────

export interface Expense {
  id: string;
  type: ExpenseType;
  category: string;
  amount: number;
  currency: string;
  description: string | null;
  expenseDate: string;
  invoiceId: string | null;
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
  invoice?: { invoiceNumber: string } | null;
  owner?: { name: string } | null;
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

// ─── ERP-10: Dashboard Stats ──────────────────────────────────────────────────

export interface DashboardStats {
  // Lead / Client
  totalLeads: number;
  totalClients: number;
  newLeadsThisMonth: number;
  newClientsThisMonth: number;
  // Projects
  activeProjects: number;
  projectsByStatus: {
    planning: number;
    active: number;
    onHold: number;
    completed: number;
    cancelled: number;
  };
  // Tasks
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  delayedTasks: number;
  pendingTasks: number;
  // Financials (current month)
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  outstandingInvoices: number;
  overdueInvoicesCount: number;
  // Contracts
  contractsByStatus: {
    draft: number;
    sent: number;
    signed: number;
    rejected: number;
  };
}

export interface FinancialChartMonth {
  month: string;   // e.g. "Jan 2026"
  income: number;
  expenses: number;
}

export type FinancialChartData = FinancialChartMonth[];

// ─── ERP: Users Paginated ─────────────────────────────────────────────────────

export interface PaginatedUsers {
  users: User[];
  total: number;
  page: number;
  pages: number;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export interface SignInPayload {
  email: string;
  password: string;
}

export interface SignUpPayload {
  email: string;
  password: string;
  name: string;
}

// ─── API Response Shapes ──────────────────────────────────────────────────────

/** Standard success envelope from TransformInterceptor */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

/** Paginated list response */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** API error shape */
export interface ApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
  timestamp?: string;
  path?: string;
}

// ─── Presigned URL ────────────────────────────────────────────────────────────

export interface PresignedUrlResult {
  url: string;
  bucket: string;
  key: string;
  expiresIn: number;
  fileUrl: string;
}

export interface PresignedUrlRequest {
  fileName: string;
  contentType: string;
  fileSize: number;
}

// ─── Query DTOs ───────────────────────────────────────────────────────────────

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface NotificationQuery extends PaginationQuery {
  isRead?: boolean;
}

// ─── Zustand State Slices ─────────────────────────────────────────────────────

export interface AuthState {
  user: User | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  login: (payload: SignInPayload) => Promise<void>;
  signup: (payload: SignUpPayload) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  getMe: () => Promise<void>;
  setUser: (user: User | null) => void;
}

export interface ChatState {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  messages: Message[];
  isLoadingConversations: boolean;
  isLoadingMessages: boolean;
  isSending: boolean;
  typingUsers: Record<string, boolean>; // userId → isTyping
  setActiveConversation: (conversation: Conversation | null) => void;
  setConversations: (conversations: Conversation[]) => void;
  addMessage: (message: Message) => void;
  setMessages: (messages: Message[]) => void;
  setTyping: (userId: string, isTyping: boolean) => void;
  updateConversationStatus: (id: string, status: ConversationStatus) => void;
}

export interface NotificationState {
  notifications:      Notification[];
  unreadCount:        number;
  isLoading:          boolean;
  addNotification:    (notification: Notification) => void;
  setNotifications:   (notifications: Notification[]) => void;
  markAsRead:         (id: string) => void;
  markAllAsRead:      () => void;
  deleteNotification: (id: string) => void;
  setUnreadCount:     (count: number) => void;
}

export interface UIState {
  theme: Theme;
  locale: Locale;
  sidebarOpen: boolean;
  isMobileMenuOpen: boolean;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  setLocale: (locale: Locale) => void;
  toggleSidebar: () => void;
  setMobileMenuOpen: (open: boolean) => void;
}

// ─── Socket Event Payloads ────────────────────────────────────────────────────

export interface SocketMessageReceivedPayload {
  message: Message;
  conversationId: string;
}

export interface SocketNotificationPayload {
  notification: Notification;
  conversationId: string;
  senderId: string;
}

export interface SocketTypingPayload {
  userId: string;
  userName: string;
  conversationId: string;
  isTyping: boolean;
}

export interface SocketUserOnlinePayload {
  userId: string;
  online: boolean;
}

export interface SocketMessageReadPayload {
  messageId: string;
  userId: string;
}

export interface SocketMessagesReadPayload {
  conversationId: string;
  userId: string;
}

/** All typed socket events emitted from the server → client */
export interface ServerToClientEvents {
  messageReceived:  (payload: SocketMessageReceivedPayload) => void;
  notificationNew:  (payload: SocketNotificationPayload) => void;
  userTyping:       (payload: SocketTypingPayload) => void;
  userOnline:       (payload: SocketUserOnlinePayload) => void;
  messageRead:      (payload: SocketMessageReadPayload) => void;
  messagesRead:     (payload: SocketMessagesReadPayload) => void;
  error:            (payload: { message: string }) => void;
}

/** All typed socket events emitted from the client → server */
export interface ClientToServerEvents {
  sendMessage:       (payload: { conversationId: string; content?: string; fileUrl?: string }) => void;
  markAsRead:        (payload: { messageId?: string; conversationId?: string }) => void;
  typing:            (payload: { conversationId: string; isTyping: boolean }) => void;
  joinConversation:  (payload: { conversationId: string }) => void;
  leaveConversation: (payload: { conversationId: string }) => void;
}

// ─── File Upload ──────────────────────────────────────────────────────────────

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface UploadResult {
  fileUrl: string;
  key: string;
  contentType: string;
  size: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// NEW MODULES (Accounting, Suppliers, Purchases, Quotations, Support, Reports)
// ═══════════════════════════════════════════════════════════════════════════

// ─── Accounting (Financial Hub) ───────────────────────────────────────────────

export type AccountType = 'ASSET' | 'LIABILITY' | 'INCOME' | 'EXPENSE' | 'EQUITY';
export type LedgerDirection = 'IN' | 'OUT';
export type LedgerSourceType = 'INVOICE' | 'EXPENSE' | 'PURCHASE' | 'QUOTATION' | 'MANUAL';

export interface Account {
  id:          string;
  code:        string;
  name:        string;
  type:        AccountType;
  parentId:    string | null;
  currency:    string | null;
  description: string | null;
  isSystem:    boolean;
  isActive:    boolean;
  createdAt:   string;
  updatedAt:   string;
}

export interface LedgerEntry {
  id:          string;
  entryDate:   string;
  accountId:   string;
  account?:    Account | null;
  clientId:    string | null;
  client?:     Client | null;
  direction:   LedgerDirection;
  amount:      number;
  currency:    string | null;
  sourceType:  LedgerSourceType;
  sourceId:    string;
  description: string | null;
  ownerId:     string | null;
  createdAt:   string;
}

export interface PaginatedLedger {
  entries: LedgerEntry[];
  total:   number;
  page:    number;
  pages:   number;
}

// ─── Suppliers ────────────────────────────────────────────────────────────────

export interface Supplier {
  id:        string;
  name:      string;
  company:   string | null;
  email:     string | null;
  phone:     string | null;
  taxId:     string | null;
  address:   string | null;
  notes:     string | null;
  isActive:  boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedSuppliers {
  suppliers: Supplier[];
  total:     number;
  page:      number;
  pages:     number;
}

// ─── Purchases ────────────────────────────────────────────────────────────────

export type PurchaseStatus        = 'DRAFT' | 'ORDERED' | 'RECEIVED' | 'CANCELLED';
export type PurchasePaymentStatus = 'UNPAID' | 'PAID' | 'OVERDUE';

export interface PurchaseLineItem {
  id?:        string;
  description:string;
  quantity:   number;
  unitPrice:  number;
  lineTotal?: number;
  sortOrder?: number;
}

export interface Purchase {
  id:             string;
  purchaseNumber: string;
  supplierId:     string;
  supplier?:      Supplier | null;
  ownerId:        string | null;
  owner?:         { id: string; name: string } | null;
  status:         PurchaseStatus;
  paymentStatus:  PurchasePaymentStatus;
  subtotal:       number;
  taxRate:        number;
  taxAmount:      number;
  total:          number;
  currency:       string | null;
  accountCode:    string | null;
  orderDate:      string | null;
  dueDate:        string | null;
  paidAt:         string | null;
  notes:          string | null;
  lineItems?:     PurchaseLineItem[];
  createdAt:      string;
  updatedAt:      string;
}

export interface PaginatedPurchases {
  purchases: Purchase[];
  total:     number;
  page:      number;
  pages:     number;
}

// ─── Quotations ───────────────────────────────────────────────────────────────

export type QuotationStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CONVERTED';

export interface QuotationLineItem {
  id?:        string;
  description:string;
  quantity:   number;
  unitPrice:  number;
  lineTotal?: number;
  sortOrder?: number;
}

export interface Quotation {
  id:                  string;
  quoteNumber:         string;
  title:               string;
  publicToken:         string;
  clientId:            string;
  client?:             Client | null;
  ownerId:             string | null;
  owner?:              { id: string; name: string } | null;
  status:              QuotationStatus;
  subtotal:            number;
  taxRate:             number;
  taxAmount:           number;
  total:               number;
  currency:            string | null;
  validUntil:          string | null;
  sentAt:              string | null;
  acceptedAt:          string | null;
  rejectedAt:          string | null;
  notes:               string | null;
  convertedContractId: string | null;
  convertedInvoiceId:  string | null;
  lineItems?:          QuotationLineItem[];
  createdAt:           string;
  updatedAt:           string;
}

export interface PaginatedQuotations {
  quotations: Quotation[];
  total:      number;
  page:       number;
  pages:      number;
}

// ─── Support / Ticketing ──────────────────────────────────────────────────────

export type TicketStatus   = 'OPEN' | 'IN_PROGRESS' | 'WAITING_CUSTOMER' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TicketCategory = 'BUG' | 'FEATURE' | 'QUESTION' | 'BILLING' | 'OTHER';
export type TicketSource   = 'WEB' | 'API' | 'EMAIL';

export interface TicketAttachment {
  url:   string;
  name?: string;
}

export interface TicketReply {
  id:          string;
  ticketId:    string;
  authorId:    string | null;
  authorName:  string | null;
  body:        string;
  isInternal:  boolean;
  attachments: TicketAttachment[] | null;
  createdAt:   string;
}

export interface Ticket {
  id:                 string;
  ticketNumber:       string;
  subject:            string;
  description:        string;
  clientId:           string;
  client?:            Client | null;
  projectId:          string | null;
  project?:           Project | null;
  assigneeId:         string | null;
  assignee?:          { id: string; name: string } | null;
  reporterId:         string | null;
  status:             TicketStatus;
  priority:           TicketPriority;
  category:           TicketCategory;
  source:             TicketSource;
  attachments:        TicketAttachment[] | null;
  firstResponseDueAt: string | null;
  resolveDueAt:       string | null;
  firstRespondedAt:   string | null;
  resolvedAt:         string | null;
  closedAt:           string | null;
  slaBreached?:       boolean;
  replies?:           TicketReply[];
  createdAt:          string;
  updatedAt:          string;
}

export interface PaginatedTickets {
  tickets: Ticket[];
  total:   number;
  page:    number;
  pages:   number;
}

export interface ClientApiKey {
  id:         string;
  clientId:   string;
  label:      string;
  prefix:     string;
  isActive:   boolean;
  lastUsedAt: string | null;
  createdAt:  string;
  plaintext?: string; // present only on creation
}

// ─── Phase 11: SaaS Control Plane ─────────────────────────────────────────────
// Handla as a managed, admin-only SaaS control plane for its products.

export type TenantStatus =
  | 'PENDING'
  | 'PROVISIONING'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'FAILED'
  | 'ARCHIVED';

export type SubscriptionStatus =
  | 'TRIAL'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'EXPIRED'
  | 'CANCELLED';

export type BillingInterval = 'MONTHLY' | 'YEARLY';

export type ProvisioningAction =
  | 'PROVISION'
  | 'SUSPEND'
  | 'REACTIVATE'
  | 'UPDATE_PLAN'
  | 'UPDATE_LIMITS'
  | 'ARCHIVE';

export type ProvisioningStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';

export interface SaasProduct {
  id:                  string;
  code:                string;
  name:                string;
  description:         string | null;
  subdomainZone:       string | null;
  provisioner:         string;
  provisioningBaseUrl: string | null;
  provisioningKeyHash: string | null;
  isActive:            boolean;
  createdAt:           string;
  updatedAt:           string;
}

export interface SaasPlan {
  id:           string;
  productId:    string;
  code:         string;
  name:         string;
  description:  string | null;
  priceMonthly: string | null;
  priceYearly:  string | null;
  currency:     string | null;
  limits:       Record<string, unknown> | null;
  entitlements: Record<string, unknown> | null;
  trialDays:    number;
  isActive:     boolean;
  createdAt:    string;
  updatedAt:    string;
}

export interface SaasTenantDomain {
  id:         string;
  tenantId:   string;
  domain:     string;
  isPrimary:  boolean;
  isVerified: boolean;
}

export interface SaasTenant {
  id:               string;
  clientId:         string;
  productId:        string;
  slug:             string;
  name:             string;
  status:           TenantStatus;
  externalTenantId: string | null;
  metadata:         Record<string, unknown> | null;
  lastError:        string | null;
  archivedAt:       string | null;
  createdAt:        string;
  updatedAt:        string;
  product?:         SaasProduct;
  client?:          Client;
  domains?:         SaasTenantDomain[];
}

export interface SaasSubscription {
  id:                 string;
  tenantId:           string;
  planId:             string;
  status:             SubscriptionStatus;
  billingInterval:    BillingInterval;
  trialEndsAt:        string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd:   string | null;
  cancelledAt:        string | null;
  plan?:              SaasPlan;
}

export interface SaasProvisioningLog {
  id:           string;
  tenantId:     string;
  action:       ProvisioningAction;
  status:       ProvisioningStatus;
  requestId:    string;
  attempts:     number;
  errorMessage: string | null;
  triggeredBy:  string | null;
  startedAt:    string | null;
  finishedAt:   string | null;
  createdAt:    string;
}

export interface PaginatedTenants {
  tenants: SaasTenant[];
  total:   number;
  page:    number;
  pages:   number;
}

export interface TenantDetail {
  tenant:       SaasTenant;
  subscription: SaasSubscription | null;
  logs:         SaasProvisioningLog[];
  nextStates:   TenantStatus[];
}

// ─── Phase 10: AI Handla Assistant ────────────────────────────────────────────
// KB-grounded chatbot + lead qualification. Admin/staff surface only.

export type KnowledgeCategory =
  | 'COMPANY'
  | 'PRODUCT'
  | 'PRICING'
  | 'PROCESS'
  | 'FAQ'
  | 'POLICY'
  | 'OTHER';

export type LeadStatus =
  | 'NEW'
  | 'QUALIFYING'
  | 'QUALIFIED'
  | 'DISQUALIFIED'
  | 'CONVERTED';

export type AiControlMode = 'AI' | 'HUMAN';

export type MessageOrigin = 'CLIENT' | 'STAFF' | 'AI' | 'SYSTEM';

export type AiIntent =
  | 'GENERAL_QUESTION'
  | 'LEAD_INQUIRY'
  | 'SUPPORT_REQUEST'
  | 'SMALL_TALK'
  | 'OUT_OF_SCOPE'
  | 'HANDOFF_REQUEST';

/** A single curated fact the assistant is allowed to speak from. */
export interface KnowledgeEntry {
  id:        string;
  title:     string;
  content:   string;
  category:  KnowledgeCategory;
  tags:      string | null;
  priority:  number;
  isActive:  boolean;
  product:   string | null;
  authorId:  string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedKnowledge {
  entries: KnowledgeEntry[];
  total:   number;
  page:    number;
  pages:   number;
}

export interface CreateKnowledgePayload {
  title:     string;
  content:   string;
  category?: KnowledgeCategory;
  tags?:     string;
  priority?: number;
  isActive?: boolean;
  product?:  string;
}

export type UpdateKnowledgePayload = Partial<CreateKnowledgePayload>;

/** Per-conversation AI orchestration state (sidecar keyed by conversationId). */
export interface ConversationAiState {
  id:                  string;
  conversationId:      string;
  controlMode:         AiControlMode;
  takenOverBy:         string | null;
  takenOverAt:         string | null;
  needsHuman:          boolean;
  escalationReason:    string | null;
  leadStatus:          LeadStatus;
  leadData:            Record<string, unknown> | null;
  missingFields:       string[] | null;
  runningSummary:      string | null;
  lastHandledMessageId: string | null;
  aiMessageCount:      number;
  createdAt:           string;
  updatedAt:           string;
}

// ─── Misc helpers ─────────────────────────────────────────────────────────────

export type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T;

export type Nullable<T> = T | null;
