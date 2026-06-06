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

    // Only attempt refresh on 401 that hasn't already been retried
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      originalRequest.url !== '/auth/refresh' &&
      originalRequest.url !== '/auth/signin'
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

export default api;
