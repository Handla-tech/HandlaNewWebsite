'use client';

import { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Check, CheckCheck, Download, ExternalLink,
  File, FileText, FileSpreadsheet, FileArchive, FileImage,
  FileSignature, Receipt, FolderOpen,
} from 'lucide-react';
import { formatTime, getDateLabel, cn } from '@/lib/utils';
import { isImageType, formatFileSize } from '@/lib/s3-uploader';
import Avatar from '@/components/ui/Avatar';
import type { Message, User } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MessageListProps {
  messages:     Message[];
  currentUser:  User;
  typingUsers:  Record<string, boolean>;
  /** Map of userId → User for display names/avatars */
  participants: Record<string, User>;
  isLoading?:   boolean;
}

// ─── Date separator ───────────────────────────────────────────────────────────

function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-4 px-2">
      <div className="flex-1 h-px bg-[#2a2a2a]" />
      <span className="text-[10px] font-medium text-[#555] whitespace-nowrap px-2 py-0.5 rounded-full bg-[#141414] border border-[#2a2a2a]">
        {label}
      </span>
      <div className="flex-1 h-px bg-[#2a2a2a]" />
    </div>
  );
}

// ─── Read receipt icons ───────────────────────────────────────────────────────

function ReadReceipt({ isRead }: { isRead: boolean }) {
  return isRead ? (
    <span title="Read">
      <CheckCheck className="h-3 w-3 text-gold-400" />
    </span>
  ) : (
    <span title="Sent">
      <Check className="h-3 w-3 text-[#555]" />
    </span>
  );
}

// ─── System event card ───────────────────────────────────────────────────────

type SystemEventType = 'CONTRACT_SENT' | 'INVOICE_CREATED' | 'PROJECT_CREATED';

interface SystemEventPayload {
  type:     SystemEventType;
  title:    string;
  id:       string;
  message:  string;
  amount?:  string;
  dueDate?: string | null;
  status?:  string;
}

const SYSTEM_EVENT_CONFIG: Record<SystemEventType, {
  icon:       React.ComponentType<{ className?: string }>;
  label:      string;
  accentClass: string;
  href?:      (id: string) => string;
}> = {
  CONTRACT_SENT: {
    icon:        FileSignature,
    label:       'Contract',
    accentClass: 'border-amber-500/30 bg-amber-500/5 text-amber-400',
    href:        () => '/dashboard?tab=contracts',
  },
  INVOICE_CREATED: {
    icon:        Receipt,
    label:       'Invoice',
    accentClass: 'border-blue-500/30 bg-blue-500/5 text-blue-400',
    href:        () => '/dashboard?tab=invoices',
  },
  PROJECT_CREATED: {
    icon:        FolderOpen,
    label:       'Project',
    accentClass: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400',
    href:        (id: string) => `/dashboard/projects/${id}`,
  },
};

