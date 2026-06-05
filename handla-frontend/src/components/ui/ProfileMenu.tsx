'use client';

/**
 * ProfileMenu — compact person-icon button that opens a dropdown.
 *
 * Sized identically to NotificationBell (h-9 w-9 rounded-xl border).
 * Used in:
 *   • /dashboard top-bar
 *   • /erp top-bar
 *   • Landing page Navbar (authenticated state)
 *
 * Smart context: when the user is already on their dashboard (/dashboard or
 * /erp), the "Go to Chat / ERP Portal" link is hidden and only
 * "Back to Website" + "Sign out" are shown.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User, MessageSquare, LayoutDashboard, Home, LogOut } from 'lucide-react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { getInitials, getAvatarColor, cn } from '@/lib/utils';

export default function ProfileMenu() {
  const [open, setOpen]  = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const wrapperRef       = useRef<HTMLDivElement>(null);
  const router           = useRouter();
  const pathname         = usePathname();
  const { user, isLoggedIn, logout } = useAuthStore();

  // ── Compute fixed position from button's bounding rect ───────────────────
  const updateDropdownPosition = useCallback(() => {
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      setDropdownStyle({
        top:   rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
  }, []);

  const isAdmin   = isLoggedIn && user?.role === 'ADMIN';
  // Hide the "Go to Chat / Admin Panel" item when we're already on that page
  const onDash    = pathname?.startsWith('/dashboard');
  const onErp     = pathname?.startsWith('/erp');
  const alreadyThere = isAdmin ? onErp : onDash;

  // ── Close on outside click ──────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      updateDropdownPosition();
      document.addEventListener('mousedown', handler);
      window.addEventListener('resize', updateDropdownPosition);
      window.addEventListener('scroll', updateDropdownPosition, true);
    }
    return () => {
      document.removeEventListener('mousedown', handler);
      window.removeEventListener('resize', updateDropdownPosition);
      window.removeEventListener('scroll', updateDropdownPosition, true);
    };
  }, [open, updateDropdownPosition]);

  // ── Close on Escape ─────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleLogout = useCallback(async () => {
    setOpen(false);
    await logout();
    router.push('/');
  }, [logout, router]);

  if (!isLoggedIn || !user) return null;

  const dashHref  = isAdmin ? '/erp' : '/dashboard';
  const dashLabel = isAdmin ? 'ERP Portal' : 'Go to Chat';
  const DashIcon  = isAdmin ? LayoutDashboard : MessageSquare;
  const roleLabel = isAdmin ? 'Admin' : 'Client';
  const avatarBg  = getAvatarColor(user.id);
  const initials  = getInitials(user.name);

  return (
    <div ref={wrapperRef} className="relative">

      {/* ── Trigger — same h-9 w-9 rounded-xl border as NotificationBell ── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Profile menu"
        aria-haspopup="true"
        aria-expanded={open}
        className={cn(
          'relative flex h-9 w-9 items-center justify-center rounded-xl border transition-all duration-200',
          open
            ? 'border-[#fbbf24]/40 bg-[#fbbf24]/10 text-[#fbbf24]'
            : 'border-[#2a2a2a] bg-transparent text-[#888] hover:border-[#3a3a3a] hover:text-white',
        )}
      >
        <User className="h-4 w-4" aria-hidden="true" />
      </button>

      {/* ── Dropdown — rendered via portal at fixed viewport position ────────
           Using position:fixed + portal bypasses any stacking context created
           by backdrop-blur on the header, ensuring the menu always renders
           on top regardless of CSS transforms or filter effects on ancestors. */}
      <AnimatePresence>
        {open && typeof document !== 'undefined' && createPortal(
          <motion.div
            key="profile-menu"
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{   opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            style={{
              position:     'fixed',
              top:          dropdownStyle.top,
              right:        dropdownStyle.right,
              zIndex:       9999,
              width:        '14rem',
              background:   '#141414',
              border:       '1px solid #2a2a2a',
              boxShadow:    '0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
              borderRadius: '1rem',
              overflow:     'hidden',
            }}
          >
            {/* ── User info card ── */}
            <div
              className="px-4 py-3 flex items-center gap-3"
              style={{ background: 'rgba(251,191,36,0.05)', borderBottom: '1px solid #1e1e1e' }}
            >
              <div
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white flex-shrink-0',
                  avatarBg,
                )}
              >
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate">{user.name}</p>
                <p className="text-[10px] truncate mt-0.5" style={{ color: '#888' }}>{user.email}</p>
                <span
                  className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
                  style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}
                >
                  {roleLabel}
                </span>
              </div>
            </div>

            {/* ── Menu items ── */}
            <div className="p-1.5 space-y-0.5">

              {/* Go to Chat / Admin Panel — hidden when already there */}
              {!alreadyThere && (
                <Link
                  href={dashHref}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-xs font-medium text-[#b0b0b0] hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-lg flex-shrink-0"
                    style={{ background: 'rgba(251,191,36,0.1)' }}
                  >
                    <DashIcon className="w-3 h-3" style={{ color: '#fbbf24' }} />
                  </span>
                  {dashLabel}
                </Link>
              )}

              {/* Back to Website */}
              <Link
                href="/"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-xs font-medium text-[#b0b0b0] hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-lg flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  <Home className="w-3 h-3 text-[#888]" />
                </span>
                Back to Website
              </Link>

              {/* Divider */}
              <div style={{ height: 1, background: '#1e1e1e', margin: '4px 0' }} />

              {/* Sign out */}
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-xs font-medium text-[#f87171] hover:text-white hover:bg-red-500/10 transition-colors"
              >
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-lg flex-shrink-0"
                  style={{ background: 'rgba(239,68,68,0.1)' }}
                >
                  <LogOut className="w-3 h-3 text-[#f87171]" />
                </span>
                Sign out
              </button>

            </div>
          </motion.div>,
          document.body,
        )}
      </AnimatePresence>
    </div>
  );
}
