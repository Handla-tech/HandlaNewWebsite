'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  connectSocket,
  disconnectSocket,
  getSocket,
} from '@/lib/socket';
import { useChatStore }          from '@/store/chatStore';
import { useNotificationStore }  from '@/store/notificationStore';
import { useAuthStore }          from '@/store/authStore';
import { useToastStore }         from '@/store/toastStore';
import { NOTIFICATIONS_KEY, UNREAD_KEY } from '@/hooks/useNotifications';
import type { TypedSocket }      from '@/lib/socket';

export function useSocket() {
  // Use isLoggedIn to drive connect/disconnect — it flips fast enough.
  // The notification hook uses `user !== null` for its own fetch guard.
  const isLoggedIn  = useAuthStore((s) => s.isLoggedIn);
  const queryClient = useQueryClient();

  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;

  const socketRef = useRef<TypedSocket | null>(null);

  useEffect(() => {
    if (!isLoggedIn) {
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current = null;
      }
      disconnectSocket();
      return;
    }

    // connectSocket is idempotent — no-op if already connected
    const socket = connectSocket();
    socketRef.current = socket;

    // ── messageReceived ────────────────────────────────────────────────────
    socket.on('messageReceived', ({ message, conversationId }) => {
      useChatStore.getState().addMessage(message);
      queryClientRef.current.invalidateQueries({ queryKey: ['conversations'] });
      queryClientRef.current.invalidateQueries({ queryKey: ['admin-conversations'] });
      queryClientRef.current.invalidateQueries({ queryKey: ['messages', conversationId] });
    });

    // ── notificationNew ────────────────────────────────────────────────────
    socket.on('notificationNew', ({ notification }) => {
      // Immediately update badge + list in Zustand store
      useNotificationStore.getState().addNotification(notification);

      // Invalidate React Query caches so bell + panel stay in sync
      queryClientRef.current.invalidateQueries({ queryKey: [...NOTIFICATIONS_KEY] });
      queryClientRef.current.invalidateQueries({ queryKey: [...UNREAD_KEY] });

      // Show toast for incoming messages
      if (notification.type === 'MESSAGE') {
        useToastStore.getState().addToast({
          type:     'message',
          title:    notification.title,
          message:  notification.message,
          duration: 5000,
        });
      }
    });

    // ── userTyping ─────────────────────────────────────────────────────────
    socket.on('userTyping', ({ userId, isTyping }) => {
      useChatStore.getState().setTyping(userId, isTyping);
    });

    // ── userOnline ─────────────────────────────────────────────────────────
    socket.on('userOnline', ({ userId, online }) => {
      useChatStore.getState().setOnlineUsers(userId, online);
    });

    // ── messagesRead ───────────────────────────────────────────────────────
    socket.on('messagesRead', ({ conversationId }) => {
      queryClientRef.current.invalidateQueries({
        queryKey: ['messages', conversationId],
      });
    });

    // ── error ──────────────────────────────────────────────────────────────
    socket.on('error', ({ message }) => {
      console.error('[useSocket] server error:', message);
    });

    // ── Cleanup — remove listeners but keep socket alive ──────────────────
    return () => {
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
      }
    };
  }, [isLoggedIn]);

  return {
    socket:      socketRef.current,
    isConnected: socketRef.current?.connected ?? false,
    connect:     connectSocket,
    disconnect:  disconnectSocket,
    getSocket,
  };
}
