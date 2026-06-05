'use client';

import { useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, BellOff, CheckCheck, Trash2, MessageSquare, Info,
  Loader2, RefreshCw, X,
  FileText, Receipt, UserCheck, CheckSquare,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useNotifications } from '@/hooks/useNotifications';
import { formatMessageTime, cn } from '@/lib/utils';
import type { Notification, NotificationType } from '@/types';

// ─── Props ────────────────────────────────────────────────────────────────────

interface NotificationCenterProps {
  onClose: () => void;
}

// ─── Type icon + colour ───────────────────────────────────────────────────────

function typeConfig(type: NotificationType): {
  icon: React.ReactNode;
  dot: string;
  bg: string;
} {
  switch (type) {
    case 'MESSAGE':
      return {
        icon: <MessageSquare className="h-3.5 w-3.5" />,
        dot:  'bg-[#fbbf24]',
        bg:   'bg-[#fbbf24]/10 text-[#fbbf24]',
      };

    // ── Contracts ────────────────────────────────────────────────────────────
    case 'CONTRACT_SENT':
      return {
        icon: <FileText className="h-3.5 w-3.5" />,
        dot:  'bg-[#fbbf24]',
        bg:   'bg-[#fbbf24]/10 text-[#fbbf24]',
      };
    case 'CONTRACT_SIGNED':
      return {
        icon: <FileText className="h-3.5 w-3.5" />,
        dot:  'bg-[#4ade80]',
        bg:   'bg-[#4ade80]/10 text-[#4ade80]',
      };
    case 'CONTRACT_REJECTED':
      return {
        icon: <FileText className="h-3.5 w-3.5" />,
        dot:  'bg-[#f87171]',
        bg:   'bg-[#f87171]/10 text-[#f87171]',
      };

    // ── Invoices ─────────────────────────────────────────────────────────────
    case 'INVOICE_CREATED':
      return {
        icon: <Receipt className="h-3.5 w-3.5" />,
        dot:  'bg-[#fbbf24]',
        bg:   'bg-[#fbbf24]/10 text-[#fbbf24]',
      };
    case 'INVOICE_OVERDUE':
      return {
        icon: <Receipt className="h-3.5 w-3.5" />,
        dot:  'bg-[#f87171]',
        bg:   'bg-[#f87171]/10 text-[#f87171]',
      };

    // ── Leads / Clients ──────────────────────────────────────────────────────
    case 'LEAD_ASSIGNED':
      return {
        icon: <UserCheck className="h-3.5 w-3.5" />,
        dot:  'bg-[#60a5fa]',
        bg:   'bg-[#60a5fa]/10 text-[#60a5fa]',
      };
    case 'LEAD_PROMOTED':
      return {
        icon: <UserCheck className="h-3.5 w-3.5" />,
        dot:  'bg-[#fbbf24]',
        bg:   'bg-[#fbbf24]/10 text-[#fbbf24]',
      };

    // ── Tasks ────────────────────────────────────────────────────────────────
    case 'TASK_ASSIGNED':
      return {
        icon: <CheckSquare className="h-3.5 w-3.5" />,
        dot:  'bg-[#60a5fa]',
        bg:   'bg-[#60a5fa]/10 text-[#60a5fa]',
      };
    case 'TASK_DELAYED':
      return {
        icon: <CheckSquare className="h-3.5 w-3.5" />,
        dot:  'bg-[#fbbf24]',
        bg:   'bg-[#fbbf24]/10 text-[#fbbf24]',
      };

    case 'SYSTEM':
    default:
      return {
        icon: <Info className="h-3.5 w-3.5" />,
        dot:  'bg-[#a78bfa]',
        bg:   'bg-[#a78bfa]/10 text-[#a78bfa]',
      };
  }
}

// ─── Single notification row ──────────────────────────────────────────────────

interface NotificationRowProps {
  notification: Notification;
  onMarkRead:   (id: string) => void;
  onDelete:     (id: string) => void;
  onNavigate:   (notification: Notification) => void;
}

