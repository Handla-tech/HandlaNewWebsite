import { api } from './api';
import type {
  AuthResult,
  PendingVerification,
  VerificationPurpose,
  User,
  PaginatedConversations,
  ConversationDetail,
  Conversation,
  Message,
  PaginatedTickets,
  Ticket,
  SupportStats,
  TicketStatus,
  TicketPriority,
  TicketCategory,
  PaginatedClients,
  Client,
  Supplier,
  Project,
  Task,
  PaginatedQuotations,
  Quotation,
  QuotationStatus,
  PaginatedContracts,
  Contract,
  ContractStatus,
  PaginatedInvoices,
  Invoice,
  InvoicePaymentStatus,
  PaginatedPurchases,
  Purchase,
  PurchaseStatus,
  PurchasePaymentStatus,
  PaginatedExpenses,
  Expense,
  ExpenseType,
  FinancialSummary,
  PaginatedLedger,
  LedgerDirection,
  LedgerSourceType,
  AnalyticsOverview,
  AnalyticsTimeseries,
  AnalyticsTopResult,
  AnalyticsInterval,
  UserRole,
  PaginatedUsers,
  PaginatedSuppliers,
  PaginatedProjects,
  ProjectStatus,
  PaginatedTasks,
  TaskStatus,
  PaginatedTestimonials,
  PaginatedTenants,
  TenantStatus,
  DashboardStats,
  FinancialChartMonth,
  WebsiteProduct,
  PaginatedWebsiteProducts,
  WebsiteProject,
  PaginatedWebsiteProjects,
} from '@/types';

/**
 * Typed endpoint helpers. Paths mirror the NestJS backend (global `/api` prefix
 * is already baked into the axios baseURL).
 */

export const authApi = {
  // signin can return EITHER a full session (verified account) OR
  // { status: 'verification_required', email, purpose } (unverified account).
  signIn: (email: string, password: string) =>
    api.post<{ message: string; data: AuthResult | PendingVerification }>('/auth/signin', {
      email,
      password,
    }),
  signUp: (payload: { name: string; email: string; password: string }) =>
    api.post<{ message: string; data: AuthResult | PendingVerification }>('/auth/signup', payload),
  /** Step 2 of 2: submit the emailed code to complete authentication. */
  verifyOtp: (payload: { email: string; code: string; purpose: VerificationPurpose }) =>
    api.post<{ message: string; data: AuthResult }>('/auth/verify-otp', payload),
  /** Request a fresh code (rate-limited + server-side cooldown). */
  resendOtp: (payload: { email: string; purpose: VerificationPurpose; locale?: string }) =>
    api.post<{ message: string; data: unknown }>('/auth/resend-otp', payload),
  me: () => api.get<{ message: string; data: { user: User } }>('/auth/me'),
  logout: () => api.post<{ message: string; data: unknown }>('/auth/logout'),
};

export const dashboardApi = {
  // Existing back-office dashboard endpoints (ADMIN/EMPLOYEE).
  stats: (params?: object) =>
    api.get<{ message: string; data: DashboardStats }>('/erp/dashboard/stats', { params }),
  financialChart: (params?: object) =>
    api.get<{ message: string; data: FinancialChartMonth[] }>('/erp/dashboard/financial-chart', {
      params,
    }),
};

export const notificationsApi = {
  list: (params?: object) => api.get('/notifications', { params }),
  unreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
  // Native push (Expo) device-token registration.
  registerPushToken: (body: { token: string; platform?: string; deviceName?: string }) =>
    api.post('/notifications/push-token', body),
  unregisterPushToken: (token: string) =>
    api.delete('/notifications/push-token', { data: { token } }),
};

