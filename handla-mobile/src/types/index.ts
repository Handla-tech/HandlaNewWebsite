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
