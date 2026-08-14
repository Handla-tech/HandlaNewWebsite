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
  Zap,
  BookOpen,
  Truck,
  ShoppingCart,
  FileSignature,
  LifeBuoy,
  BarChart3,
  LineChart,
  Server,
  Bot,
  FolderGit2,
  Package,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import NotificationBell from '@/components/notifications/NotificationBell';
import ProfileMenu from '@/components/ui/ProfileMenu';
import LanguageSwitcher from '@/components/ui/LanguageSwitcher';
import ThemeSwitcher from '@/components/ui/ThemeSwitcher';
import { getInitials, getAvatarColor, cn } from '@/lib/utils';

// ─── Role badge colours ────────────────────────────────────────────────────────

const ROLE_COLOURS: Record<string, string> = {
  ADMIN:    'border-[#fbbf24]/40 bg-[#fbbf24]/15 text-[#fbbf24]',
  EMPLOYEE: 'border-blue-400/40 bg-blue-400/15 text-blue-400',
};

// ─── Nav items ────────────────────────────────────────────────────────────────

type NavItem = {
  href:       string;
  icon:       React.ComponentType<{ className?: string }>;
  /** Translation key under erp.sidebar.items */
  labelKey:   string;
  adminOnly?: boolean;
};

type NavSection = {
  /** Translation key under erp.sidebar.sections */
  titleKey: string;
  items:    NavItem[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    titleKey: 'workspace',
    items: [
      { href: '/erp',            icon: LayoutDashboard, labelKey: 'dashboard' },
      { href: '/erp/messages',   icon: MessageSquare,   labelKey: 'messages'  },
      { href: '/erp/clients',    icon: Briefcase,       labelKey: 'clients'   },
      { href: '/erp/projects',   icon: FolderOpen,      labelKey: 'projects'  },
      { href: '/erp/tasks',      icon: CheckSquare,     labelKey: 'tasks'     },
    ],
  },
  {
    titleKey: 'sales',
    items: [
      { href: '/erp/quotations', icon: FileSignature,   labelKey: 'quotations' },
      { href: '/erp/contracts',  icon: FileText,        labelKey: 'contracts'  },
      { href: '/erp/invoices',   icon: Receipt,         labelKey: 'invoices'   },
    ],
  },
  {
    titleKey: 'finance',
    items: [
      { href: '/erp/accounting', icon: BookOpen,        labelKey: 'accounting' },
      { href: '/erp/expenses',   icon: DollarSign,      labelKey: 'expenses'   },
      { href: '/erp/suppliers',  icon: Truck,           labelKey: 'suppliers'  },
      { href: '/erp/purchases',  icon: ShoppingCart,    labelKey: 'purchases'  },
    ],
  },
  {
    titleKey: 'operations',
    items: [
      { href: '/erp/support',    icon: LifeBuoy,        labelKey: 'support'   },
      { href: '/erp/ai',         icon: Bot,             labelKey: 'ai'        },
      { href: '/erp/reports',    icon: BarChart3,       labelKey: 'reports'   },
      { href: '/erp/analytics',  icon: LineChart,       labelKey: 'analytics' },
    ],
  },
  {
    titleKey: 'website',
    items: [
      { href: '/erp/website/projects', icon: FolderGit2, labelKey: 'websiteProjects', adminOnly: true },
      { href: '/erp/website/products', icon: Package,    labelKey: 'websiteProducts', adminOnly: true },
      { href: '/erp/testimonials',     icon: Star,       labelKey: 'testimonials',    adminOnly: true },
    ],
  },
  {
    titleKey: 'admin',
    items: [
      { href: '/erp/saas',         icon: Server, labelKey: 'saas',         adminOnly: true },
      { href: '/erp/users',        icon: Users,  labelKey: 'users',        adminOnly: true },
    ],
  },
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
  const { t, isRTL } = useTranslation();

  return (
    <div className="flex h-full flex-col">
      {/* ── Logo + ERP pill ────────────────────────────────────────────── */}
      <div className="flex items-center border-b border-white/[0.06] px-5 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#fbbf24] to-[#f59e0b] shadow-lg shadow-[#fbbf24]/20">
            <Zap className="h-4 w-4 text-black" />
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight text-white">Handla</span>
            <span className="ml-1.5 rounded-md border border-[#fbbf24]/30 bg-[#fbbf24]/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-[#fbbf24]">
              ERP
            </span>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-white/30 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── Nav links ──────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {NAV_SECTIONS.map((section) => {
          const items = section.items.filter(item => isAdmin || !item.adminOnly);
          if (items.length === 0) return null;
          return (
            <div key={section.titleKey}>
              <p className="px-2 pb-2.5 text-[10px] font-semibold uppercase tracking-widest text-white/20">
                {t(`erp.sidebar.sections.${section.titleKey}`)}
              </p>
              <div className="space-y-0.5">
                {items.map(({ href, icon: Icon, labelKey }) => {
                  const isActive = href === '/erp' ? pathname === '/erp' : pathname.startsWith(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={onClose}
                      className={cn(
                        'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
                        isActive
                          ? 'border border-[#fbbf24]/20 bg-gradient-to-r from-[#fbbf24]/15 to-[#fbbf24]/5 text-[#fbbf24] shadow-sm'
                          : 'border border-transparent text-white/50 hover:border-white/[0.08] hover:bg-white/[0.06] hover:text-white',
                      )}
                    >
                      <span className={cn(
                        'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg transition-all',
                        isActive
                          ? 'bg-[#fbbf24]/20 text-[#fbbf24]'
                          : 'text-white/40 group-hover:text-white',
                      )}>
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      {t(`erp.sidebar.items.${labelKey}`)}
                      {isActive && (
                        <ChevronRight className={cn('ml-auto h-3 w-3 text-[#fbbf24]/60', isRTL && 'rotate-180')} />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* ── User card + logout ─────────────────────────────────────────── */}
      <div className="border-t border-white/[0.06] p-3 space-y-1">
        {user && (
          <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 backdrop-blur-sm">
            <div
              className={cn(
                'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ring-2 ring-black/20',
                getAvatarColor(user.id),
              )}
            >
              {getInitials(user.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">{user.name}</p>
              <p className="truncate text-[10px] text-white/30">{user.email}</p>
            </div>
            <span
              className={cn(
                'rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
                ROLE_COLOURS[role] ?? 'border-white/10 bg-white/5 text-white/40',
              )}
            >
              {role}
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/40 transition-all hover:bg-red-500/10 hover:text-red-400 border border-transparent hover:border-red-500/20"
        >
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg">
            <LogOut className={cn('h-3.5 w-3.5', isRTL && 'rotate-180')} />
          </span>
          {t('erp.sidebar.signOut')}
        </button>

        <Link
          href="/"
          onClick={onClose}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/40 transition-all hover:bg-[#fbbf24]/5 hover:text-[#fbbf24] border border-transparent hover:border-[#fbbf24]/10"
        >
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg">
            <Home className="h-3.5 w-3.5" />
          </span>
          {t('erp.sidebar.backToWebsite')}
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
  const { t, isRTL } = useTranslation();
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
      <div className="flex h-screen items-center justify-center bg-[#080808]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-10 w-10">
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-white/5 border-t-[#fbbf24]" />
            <div className="absolute inset-2 rounded-full bg-[#fbbf24]/10" />
          </div>
          <p className="text-xs font-medium text-white/30">{t('erp.sidebar.loadingErp')}</p>
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
    <div className="flex h-screen overflow-hidden bg-[#080808]">

      {/* ══════════════════════════════════════════════════
          DESKTOP SIDEBAR — w-64
      ══════════════════════════════════════════════════ */}
      <aside className={cn(
        'hidden w-64 flex-shrink-0 flex-col border-white/[0.06] bg-[#0c0c0c] lg:flex',
        isRTL ? 'border-l' : 'border-r',
      )}>
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
              className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm lg:hidden"
              onClick={() => setDrawerOpen(false)}
            />
            <motion.aside
              key="drawer"
              initial={{ x: isRTL ? '100%' : '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: isRTL ? '100%' : '-100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className={cn(
                'fixed inset-y-0 z-50 w-64 border-white/[0.06] bg-[#0c0c0c] lg:hidden',
                isRTL ? 'right-0 border-l' : 'left-0 border-r',
              )}
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
        <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#0c0c0c]/80 px-4 backdrop-blur-md">
          {/* Hamburger — mobile only */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label={t('erp.sidebar.openMenu')}
            aria-expanded={drawerOpen}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white lg:hidden"
          >
            <Menu className="h-4 w-4" aria-hidden="true" />
          </button>

          {/* Desktop title */}
          <div className="hidden items-center gap-3 lg:flex">
            <div className="h-4 w-px bg-white/10" />
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-[#fbbf24] shadow-sm shadow-[#fbbf24]/50" />
              <span className="text-sm font-semibold text-white/80">
                {role === 'ADMIN' ? t('erp.sidebar.adminPortal') : t('erp.sidebar.employeePortal')}
              </span>
            </div>
          </div>

          {/* Right-side actions */}
          <div className="ms-auto flex items-center gap-2">
            <ThemeSwitcher />
            <LanguageSwitcher />
            <NotificationBell />
            <ProfileMenu />
          </div>
        </header>

        {/* Page content — min-h-0 lets flex shrink work; inner div scrolls.
            Do NOT add overflow:hidden here — it would clip portal-rendered
            dropdowns that use position:fixed + document.body portal. */}
        <main className="flex-1 min-h-0">
          <div className="h-full overflow-auto p-4 sm:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