function NotificationRow({
  notification,
  onMarkRead,
  onDelete,
  onNavigate,
}: NotificationRowProps) {
  const { icon, dot, bg } = typeConfig(notification.type);
  const isUnread = !notification.isRead;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8, height: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'group relative flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors cursor-pointer select-none',
        isUnread
          ? 'bg-[#161616] hover:bg-[#1c1c1c]'
          : 'hover:bg-[#141414]',
      )}
      onClick={() => onNavigate(notification)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onNavigate(notification)}
      aria-label={notification.title}
    >
      {/* Unread indicator bar */}
      {isUnread && (
        <span className={cn('absolute left-0 top-3 bottom-3 w-0.5 rounded-full', dot)} />
      )}

      {/* Type icon badge */}
      <div className={cn(
        'mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg',
        bg,
      )}>
        {icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-xs leading-snug truncate',
          isUnread ? 'font-semibold text-white' : 'font-medium text-[#aaa]',
        )}>
          {notification.title}
        </p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-[#666] line-clamp-2">
          {notification.message}
        </p>
        <p className="mt-1 text-[10px] text-[#444]">
          {formatMessageTime(notification.createdAt)}
        </p>
      </div>

      {/* Row actions (visible on hover) */}
      <div className="flex flex-shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {isUnread && (
          <button
            type="button"
            title="Mark as read"
            onClick={(e) => { e.stopPropagation(); onMarkRead(notification.id); }}
            className="flex h-6 w-6 items-center justify-center rounded-lg text-[#555] hover:text-[#fbbf24] hover:bg-[#fbbf24]/10 transition-colors"
          >
            <CheckCheck className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          title="Delete notification"
          onClick={(e) => { e.stopPropagation(); onDelete(notification.id); }}
          className="flex h-6 w-6 items-center justify-center rounded-lg text-[#555] hover:text-red-400 hover:bg-red-400/10 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center px-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1a1a1a] border border-[#2a2a2a]">
        <BellOff className="h-5 w-5 text-[#555]" />
      </div>
      <p className="text-sm font-medium text-[#888]">You&apos;re all caught up!</p>
      <p className="text-xs text-[#555] max-w-[180px]">
        No notifications yet. New activity will appear here.
      </p>
    </div>
  );
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function NotificationSkeleton() {
  return (
    <div className="space-y-1 px-2 py-2 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-start gap-3 rounded-xl px-3 py-2.5">
          <div className="mt-0.5 h-7 w-7 rounded-lg bg-[#1e1e1e] flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-3/4 rounded bg-[#1e1e1e]" />
            <div className="h-2.5 w-full rounded bg-[#1a1a1a]" />
            <div className="h-2 w-1/3 rounded bg-[#181818]" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Error state ─────────────────────────────────────────────────────────────

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8 text-center px-6">
      <p className="text-sm text-[#888]">Failed to load notifications</p>
      <button
        type="button"
        onClick={onRetry}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#aaa] border border-[#2a2a2a] hover:text-white hover:border-[#3a3a3a] transition-colors"
      >
        <RefreshCw className="h-3 w-3" />
        Retry
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function NotificationCenter({ onClose }: NotificationCenterProps) {
  const router  = useRouter();
  const listRef = useRef<HTMLDivElement>(null);

  const {
    notifications,
    unreadCount,
    isLoading,
    isMarkingAllRead,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refetch,
  } = useNotifications({ page: 1, limit: 20 });

  // ── Navigate on click ─────────────────────────────────────────────────────
  const handleNavigate = useCallback(
    (notification: Notification) => {
      if (!notification.isRead) markAsRead(notification.id);

      const id = notification.relatedEntityId;

      switch (notification.type) {
        case 'MESSAGE':
          router.push('/dashboard');
          break;
        case 'CONTRACT_SENT':
        case 'CONTRACT_SIGNED':
        case 'CONTRACT_REJECTED':
          router.push(id ? `/erp/contracts/${id}` : '/erp/contracts');
          break;
        case 'INVOICE_CREATED':
        case 'INVOICE_OVERDUE':
          router.push(id ? `/erp/invoices/${id}` : '/erp/invoices');
          break;
        case 'LEAD_ASSIGNED':
        case 'LEAD_PROMOTED':
          router.push('/erp/clients');
          break;
        case 'TASK_ASSIGNED':
        case 'TASK_DELAYED':
          router.push(id ? `/erp/tasks/${id}` : '/erp/tasks');
          break;
        default:
          break;
      }
      onClose();
    },
    [markAsRead, router, onClose],
  );

  const hasError = false; // errors surface via empty list; could extend

  return (
    <div
      role="dialog"
      aria-label="Notifications"
      className="w-80 sm:w-96 rounded-2xl border border-[#2a2a2a] bg-[#0f0f0f] shadow-glass-lg overflow-hidden"
    >
      {/* ══ HEADER ════════════════════════════════════════════════════════════ */}
      <div className="flex items-center justify-between border-b border-[#2a2a2a] bg-[#111] px-4 py-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-[#fbbf24]" />
          <span className="text-sm font-semibold text-white">Notifications</span>
          {unreadCount > 0 && (
            <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#fbbf24] px-1.5 text-[10px] font-bold text-black">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Refresh */}
          <button
            type="button"
            onClick={() => refetch()}
            title="Refresh"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#555] hover:text-white hover:bg-[#1e1e1e] transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>

          {/* Mark all read */}
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => markAllAsRead()}
              disabled={isMarkingAllRead}
              title="Mark all as read"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[#555] hover:text-[#fbbf24] hover:bg-[#fbbf24]/10 transition-colors disabled:opacity-40"
            >
              {isMarkingAllRead
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <CheckCheck className="h-3.5 w-3.5" />
              }
            </button>
          )}

          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#555] hover:text-white hover:bg-[#1e1e1e] transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ══ NOTIFICATION LIST ═════════════════════════════════════════════════ */}
      <div
        ref={listRef}
        className="max-h-[420px] overflow-y-auto p-2 scrollbar-thin"
      >
        {isLoading ? (
          <NotificationSkeleton />
        ) : hasError ? (
          <ErrorState onRetry={refetch} />
        ) : notifications.length === 0 ? (
          <EmptyState />
        ) : (
          <AnimatePresence initial={false}>
            {notifications.map((n) => (
              <NotificationRow
                key={n.id}
                notification={n}
                onMarkRead={markAsRead}
                onDelete={deleteNotification}
                onNavigate={handleNavigate}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* ══ FOOTER ════════════════════════════════════════════════════════════ */}
      {notifications.length > 0 && (
        <div className="border-t border-[#2a2a2a] bg-[#0d0d0d] px-4 py-2.5 flex items-center justify-between">
          <span className="text-[11px] text-[#444]">
            {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
          </span>
          <button
            type="button"
            onClick={() => { router.push('/dashboard'); onClose(); }}
            className="text-[11px] text-[#fbbf24]/70 hover:text-[#fbbf24] transition-colors font-medium"
          >
            View chat →
          </button>
        </div>
      )}
    </div>
  );
}
