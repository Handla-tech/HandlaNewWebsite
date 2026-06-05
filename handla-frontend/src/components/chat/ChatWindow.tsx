'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MoreVertical, Phone, Video, ChevronDown,
  CheckCheck, Circle, Loader2, WifiOff,
} from 'lucide-react';
import MessageList   from './MessageList';
import MessageInput  from './MessageInput';
import { useChat }   from '@/hooks/useChat';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { markRead }  from '@/lib/socket';
import { getInitials, getAvatarColor, cn } from '@/lib/utils';
import type { Conversation, User, ConversationStatus } from '@/types';

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ConversationStatus, string> = {
  ACTIVE:    'Active',
  ON_HOLD:   'On Hold',
  COMPLETED: 'Completed',
};
const STATUS_COLORS: Record<ConversationStatus, string> = {
  ACTIVE:    'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  ON_HOLD:   'text-amber-400 bg-amber-400/10 border-amber-400/20',
  COMPLETED: 'text-[#666] bg-[#1a1a1a] border-[#2a2a2a]',
};

function StatusBadge({ status }: { status: ConversationStatus }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
      STATUS_COLORS[status],
    )}>
      {STATUS_LABELS[status]}
    </span>
  );
}

// ─── Online dot ───────────────────────────────────────────────────────────────

