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

// ─── Misc helpers ─────────────────────────────────────────────────────────────

export type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T;

export type Nullable<T> = T | null;