function SystemEventCard({ content }: { content: string }) {
  const raw = content.replace(/^__SYSTEM__:/, '');
  let payload: SystemEventPayload | null = null;
  try {
    payload = JSON.parse(raw) as SystemEventPayload;
  } catch {
    // malformed — fall back to plain text
    return <p className="whitespace-pre-wrap break-words text-sm">{content}</p>;
  }

  const cfg = SYSTEM_EVENT_CONFIG[payload.type];
  if (!cfg) {
    return <p className="whitespace-pre-wrap break-words text-sm">{payload.message}</p>;
  }

  const Icon = cfg.icon;
  const href = cfg.href?.(payload.id);

  return (
    <div className={cn(
      'rounded-xl border px-4 py-3 space-y-2 min-w-[220px]',
      cfg.accentClass,
    )}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 flex-shrink-0" />
        <span className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{cfg.label}</span>
      </div>

      {/* Title */}
      <p className="text-sm font-semibold text-white leading-snug">{payload.title}</p>

      {/* Extra metadata */}
      {payload.amount && (
        <p className="text-xs text-white/60">Amount: <span className="text-white font-medium">{payload.amount}</span></p>
      )}
      {payload.dueDate && (
        <p className="text-xs text-white/60">Due: <span className="text-white font-medium">{new Date(payload.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></p>
      )}
      {payload.status && (
        <p className="text-xs text-white/60">Status: <span className="text-white font-medium">{payload.status.replace('_', ' ')}</span></p>
      )}

      {/* Message */}
      <p className="text-xs text-white/50">{payload.message}</p>

      {/* CTA */}
      {href && (
        <Link
          href={href}
          className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold underline underline-offset-2 opacity-80 hover:opacity-100 transition-opacity"
        >
          View details <ExternalLink className="h-2.5 w-2.5" />
        </Link>
      )}
    </div>
  );
}

// ─── File attachment display ──────────────────────────────────────────────────

function FileAttachment({ url, contentType }: { url: string; contentType?: string }) {
  const type = contentType ?? '';
  const name = url.split('/').pop()?.split('?')[0] ?? 'attachment';
  const isImg = isImageType(type) || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);

  function AttachIcon({ className }: { className: string }) {
    if (isImg)                                           return <FileImage       className={className} />;
    if (type === 'application/pdf')                      return <FileText        className={className} />;
    if (type.includes('word'))                           return <FileText        className={className} />;
    if (type.includes('excel') || type.includes('spreadsheet')) return <FileSpreadsheet className={className} />;
    if (type.includes('zip'))                            return <FileArchive     className={className} />;
    return                                                      <File            className={className} />;
  }

  if (isImg) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block mt-1 group/img">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="attachment"
          className="max-w-[220px] max-h-[200px] rounded-xl object-cover border border-[#2a2a2a] group-hover/img:border-gold-400/30 transition-colors"
          loading="lazy"
        />
        <span className="flex items-center gap-1 mt-1 text-[10px] text-[#555] group-hover/img:text-[#888] transition-colors">
          <ExternalLink className="h-2.5 w-2.5" /> View full size
        </span>
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      download
      className="mt-1 flex items-center gap-2 rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 hover:border-gold-400/30 transition-colors group/file"
    >
      <AttachIcon className="h-5 w-5 text-gold-400 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-white truncate">{decodeURIComponent(name)}</p>
        <p className="text-[10px] text-[#555]">Click to download</p>
      </div>
      <Download className="h-4 w-4 text-[#555] group-hover/file:text-gold-400 transition-colors flex-shrink-0" />
    </a>
  );
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator({ names }: { names: string[] }) {
  const label = names.length === 1
    ? `${names[0]} is typing`
    : names.length === 2
    ? `${names[0]} and ${names[1]} are typing`
    : 'Several people are typing';

  return (
    <motion.div
      key="typing"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="flex items-end gap-2 px-3"
    >
      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#2a2a2a] text-[10px] font-bold text-[#888]">
        …
      </div>
      <div className="rounded-2xl rounded-bl-sm bg-[#1a1a1a] border border-[#2a2a2a] px-3 py-2 flex items-center gap-2">
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-[#666]"
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
            />
          ))}
        </span>
        <span className="text-[11px] text-[#555]">{label}</span>
      </div>
    </motion.div>
  );
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function MessageSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4 animate-pulse">
      {[true, false, true, false, true].map((isOwn, idx) => (
        <div key={idx} className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
          <div className="h-7 w-7 rounded-full bg-[#2a2a2a] flex-shrink-0" />
          <div
            className={`h-9 rounded-2xl bg-[#1e1e1e] ${
              isOwn ? 'w-40' : 'w-52'
            }`}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MessageList({
  messages,
  currentUser,
  typingUsers,
  participants,
  isLoading = false,
}: MessageListProps) {
  const bottomRef    = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Auto-scroll to bottom on new messages ─────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // ── Group messages by date ────────────────────────────────────────────────
  const grouped = useCallback((): { label: string; msgs: Message[] }[] => {
    const buckets: Map<string, Message[]> = new Map();
    for (const msg of messages) {
      const label = getDateLabel(msg.createdAt);
      if (!buckets.has(label)) buckets.set(label, []);
      buckets.get(label)!.push(msg);
    }
    return Array.from(buckets.entries()).map(([label, msgs]) => ({ label, msgs }));
  }, [messages]);

  // ── Typing users who aren't the current user ──────────────────────────────
  const activeTypers = Object.entries(typingUsers)
    .filter(([uid, typing]) => typing && uid !== currentUser.id)
    .map(([uid]) => participants[uid]?.name ?? 'Someone');

  if (isLoading) return <MessageSkeleton />;

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center px-6 py-10">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-400/10 border border-gold-400/20">
          <Check className="h-6 w-6 text-gold-400" />
        </div>
        <p className="text-sm font-medium text-white">No messages yet</p>
        <p className="text-xs text-[#555] max-w-[200px]">
          Say hello! Your conversation starts here.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-col flex-1 overflow-y-auto px-3 py-4 gap-1 scrollbar-thin"
    >
      {grouped().map(({ label, msgs }) => (
        <div key={label}>
          <DateSeparator label={label} />
          {msgs.map((msg, idx) => {
            const isOwn     = msg.senderId === currentUser.id;
            const sender    = participants[msg.senderId];
            const prevMsg   = idx > 0 ? msgs[idx - 1] : null;
            const isFirst   = !prevMsg || prevMsg.senderId !== msg.senderId;
            const showAvatar = !isOwn && isFirst;

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  // Bigger gap between messages — was mb-0.5 which felt cramped.
                  // First message in a group gets extra top margin so consecutive
                  // messages from the same sender stay visually grouped.
                  'flex items-end gap-2 px-1 mb-3',
                  isFirst ? 'mt-2' : 'mt-0',
                  isOwn ? 'flex-row-reverse' : 'flex-row',
                )}
              >
                {/* ── Avatar / spacer ──────────────────────────────── */}
                {/*
                  Fallback chain for the sender:
                    1) participants map (admin / client / assignedEmployee on
                       the conversation — keeps avatars consistent in the header)
                    2) msg.sender (eagerly loaded on every Message — guarantees
                       a real avatar for EMPLOYEEs that aren't in the
                       participants map, e.g. a different employee chimed in
                       on the same conversation)
                  Without (2) the avatar fell back to "?" for every employee.
                */}
                {!isOwn ? (
                  showAvatar ? (
                    <Avatar user={sender ?? msg.sender ?? null} size="sm" />
                  ) : (
                    <div className="w-7 flex-shrink-0" />
                  )
                ) : null}

                {/* ── Bubble ───────────────────────────────────────── */}
                <div
                  className={cn(
                    'group relative max-w-[72%] space-y-1',
                    isOwn ? 'items-end' : 'items-start',
                  )}
                >
                  {/* Sender name (others only, first in group) */}
                  {!isOwn && showAvatar && (sender ?? msg.sender) && (
                    <p className="text-[10px] font-semibold text-[#888] px-1">
                      {(sender ?? msg.sender)!.name}
                    </p>
                  )}

                  {/* ── System event card (full-width, no bubble styling) ── */}
                  {msg.content?.startsWith('__SYSTEM__:') ? (
                    <SystemEventCard content={msg.content} />
                  ) : (
                  <div
                    className={cn(
                      'relative rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                      isOwn
                        ? 'bg-gold-400/15 border border-gold-400/25 text-white rounded-tr-sm'
                        : 'bg-[#1a1a1a] border border-[#2a2a2a] text-[#e0e0e0] rounded-tl-sm',
                    )}
                  >
                    {/* Text content */}
                    {msg.content && (
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    )}

                    {/* File attachment */}
                    {msg.fileUrl && (
                      <FileAttachment url={msg.fileUrl} />
                    )}

                    {/* Timestamp + read receipt */}
                    <div
                      className={cn(
                        'flex items-center gap-1 mt-1',
                        isOwn ? 'justify-end' : 'justify-start',
                      )}
                    >
                      <time
                        dateTime={msg.createdAt}
                        className="text-[10px] text-[#555]"
                        title={new Date(msg.createdAt).toLocaleString()}
                      >
                        {formatTime(msg.createdAt)}
                      </time>
                      {isOwn && <ReadReceipt isRead={msg.isRead} />}
                    </div>
                  </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      ))}

      {/* ── Typing indicator ──────────────────────────────────────────── */}
      <AnimatePresence>
        {activeTypers.length > 0 && (
          <TypingIndicator names={activeTypers} />
        )}
      </AnimatePresence>

      {/* ── Scroll anchor ────────────────────────────────────────────── */}
      <div ref={bottomRef} />
    </div>
  );
}
