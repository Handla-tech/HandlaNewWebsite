'use client';

import { create } from 'zustand';
import type { NotificationState, Notification } from '@/types';

// NotificationState now includes deleteNotification, so no extra interface needed.
export const useNotificationStore = create<NotificationState>()((set) => ({
  // ── State ──────────────────────────────────────────────────────────────────
  notifications: [],
  unreadCount:   0,
  isLoading:     false,

  // ── Actions ────────────────────────────────────────────────────────────────

  setNotifications: (notifications: Notification[]) =>
    set({
      notifications,
      unreadCount: notifications.filter((n) => !n.isRead).length,
    }),

  addNotification: (notification: Notification) =>
    set((state) => {
      // Deduplicate — socket may fire before HTTP response
      if (state.notifications.some((n) => n.id === notification.id)) {
        return state;
      }
      return {
        notifications: [notification, ...state.notifications],
        unreadCount:   notification.isRead
          ? state.unreadCount
          : state.unreadCount + 1,
      };
    }),

  markAsRead: (id: string) =>
    set((state) => {
      const notifications = state.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n,
      );
      return {
        notifications,
        unreadCount: notifications.filter((n) => !n.isRead).length,
      };
    }),

  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount:   0,
    })),

  deleteNotification: (id: string) =>
    set((state) => {
      const notifications = state.notifications.filter((n) => n.id !== id);
      return {
        notifications,
        unreadCount: notifications.filter((n) => !n.isRead).length,
      };
    }),

  setUnreadCount: (count: number) => set({ unreadCount: count }),
}));
