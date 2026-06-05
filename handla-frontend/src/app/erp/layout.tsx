'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Briefcase,
  FolderOpen,
  CheckSquare,
  FileText,
  Receipt,
  DollarSign,
  Star,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Home,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import NotificationBell from '@/components/notifications/NotificationBell';
import ProfileMenu from '@/components/ui/ProfileMenu';
import { getInitials, getAvatarColor, cn } from '@/lib/utils';

// ─── Role badge colours ────────────────────────────────────────────────────────

const ROLE_COLOURS: Record<string, string> = {
  ADMIN:    'border-gold-400/30 bg-gold-400/10 text-gold-400',
  EMPLOYEE: 'border-blue-400/30 bg-blue-400/10 text-blue-400',
};

// ─── Nav items ────────────────────────────────────────────────────────────────

type NavItem = {
  href:       string;
  icon:       React.ComponentType<{ className?: string }>;
  label:      string;
  adminOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: '/erp',                   icon: LayoutDashboard, label: 'Dashboard'    },
  { href: '/erp/messages',          icon: MessageSquare,   label: 'Messages'     },
  { href: '/erp/clients',           icon: Briefcase,       label: 'Clients'      },
  { href: '/erp/projects',          icon: FolderOpen,      label: 'Projects'     },
  { href: '/erp/tasks',             icon: CheckSquare,     label: 'Tasks'        },
  { href: '/erp/contracts',         icon: FileText,        label: 'Contracts'    },
  { href: '/erp/invoices',          icon: Receipt,         label: 'Invoices'     },
  { href: '/erp/expenses',          icon: DollarSign,      label: 'Expenses'     },
  { href: '/erp/testimonials',      icon: Star,            label: 'Testimonials', adminOnly: true },
  { href: '/erp/users',             icon: Users,           label: 'Users',        adminOnly: true },
];

// ─── Sidebar content ──────────────────────────────────────────────────────────

function SidebarContent({
  user,
  role,
  pathname,
  onLogout,
  onClose,
}: {
  user:     { name: string; email: string; id: string } | null;
  role:     string;
  pathname: string;
  onLogout: () => void;
  onClose?: () => void;
}) {
  const isAdmin = role === 'ADMIN';

  return (
    <div className="flex h-full flex-col">
      {/* ── Logo + ERP pill ────────────────────────────────────────────── */}
      <div className="flex items-center border-b border-[#1e1e1e] px-5 py-5">
        <span className="font-mono font-bold text-base tracking-tight">
          <span className="text-white">&lt;Handla </span>
          <span className="text-[#fbbf24]">/</span>
          <span className="text-white">&gt;</span>
        </span>
        {/* Gold "ERP" badge */}
        <span className="ml-2 rounded-md border border-[#fbbf24]/30 bg-[#fbbf24]/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-[#fbbf24]">
          ERP
        </span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="ml-auto text-[#555] transition-colors hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── Nav links ──────────────────────────────────────────────────── */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-widest text-[#444]">
          Workspace
        </p>
        {NAV_ITEMS.filter(item => isAdmin || !item.adminOnly).map(({ href, icon: Icon, label }) => {
          const isActive = href === '/erp' ? pathname === '/erp' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                isActive
                  ? 'border border-[#fbbf24]/20 bg-[#fbbf24]/10 text-[#fbbf24]'
                  : 'text-[#888] hover:bg-[#1a1a1a] hover:text-white',
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
              {isActive && (
                <ChevronRight className="ml-auto h-3.5 w-3.5 text-[#fbbf24]/60" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── User card + logout ─────────────────────────────────────────── */}
      <div className="space-y-1 border-t border-[#1e1e1e] p-3">
        {user && (
          <div className="flex items-center gap-3 rounded-xl border border-[#1e1e1e] bg-[#141414] px-3 py-2.5">
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
            {/* Role badge */}
            <span
              className={cn(
                'rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
                ROLE_COLOURS[role] ?? 'border-[#333] bg-[#1a1a1a] text-[#888]',
              )}
            >
              {role}
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[#666] transition-all hover:bg-red-400/5 hover:text-red-400"
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          Sign Out
        </button>

        <Link
          href="/"
          onClick={onClose}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[#666] transition-all hover:bg-[#fbbf24]/5 hover:text-[#fbbf24]"
        >
          <Home className="h-4 w-4 flex-shrink-0" />
          Back to Website
        </Link>
      </div>
    </div>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function ErpLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const { user, isLoggedIn, isLoading, isAdmin, isEmployee, logout } = useAuth();
  const [mounted,    setMounted]    = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Prevent SSR hydration flash
  useEffect(() => { setMounted(true); }, []);

  // ── Auth guard: only ADMIN or EMPLOYEE may enter ─────────────────────────
  useEffect(() => {
    if (!mounted || isLoading) return;
    if (!isLoggedIn) {
      router.replace('/auth');
      return;
    }
    if (!isAdmin && !isEmployee) {
      // CLIENT / LEAD → back to their dashboard
      router.replace('/dashboard');
    }
  }, [mounted, isLoading, isLoggedIn, isAdmin, isEmployee, router]);

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  // Loading / auth flash guard
  if (!mounted || isLoading || !isLoggedIn) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#2a2a2a] border-t-[#fbbf24]" />
          <p className="text-xs text-[#555]">Loading ERP…</p>
        </div>
      </div>
    );
  }

  const role = user?.role ?? '';

  const sidebarProps = {
    user:     user ? { name: user.name, email: user.email, id: user.id } : null,
    role,
    pathname,
    onLogout: handleLogout,
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0a0a]">

      {/* ══════════════════════════════════════════════════
          DESKTOP SIDEBAR — w-64
      ══════════════════════════════════════════════════ */}
      <aside className="hidden w-64 flex-shrink-0 flex-col border-r border-[#1a1a1a] bg-[#0d0d0d] lg:flex">
        <SidebarContent {...sidebarProps} />
      </aside>

      {/* ══════════════════════════════════════════════════
          MOBILE DRAWER — spring animation
      ══════════════════════════════════════════════════ */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/70 lg:hidden"
              onClick={() => setDrawerOpen(false)}
            />
            <motion.aside
              key="drawer"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="fixed inset-y-0 left-0 z-50 w-64 border-r border-[#1a1a1a] bg-[#0d0d0d] lg:hidden"
            >
              <SidebarContent {...sidebarProps} onClose={() => setDrawerOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════
          MAIN CONTENT
      ══════════════════════════════════════════════════ */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">

        {/* Header */}
        <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-[#1a1a1a] bg-[#0d0d0d] px-4">
          {/* Hamburger — mobile only */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={drawerOpen}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[#666] transition-colors hover:bg-[#1a1a1a] hover:text-white lg:hidden"
          >
            <Menu className="h-4 w-4" aria-hidden="true" />
          </button>

          {/* Desktop title */}
          <div className="hidden items-center gap-2 lg:flex">
            <span className="rounded-md border border-[#fbbf24]/30 bg-[#fbbf24]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-[#fbbf24]">
              ERP
            </span>
            <span className="text-sm font-semibold text-white">
              {role === 'ADMIN' ? 'Admin Portal' : 'Employee Portal'}
            </span>
          </div>

          {/* Right-side actions */}
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />
            <ProfileMenu />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
