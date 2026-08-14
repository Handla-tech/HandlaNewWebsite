import { api } from './api';
import type {
  AuthResult,
  User,
  PaginatedConversations,
  ConversationDetail,
  Conversation,
  Message,
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
