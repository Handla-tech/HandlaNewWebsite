'use client';

/**
 * ERP Messages — /erp/messages
 *
 * Two-panel layout (desktop) / stacked layout (mobile):
 *   LEFT  — conversation list with search, status filter, unread badges
 *   RIGHT — active ChatWindow
 *
 * Available to both ADMIN and EMPLOYEE roles (auth guard is in ErpLayout).
 */

import { Suspense, useState, useCallback, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Search, RefreshCw,
  Filter, X, Loader2, AlertCircle,
  Inbox, ArrowLeft,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ChatWindow from '@/components/chat/ChatWindow';
import { chatApi } from '@/lib/api';
import { getInitials, getAvatarColor, formatMessageTime, cn } from '@/lib/utils';
import type { Conversation, ConversationStatus } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: ConversationStatus | 'ALL'; label: string }[] = [
  { value: 'ALL',       label: 'All'       },
  { value: 'ACTIVE',    label: 'Active'    },
  { value: 'ON_HOLD',   label: 'On Hold'   },
  { value: 'COMPLETED', label: 'Completed' },
];

const STATUS_COLORS: Record<ConversationStatus, string> = {
  ACTIVE:    'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  ON_HOLD:   'text-amber-400  bg-amber-400/10  border-amber-400/20',
  COMPLETED: 'text-[#666]     bg-[#1a1a1a]     border-[#2a2a2a]',
};

const STATUS_LABELS: Record<ConversationStatus, string> = {
  ACTIVE: 'Active', ON_HOLD: 'On Hold', COMPLETED: 'Completed',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ConversationStatus }) {
  return (
    <span className={cn(
      'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
      STATUS_COLORS[status],
    )}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function UnreadDot() {
  return (
    <span className="flex h-2 w-2 rounded-full bg-[#fbbf24] flex-shrink-0" />
  );
}

function UnreadBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#fbbf24] px-1.5 text-[10px] font-bold text-black">
      {count > 99 ? '99+' : count}
    </span>
  );
}

// ─── Conversation list item ───────────────────────────────────────────────────

function ConversationItem({
  conv,
  isActive,
  onClick,
}: {
  conv:     Conversation;
  isActive: boolean;
  onClick:  () => void;
}) {
  const client    = conv.client;
  const lastMsg   = conv.lastMessage ?? conv.messages?.[conv.messages.length - 1];
  const unread    = conv.unreadCount ?? 0;
  const hasUnread = unread > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-all',
        isActive
          ? 'border border-[#fbbf24]/20 bg-[#fbbf24]/8'
          : 'border border-transparent hover:border-[#2a2a2a] hover:bg-[#141414]',
      )}
    >
      {/* Avatar */}
      <div className={cn(
        'relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white',
        client ? getAvatarColor(client.id) : 'bg-[#2a2a2a]',
      )}>
        {client ? getInitials(client.name) : '?'}
        {hasUnread && (
          <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-[#fbbf24] ring-2 ring-[#0d0d0d]" />
        )}
      </div>

      {/* Name + preview */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className={cn(
            'truncate text-sm font-semibold',
            hasUnread ? 'text-white' : 'text-[#ccc]',
          )}>
            {client?.name ?? 'Unknown Client'}
          </span>
          {conv.lastMessageAt && (
            <span className="flex-shrink-0 text-[10px] text-[#555]">
              {formatMessageTime(conv.lastMessageAt)}
            </span>
          )}
        </div>

        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className={cn(
            'truncate text-xs',
            hasUnread ? 'text-[#aaa]' : 'text-[#555]',
          )}>
            {lastMsg?.content
              ? lastMsg.content.slice(0, 50) + (lastMsg.content.length > 50 ? '…' : '')
              : lastMsg?.fileUrl
                ? '📎 Attachment'
                : 'No messages yet'}
          </p>
          <div className="flex flex-shrink-0 items-center gap-1.5">
            <UnreadBadge count={unread} />
            <StatusBadge status={conv.status} />
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#2a2a2a] bg-[#141414]">
        <Inbox className="h-6 w-6 text-[#555]" />
      </div>
      <p className="text-sm font-medium text-[#666]">
        {filtered ? 'No conversations match your filters' : 'No conversations yet'}
      </p>
      {filtered && (
        <p className="text-xs text-[#444]">Try adjusting the search or status filter</p>
      )}
    </div>
  );
}

// ─── No conversation selected placeholder ────────────────────────────────────