export const chatApi = {
  listConversations: (params?: { page?: number; limit?: number }) =>
    api.get<{ message: string; data: PaginatedConversations }>('/chat/conversations', { params }),
  getConversation: (id: string) =>
    api.get<{ message: string; data: ConversationDetail }>(`/chat/conversations/${id}`),
  getMessages: (id: string) =>
    api.get<{ message: string; data: Message[] }>(`/chat/conversations/${id}/messages`),
  sendMessage: (id: string, content: string, fileUrl?: string) =>
    api.post<{ message: string; data: { message: Message } }>(
      `/chat/conversations/${id}/messages`,
      { content, fileUrl },
    ),
  /** CLIENT: create-or-get the conversation with the default admin. */
  createConversation: () =>
    api.post<{ message: string; data: { conversation: Conversation } }>('/chat/conversations'),
  /**
   * Mark a single message as read.
   * NOTE: `messageId` is a MESSAGE id (not a conversation id) — the backend
   * route is `PATCH /chat/messages/:id/read`. Real-time read receipts are
   * normally driven over the socket (`markAsRead`); this REST call is the
   * per-message fallback.
   */
  markMessageRead: (messageId: string) =>
    api.patch(`/chat/messages/${messageId}/read`),
};

// ─── Support / Ticketing (@Controller('erp/support')) ────────────────────────
export interface TicketsQuery {
  page?: number;
  limit?: number;
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
  clientId?: string;
  assigneeId?: string;
  search?: string;
}

export const supportApi = {
  /** GET /erp/support/stats — ADMIN/EMPLOYEE ticket stats. */
  getStats: () =>
    api.get<{ message: string; data: SupportStats }>('/erp/support/stats'),
  /** GET /erp/support — paginated, role-scoped. */
  getTickets: (params?: TicketsQuery) =>
    api.get<{ message: string; data: PaginatedTickets }>('/erp/support', { params }),
  /** GET /erp/support/:id — ticket with visible replies. */
  getTicket: (id: string) =>
    api.get<{ message: string; data: Ticket }>(`/erp/support/${id}`),
  /** POST /erp/support — create a ticket. */
  createTicket: (data: {
    subject: string;
    description: string;
    clientId?: string;
    priority?: TicketPriority;
    category?: TicketCategory;
  }) => api.post<{ message: string; data: Ticket }>('/erp/support', data),
  /** POST /erp/support/:id/replies — add a threaded reply. */
  addReply: (id: string, data: { body: string; isInternal?: boolean }) =>
    api.post<{ message: string; data: Ticket }>(`/erp/support/${id}/replies`, data),
  /** PATCH /erp/support/:id — staff update (status/priority/assignee/category). */
  updateTicket: (
    id: string,
    data: {
      status?: TicketStatus;
      priority?: TicketPriority;
      category?: TicketCategory;
      assigneeId?: string | null;
    },
  ) => api.patch<{ message: string; data: Ticket }>(`/erp/support/${id}`, data),
};

// ─── Clients (@Controller('erp/clients')) ────────────────────────────────────
export interface ClientInput {
  userId?: string;
  company?: string | null;
  status?: string;
  notes?: string | null;
}

export const clientsApi = {
  /** GET /erp/clients — ADMIN/EMPLOYEE, role-scoped. */
  list: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get<{ message: string; data: PaginatedClients }>('/erp/clients', { params }),
  /** POST /erp/clients — ADMIN/EMPLOYEE. */
  create: (body: ClientInput) =>
    api.post<{ message: string; data: Client }>('/erp/clients', body),
  /** PATCH /erp/clients/:id — ADMIN/EMPLOYEE. */
  update: (id: string, body: ClientInput) =>
    api.patch<{ message: string; data: Client }>(`/erp/clients/${id}`, body),
  /** DELETE /erp/clients/:id — ADMIN. */
  remove: (id: string) => api.delete(`/erp/clients/${id}`),
};

// ─── Suppliers (@Controller('suppliers')) ────────────────────────────────────
export interface SupplierInput {
  name?: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  taxId?: string | null;
  address?: string | null;
  notes?: string | null;
  isActive?: boolean;
}

