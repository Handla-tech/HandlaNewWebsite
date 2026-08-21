'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, LogOut,
  Menu, X, ChevronRight, Home,
  FileText, Receipt, FolderOpen,
} from 'lucide-react';
import ProfileMenu from '@/components/ui/ProfileMenu';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import NotificationBell from '@/components/notifications/NotificationBell';
import { getInitials, getAvatarColor, cn } from '@/lib/utils';

// ─── Nav items ────────────────────────────────────────────────────────────────

const BASE_NAV_ITEMS = [
  { href: '/dashboard',            icon: MessageSquare, label: 'My Chat',   roles: ['CLIENT', 'LEAD'] },
];

const CLIENT_ONLY_NAV_ITEMS = [
  { href: '/dashboard?tab=projects',  icon: FolderOpen,    label: 'Projects'  },
  { href: '/dashboard?tab=contracts', icon: FileText,       label: 'Contracts' },
  { href: '/dashboard?tab=invoices',  icon: Receipt,        label: 'Invoices'  },
];

// ─── Sidebar content (shared between mobile drawer and desktop panel) ─────────

function SidebarContent({
  user,
  pathname,
  searchParams,
  isClient,
  onLogout,
  onClose,
  onTabChange,
}: {
  user: { name: string; email: string; id: string } | null;
  pathname: string;
  searchParams: string;
  isClient: boolean;
  onLogout: () => void;
  onClose?: () => void;
  onTabChange?: (tab: string) => void;
}) {
  const activeTab = typeof window !== 'undefined'
    ? new URLSearchParams(searchParams).get('tab') ?? 'chat'
    : 'chat';

  return (
    <div className="flex h-full flex-col">
      {/* ── Logo ──────────────────────────────────────────────────────── */}
      <div className="flex items-center px-5 py-5 border-b border-[#1e1e1e]">
        <span className="font-mono font-bold text-base tracking-tight">
          <span className="text-white">&lt;Handla </span><span className="text-gold-400">/</span><span className="text-white">&gt;</span>
        </span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="ml-auto min-h-[44px] min-w-[44px] flex items-center justify-center text-[#555] hover:text-white transition-colors"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* ── Nav links ─────────────────────────────────────────────────── */}
      <nav className="flex-1 space-y-0.5 px-3 py-4">
        <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-widest text-[#444]">
          Menu
        </p>

        {/* Chat — always visible */}
        {(() => {
          const href = '/dashboard';
          const isActive = pathname === href && (!activeTab || activeTab === 'chat');
          return (
            <Link
              key={href}
              href={href}
              onClick={() => { onTabChange?.('chat'); onClose?.(); }}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                isActive
                  ? 'bg-gold-400/10 border border-gold-400/20 text-gold-400'
                  : 'text-[#888] hover:text-white hover:bg-[#1a1a1a]',
              )}
            >
              <MessageSquare className="h-4 w-4 flex-shrink-0" />
              My Chat
              {isActive && <ChevronRight className="ml-auto h-3.5 w-3.5 text-gold-400/60" />}
            </Link>
          );
        })()}

        {/* CLIENT-only module nav items */}
        {isClient && (
          <>
            <p className="px-2 pt-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-[#444]">
              Modules
            </p>
            {CLIENT_ONLY_NAV_ITEMS.map(({ href, icon: Icon, label }) => {
              const tabKey = href.split('tab=')[1] ?? '';
              const isActive = pathname === '/dashboard' && activeTab === tabKey;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => { onTabChange?.(tabKey); onClose?.(); }}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                    isActive
                      ? 'bg-gold-400/10 border border-gold-400/20 text-gold-400'
                      : 'text-[#888] hover:text-white hover:bg-[#1a1a1a]',
                  )}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {label}
                  {isActive && <ChevronRight className="ml-auto h-3.5 w-3.5 text-gold-400/60" />}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* ── User card + logout ─────────────────────────────────────────── */}
      <div className="border-t border-[#1e1e1e] p-3 space-y-1">
        {user && (
          <div className="flex items-center gap-3 rounded-xl bg-[#141414] border border-[#1e1e1e] px-3 py-2.5">
            <div
              className={cn(
                'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white',
                getAvatarColor(user.id),
              )}
            >
              {getInitials(user.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">{user.name}</p>
              <p className="truncate text-[10px] text-[#555]">{user.email}</p>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={onLogout}
          aria-label="Sign out"
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 min-h-[44px] text-sm font-medium text-[#666] transition-all hover:text-red-400 hover:bg-red-400/5"
        >
          <LogOut className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          Sign Out
        </button>
        <Link
          href="/"
          onClick={onClose}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 min-h-[44px] text-sm font-medium text-[#666] transition-all hover:text-gold-400 hover:bg-gold-400/5"
        >
          <Home className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          Back to Website
        </Link>
      </div>
    </div>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const { user, isLoggedIn, isLoading, authResolved, isAdmin, isEmployee, logout } = useAuth();
  const isClient = user?.role === 'CLIENT';
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchParams, setSearchParams] = useState('');
  const { t } = useTranslation();

  // Track query string for active tab highlighting
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSearchParams(window.location.search);
    }
  }, [pathname]);

  // ── Auth guard: redirect to correct dashboard per role ───────────────────
  // Wait until auth is RESOLVED (first /auth/me settled or a user was adopted
  // after OTP verify) before redirecting. Without this gate the initial
  // pre-hydration `isLoggedIn=false` bounces authenticated users straight back
  // to /auth in a loop (the "stuck on OTP screen after verify" bug).
  useEffect(() => {
    if (!authResolved) return;
    if (isLoggedIn && (isAdmin || isEmployee)) {
      router.replace('/erp');
    } else if (!isLoggedIn) {
      router.replace('/auth');
    }
  }, [authResolved, isLoggedIn, isAdmin, isEmployee, router]);

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const handleTabChange = (tab: string) => {
    // Update local search params to reflect active tab in sidebar highlight
    setSearchParams(tab === 'chat' ? '' : `?tab=${tab}`);
  };

  // Prevent flash during auth loading — wait for resolution, not just isLoading.
  if (!authResolved || isLoading || !isLoggedIn) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#2a2a2a] border-t-gold-400" />
          <p className="text-xs text-[#555]">Loading…</p>
        </div>
      </div>
    );
  }

  const sidebarProps = {
    user: user ? { name: user.name, email: user.email, id: user.id } : null,
    pathname,
    searchParams,
    isClient,
    onLogout: handleLogout,
    onTabChange: handleTabChange,
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0a0a]">

      {/* ═══════════════════════════════════════════════════════════════
          DESKTOP SIDEBAR (hidden below lg)
      ═══════════════════════════════════════════════════════════════ */}
      <aside className="hidden lg:flex w-56 flex-shrink-0 flex-col border-r border-[#1a1a1a] bg-[#0d0d0d]">
        <SidebarContent {...sidebarProps} />
      </aside>

      {/* ═══════════════════════════════════════════════════════════════
          MOBILE DRAWER
      ═══════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/70 lg:hidden"
              onClick={() => setDrawerOpen(false)}
            />
            {/* Drawer panel */}
            <motion.aside
              key="drawer"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="fixed inset-y-0 left-0 z-50 w-64 border-r border-[#1a1a1a] bg-[#0d0d0d] lg:hidden"
            >
              <SidebarContent
                {...sidebarProps}
                onClose={() => setDrawerOpen(false)}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════════════
          MAIN CONTENT AREA
      ═══════════════════════════════════════════════════════════════ */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">

        {/* ── Top header bar ──────────────────────────────────────── */}
        <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-[#1a1a1a] bg-[#0d0d0d] px-4">
          {/* Hamburger (mobile only) */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={drawerOpen}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[#666] hover:text-white hover:bg-[#1a1a1a] transition-colors lg:hidden touch-target"
          >
            <Menu className="h-4 w-4" aria-hidden="true" />
          </button>

          {/* Page title (desktop) */}
          <div className="hidden lg:flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-gold-400" aria-hidden="true" />
            <span className="text-sm font-semibold text-white">{t('dashboard.title')}</span>
          </div>

          {/* Right actions */}
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />
            <ProfileMenu />
          </div>
        </header>

        {/* ── Page content ──────────────────────────────────────── */}
        <main className="flex-1 overflow-auto pb-safe">
          {children}
        </main>
      </div>
    </div>
  );
}
