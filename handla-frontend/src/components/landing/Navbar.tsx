'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, LogIn, Globe, MessageSquare, LayoutDashboard, LogOut } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/uiStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuthStore } from '@/store/authStore';
import NotificationBell from '@/components/notifications/NotificationBell';
import ProfileMenu from '@/components/ui/ProfileMenu';
import { getInitials, getAvatarColor, cn } from '@/lib/utils';

// ─── Nav links ────────────────────────────────────────────────────────────────

const NAV_KEYS: { href: string; key: string }[] = [
  { href: '#about',     key: 'nav.about'    },
  { href: '#services',  key: 'nav.services' },
  { href: '#solutions', key: 'nav.solutions'},
  { href: '#process',   key: 'nav.process'  },
  { href: '#contact',   key: 'nav.contact'  },
];

// ─── Navbar ───────────────────────────────────────────────────────────────────

export default function Navbar() {
  const [scrolled,   setScrolled]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const router = useRouter();

  // ── Auth ─────────────────────────────────────────────────────────────────
  const { isLoggedIn, user, logout } = useAuthStore();
  const isAdmin = isLoggedIn && user?.role === 'ADMIN';

  // ── i18n ─────────────────────────────────────────────────────────────────
  const { t, locale, isRTL } = useTranslation();
  const setLocale             = useUIStore((s) => s.setLocale);

  // ── Scroll detection ─────────────────────────────────────────────────────
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ── Close mobile drawer on Escape ────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileOpen) setMobileOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  // ── Smooth-scroll handler ─────────────────────────────────────────────────
  const handleNavClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      e.preventDefault();
      setMobileOpen(false);
      const el = document.querySelector(href);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    [],
  );

  // ── Locale toggle ────────────────────────────────────────────────────────
  const toggleLocale = useCallback(() => {
    setLocale(locale === 'en' ? 'ar' : 'en');
  }, [locale, setLocale]);

  // ── Mobile logout ────────────────────────────────────────────────────────
  const handleMobileLogout = useCallback(async () => {
    setMobileOpen(false);
    await logout();
    router.push('/');
  }, [logout, router]);

  const dashboardHref  = isAdmin ? '/erp' : '/dashboard';
  const dashboardLabel = isAdmin ? 'ERP Portal' : 'Go to Chat';
  const DashboardIcon  = isAdmin ? LayoutDashboard : MessageSquare;

  return (
    <>
      <header
        role="banner"
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-[#1e1e1e]'
            : 'bg-transparent'
        }`}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">

            {/* ── Logo ──────────────────────────────────────────────────── */}
            <Link href="/" className="flex items-center" aria-label="Handla — Home">
              <span className="font-mono font-bold text-lg tracking-tight">
                <span className="text-white">&lt;Handla </span>
                <span className="text-[#fbbf24]">/</span>
                <span className="text-white">&gt;</span>
              </span>
            </Link>

            {/* ── Desktop nav ───────────────────────────────────────────── */}
            <nav className="hidden md:flex items-center gap-1" aria-label="Primary navigation">
              {NAV_KEYS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  className={`px-4 py-2 text-sm font-medium text-[#a0a0a0] hover:text-white rounded-lg transition-colors duration-150 hover:bg-white/5 ${
                    isRTL ? 'font-[family-name:var(--font-space-grotesk)]' : ''
                  }`}
                >
                  {t(link.key)}
                </a>
              ))}
            </nav>

            {/* ── Right controls ────────────────────────────────────────── */}
            <div className="hidden md:flex items-center gap-2">

              {/* Locale toggle */}
              <button
                type="button"
                onClick={toggleLocale}
                aria-label={t('common.language.toggle')}
                className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] text-sm font-medium text-[#a0a0a0] hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              >
                <Globe className="w-4 h-4" aria-hidden="true" />
                <span>{locale === 'en' ? t('common.language.ar') : t('common.language.en')}</span>
              </button>

              {isLoggedIn ? (
                /* ── Authenticated — bell + profile icon ── */
                <div className="flex items-center gap-2">
                  <NotificationBell />
                  {/* Shared ProfileMenu — same person icon as in dashboard/erp,
                      same size as NotificationBell */}
                  <ProfileMenu />
                </div>
              ) : (
                /* ── Unauthenticated ── */
                <Link
                  href="/auth"
                  className="flex items-center gap-1.5 px-4 py-2 min-h-[44px] text-sm font-medium text-[#a0a0a0] hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                >
                  <LogIn className="w-4 h-4" aria-hidden="true" />
                  <span>{t('nav.signIn')}</span>
                </Link>
              )}
            </div>

            {/* ── Mobile: bell + hamburger ───────────────────────────────── */}
            <div className="md:hidden flex items-center gap-2">
              {isLoggedIn && <NotificationBell />}
              <button
                type="button"
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-[#a0a0a0] hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label={mobileOpen ? t('common.close') : 'Open navigation menu'}
                aria-expanded={mobileOpen}
                aria-controls="mobile-nav"
              >
                {mobileOpen
                  ? <X    className="w-5 h-5" aria-hidden="true" />
                  : <Menu className="w-5 h-5" aria-hidden="true" />}
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* ── Mobile drawer ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />

            {/* Drawer */}
            <motion.nav
              id="mobile-nav"
              role="navigation"
              aria-label="Mobile navigation"
              initial={{ x: isRTL ? '-100%' : '100%' }}
              animate={{ x: 0 }}
              exit={{ x: isRTL ? '-100%' : '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className={`fixed top-0 bottom-0 z-50 w-72 bg-[#111111] flex flex-col ${
                isRTL ? 'left-0 border-r border-[#1e1e1e]' : 'right-0 border-l border-[#1e1e1e]'
              }`}
            >
              {/* Drawer header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-[#1e1e1e]">
                <span className="font-mono font-bold text-lg tracking-tight">
                  <span className="text-white">&lt;Handla </span>
                  <span className="text-[#fbbf24]">/</span>
                  <span className="text-white">&gt;</span>
                </span>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label={t('common.close')}
                  className="p-1.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-[#666] hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                >
                  <X className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>

              {/* ── User info card (logged in) ── */}
              {isLoggedIn && user && (
                <div
                  className="mx-4 mt-3 rounded-xl px-3 py-3 flex items-center gap-3"
                  style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}
                >
                  <div
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white flex-shrink-0',
                      getAvatarColor(user.id),
                    )}
                  >
                    {getInitials(user.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white truncate">{user.name}</p>
                    <p className="text-[10px] truncate mt-0.5" style={{ color: '#666' }}>{user.email}</p>
                    <span
                      className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
                      style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}
                    >
                      {isAdmin ? 'Admin' : 'Client'}
                    </span>
                  </div>
                </div>
              )}

              {/* Nav links */}
              <div className="flex-1 px-4 py-5 space-y-0.5 overflow-y-auto">
                {NAV_KEYS.map((link, i) => (
                  <motion.a
                    key={link.href}
                    href={link.href}
                    onClick={(e) => handleNavClick(e, link.href)}
                    initial={{ opacity: 0, x: isRTL ? -20 : 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center px-4 py-3 min-h-[44px] text-sm font-medium text-[#a0a0a0] hover:text-white rounded-xl hover:bg-white/5 transition-colors"
                  >
                    {t(link.key)}
                  </motion.a>
                ))}

                {/* ── Authenticated: dashboard + sign-out ── */}
                {isLoggedIn && (
                  <div className="pt-3 mt-2 space-y-1" style={{ borderTop: '1px solid #1e1e1e' }}>
                    <Link
                      href={dashboardHref}
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 min-h-[44px] text-sm font-medium text-[#a0a0a0] hover:text-white rounded-xl hover:bg-white/5 transition-colors"
                    >
                      <span
                        className="flex h-7 w-7 items-center justify-center rounded-lg flex-shrink-0"
                        style={{ background: 'rgba(251,191,36,0.1)' }}
                      >
                        <DashboardIcon className="w-3.5 h-3.5" style={{ color: '#fbbf24' }} />
                      </span>
                      <span>{dashboardLabel}</span>
                    </Link>

                    <button
                      type="button"
                      onClick={handleMobileLogout}
                      className="flex items-center gap-3 w-full px-4 py-3 min-h-[44px] text-sm font-medium text-[#f87171] hover:text-white hover:bg-red-500/10 rounded-xl transition-colors"
                    >
                      <span
                        className="flex h-7 w-7 items-center justify-center rounded-lg flex-shrink-0"
                        style={{ background: 'rgba(239,68,68,0.1)' }}
                      >
                        <LogOut className="w-3.5 h-3.5 text-[#f87171]" />
                      </span>
                      <span>Sign out</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Drawer footer */}
              <div className="px-4 py-5 border-t border-[#1e1e1e] space-y-2">
                <button
                  type="button"
                  onClick={toggleLocale}
                  aria-label={t('common.language.toggle')}
                  className="w-full flex items-center gap-2 px-4 py-3 min-h-[44px] text-sm text-[#a0a0a0] hover:text-white rounded-xl hover:bg-white/5 transition-colors"
                >
                  <Globe className="w-4 h-4" aria-hidden="true" />
                  <span>{locale === 'en' ? t('common.language.ar') : t('common.language.en')}</span>
                </button>

                {!isLoggedIn && (
                  <Link
                    href="/auth"
                    className="flex items-center gap-2 px-4 py-3 min-h-[44px] text-sm text-[#a0a0a0] hover:text-white rounded-xl hover:bg-white/5 transition-colors"
                  >
                    <LogIn className="w-4 h-4" aria-hidden="true" />
                    <span>{t('nav.signIn')}</span>
                  </Link>
                )}
              </div>

            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