export const suppliersApi = {
  /** GET /suppliers — ADMIN/EMPLOYEE, paginated. */
  list: (params?: { page?: number; limit?: number; search?: string; isActive?: string }) =>
    api.get<{ message: string; data: PaginatedSuppliers }>('/suppliers', { params }),
  /** POST /suppliers — ADMIN/EMPLOYEE. */
  create: (body: SupplierInput) =>
    api.post<{ message: string; data: Supplier }>('/suppliers', body),
  /** PATCH /suppliers/:id — ADMIN/EMPLOYEE. */
  update: (id: string, body: SupplierInput) =>
    api.patch<{ message: string; data: Supplier }>(`/suppliers/${id}`, body),
  /** DELETE /suppliers/:id — ADMIN. */
  remove: (id: string) => api.delete(`/suppliers/${id}`),
};

// ─── Projects (@Controller('erp/projects')) ──────────────────────────────────
export interface ProjectInput {
  title?: string;
  description?: string;
  clientId?: string;
  status?: ProjectStatus;
  startDate?: string;
  endDate?: string;
}

export const projectsApi = {
  /** GET /erp/projects — ADMIN/EMPLOYEE, role-scoped. */
  list: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: ProjectStatus;
    clientId?: string;
  }) => api.get<{ message: string; data: PaginatedProjects }>('/erp/projects', { params }),
  /** GET /erp/projects/my — CLIENT's own projects. */
  mine: (params?: { page?: number; limit?: number }) =>
    api.get<{ message: string; data: PaginatedProjects }>('/erp/projects/my', { params }),
  /** POST /erp/projects — ADMIN/EMPLOYEE. */
  create: (body: ProjectInput) =>
    api.post<{ message: string; data: Project }>('/erp/projects', body),
  /** PATCH /erp/projects/:id — ADMIN/EMPLOYEE. */
  update: (id: string, body: ProjectInput) =>
    api.patch<{ message: string; data: Project }>(`/erp/projects/${id}`, body),
  /** DELETE /erp/projects/:id — ADMIN. */
  remove: (id: string) => api.delete(`/erp/projects/${id}`),
};

// ─── Tasks (@Controller('erp/tasks')) ────────────────────────────────────────
export interface TaskInput {
  title?: string;
  description?: string;
  projectId?: string;
  assigneeId?: string;
  status?: TaskStatus;
  dueDate?: string;
}

export const tasksApi = {
  /** GET /erp/tasks — ADMIN/EMPLOYEE, role-scoped. */
  list: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: TaskStatus;
    projectId?: string;
    assigneeId?: string;
  }) => api.get<{ message: string; data: PaginatedTasks }>('/erp/tasks', { params }),
  /** POST /erp/tasks — ADMIN/EMPLOYEE. */
  create: (body: TaskInput) => api.post<{ message: string; data: Task }>('/erp/tasks', body),
  /** PATCH /erp/tasks/:id — ADMIN/EMPLOYEE. */
  update: (id: string, body: TaskInput) =>
    api.patch<{ message: string; data: Task }>(`/erp/tasks/${id}`, body),
  /** DELETE /erp/tasks/:id — ADMIN. */
  remove: (id: string) => api.delete(`/erp/tasks/${id}`),
};

// Shared line item for quotations / invoices / purchases.
export interface LineItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
}

// ─── Quotations (@Controller('erp/quotations')) ──────────────────────────────
export interface QuotationsQuery {
  page?: number;
  limit?: number;
  clientId?: string;
  status?: QuotationStatus;
  search?: string;
}

export interface QuotationInput {
  title?: string;
  clientId?: string;
  lineItems?: LineItemInput[];
  taxRate?: number;
  currency?: string | null;
  validUntil?: string | null;
  notes?: string | null;
}

