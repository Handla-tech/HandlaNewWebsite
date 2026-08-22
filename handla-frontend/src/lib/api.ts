import axios, {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
} from 'axios';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// ─── Create the shared Axios instance ────────────────────────────────────────

// 60s is generous enough to cover:
//   • cold-start backends (first request hits DB connection pool warm-up)
//   • aggregate dashboard queries that scan many tables
//   • slow corporate networks or mobile data
// Per-call timeouts can still be set via the axios config when needed
// (e.g. uploads use a much longer timeout managed by the upload helper).
const DEFAULT_TIMEOUT_MS = 60_000;

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true,      // send httpOnly cookies automatically
  timeout: DEFAULT_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Flag to prevent recursive refresh loops ─────────────────────────────────

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

function processQueue(error: AxiosError | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve();
  });
  failedQueue = [];
}

// ─── Auth-failure callback ────────────────────────────────────────────────────
//
// The interceptor lives outside React, so it cannot use hooks or router.
// Components that care about forced logout register a callback here so the
// interceptor can clear state and navigate without a hard page reload.
//
// Without this, `window.location.href = '/auth'` causes a hard reload that
// keeps the httpOnly access_token cookie alive → middleware sees the cookie
// and redirects back to /dashboard → getMe() 401 → loop forever.

type LogoutCallback = () => void;
let _onAuthFailure: LogoutCallback | null = null;

/** Call this once from a top-level client component (e.g. Providers). */
export function registerAuthFailureCallback(cb: LogoutCallback) {
  _onAuthFailure = cb;
}

