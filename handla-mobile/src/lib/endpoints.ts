import { api } from './api';
import type {
  AuthResult,
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
} from '@/types';

/**
 * Typed endpoint helpers. Paths mirror the NestJS backend (global `/api` prefix
 * is already baked into the axios baseURL).
 */

export const authApi = {
  signIn: (email: string, password: string) =>
    api.post<{ message: string; data: AuthResult }>('/auth/signin', { email, password }),
  signUp: (payload: { name: string; email: string; password: string }) =>
    api.post<{ message: string; data: AuthResult }>('/auth/signup', payload),
  me: () => api.get<{ message: string; data: { user: User } }>('/auth/me'),
  logout: () => api.post<{ message: string; data: unknown }>('/auth/logout'),
};

export const dashboardApi = {
  // Existing back-office dashboard endpoints (ADMIN/EMPLOYEE).
  stats: (params?: object) => api.get('/erp/dashboard/stats', { params }),
  financialChart: (params?: object) => api.get('/erp/dashboard/financial-chart', { params }),
};

export const notificationsApi = {
  list: (params?: object) => api.get('/notifications', { params }),
  unreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
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
  markConversationRead: (id: string) =>
    api.patch(`/chat/messages/${id}/read`),
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

// ─── Clients (@Controller('erp/clients')) — used by staff pickers ────────────
export const clientsApi = {
  /** GET /erp/clients — ADMIN/EMPLOYEE, role-scoped. */
  list: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get<{ message: string; data: PaginatedClients }>('/erp/clients', { params }),
};

// ─── Quotations (@Controller('erp/quotations')) ──────────────────────────────
export interface QuotationsQuery {
  page?: number;
  limit?: number;
  clientId?: string;
  status?: QuotationStatus;
  search?: string;
}

export const quotationsApi = {
  list: (params?: QuotationsQuery) =>
    api.get<{ message: string; data: PaginatedQuotations }>('/erp/quotations', { params }),
  get: (id: string) =>
    api.get<{ message: string; data: Quotation }>(`/erp/quotations/${id}`),
  /** ADMIN/EMPLOYEE/CLIENT — accept a sent quotation. */
  accept: (id: string) =>
    api.post<{ message: string; data: Quotation }>(`/erp/quotations/${id}/accept`),
  /** ADMIN/EMPLOYEE/CLIENT — reject a sent quotation. */
  reject: (id: string, reason?: string) =>
    api.post<{ message: string; data: Quotation }>(`/erp/quotations/${id}/reject`, { reason }),
};

// ─── Contracts (@Controller('erp/contracts')) ────────────────────────────────
export interface ContractsQuery {
  page?: number;
  limit?: number;
  clientId?: string;
  status?: ContractStatus;
  search?: string;
}

export const contractsApi = {
  list: (params?: ContractsQuery) =>
    api.get<{ message: string; data: PaginatedContracts }>('/erp/contracts', { params }),
  get: (id: string) =>
    api.get<{ message: string; data: Contract }>(`/erp/contracts/${id}`),
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

export const invoicesApi = {
  list: (params?: InvoicesQuery) =>
    api.get<{ message: string; data: PaginatedInvoices }>('/erp/invoices', { params }),
  get: (id: string) =>
    api.get<{ message: string; data: Invoice }>(`/erp/invoices/${id}`),
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

export const purchasesApi = {
  list: (params?: PurchasesQuery) =>
    api.get<{ message: string; data: PaginatedPurchases }>('/purchases', { params }),
  get: (id: string) => api.get<{ message: string; data: Purchase }>(`/purchases/${id}`),
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

export const expensesApi = {
  /** GET /erp/expenses/summary — income/expense/net financial summary. */
  summary: (params?: { dateFrom?: string; dateTo?: string }) =>
    api.get<{ message: string; data: FinancialSummary }>('/erp/expenses/summary', { params }),
  list: (params?: ExpensesQuery) =>
    api.get<{ message: string; data: PaginatedExpenses }>('/erp/expenses', { params }),
  get: (id: string) => api.get<{ message: string; data: Expense }>(`/erp/expenses/${id}`),
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

export const usersApi = {
  list: (params?: UsersQuery) =>
    api.get<{ message: string; data: PaginatedUsers }>('/users', { params }),
};