export const quotationsApi = {
  list: (params?: QuotationsQuery) =>
    api.get<{ message: string; data: PaginatedQuotations }>('/erp/quotations', { params }),
  get: (id: string) =>
    api.get<{ message: string; data: Quotation }>(`/erp/quotations/${id}`),
  /** POST /erp/quotations — ADMIN/EMPLOYEE. */
  create: (body: QuotationInput) =>
    api.post<{ message: string; data: Quotation }>('/erp/quotations', body),
  /** PATCH /erp/quotations/:id — ADMIN/EMPLOYEE. */
  update: (id: string, body: QuotationInput) =>
    api.patch<{ message: string; data: Quotation }>(`/erp/quotations/${id}`, body),
  /** DELETE /erp/quotations/:id — ADMIN. */
  remove: (id: string) => api.delete(`/erp/quotations/${id}`),
  /** POST /erp/quotations/:id/send — ADMIN/EMPLOYEE. */
  send: (id: string) =>
    api.post<{ message: string; data: Quotation }>(`/erp/quotations/${id}/send`),
  /** ADMIN/EMPLOYEE/CLIENT — accept a sent quotation. */
  accept: (id: string) =>
    api.post<{ message: string; data: Quotation }>(`/erp/quotations/${id}/accept`),
  /** ADMIN/EMPLOYEE/CLIENT — reject a sent quotation. */
  reject: (id: string, reason?: string) =>
    api.post<{ message: string; data: Quotation }>(`/erp/quotations/${id}/reject`, { reason }),
  /** POST /erp/quotations/:id/convert — ADMIN/EMPLOYEE (→ invoice). */
  convert: (id: string) =>
    api.post<{ message: string; data: unknown }>(`/erp/quotations/${id}/convert`),
};

// ─── Contracts (@Controller('erp/contracts')) ────────────────────────────────
export interface ContractsQuery {
  page?: number;
  limit?: number;
  clientId?: string;
  status?: ContractStatus;
  search?: string;
}

export interface ContractInput {
  title?: string;
  clientId?: string;
  body?: string;
  details?: Record<string, unknown>;
}

export const contractsApi = {
  list: (params?: ContractsQuery) =>
    api.get<{ message: string; data: PaginatedContracts }>('/erp/contracts', { params }),
  get: (id: string) =>
    api.get<{ message: string; data: Contract }>(`/erp/contracts/${id}`),
  /** POST /erp/contracts — ADMIN/EMPLOYEE. */
  create: (body: ContractInput) =>
    api.post<{ message: string; data: Contract }>('/erp/contracts', body),
  /** PATCH /erp/contracts/:id — ADMIN/EMPLOYEE. */
  update: (id: string, body: ContractInput) =>
    api.patch<{ message: string; data: Contract }>(`/erp/contracts/${id}`, body),
  /** DELETE /erp/contracts/:id — ADMIN. */
  remove: (id: string) => api.delete(`/erp/contracts/${id}`),
  /** POST /erp/contracts/:id/send — ADMIN/EMPLOYEE. */
  send: (id: string) =>
    api.post<{ message: string; data: Contract }>(`/erp/contracts/${id}/send`),
  /** CLIENT — accept (sign) a sent contract. */
  accept: (id: string) =>
    api.post<{ message: string; data: Contract }>(`/erp/contracts/${id}/accept`),
  /** CLIENT — reject a sent contract. */
  reject: (id: string, reason?: string) =>
    api.post<{ message: string; data: Contract }>(`/erp/contracts/${id}/reject`, { reason }),
  /** Presigned document URL (all roles). */
  pdfUrl: (id: string) =>
    api.get<{ message: string; data: { url: string } }>(`/erp/contracts/${id}/pdf-url`),
};