// ─── Response interceptor — transparent token refresh ────────────────────────

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
      _timeoutRetry?: boolean;
    };

    // ── Transparent retry on transient network timeouts (idempotent GETs only) ──
    //
    // Many "AxiosError: timeout of Xms exceeded" reports are transient hiccups
    // (cold backend, network blip). Retry exactly ONCE for safe HTTP verbs so
    // the user doesn't see a runtime error for a recoverable failure. We do
    // NOT retry POST/PATCH/DELETE — re-issuing them could create duplicate
    // resources (the very bug we just fixed in chat conversation create).
    const isTimeoutOrNetwork =
      error.code === 'ECONNABORTED' ||  // axios timeout
      error.code === 'ETIMEDOUT'  ||
      error.code === 'ERR_NETWORK' ||
      (typeof error.message === 'string' && error.message.toLowerCase().includes('timeout'));
    const method = (originalRequest?.method || 'get').toLowerCase();
    const isIdempotent = method === 'get' || method === 'head' || method === 'options';

    if (
      originalRequest &&
      isTimeoutOrNetwork &&
      isIdempotent &&
      !originalRequest._timeoutRetry
    ) {
      originalRequest._timeoutRetry = true;
      // Brief backoff helps if the server is briefly overloaded
      await new Promise((r) => setTimeout(r, 500));
      try {
        return await api(originalRequest);
      } catch (retryErr) {
        // Fall through to normal error handling below
        error = retryErr as AxiosError;
      }
    }

    // Only attempt refresh on 401 that hasn't already been retried.
    //
    // We explicitly EXCLUDE the session-probe endpoints below. A 401 from
    // /auth/me simply means "not authenticated" — it must NOT kick off a
    // refresh→retry cascade. The store's getMe()/refresh() actions own that
    // flow deliberately; letting the interceptor also react here created the
    // "count keeps climbing" loop:  me 401 → refresh → me 401 → refresh …
    const refreshExemptUrls = ['/auth/refresh', '/auth/signin', '/auth/me'];
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !refreshExemptUrls.includes(originalRequest.url ?? '')
    ) {
      if (isRefreshing) {
        // Queue this request until the refresh finishes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => api(originalRequest));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await api.post('/auth/refresh');    // uses refresh_token httpOnly cookie
        processQueue(null);
        return api(originalRequest);        // retry original request
      } catch (refreshError) {
        processQueue(refreshError as AxiosError);
        // Use the registered callback (soft logout + Next.js router.push)
        // instead of window.location.href which causes the infinite loop:
        //   expired cookie → middleware → /dashboard → getMe() 401 → repeat.
        if (_onAuthFailure) {
          _onAuthFailure();
        } else if (typeof window !== 'undefined') {
          // Fallback if callback not yet registered (e.g. very early load)
          // Navigate without a full reload so the cookie check in middleware
          // is bypassed by Next.js client-side routing.
          window.history.replaceState(null, '', '/auth');
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

// ─── Typed API helpers ────────────────────────────────────────────────────────

export const authApi = {
  signUp:  (data: object) => api.post('/auth/signup', data),
  signIn:  (data: object) => api.post('/auth/signin', data),
  signOut: ()             => api.post('/auth/logout'),
  refresh: ()             => api.post('/auth/refresh'),
  getMe:   ()             => api.get('/auth/me'),
  // ── OTP-based two-step auth ────────────────────────────────────────────────
  verifyOtp:      (data: { email: string; code: string; purpose: 'SIGNUP' | 'LOGIN' | 'GOOGLE' }) =>
    api.post('/auth/verify-otp', data),
  resendOtp:      (data: { email: string; purpose: 'SIGNUP' | 'LOGIN' | 'GOOGLE'; locale?: string }) =>
    api.post('/auth/resend-otp', data),
  // ── Password reset (email code flow) ───────────────────────────────────────
  forgotPassword: (data: { email: string; locale?: string }) =>
    api.post('/auth/forgot-password', data),
  resetPassword:  (data: { email: string; code: string; password: string }) =>
    api.post('/auth/reset-password', data),
  /** Absolute URL that starts the server-side Google OAuth redirect flow. */
  googleUrl: () => `${API_URL}/auth/google`,
};

export const chatApi = {
  getConversations:   ()                          => api.get('/chat/conversations'),
  getConversation:    (id: string)                => api.get(`/chat/conversations/${id}`),
  createConversation: (data: object)              => api.post('/chat/conversations', data),
  getMessages:        (id: string)                => api.get(`/chat/conversations/${id}/messages`),
  sendMessage:        (id: string, data: object)  => api.post(`/chat/conversations/${id}/messages`, data),
  getPresignedUrl:    (data: object)              => api.post('/chat/presigned-url', data),
  updateStatus:       (id: string, data: object)  => api.patch(`/chat/conversations/${id}/status`, data),
  markMessageRead:    (id: string)                => api.patch(`/chat/messages/${id}/read`),
};

export const notificationApi = {
  getAll:      (params?: object) => api.get('/notifications', { params }),
  getUnread:   ()                => api.get('/notifications/unread-count'),
  markRead:    (id: string)      => api.patch(`/notifications/${id}/read`),
  markAllRead: ()                => api.patch('/notifications/read-all'),
  delete:      (id: string)      => api.delete(`/notifications/${id}`),
  deleteAllRead: ()              => api.delete('/notifications/read'),
};

export const testimonialApi = {
  getAll:  (params?: object) => api.get('/testimonials', { params }),
  getOne:  (id: string)      => api.get(`/testimonials/${id}`),
  create:  (data: object)    => api.post('/testimonials', data),
  update:  (id: string, data: object) => api.patch(`/testimonials/${id}`, data),
  remove:  (id: string)      => api.delete(`/testimonials/${id}`),
};

// ─── Website Content — Projects (public showcase, NOT ERP projects) ──────────
// Backend: @Controller('website/projects') → /api/website/projects/*
// Public GET (list + featured filter + :id); ADMIN-only create/update/delete.

export const websiteProjectApi = {
  /** GET /website/projects — public, paginated. params: { page, limit, featured, category } */
  getAll:  (params?: object)          => api.get('/website/projects', { params }),
  /** GET /website/projects/:id — public */
  getOne:  (id: string)               => api.get(`/website/projects/${id}`),
  /** POST /website/projects — ADMIN */
  create:  (data: object)             => api.post('/website/projects', data),
  /** PATCH /website/projects/:id — ADMIN */
  update:  (id: string, data: object) => api.patch(`/website/projects/${id}`, data),
  /** DELETE /website/projects/:id — ADMIN */
  remove:  (id: string)               => api.delete(`/website/projects/${id}`),
  /** POST /website/projects/image-upload — ADMIN → presigned S3 PUT URL */
  getImageUploadUrl: (data: { fileName: string; contentType: string }) =>
    api.post('/website/projects/image-upload', data),
};

// ─── Website Content — Products (public showcase) ────────────────────────────
// Backend: @Controller('website/products') → /api/website/products/*

export const websiteProductApi = {
  /** GET /website/products — public, paginated. params: { page, limit, featured, category } */
  getAll:  (params?: object)          => api.get('/website/products', { params }),
  /** GET /website/products/:id — public */
  getOne:  (id: string)               => api.get(`/website/products/${id}`),
  /** POST /website/products — ADMIN */
  create:  (data: object)             => api.post('/website/products', data),
  /** PATCH /website/products/:id — ADMIN */
  update:  (id: string, data: object) => api.patch(`/website/products/${id}`, data),
  /** DELETE /website/products/:id — ADMIN */
  remove:  (id: string)               => api.delete(`/website/products/${id}`),
};

// ─── ERP — Users API (ADMIN only) ────────────────────────────────────────────

export const usersApi = {
  /** GET /users — paginated list (role, search, page, limit) */
  getUsers:           (params?: object)              => api.get('/users', { params }),
  /** GET /users/:id */
  getUser:            (id: string)                   => api.get(`/users/${id}`),
  /** POST /users — create user with explicit role */
  createUser:         (data: object)                 => api.post('/users', data),
  /** PATCH /users/:id/role — change role */
  updateRole:         (id: string, data: object)     => api.patch(`/users/${id}/role`, data),
  /** PATCH /users/:leadId/promote — LEAD → CLIENT */
  promoteLead:        (leadId: string)               => api.patch(`/users/${leadId}/promote`),
  /** PATCH /users/:fromId/reassign/:toId — bulk ownership transfer */
  reassignOwnership:  (fromId: string, toId: string) => api.patch(`/users/${fromId}/reassign/${toId}`),
  /** DELETE /users/:id — hard delete */
  deleteUser:         (id: string)                   => api.delete(`/users/${id}`),
  /** PATCH /users/:id/archive — soft-archive (preserves all records) */
  archiveUser:        (id: string)                   => api.patch(`/users/${id}/archive`),
  /** PATCH /users/:id/unarchive — restore from archive */
  unarchiveUser:      (id: string)                   => api.patch(`/users/${id}/unarchive`),
  /** PATCH /users/:id/disable — block login without deleting */
  disableUser:        (id: string)                   => api.patch(`/users/${id}/disable`),
  /** PATCH /users/:id/enable — re-enable a disabled account */
  enableUser:         (id: string)                   => api.patch(`/users/${id}/enable`),
  /** PATCH /users/:id — update name / email */
  updateUser:         (id: string, data: object)     => api.patch(`/users/${id}`, data),
  /** PATCH /users/:id/reset-password — set a new password */
  resetPassword:      (id: string, data: object)     => api.patch(`/users/${id}/reset-password`, data),
};

// ─── ERP — Clients API (ADMIN + EMPLOYEE) ────────────────────────────────────

export const clientsApi = {
  /** GET /erp/clients — paginated (role-scoped) */
  getClients:       (params?: object)              => api.get('/erp/clients', { params }),
  /** GET /erp/clients/:id */
  getClient:        (id: string)                   => api.get(`/erp/clients/${id}`),
  /** POST /erp/clients — create client record for existing CLIENT-role user */
  createClient:     (data: object)                 => api.post('/erp/clients', data),
  /** PATCH /erp/clients/:id — update (EMPLOYEE: own only) */
  updateClient:     (id: string, data: object)     => api.patch(`/erp/clients/${id}`, data),
  /** DELETE /erp/clients/:id — ADMIN only */
  deleteClient:     (id: string)                   => api.delete(`/erp/clients/${id}`),
  /** PATCH /erp/clients/:id/assign-owner — ADMIN only */
  assignClientOwner:(id: string, data: object)     => api.patch(`/erp/clients/${id}/assign-owner`, data),
  /** GET /erp/clients/me — CLIENT: get own client record (id, userId, etc.) */
  getMyRecord:      ()                             => api.get('/erp/clients/me'),
};

// ─── ERP-4: Projects ──────────────────────────────────────────────────────────

export const projectsApi = {
  /** GET /erp/projects — paginated, role-scoped */
  getProjects:          (params?: object)              => api.get('/erp/projects', { params }),
  /** GET /erp/projects/:id — ADMIN / EMPLOYEE / CLIENT (own) */
  getProject:           (id: string)                   => api.get(`/erp/projects/${id}`),
  /** POST /erp/projects — create project under a client */
  createProject:        (data: object)                 => api.post('/erp/projects', data),
  /** PATCH /erp/projects/:id — update (EMPLOYEE: own only) */
  updateProject:        (id: string, data: object)     => api.patch(`/erp/projects/${id}`, data),
  /** DELETE /erp/projects/:id — ADMIN only */
  deleteProject:        (id: string)                   => api.delete(`/erp/projects/${id}`),
  /** GET /erp/clients/:clientId/projects — projects for a specific client */
  getProjectsByClient:  (clientId: string)             => api.get(`/erp/clients/${clientId}/projects`),
  /** GET /erp/projects/my — CLIENT: get own assigned projects */
  getMyProjects:        ()                             => api.get('/erp/projects/my'),
};

// ─── ERP-5: Tasks ─────────────────────────────────────────────────────────────

export const tasksApi = {
  /** GET /erp/tasks — paginated, role-scoped */
  getTasks:             (params?: object)                     => api.get('/erp/tasks', { params }),
  /** GET /erp/tasks/:id — ADMIN / EMPLOYEE (own+assigned) / CLIENT (own project) */
  getTask:              (id: string)                          => api.get(`/erp/tasks/${id}`),
  /** POST /erp/tasks — create task under a project */
  createTask:           (data: object)                        => api.post('/erp/tasks', data),
  /** PATCH /erp/tasks/:id — update (EMPLOYEE: own or assigned) */
  updateTask:           (id: string, data: object)            => api.patch(`/erp/tasks/${id}`, data),
  /** DELETE /erp/tasks/:id — ADMIN only */
  deleteTask:           (id: string)                          => api.delete(`/erp/tasks/${id}`),
  /** GET /erp/projects/:projectId/tasks — tasks for a specific project */
  getTasksByProject:    (projectId: string)                   => api.get(`/erp/projects/${projectId}/tasks`),
  /** PATCH /erp/tasks/:id/submit — CLIENT submits a client-directed task (files + complete) */
  submitClientTask:     (id: string, data: object)            => api.patch(`/erp/tasks/${id}/submit`, data),
  /** POST /erp/tasks/recalculate-delayed — ADMIN manual trigger */
  recalculateDelayed:   ()                                    => api.post('/erp/tasks/recalculate-delayed'),
};

// ─── ERP-6: Contracts ─────────────────────────────────────────────────────────

export const contractsApi = {
  /** GET /erp/contracts — paginated, role-scoped */
  getContracts:         (params?: object)                     => api.get('/erp/contracts', { params }),
  /** GET /erp/contracts/:id */
  getContract:          (id: string)                          => api.get(`/erp/contracts/${id}`),
  /** POST /erp/contracts — create DRAFT */
  createContract:       (data: object)                        => api.post('/erp/contracts', data),
  /** PATCH /erp/contracts/:id — update DRAFT (title/body) */
  updateContract:       (id: string, data: object)            => api.patch(`/erp/contracts/${id}`, data),
  /** DELETE /erp/contracts/:id — ADMIN, DRAFT only */
  deleteContract:       (id: string)                          => api.delete(`/erp/contracts/${id}`),
  /** POST /erp/contracts/:id/send — DRAFT → SENT */
  sendContract:         (id: string)                          => api.post(`/erp/contracts/${id}/send`),
  /** POST /erp/contracts/:id/accept — SENT → SIGNED (CLIENT) */
  acceptContract:       (id: string)                          => api.post(`/erp/contracts/${id}/accept`),
  /** POST /erp/contracts/:id/reject — SENT → REJECTED (CLIENT) */
  rejectContract:       (id: string)                          => api.post(`/erp/contracts/${id}/reject`),
  /** GET /erp/contracts/:id/pdf-url — presigned download URL */
  getPdfUrl:            (id: string)                          => api.get(`/erp/contracts/${id}/pdf-url`),
  /** GET /erp/contracts/public/:id — public sanitized contract (no auth, QR code target) */
  getPublicContract:    (id: string)                          => api.get(`/erp/contracts/public/${id}`),
  /** GET /erp/clients/:clientId/contracts */
  getContractsByClient: (clientId: string)                    => api.get(`/erp/clients/${clientId}/contracts`),
};

// ─── ERP-7: Invoices ──────────────────────────────────────────────────────────

export const invoicesApi = {
  /** GET /erp/invoices — paginated, role-scoped */
  getInvoices:          (params?: object)                     => api.get('/erp/invoices', { params }),
  /** GET /erp/invoices/:id — with lineItems */
  getInvoice:           (id: string)                          => api.get(`/erp/invoices/${id}`),
  /** POST /erp/invoices — create with line items */
  createInvoice:        (data: object)                        => api.post('/erp/invoices', data),
  /** PATCH /erp/invoices/:id — update UNPAID invoice */
  updateInvoice:        (id: string, data: object)            => api.patch(`/erp/invoices/${id}`, data),
  /** DELETE /erp/invoices/:id — ADMIN, UNPAID only */
  deleteInvoice:        (id: string)                          => api.delete(`/erp/invoices/${id}`),
  /** POST /erp/invoices/:id/mark-paid — UNPAID/OVERDUE → PAID */
  markInvoicePaid:      (id: string, data?: object)           => api.post(`/erp/invoices/${id}/mark-paid`, data ?? {}),
  /** POST /erp/invoices/recalculate-overdue — ADMIN manual trigger */
  recalculateOverdue:   ()                                    => api.post('/erp/invoices/recalculate-overdue'),
  /** POST /erp/invoices/:id/submit-payment — CLIENT submits payment proof */
  submitPaymentProof:   (id: string, data: object)            => api.post(`/erp/invoices/${id}/submit-payment`, data),
  /** GET /erp/invoices/public/:id — public sanitized invoice (no auth, QR code target) */
  getPublicInvoice:     (id: string)                          => api.get(`/erp/invoices/public/${id}`),
};

// ─── Expenses API (ERP-8) ─────────────────────────────────────────────────────

export const expensesApi = {
  /** GET /erp/expenses/summary — financial summary with optional date range */
  getSummary:     (params?: object)              => api.get('/erp/expenses/summary', { params }),
  /** GET /erp/expenses — paginated, role-scoped */
  getExpenses:    (params?: object)              => api.get('/erp/expenses', { params }),
  /** GET /erp/expenses/:id — single entry */
  getExpense:     (id: string)                   => api.get(`/erp/expenses/${id}`),
  /** POST /erp/expenses — create manual income/expense */
  createExpense:  (data: object)                 => api.post('/erp/expenses', data),
  /** PATCH /erp/expenses/:id — update manual entry */
  updateExpense:  (id: string, data: object)     => api.patch(`/erp/expenses/${id}`, data),
  /** DELETE /erp/expenses/:id — ADMIN, manual only */
  deleteExpense:  (id: string)                   => api.delete(`/erp/expenses/${id}`),
};

// ─── Profiles API (all authenticated users) ──────────────────────────────────
//
// Routes (backend ProfilesController):
//   GET    /profiles/me                 — own profile
//   PATCH  /profiles/me                 — update own profile
//   POST   /profiles/me/avatar-upload   — presigned S3 URL for avatar upload
//   GET    /profiles/:id                — owner OR ADMIN
//   PATCH  /profiles/:id                — owner OR ADMIN

export const profilesApi = {
  /** GET /profiles/me — own profile */
  getMe:                () => api.get('/profiles/me'),
  /** PATCH /profiles/me — update own profile (partial) */
  updateMe:             (data: object) => api.patch('/profiles/me', data),
  /** POST /profiles/me/avatar-upload — { fileName, contentType } → presigned URL */
  getAvatarUploadUrl:   (data: object) => api.post('/profiles/me/avatar-upload', data),
  /** GET /profiles/:id — owner OR ADMIN */
  getOne:               (id: string) => api.get(`/profiles/${id}`),
  /** PATCH /profiles/:id — owner OR ADMIN */
  update:               (id: string, data: object) => api.patch(`/profiles/${id}`, data),
};

// ─── ERP-10: Dashboard ────────────────────────────────────────────────────────

export const dashboardApi = {
  /** GET /erp/dashboard/stats — role-aware KPI stats */
  getStats:         () => api.get('/erp/dashboard/stats'),
  /** GET /erp/dashboard/financial-chart — last 6 months income vs expenses */
  getFinancialChart: () => api.get('/erp/dashboard/financial-chart'),
};

// ─── NEW-1: Accounting (Financial Hub) ────────────────────────────────────────
// Backend: @Controller('accounting') → /api/accounting/*  (ADMIN/EMPLOYEE)

export const accountingApi = {
  /** GET /accounting/accounts — chart of accounts */
  getAccounts:       (params?: object)          => api.get('/accounting/accounts', { params }),
  /** GET /accounting/accounts/:id */
  getAccount:        (id: string)               => api.get(`/accounting/accounts/${id}`),
  /** GET /accounting/accounts/:id/balance */
  getAccountBalance: (id: string, params?: object) => api.get(`/accounting/accounts/${id}/balance`, { params }),
  /** POST /accounting/accounts */
  createAccount:     (data: object)             => api.post('/accounting/accounts', data),
  /** PATCH /accounting/accounts/:id */
  updateAccount:     (id: string, data: object) => api.patch(`/accounting/accounts/${id}`, data),
  /** DELETE /accounting/accounts/:id — ADMIN */
  deleteAccount:     (id: string)               => api.delete(`/accounting/accounts/${id}`),
  /** GET /accounting/ledger — unified transaction ledger */
  getLedger:         (params?: object)          => api.get('/accounting/ledger', { params }),
  /** POST /accounting/ledger — manual ledger entry */
  createLedgerEntry: (data: object)             => api.post('/accounting/ledger', data),
  /** DELETE /accounting/ledger/:id — ADMIN */
  deleteLedgerEntry: (id: string)               => api.delete(`/accounting/ledger/${id}`),
  /** GET /accounting/clients/:clientId/ledger — per-client ledger */
  getClientLedger:   (clientId: string, params?: object) => api.get(`/accounting/clients/${clientId}/ledger`, { params }),
};

// ─── NEW-2: Suppliers ─────────────────────────────────────────────────────────
// Backend: @Controller('suppliers') → /api/suppliers/*  (ADMIN/EMPLOYEE)

export const suppliersApi = {
  /** GET /suppliers — paginated */
  getSuppliers:  (params?: object)          => api.get('/suppliers', { params }),
  /** GET /suppliers/:id */
  getSupplier:   (id: string)               => api.get(`/suppliers/${id}`),
  /** POST /suppliers */
  createSupplier:(data: object)             => api.post('/suppliers', data),
  /** PATCH /suppliers/:id */
  updateSupplier:(id: string, data: object) => api.patch(`/suppliers/${id}`, data),
  /** DELETE /suppliers/:id — ADMIN */
  deleteSupplier:(id: string)               => api.delete(`/suppliers/${id}`),
};

// ─── NEW-3: Purchases (PO → Bill → auto-Expense on paid) ──────────────────────
// Backend: @Controller('purchases') → /api/purchases/*  (ADMIN/EMPLOYEE)

export const purchasesApi = {
  /** GET /purchases — paginated */
  getPurchases:   (params?: object)          => api.get('/purchases', { params }),
  /** GET /purchases/:id — with line items */
  getPurchase:    (id: string)               => api.get(`/purchases/${id}`),
  /** POST /purchases — create with line items */
  createPurchase: (data: object)             => api.post('/purchases', data),
  /** PATCH /purchases/:id — update UNPAID */
  updatePurchase: (id: string, data: object) => api.patch(`/purchases/${id}`, data),
  /** POST /purchases/:id/mark-paid — auto-creates an EXPENSE */
  markPurchasePaid:(id: string, data?: object)=> api.post(`/purchases/${id}/mark-paid`, data ?? {}),
  /** DELETE /purchases/:id — ADMIN */
  deletePurchase: (id: string)               => api.delete(`/purchases/${id}`),
};

// ─── NEW-4: Quotations (accept → draft Contract + draft Invoice) ──────────────
// Backend: @Controller('erp/quotations') → /api/erp/quotations/*

export const quotationsApi = {
  /** GET /erp/quotations — paginated, role-scoped */
  getQuotations:     (params?: object)          => api.get('/erp/quotations', { params }),
  /** GET /erp/quotations/:id — with line items */
  getQuotation:      (id: string)               => api.get(`/erp/quotations/${id}`),
  /** POST /erp/quotations — create DRAFT with line items */
  createQuotation:   (data: object)             => api.post('/erp/quotations', data),
  /** PATCH /erp/quotations/:id — update DRAFT */
  updateQuotation:   (id: string, data: object) => api.patch(`/erp/quotations/${id}`, data),
  /** DELETE /erp/quotations/:id — ADMIN, DRAFT only */
  deleteQuotation:   (id: string)               => api.delete(`/erp/quotations/${id}`),
  /** POST /erp/quotations/:id/send — DRAFT → SENT */
  sendQuotation:     (id: string)               => api.post(`/erp/quotations/${id}/send`),
  /** POST /erp/quotations/:id/accept — SENT → ACCEPTED */
  acceptQuotation:   (id: string)               => api.post(`/erp/quotations/${id}/accept`),
  /** POST /erp/quotations/:id/reject — SENT → REJECTED */
  rejectQuotation:   (id: string)               => api.post(`/erp/quotations/${id}/reject`),
  /** POST /erp/quotations/:id/convert — generate draft Contract + Invoice */
  convertQuotation:  (id: string)               => api.post(`/erp/quotations/${id}/convert`),
  /** POST /erp/quotations/recalculate-expired — ADMIN manual trigger */
  recalculateExpired:()                         => api.post('/erp/quotations/recalculate-expired'),
  /** GET /erp/quotations/public/:token — public view (no auth) */
  getPublicQuotation:(token: string)            => api.get(`/erp/quotations/public/${token}`),
  /** POST /erp/quotations/public/:token/accept — public accept (no auth) */
  publicAccept:      (token: string)            => api.post(`/erp/quotations/public/${token}/accept`),
  /** POST /erp/quotations/public/:token/reject — public reject (no auth) */
  publicReject:      (token: string)            => api.post(`/erp/quotations/public/${token}/reject`),
};

// ─── NEW-5: Support / Ticketing ───────────────────────────────────────────────
// Backend: @Controller('erp/support') → /api/erp/support/*  (ADMIN/EMPLOYEE/CLIENT)

export const supportApi = {
  /** GET /erp/support/stats — ADMIN/EMPLOYEE ticket stats */
  getStats:      ()                             => api.get('/erp/support/stats'),
  /** GET /erp/support — paginated, role-scoped */
  getTickets:    (params?: object)              => api.get('/erp/support', { params }),
  /** GET /erp/support/:id — with replies */
  getTicket:     (id: string)                   => api.get(`/erp/support/${id}`),
  /** POST /erp/support — create ticket */
  createTicket:  (data: object)                 => api.post('/erp/support', data),
  /** POST /erp/support/:id/replies — add threaded reply */
  addReply:      (id: string, data: object)     => api.post(`/erp/support/${id}/replies`, data),
  /** PATCH /erp/support/:id — staff update (status/priority/assignee) */
  updateTicket:  (id: string, data: object)     => api.patch(`/erp/support/${id}`, data),
  /** DELETE /erp/support/:id — ADMIN */
  deleteTicket:  (id: string)                   => api.delete(`/erp/support/${id}`),
  // ── Per-client API keys (external programmatic ticket creation) ──
  /** POST /erp/support/api-keys — returns plaintext key once */
  createApiKey:  (data: object)                 => api.post('/erp/support/api-keys', data),
  /** GET /erp/support/api-keys — list (masked) */
  listApiKeys:   (params?: object)              => api.get('/erp/support/api-keys', { params }),
  /** DELETE /erp/support/api-keys/:id — revoke */
  revokeApiKey:  (id: string)                   => api.delete(`/erp/support/api-keys/${id}`),
};

// ─── NEW-6: Reports (financial + operational) ─────────────────────────────────
// Backend: @Controller('erp/reports') → /api/erp/reports/*  (ADMIN/EMPLOYEE)

export const reportsApi = {
  /** GET /erp/reports/profit-loss */
  profitLoss:      (params?: object) => api.get('/erp/reports/profit-loss', { params }),
  /** GET /erp/reports/cash-flow */
  cashFlow:        (params?: object) => api.get('/erp/reports/cash-flow', { params }),
  /** GET /erp/reports/tax-summary */
  taxSummary:      (params?: object) => api.get('/erp/reports/tax-summary', { params }),
  /** GET /erp/reports/ar-aging */
  arAging:         (params?: object) => api.get('/erp/reports/ar-aging', { params }),
  /** GET /erp/reports/ap-aging */
  apAging:         (params?: object) => api.get('/erp/reports/ap-aging', { params }),
  /** GET /erp/reports/revenue-by-client */
  revenueByClient: (params?: object) => api.get('/erp/reports/revenue-by-client', { params }),
  /** GET /erp/reports/projects-status */
  projectsStatus:  (params?: object) => api.get('/erp/reports/projects-status', { params }),
  /** GET /erp/reports/support-stats */
  supportStats:    (params?: object) => api.get('/erp/reports/support-stats', { params }),
};

// ─── NEW-7: Analytics (self-hosted dashboard) ─────────────────────────────────
// Backend: @Controller('erp/analytics') → /api/erp/analytics/*  (ADMIN/EMPLOYEE)

export const analyticsApi = {
  /** GET /erp/analytics/overview */
  overview:         (params?: object) => api.get('/erp/analytics/overview', { params }),
  /** GET /erp/analytics/timeseries */
  timeseries:       (params?: object) => api.get('/erp/analytics/timeseries', { params }),
  /** GET /erp/analytics/top-pages */
  topPages:         (params?: object) => api.get('/erp/analytics/top-pages', { params }),
  /** GET /erp/analytics/top-referrers */
  topReferrers:     (params?: object) => api.get('/erp/analytics/top-referrers', { params }),
  /** GET /erp/analytics/devices */
  devices:          (params?: object) => api.get('/erp/analytics/devices', { params }),
  /** GET /erp/analytics/browsers */
  browsers:         (params?: object) => api.get('/erp/analytics/browsers', { params }),
  /** GET /erp/analytics/countries */
  countries:        (params?: object) => api.get('/erp/analytics/countries', { params }),
  /** GET /erp/analytics/top-events */
  topEvents:        (params?: object) => api.get('/erp/analytics/top-events', { params }),
};

// ─── NEW-11: SaaS Control Plane (admin-only provisioning) ─────────────────────
// Backend: @Controller('saas') → /api/saas/*  (ADMIN only)

export const saasApi = {
  // ── Products ──
  /** GET /saas/products */
  getProducts:    ()                          => api.get('/saas/products'),
  /** GET /saas/products/:id */
  getProduct:     (id: string)                => api.get(`/saas/products/${id}`),
  /** POST /saas/products */
  createProduct:  (data: object)              => api.post('/saas/products', data),
  /** PATCH /saas/products/:id */
  updateProduct:  (id: string, data: object)  => api.patch(`/saas/products/${id}`, data),
  /** DELETE /saas/products/:id */
  deleteProduct:  (id: string)                => api.delete(`/saas/products/${id}`),

  // ── Plans (scoped to a product) ──
  /** GET /saas/products/:productId/plans */
  getPlans:       (productId: string)         => api.get(`/saas/products/${productId}/plans`),
  /** POST /saas/products/:productId/plans */
  createPlan:     (productId: string, data: object) => api.post(`/saas/products/${productId}/plans`, data),
  /** GET /saas/plans/:id */
  getPlan:        (id: string)                => api.get(`/saas/plans/${id}`),
  /** PATCH /saas/plans/:id */
  updatePlan:     (id: string, data: object)  => api.patch(`/saas/plans/${id}`, data),
  /** DELETE /saas/plans/:id */
  deletePlan:     (id: string)                => api.delete(`/saas/plans/${id}`),

  // ── Tenants ──
  /** GET /saas/tenants — paginated */
  getTenants:     (params?: object)           => api.get('/saas/tenants', { params }),
  /** GET /saas/tenants/:id — tenant + subscription + logs + nextStates */
  getTenant:      (id: string)                => api.get(`/saas/tenants/${id}`),
  /** POST /saas/tenants — provision a tenant for a client */
  createTenant:   (data: object)              => api.post('/saas/tenants', data),
  /** POST /saas/tenants/:id/suspend */
  suspendTenant:  (id: string, data?: object) => api.post(`/saas/tenants/${id}/suspend`, data ?? {}),
  /** POST /saas/tenants/:id/reactivate */
  reactivateTenant:(id: string, data?: object)=> api.post(`/saas/tenants/${id}/reactivate`, data ?? {}),
  /** POST /saas/tenants/:id/archive */
  archiveTenant:  (id: string, data?: object) => api.post(`/saas/tenants/${id}/archive`, data ?? {}),
  /** POST /saas/tenants/:id/retry — re-queue a FAILED tenant */
  retryTenant:    (id: string)                => api.post(`/saas/tenants/${id}/retry`),
  /** POST /saas/tenants/:id/change-plan */
  changePlan:     (id: string, data: object)  => api.post(`/saas/tenants/${id}/change-plan`, data),

  // ── Lead → Client → Tenant conversion ──
  /** POST /saas/convert-lead */
  convertLead:    (data: object)              => api.post('/saas/convert-lead', data),
};

// ─── Phase 10: AI Handla Assistant (ADMIN + EMPLOYEE) ─────────────────────────
export const aiApi = {
  // ── Knowledge Base (list/read: ADMIN+EMPLOYEE; write: ADMIN only) ──
  /** GET /ai/knowledge — paginated { entries, total, page, pages } */
  getKnowledge:    (params?: object)           => api.get('/ai/knowledge', { params }),
  /** GET /ai/knowledge/:id */
  getKnowledgeEntry:(id: string)               => api.get(`/ai/knowledge/${id}`),
  /** POST /ai/knowledge (ADMIN) */
  createKnowledge: (data: object)              => api.post('/ai/knowledge', data),
  /** PATCH /ai/knowledge/:id (ADMIN) */
  updateKnowledge: (id: string, data: object)  => api.patch(`/ai/knowledge/${id}`, data),
  /** DELETE /ai/knowledge/:id (ADMIN) */
  deleteKnowledge: (id: string)                => api.delete(`/ai/knowledge/${id}`),

  // ── Per-conversation AI state / lead panel / human takeover ──
  /** GET /ai/conversations/:id/state */
  getState:        (conversationId: string)    => api.get(`/ai/conversations/${conversationId}/state`),
  /** POST /ai/conversations/:id/takeover — human takes over, bot muted */
  takeover:        (conversationId: string, data?: object) =>
    api.post(`/ai/conversations/${conversationId}/takeover`, data ?? {}),
  /** POST /ai/conversations/:id/return-to-ai — hand control back to the bot */
  returnToAi:      (conversationId: string)     =>
    api.post(`/ai/conversations/${conversationId}/return-to-ai`),
};

export default api;