function OnlineDot({ online }: { online: boolean }) {
  return online ? (
    <span className="relative flex h-2.5 w-2.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
    </span>
  ) : (
    <Circle className="h-2.5 w-2.5 text-[#555] fill-[#555]" />
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ user, size = 'sm' }: { user: User; size?: 'sm' | 'md' }) {
  const dim = size === 'md' ? 'h-10 w-10 text-sm' : 'h-8 w-8 text-xs';
  return (
    <div
      className={cn(
        'flex flex-shrink-0 items-center justify-center rounded-full font-bold text-white',
        dim,
        getAvatarColor(user.id),
      )}
      title={user.name}
    >
      {getInitials(user.name)}
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatWindowProps {
  conversation: Conversation;
  /** If true, the window can be dismissed (used in admin view) */
  onClose?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChatWindow({ conversation, onClose }: ChatWindowProps) {
  const { user: currentUser } = useAuthStore();
  const { typingUsers, onlineUsers } = useChatStore();
  const [menuOpen, setMenuOpen]       = useState(false);

  const {
    messages,
    isLoadingMessages,
    sendMessage,
    sendFile: uploadFile,
    emitTyping,
    refetchMessages,
  } = useChat(conversation.id);

  // ── Mark messages read when window becomes active ─────────────────────────
  useEffect(() => {
    markRead({ conversationId: conversation.id });
  }, [conversation.id]);

  // ── Determine the "other" participant for the header ──────────────────────
  const partner: User | null = useMemo(() => {
    if (!currentUser) return null;
    if (currentUser.role === 'ADMIN') {
      return conversation.client ?? null;
    }
    return conversation.admin ?? null;
  }, [currentUser, conversation]);

  const partnerOnline = partner ? onlineUsers.has(partner.id) : false;

  // ── Build participants map (id → User) ────────────────────────────────────
  const participants = useMemo<Record<string, User>>(() => {
    const map: Record<string, User> = {};
    if (conversation.admin)  map[conversation.admin.id]  = conversation.admin;
    if (conversation.client) map[conversation.client.id] = conversation.client;
    return map;
  }, [conversation]);

  // ── File-send handler: emit socket message with fileUrl ───────────────────
  const handleSendFile = useCallback(
    (fileUrl: string) => {
      // sendMessage via socket with fileUrl only
      import('@/lib/socket').then(({ sendSocketMessage }) => {
        sendSocketMessage({ conversationId: conversation.id, fileUrl });
      });
    },
    [conversation.id],
  );

  if (!currentUser) return null;

  return (
    <div className="flex h-full flex-col rounded-2xl border border-[#2a2a2a] bg-[#0d0d0d] overflow-hidden">

      {/* ══════════════════════════════════════════════════════════════════════
          HEADER
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="flex items-center gap-3 border-b border-[#2a2a2a] bg-[#111] px-4 py-3">
        {/* Avatar */}
        {partner ? (
          <div className="relative">
            <Avatar user={partner} size="md" />
            <span className="absolute -bottom-0.5 -right-0.5">
              <OnlineDot online={partnerOnline} />
            </span>
          </div>
        ) : (
          <div className="h-10 w-10 rounded-full bg-[#2a2a2a] animate-pulse" />
        )}

        {/* Name + status */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">
            {partner?.name ?? 'Loading…'}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-[#666]">
              {partnerOnline ? 'Online' : 'Offline'}
            </span>
            <span className="text-[#333]">·</span>
            <StatusBadge status={conversation.status} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {/* Refresh button */}
          <button
            type="button"
            onClick={() => refetchMessages()}
            title="Refresh messages"
            className="flex h-8 w-8 items-center justify-center rounded-xl text-[#555] hover:text-white hover:bg-[#1e1e1e] transition-colors"
          >
            <CheckCheck className="h-4 w-4" />
          </button>

          {/* Call icon (UI only) */}
          <button
            type="button"
            title="Call (coming soon)"
            disabled
            className="flex h-8 w-8 items-center justify-center rounded-xl text-[#555] opacity-40 cursor-not-allowed"
          >
            <Phone className="h-4 w-4" />
          </button>

          {/* Video icon (UI only) */}
          <button
            type="button"
            title="Video call (coming soon)"
            disabled
            className="flex h-8 w-8 items-center justify-center rounded-xl text-[#555] opacity-40 cursor-not-allowed"
          >
            <Video className="h-4 w-4" />
          </button>

          {/* More menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-[#555] hover:text-white hover:bg-[#1e1e1e] transition-colors"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded-xl border border-[#2a2a2a] bg-[#111] shadow-glass py-1"
                  onMouseLeave={() => setMenuOpen(false)}
                >
                  {[
                    { label: 'Mark all as read', action: () => markRead({ conversationId: conversation.id }) },
                    { label: 'Refresh messages',  action: () => refetchMessages() },
                    ...(onClose ? [{ label: 'Close chat', action: onClose }] : []),
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => { item.action(); setMenuOpen(false); }}
                      className="w-full px-4 py-2 text-left text-xs text-[#aaa] hover:text-white hover:bg-[#1e1e1e] transition-colors"
                    >
                      {item.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Close / collapse */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Close"
              className="flex h-8 w-8 items-center justify-center rounded-xl text-[#555] hover:text-white hover:bg-[#1e1e1e] transition-colors"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MESSAGE LIST
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-1 flex-col overflow-hidden relative">
        {isLoadingMessages ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-gold-400" />
              <p className="text-xs text-[#555]">Loading messages…</p>
            </div>
          </div>
        ) : (
          <MessageList
            messages={messages}
            currentUser={currentUser}
            typingUsers={typingUsers}
            participants={participants}
            isLoading={false}
          />
        )}

        {/* Offline banner */}
        <AnimatePresence>
          {conversation.status === 'COMPLETED' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10"
            >
              <div className="flex items-center gap-2 rounded-full border border-[#2a2a2a] bg-[#111] px-4 py-2 text-xs text-[#666] shadow-glass">
                <WifiOff className="h-3.5 w-3.5" />
                This conversation is completed — messaging is disabled
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          INPUT BAR
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="border-t border-[#2a2a2a] px-3 py-3">
        <MessageInput
          conversationId={conversation.id}
          onSendMessage={sendMessage}
          onSendFile={handleSendFile}
          onTyping={emitTyping}
          disabled={conversation.status === 'COMPLETED'}
        />
        {conversation.status === 'COMPLETED' && (
          <p className="mt-1.5 text-center text-[10px] text-[#444]">
            Conversation completed — read only
          </p>
        )}
      </div>
    </div>
  );
}
