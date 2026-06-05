'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell } from 'lucide-react';
import NotificationCenter from './NotificationCenter';
import { useNotificationStore } from '@/store/notificationStore';
import { useAuthStore } from '@/store/authStore';

// ── Inner bell — only mounted once auth is hydrated + user is logged in ───────
function BellInner() {
  const [open, setOpen] = useState(false);
  const wrapperRef      = useRef<HTMLDivElement>(null);

  // Read unreadCount directly from Zustand — the socket handler calls
  // addNotification() which increments the store synchronously, so the
  // badge updates the instant a notificationNew event arrives without
  // needing an active React Query observer for ['notifications-unread'].
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  // ── Close on outside click ────────────────────────────────────────────────
  const handleOutsideClick = useCallback((e: MouseEvent) => {
    if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) document.addEventListener('mousedown', handleOutsideClick);
    else      document.removeEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open, handleOutsideClick]);

  // ── Close on Escape ───────────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  const hasUnread = unreadCount > 0;

  return (
    <div ref={wrapperRef} className="relative">
      {/* ── Bell button ──────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${hasUnread ? ` — ${unreadCount} unread` : ''}`}
        aria-haspopup="true"
        aria-expanded={open}
        className={`relative flex h-9 w-9 items-center justify-center rounded-xl border transition-all duration-200 ${
          open
            ? 'border-[#fbbf24]/40 bg-[#fbbf24]/10 text-[#fbbf24]'
            : 'border-[#2a2a2a] bg-transparent text-[#888] hover:border-[#3a3a3a] hover:text-white'
        }`}
      >
        {/* Bell icon — shakes when there are unread notifications */}
        <motion.span
          animate={hasUnread && !open ? { rotate: [0, -12, 12, -8, 8, -4, 4, 0] } : {}}
          transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 4 }}
          className="flex items-center justify-center"
        >
          <Bell className="h-4 w-4" />
        </motion.span>

        {/* ── Unread badge ─────────────────────────────────────────────── */}
        <AnimatePresence>
          {hasUnread && (
            <motion.span
              key="badge"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center
                         rounded-full bg-[#fbbf24] px-1 text-[9px] font-bold leading-none text-black"
              style={{ boxShadow: '0 0 8px rgba(251,191,36,0.6)' }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>

        {/* ── Pulse ring (only when unread and panel closed) ─────────── */}
        {hasUnread && !open && (
          <span className="absolute -right-1 -top-1 h-4 w-4 animate-ping rounded-full bg-[#fbbf24]/30 pointer-events-none" />
        )}
      </button>

      {/* ── Dropdown panel ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="notification-center"
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute right-0 top-full mt-2 z-50"
          >
            <NotificationCenter onClose={() => setOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Public wrapper — guards against SSR hydration 401s ───────────────────────
//
// Problem: Zustand persists `isLoggedIn` to localStorage (client-only).
// On first render (SSR + hydration flash) `isLoggedIn` is `false` even for
// authenticated users, so the `enabled: isLoggedIn` guard in useNotifications
// fires as `enabled: false` initially — but React Query still evaluates the
// queryFn on the first client render before Zustand has read localStorage.
//
// Fix: Don't mount the bell component at all until:
//   1. The component is on the client (`mounted === true`)  AND
//   2. Zustand has confirmed the user is logged in (`isLoggedIn === true`)
//
// This guarantees the useNotifications hook is NEVER called for
// unauthenticated users, eliminating the 401 entirely.
export default function NotificationBell() {
  const [mounted, setMounted] = useState(false);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

  // Wait for client-side hydration before rendering.
  // This prevents Zustand's localStorage hydration race from letting
  // React Query fire the notifications API before isLoggedIn is true.
  useEffect(() => { setMounted(true); }, []);

  if (!mounted || !isLoggedIn) return null;

  return <BellInner />;
}
