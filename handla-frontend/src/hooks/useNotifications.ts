'use client';

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationApi } from '@/lib/api';
import { useNotificationStore } from '@/store/notificationStore';
import { useAuthStore } from '@/store/authStore';
import { getErrorMessage } from '@/lib/utils';
import type { Notification, NotificationQuery } from '@/types';

// ─── Query keys ───────────────────────────────────────────────────────────────
//
// Use a SINGLE stable key for the notification list so every caller
// (NotificationBell, NotificationCenter) shares the same React Query cache
// entry — regardless of the `query` params passed in.
// The query params are forwarded to the API but are NOT part of the cache key,
// which means the bell badge and the dropdown panel always reflect the same
// data without duplicate requests.

export const NOTIFICATIONS_KEY = ['notifications'] as const;
export const UNREAD_KEY        = ['notifications-unread'] as const;

// ─── Response unwrappers ──────────────────────────────────────────────────────
//
// Actual backend response chain:
//   Controller returns  → { message: string, data: <serviceResult> }
//   TransformInterceptor wraps it →
//     { success, statusCode, message: ctrl.message, data: ctrl.data, timestamp }
//
//   So Axios `res.data` = { success, statusCode, message, data, timestamp }
//   And `res.data.data` = the service result.
//
//   GET /notifications      → res.data.data = { notifications, total, page, pages, unreadCount }
//   GET /unread-count       → res.data.data = { unreadCount: N }

function unwrapNotifications(res: { data: unknown }): Notification[] {
  const payload = (res.data as { data?: { notifications?: Notification[] } })
    ?.data;
  return Array.isArray(payload?.notifications) ? payload!.notifications! : [];
}

function unwrapUnreadCount(res: { data: unknown }): number {
  const payload = (res.data as { data?: { unreadCount?: number } })?.data;
  return typeof payload?.unreadCount === 'number' ? payload.unreadCount : 0;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNotifications(query?: NotificationQuery) {
  const queryClient = useQueryClient();

  // Guard: require user !== null (set only after getMe() succeeds), which
  // confirms the session cookie is valid and alive. isLoggedIn alone can be
  // true from a stale sessionStorage value even when the cookie has expired.
  const user     = useAuthStore((s) => s.user);
  const canFetch = user !== null;

  const {
    notifications,
    unreadCount,
    setNotifications,
    markAsRead:    markReadLocal,
    markAllAsRead: markAllReadLocal,
    setUnreadCount,
    deleteNotification: deleteLocal,
  } = useNotificationStore();

  // ── Fetch notification list ───────────────────────────────────────────────
  // The query params are forwarded to the API (for pagination/filtering) but
  // are NOT included in the cache key — all callers share one cache entry.
  const notificationsQuery = useQuery({
    queryKey: [...NOTIFICATIONS_KEY],
    queryFn:  async () => {
      const res  = await notificationApi.getAll(query);
      const data = unwrapNotifications(res);
      setNotifications(data);
      return data;
    },
    enabled:              canFetch,
    staleTime:            30_000,
    refetchOnWindowFocus: false,
  });

  // ── Fetch unread count from dedicated endpoint ────────────────────────────
  // This is the authoritative source of truth for the bell badge.
  // It polls every 30 s and re-fetches on window focus so the badge stays
  // accurate even when the user comes back from another tab.
  const unreadQuery = useQuery({
    queryKey: [...UNREAD_KEY],
    queryFn:  async () => {
      const res   = await notificationApi.getUnread();
      const count = unwrapUnreadCount(res);
      // Always use the server value — never clamp with Math.max so that
      // mark-as-read / mark-all-read actually lower the badge count.
      setUnreadCount(count);
      return count;
    },
    enabled:              canFetch,
    staleTime:            15_000,
    refetchInterval:      30_000,
    refetchOnWindowFocus: true,
  });

  // ── Mark single notification as read ─────────────────────────────────────
  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationApi.markRead(id),
    onMutate:   (id: string) => {
      // Optimistic update — immediate visual feedback
      markReadLocal(id);
      setUnreadCount(Math.max(0, unreadCount - 1));
    },
    onSuccess: () => {
      // Re-sync from server to ensure accuracy
      queryClient.invalidateQueries({ queryKey: [...UNREAD_KEY] });
    },
    onError: () => {
      // Roll back by re-fetching authoritative state
      queryClient.invalidateQueries({ queryKey: [...NOTIFICATIONS_KEY] });
      queryClient.invalidateQueries({ queryKey: [...UNREAD_KEY] });
    },
  });

  // ── Mark ALL notifications as read ────────────────────────────────────────
  const markAllReadMutation = useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onMutate: () => {
      // Optimistic: clear badge immediately
      markAllReadLocal();
      setUnreadCount(0);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...NOTIFICATIONS_KEY] });
      queryClient.invalidateQueries({ queryKey: [...UNREAD_KEY] });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: [...NOTIFICATIONS_KEY] });
      queryClient.invalidateQueries({ queryKey: [...UNREAD_KEY] });
    },
  });

  // ── Delete a notification ─────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id: string) => notificationApi.delete(id),
    onMutate: (id: string) => {
      // Optimistic: remove from store immediately
      const wasUnread = notifications.find((n) => n.id === id && !n.isRead);
      deleteLocal?.(id);
      if (wasUnread) setUnreadCount(Math.max(0, unreadCount - 1));
      // Also update query cache so list re-renders without refetch
      queryClient.setQueryData(
        [...NOTIFICATIONS_KEY],
        (old: Notification[] | undefined) =>
          old ? old.filter((n) => n.id !== id) : [],
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...NOTIFICATIONS_KEY] });
      queryClient.invalidateQueries({ queryKey: [...UNREAD_KEY] });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: [...NOTIFICATIONS_KEY] });
      queryClient.invalidateQueries({ queryKey: [...UNREAD_KEY] });
    },
  });

  const refetch = useCallback(() => {
    notificationsQuery.refetch();
    unreadQuery.refetch();
  }, [notificationsQuery, unreadQuery]);

  return {
    notifications:      notifications as Notification[],
    unreadCount:        unreadCount   as number,
    isLoading:          notificationsQuery.isLoading,

    markAsRead:         (id: string) => markReadMutation.mutate(id),
    markAllAsRead:      ()           => markAllReadMutation.mutate(),
    deleteNotification: (id: string) => deleteMutation.mutate(id),

    isMarkingRead:    markReadMutation.isPending,
    isMarkingAllRead: markAllReadMutation.isPending,
    markReadError:    markReadMutation.error
                        ? getErrorMessage(markReadMutation.error)
                        : null,
    refetch,
  };
}
