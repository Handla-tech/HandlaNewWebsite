import { api } from './api';
import type { AuthResult, User } from '@/types';

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