function SelectConversationPlaceholder() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#fbbf24]/20 bg-[#fbbf24]/8">
        <MessageSquare className="h-7 w-7 text-[#fbbf24]" />
      </div>
      <div>
        <p className="text-sm font-semibold text-white">Select a conversation</p>
        <p className="mt-1 text-xs text-[#555]">
          Choose a conversation from the list to start messaging
        </p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function ErpMessagesPageInner() {
  const queryClient  = useQueryClient();
  const searchParams = useSearchParams();
  const initialConvId = searchParams.get('conversationId');

  const [statusFilter,    setStatusFilter]    = useState<ConversationStatus | 'ALL'>('ALL');
  const [search,          setSearch]          = useState('');
  const [activeConvId,    setActiveConvId]    = useState<string | null>(initialConvId);
  /** Mobile: show chat panel instead of list */
  const [mobileShowChat,  setMobileShowChat]  = useState(!!initialConvId);

  // If the user clicks a chat notification while already on /erp/messages,
  // the URL changes but the component stays mounted — sync the selection.
  useEffect(() => {
    if (initialConvId) {
      setActiveConvId(initialConvId);
      setMobileShowChat(true);
    }
  }, [initialConvId]);

  // ── Fetch conversations ─────────────────────────────────────────────────
  // Use the same query key as useChat ('conversations') so both share one
  // cache entry and never double-fetch or render duplicate rows.
  // Share the same cache entry as useChat (queryKey: ['conversations']).
  // The queryFn in useChat already deduplicates by clientId so no extra
  // filtering is needed here — but we provide a queryFn so this query
  // can also populate the cache if useChat hasn't run yet.
  const { data: conversations = [], isLoading, isError, refetch } = useQuery<Conversation[]>({
    queryKey: ['conversations'],
    queryFn: async () => {
      const res = await chatApi.getConversations();
      const inner = (res.data as { data?: { conversations?: Conversation[] } | Conversation[] })?.data;
      const raw: Conversation[] =
        inner && !Array.isArray(inner) && 'conversations' in inner
          ? (inner as { conversations?: Conversation[] }).conversations ?? []
          : Array.isArray(inner) ? inner : [];
      // Deduplicate by clientId — same logic as useChat.ts
      const seenClients = new Set<string>();
      return raw.filter((c) => {
        const key = c.clientId ?? c.client?.id ?? c.id;
        if (seenClients.has(key)) return false;
        seenClients.add(key);
        return true;
      });
    },
    staleTime: 15_000,
  });

  // ── Update status mutation ────────────────────────────────────────────────
  useMutation({
    mutationFn: ({ id, status }: { id: string; status: ConversationStatus }) =>
      chatApi.updateStatus(id, { status }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['conversations'] }),
  });

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = conversations;
    if (statusFilter !== 'ALL') {
      list = list.filter((c) => c.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.client?.name.toLowerCase().includes(q) ||
          c.client?.email?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [conversations, statusFilter, search]);

  // ── Summary stats ─────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:     conversations.length,
    active:    conversations.filter((c) => c.status === 'ACTIVE').length,
    unread:    conversations.reduce((n, c) => n + (c.unreadCount ?? 0), 0),
    onHold:    conversations.filter((c) => c.status === 'ON_HOLD').length,
  }), [conversations]);

  // ── Active conversation object ─────────────────────────────────────────────
  const activeConv = useMemo(
    () => conversations.find((c) => c.id === activeConvId) ?? null,
    [conversations, activeConvId],
  );

  const handleSelect = useCallback((id: string) => {
    setActiveConvId(id);
    setMobileShowChat(true);
  }, []);

  const handleBack = useCallback(() => {
    setMobileShowChat(false);
  }, []);

  const handleFilterChange = (val: ConversationStatus | 'ALL') => {
    setStatusFilter(val);
  };

  const handleSearch = (val: string) => {
    setSearch(val);
  };

  const isFiltered = statusFilter !== 'ALL' || search.trim().length > 0;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#0a0a0a]">

      {/* ── Page header ───────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-[#1a1a1a] bg-[#0d0d0d] px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#fbbf24]/20 bg-[#fbbf24]/10">
              <MessageSquare className="h-4 w-4 text-[#fbbf24]" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white">Messages</h1>
              <p className="text-[11px] text-[#555]">Client conversations</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Unread badge */}
            {stats.unread > 0 && (
              <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-[#fbbf24] px-1.5 text-[11px] font-bold text-black">
                {stats.unread > 99 ? '99+' : stats.unread}
              </span>
            )}
            <button
              type="button"
              onClick={() => refetch()}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#2a2a2a] bg-[#141414] text-[#666] transition-all hover:text-white"
              title="Refresh conversations"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="mt-3 flex gap-4 text-[11px]">
          {[
            { label: 'Total',    value: stats.total,  color: 'text-[#aaa]'        },
            { label: 'Active',   value: stats.active,  color: 'text-emerald-400'  },
            { label: 'On Hold',  value: stats.onHold,  color: 'text-amber-400'    },
            { label: 'Unread',   value: stats.unread,  color: 'text-[#fbbf24]'    },
          ].map(({ label, value, color }) => (
            <span key={label} className="flex items-center gap-1">
              <span className={cn('font-bold', color)}>{value}</span>
              <span className="text-[#444]">{label}</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Main two-panel body ───────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ════════════════════════════════════════════════════════════════
            LEFT PANEL — Conversation list
            hidden on mobile when chat is open
        ════════════════════════════════════════════════════════════════ */}
        <div className={cn(
          'flex flex-col border-r border-[#1a1a1a] bg-[#0d0d0d]',
          // Desktop: always visible, fixed width
          'lg:flex lg:w-[320px] lg:flex-shrink-0',
          // Mobile: full-width when list is shown, hidden when chat is shown
          mobileShowChat ? 'hidden' : 'flex w-full',
        )}>

          {/* Search + filter */}
          <div className="flex-shrink-0 space-y-2 border-b border-[#1a1a1a] px-3 py-3">
            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#555]" />
              <input
                type="text"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search clients…"
                className="w-full rounded-xl border border-[#2a2a2a] bg-[#141414] py-2 pl-8 pr-8 text-xs text-white placeholder-[#555] outline-none focus:border-[#fbbf24]/40 focus:ring-1 focus:ring-[#fbbf24]/20 transition-colors"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => handleSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Status filter pills */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
              <Filter className="h-3 w-3 flex-shrink-0 text-[#555]" />
              {STATUS_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleFilterChange(value)}
                  className={cn(
                    'flex-shrink-0 rounded-lg border px-2 py-1 text-[10px] font-medium transition-all',
                    statusFilter === value
                      ? 'border-[#fbbf24]/30 bg-[#fbbf24]/10 text-[#fbbf24]'
                      : 'border-[#2a2a2a] bg-[#141414] text-[#666] hover:text-white',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* List body */}
          <div className="flex-1 overflow-y-auto p-2">
            {/* Loading */}
            {isLoading && (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-5 w-5 animate-spin text-[#fbbf24]" />
              </div>
            )}

            {/* Error */}
            {isError && (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <AlertCircle className="h-6 w-6 text-red-400" />
                <p className="text-xs text-[#666]">Failed to load conversations</p>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="rounded-xl border border-[#2a2a2a] px-3 py-1.5 text-[11px] text-[#aaa] hover:text-white"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Empty */}
            {!isLoading && !isError && filtered.length === 0 && (
              <EmptyState filtered={isFiltered} />
            )}

            {/* Conversation items */}
            {!isLoading && !isError && filtered.length > 0 && (
              <div className="space-y-0.5">
                {filtered.map((conv) => (
                  <ConversationItem
                    key={conv.id}
                    conv={conv}
                    isActive={activeConvId === conv.id}
                    onClick={() => handleSelect(conv.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════
            RIGHT PANEL — Chat window
            full-width on mobile (when mobileShowChat), always visible desktop
        ════════════════════════════════════════════════════════════════ */}
        <div className={cn(
          'flex flex-col bg-[#0a0a0a]',
          // Desktop: take remaining space, always visible
          'lg:flex lg:flex-1',
          // Mobile: full-width only when chat is shown
          mobileShowChat ? 'flex w-full' : 'hidden',
        )}>
          {/* Mobile back button */}
          {mobileShowChat && (
            <div className="flex-shrink-0 border-b border-[#1a1a1a] bg-[#0d0d0d] px-4 py-3 lg:hidden">
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center gap-2 text-sm text-[#aaa] hover:text-white transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to conversations
              </button>
            </div>
          )}

          {/* Chat area */}
          <div className="flex-1 overflow-hidden p-3">
            <AnimatePresence mode="wait">
              {activeConv ? (
                <motion.div
                  key={activeConv.id}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.18 }}
                  className="h-full"
                >
                  <ChatWindow
                    conversation={activeConv}
                    onClose={() => {
                      setActiveConvId(null);
                      setMobileShowChat(false);
                    }}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="placeholder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-full"
                >
                  <SelectConversationPlaceholder />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page wrapper (Suspense required for useSearchParams in App Router) ─────

export default function ErpMessagesPage() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#fbbf24]" /></div>}>
      <ErpMessagesPageInner />
    </Suspense>
  );
}