// ─── Invoices (@Controller('erp/invoices')) ──────────────────────────────────
export interface InvoicesQuery {
  page?: number;
  limit?: number;
  clientId?: string;
  paymentStatus?: InvoicePaymentStatus;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface InvoiceInput {
  clientId?: string;
  lineItems?: LineItemInput[];
  taxRate?: number;
  dueDate?: string;
  notes?: string;
}

export const invoicesApi = {
  list: (params?: InvoicesQuery) =>
    api.get<{ message: string; data: PaginatedInvoices }>('/erp/invoices', { params }),
  get: (id: string) =>
    api.get<{ message: string; data: Invoice }>(`/erp/invoices/${id}`),
  /** POST /erp/invoices — ADMIN/EMPLOYEE. */
  create: (body: InvoiceInput) =>
    api.post<{ message: string; data: Invoice }>('/erp/invoices', body),
  /** PATCH /erp/invoices/:id — ADMIN/EMPLOYEE. */
  update: (id: string, body: InvoiceInput) =>
    api.patch<{ message: string; data: Invoice }>(`/erp/invoices/${id}`, body),
  /** DELETE /erp/invoices/:id — ADMIN. */
  remove: (id: string) => api.delete(`/erp/invoices/${id}`),
  /** ADMIN/EMPLOYEE — mark an invoice paid. */
  markPaid: (id: string) =>
    api.post<{ message: string; data: Invoice }>(`/erp/invoices/${id}/mark-paid`),
};

// ─── Purchases (@Controller('purchases')) — ADMIN/EMPLOYEE ───────────────────
export interface PurchasesQuery {
  page?: number;
  limit?: number;
  supplierId?: string;
  status?: PurchaseStatus;
  paymentStatus?: PurchasePaymentStatus;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface PurchaseInput {
  supplierId?: string;
  lineItems?: LineItemInput[];
  taxRate?: number;
  currency?: string | null;
  accountCode?: string | null;
  status?: PurchaseStatus;
  orderDate?: string | null;
  dueDate?: string | null;
  notes?: string | null;
}

export const purchasesApi = {
  list: (params?: PurchasesQuery) =>
    api.get<{ message: string; data: PaginatedPurchases }>('/purchases', { params }),
  get: (id: string) => api.get<{ message: string; data: Purchase }>(`/purchases/${id}`),
  /** POST /purchases — ADMIN/EMPLOYEE. */
  create: (body: PurchaseInput) =>
    api.post<{ message: string; data: Purchase }>('/purchases', body),
  /** PATCH /purchases/:id — ADMIN/EMPLOYEE. */
  update: (id: string, body: PurchaseInput) =>
    api.patch<{ message: string; data: Purchase }>(`/purchases/${id}`, body),
  /** DELETE /purchases/:id — ADMIN. */
  remove: (id: string) => api.delete(`/purchases/${id}`),
  markPaid: (id: string) =>
    api.post<{ message: string; data: Purchase }>(`/purchases/${id}/mark-paid`),
};

// ─── Expenses (@Controller('erp/expenses')) — ADMIN/EMPLOYEE ─────────────────
export interface ExpensesQuery {
  page?: number;
  limit?: number;
  type?: ExpenseType;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  excludeInvoiceLinked?: boolean;
}

export interface ExpenseInput {
  type?: ExpenseType;
  category?: string;
  amount?: number;
  description?: string;
  expenseDate?: string;
}

export const expensesApi = {
  /** GET /erp/expenses/summary — income/expense/net financial summary. */
  summary: (params?: { dateFrom?: string; dateTo?: string }) =>
    api.get<{ message: string; data: FinancialSummary }>('/erp/expenses/summary', { params }),
  list: (params?: ExpensesQuery) =>
    api.get<{ message: string; data: PaginatedExpenses }>('/erp/expenses', { params }),
  get: (id: string) => api.get<{ message: string; data: Expense }>(`/erp/expenses/${id}`),
  /** POST /erp/expenses — ADMIN/EMPLOYEE. */
  create: (body: ExpenseInput) =>
    api.post<{ message: string; data: Expense }>('/erp/expenses', body),
  /** PATCH /erp/expenses/:id — ADMIN/EMPLOYEE. */
  update: (id: string, body: ExpenseInput) =>
    api.patch<{ message: string; data: Expense }>(`/erp/expenses/${id}`, body),
  /** DELETE /erp/expenses/:id — ADMIN. */
  remove: (id: string) => api.delete(`/erp/expenses/${id}`),
};

// ─── Accounting ledger (@Controller('accounting')) — ADMIN/EMPLOYEE ──────────
export interface LedgerQuery {
  page?: number;
  limit?: number;
  accountId?: string;
  clientId?: string;
  direction?: LedgerDirection;
  sourceType?: LedgerSourceType;
  currency?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const accountingApi = {
  ledger: (params?: LedgerQuery) =>
    api.get<{ message: string; data: PaginatedLedger }>('/accounting/ledger', { params }),
};

// ─── Analytics (@Controller('erp/analytics')) — ADMIN/EMPLOYEE ───────────────
export interface AnalyticsQuery {
  site?: string;
  from?: string;
  to?: string;
  interval?: AnalyticsInterval;
  limit?: number;
}

export const analyticsApi = {
  overview: (params?: AnalyticsQuery) =>
    api.get<{ message: string; data: AnalyticsOverview }>('/erp/analytics/overview', { params }),
  timeseries: (params?: AnalyticsQuery) =>
    api.get<{ message: string; data: AnalyticsTimeseries }>('/erp/analytics/timeseries', { params }),
  topPages: (params?: AnalyticsQuery) =>
    api.get<{ message: string; data: AnalyticsTopResult }>('/erp/analytics/top-pages', { params }),
  topReferrers: (params?: AnalyticsQuery) =>
    api.get<{ message: string; data: AnalyticsTopResult }>('/erp/analytics/top-referrers', { params }),
  devices: (params?: AnalyticsQuery) =>
    api.get<{ message: string; data: AnalyticsTopResult }>('/erp/analytics/devices', { params }),
  browsers: (params?: AnalyticsQuery) =>
    api.get<{ message: string; data: AnalyticsTopResult }>('/erp/analytics/browsers', { params }),
  countries: (params?: AnalyticsQuery) =>
    api.get<{ message: string; data: AnalyticsTopResult }>('/erp/analytics/countries', { params }),
  topEvents: (params?: AnalyticsQuery) =>
    api.get<{ message: string; data: AnalyticsTopResult }>('/erp/analytics/top-events', { params }),
};

// ─── Users / Team (@Controller('users')) — ADMIN only ────────────────────────
export interface UsersQuery {
  page?: number;
  limit?: number;
  role?: UserRole;
  search?: string;
  isArchived?: boolean;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}
export interface UpdateUserInput {
  name?: string;
  email?: string;
}

export const usersApi = {
  list: (params?: UsersQuery) =>
    api.get<{ message: string; data: PaginatedUsers }>('/users', { params }),
  /** POST /users — ADMIN. Returns { data: { user } }. */
  create: (body: CreateUserInput) =>
    api.post<{ message: string; data: { user: User } }>('/users', body),
  /** PATCH /users/:id — ADMIN (name/email). */
  update: (id: string, body: UpdateUserInput) =>
    api.patch<{ message: string; data: { user: User } }>(`/users/${id}`, body),
  /** PATCH /users/:id/reset-password — ADMIN. */
  resetPassword: (id: string, newPassword: string) =>
    api.patch(`/users/${id}/reset-password`, { newPassword }),
  /** PATCH /users/:id/role — ADMIN. */
  setRole: (id: string, role: UserRole) =>
    api.patch<{ message: string; data: { user: User } }>(`/users/${id}/role`, { role }),
  /** PATCH /users/:leadId/promote — ADMIN. */
  promote: (leadId: string) =>
    api.patch<{ message: string; data: { user: User } }>(`/users/${leadId}/promote`, {}),
  /** PATCH /users/:fromId/reassign/:toId — ADMIN. */
  reassign: (fromId: string, toId: string) =>
    api.patch(`/users/${fromId}/reassign/${toId}`, {}),
  /** PATCH /users/:id/archive — ADMIN. */
  archive: (id: string) =>
    api.patch<{ message: string; data: { user: User } }>(`/users/${id}/archive`, {}),
  /** PATCH /users/:id/unarchive — ADMIN. */
  unarchive: (id: string) =>
    api.patch<{ message: string; data: { user: User } }>(`/users/${id}/unarchive`, {}),
  /** PATCH /users/:id/disable — ADMIN. */
  disable: (id: string) =>
    api.patch<{ message: string; data: { user: User } }>(`/users/${id}/disable`, {}),
  /** PATCH /users/:id/enable — ADMIN. */
  enable: (id: string) =>
    api.patch<{ message: string; data: { user: User } }>(`/users/${id}/enable`, {}),
  /** DELETE /users/:id — ADMIN. */
  remove: (id: string) => api.delete(`/users/${id}`),
};

// ─── Testimonials (@Controller('testimonials')) — ADMIN ──────────────────────
export interface TestimonialInput {
  clientName?: string;
  clientCompany?: string | null;
  content?: string;
  imageUrl?: string | null;
  rating?: number;
}

export const testimonialsApi = {
  /** GET /testimonials — paginated. */
  list: (params?: { page?: number; limit?: number }) =>
    api.get<{ message: string; data: PaginatedTestimonials }>('/testimonials', { params }),
  /** POST /testimonials — ADMIN. */
  create: (body: TestimonialInput) => api.post('/testimonials', body),
  /** PATCH /testimonials/:id — ADMIN. */
  update: (id: string, body: TestimonialInput) => api.patch(`/testimonials/${id}`, body),
  /** DELETE /testimonials/:id — ADMIN. */
  remove: (id: string) => api.delete(`/testimonials/${id}`),
};

// ─── Website Content: Products (@Controller('website/products')) — ADMIN ──────
// Public GET (paginated); create/update/delete are ADMIN-only. Envelope: list
// returns { data: { products, total, page, pages } }; single/create/update
// return { data: { product } }.
export interface WebsiteProductInput {
  name?: string;
  tagline?: string | null;
  description?: string;
  category?: string | null;
  imageUrl?: string | null;
  productUrl?: string | null;
  price?: string | null;
  features?: string[] | null;
  featured?: boolean;
  sortOrder?: number;
}

export const websiteProductsApi = {
  /** GET /website/products — public, paginated. */
  list: (params?: { page?: number; limit?: number; featured?: boolean; category?: string }) =>
    api.get<{ message: string; data: PaginatedWebsiteProducts }>('/website/products', { params }),
  /** GET /website/products/:id — public. */
  get: (id: string) =>
    api.get<{ message: string; data: { product: WebsiteProduct } }>(`/website/products/${id}`),
  /** POST /website/products — ADMIN. */
  create: (body: WebsiteProductInput) =>
    api.post<{ message: string; data: { product: WebsiteProduct } }>('/website/products', body),
  /** PATCH /website/products/:id — ADMIN. */
  update: (id: string, body: WebsiteProductInput) =>
    api.patch<{ message: string; data: { product: WebsiteProduct } }>(`/website/products/${id}`, body),
  /** DELETE /website/products/:id — ADMIN. */
  remove: (id: string) => api.delete(`/website/products/${id}`),
};

// ─── Website Content: Projects (@Controller('website/projects')) — ADMIN ──────
export interface WebsiteProjectInput {
  title?: string;
  clientName?: string | null;
  summary?: string | null;
  description?: string;
  category?: string | null;
  imageUrl?: string | null;
  projectUrl?: string | null;
  tags?: string[] | null;
  featured?: boolean;
  sortOrder?: number;
}

export const websiteProjectsApi = {
  /** GET /website/projects — public, paginated. */
  list: (params?: { page?: number; limit?: number; featured?: boolean; category?: string }) =>
    api.get<{ message: string; data: PaginatedWebsiteProjects }>('/website/projects', { params }),
  /** GET /website/projects/:id — public. */
  get: (id: string) =>
    api.get<{ message: string; data: { project: WebsiteProject } }>(`/website/projects/${id}`),
  /** POST /website/projects — ADMIN. */
  create: (body: WebsiteProjectInput) =>
    api.post<{ message: string; data: { project: WebsiteProject } }>('/website/projects', body),
  /** PATCH /website/projects/:id — ADMIN. */
  update: (id: string, body: WebsiteProjectInput) =>
    api.patch<{ message: string; data: { project: WebsiteProject } }>(`/website/projects/${id}`, body),
  /** DELETE /website/projects/:id — ADMIN. */
  remove: (id: string) => api.delete(`/website/projects/${id}`),
};

// ─── SaaS Tenants (@Controller('saas')) — ADMIN ──────────────────────────────
export interface TenantsQuery {
  page?: number;
  limit?: number;
  status?: TenantStatus;
  productId?: string;
  clientId?: string;
  search?: string;
}

export const tenantsApi = {
  /** GET /saas/tenants — ADMIN, paginated. */
  list: (params?: TenantsQuery) =>
    api.get<{ message: string; data: PaginatedTenants }>('/saas/tenants', { params }),
};
