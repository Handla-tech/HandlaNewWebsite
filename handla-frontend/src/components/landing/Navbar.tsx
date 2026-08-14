'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, LogIn, Globe, MessageSquare, LayoutDashboard, LogOut, Sun, Moon } from 'lucide-react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useUIStore } from '@/store/uiStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuthStore } from '@/store/authStore';
import NotificationBell from '@/components/notifications/NotificationBell';
import ProfileMenu from '@/components/ui/ProfileMenu';
import { getInitials, getAvatarColor, cn } from '@/lib/utils';

// ─── Nav links ────────────────────────────────────────────────────────────────

// `type` distinguishes cross-page routes (Home, Projects) that use real
// <Link> navigation from same-page smooth-scroll anchors. Anchors carry both
// a `hash` (for scrolling when already on the landing page) and an `href`
// (`/#hash`) so they still work from other routes like /projects.
type NavLink =
  | { type: 'page';   href: string; key: string }
  | { type: 'anchor'; href: string; hash: string; key: string };

const NAV_KEYS: NavLink[] = [
  { type: 'page',   href: '/',           key: 'nav.home'      },
  { type: 'anchor', href: '/#about',     hash: '#about',      key: 'nav.about'     },
  { type: 'anchor', href: '/#services',  hash: '#services',   key: 'nav.services'  },
  { type: 'anchor', href: '/#solutions', hash: '#solutions',  key: 'nav.solutions' },
  { type: 'page',   href: '/projects',   key: 'nav.projects'  },
  { type: 'anchor', href: '/#contact',   hash: '#contact',    key: 'nav.contact'   },
];

// ─── Navbar ───────────────────────────────────────────────────────────────────

export default function Navbar() {
  const [scrolled,   setScrolled]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeLink, setActiveLink] = useState<string>('');

  const router = useRouter();
  const pathname = usePathname();
  const onLanding = pathname === '/';

  // ── Auth ─────────────────────────────────────────────────────────────────
  const { isLoggedIn, user, logout } = useAuthStore();
  const isAdmin = isLoggedIn && user?.role === 'ADMIN';

  // ── i18n ─────────────────────────────────────────────────────────────────
  const { t, locale, isRTL } = useTranslation();
  const setLocale             = useUIStore((s) => s.setLocale);
  const theme                 = useUIStore((s) => s.theme);
  const toggleTheme           = useUIStore((s) => s.toggleTheme);

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

  // ── Smooth-scroll handler for same-page anchors ───────────────────────────
  //
  // When already on the landing page ("/"), intercept the click and smooth
  // scroll. When on another route (e.g. /projects), let the browser follow
  // the `/#hash` href so Next.js navigates home and the browser jumps to the
  // section — no preventDefault in that case.
  const handleAnchorClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, hash: string) => {
      if (!onLanding) {
        setMobileOpen(false);
        return; // allow default navigation to /#hash
      }
      e.preventDefault();
      setMobileOpen(false);
      setActiveLink(hash);
      const el = document.querySelector(hash);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    [onLanding],
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
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled
            ? 'bg-[#080808]/98 backdrop-blur-2xl'
            : 'bg-transparent'
        }`}
      >
        {/* Gold accent bottom border — appears on scroll */}
        <motion.div
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(251,191,36,0.3) 30%, rgba(251,191,36,0.5) 50%, rgba(251,191,36,0.3) 70%, transparent 100%)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: scrolled ? 1 : 0 }}
          transition={{ duration: 0.4 }}
        />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">

            {/* ── Logo ──────────────────────────────────────────────────── */}
            <Link href="/" className="flex items-center group" aria-label="Handla — Home">
              <motion.span
                className="font-mono font-bold text-lg tracking-tight"
                whileHover={{ scale: 1.03 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              >
                <span className="text-white">&lt;Handla </span>
                <span
                  className="transition-all duration-300"
                  style={{ color: '#fbbf24', textShadow: '0 0 20px rgba(251,191,36,0.6)' }}
                >/</span>
                <span className="text-white">&gt;</span>
              </motion.span>
            </Link>

            {/* ── Desktop nav ───────────────────────────────────────────── */}
            <nav className="hidden md:flex items-center gap-1" aria-label="Primary navigation">
              {NAV_KEYS.map((link) => {
                // Active state: pages match the current pathname; anchors match
                // the last-clicked hash (only meaningful on the landing page).
                const isActive =
                  link.type === 'page'
                    ? pathname === link.href
                    : onLanding && activeLink === link.hash;

                const className = `relative px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 group ${
                  isRTL ? 'font-[family-name:var(--font-space-grotesk)]' : ''
                } ${isActive ? 'text-white' : 'text-[#707070] hover:text-white'}`;

                const inner = (
                  <>
                    <span
                      className={`absolute inset-0 rounded-lg transition-all duration-200 ${
                        isActive
                          ? 'bg-white/[0.06]'
                          : 'opacity-0 group-hover:opacity-100 bg-white/[0.04]'
                      }`}
                    />
                    <span className="relative">{t(link.key)}</span>
                    {isActive && (
                      <motion.span
                        layoutId="nav-active-dot"
                        className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                        style={{ background: '#fbbf24', boxShadow: '0 0 6px #fbbf24' }}
                      />
                    )}
                  </>
                );

                return link.type === 'page' ? (
                  <Link key={link.href} href={link.href} className={className}>
                    {inner}
                  </Link>
                ) : (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={(e) => handleAnchorClick(e, link.hash)}
                    className={className}
                  >
                    {inner}
                  </a>
                );
              })}
            </nav>

            {/* ── Right controls ────────────────────────────────────────── */}
            <div className="hidden md:flex items-center gap-1">

              {/* Theme toggle */}
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={t('common.theme.toggle')}
                title={t('common.theme.toggle')}
                className="flex items-center justify-center w-[44px] h-[44px] text-[#707070] hover:text-white rounded-lg hover:bg-white/[0.04] transition-all duration-200"
              >
                {theme === 'dark'
                  ? <Sun className="w-4 h-4" aria-hidden="true" />
                  : <Moon className="w-4 h-4" aria-hidden="true" />}
              </button>

              {/* Locale toggle */}
              <button
                type="button"
                onClick={toggleLocale}
                aria-label={t('common.language.toggle')}
                className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] text-sm font-medium text-[#707070] hover:text-white rounded-lg hover:bg-white/[0.04] transition-all duration-200"
              >
                <Globe className="w-4 h-4" aria-hidden="true" />
                <span>{locale === 'en' ? t('common.language.ar') : t('common.language.en')}</span>
              </button>

              {/* Vertical separator */}
              <div className="w-px h-5 mx-1" style={{ background: 'var(--ov-strong)' }} />

              {isLoggedIn ? (
                /* ── Authenticated — bell + profile icon ── */
                <div className="flex items-center gap-1">
                  <NotificationBell />
                  <ProfileMenu />
                </div>
              ) : (
                /* ── Unauthenticated ── */
                <Link
                  href="/auth"
                  className="flex items-center gap-1.5 px-4 py-2 min-h-[44px] text-sm font-semibold rounded-lg transition-all duration-200"
                  style={{
                    background: 'rgba(251,191,36,0.1)',
                    border: '1px solid rgba(251,191,36,0.2)',
                    color: '#fbbf24',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(251,191,36,0.15)';
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 0 20px rgba(251,191,36,0.15)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(251,191,36,0.1)';
                    (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                  }}
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
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-[#707070] hover:text-white rounded-lg hover:bg-white/[0.05] transition-colors"
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label={mobileOpen ? t('common.close') : 'Open navigation menu'}
                aria-expanded={mobileOpen}
                aria-controls="mobile-nav"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {mobileOpen ? (
                    <motion.span
                      key="close"
                      initial={{ rotate: -90, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      exit={{ rotate: 90, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <X className="w-5 h-5" aria-hidden="true" />
                    </motion.span>
                  ) : (
                    <motion.span
                      key="menu"
                      initial={{ rotate: 90, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      exit={{ rotate: -90, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <Menu className="w-5 h-5" aria-hidden="true" />
                    </motion.span>
                  )}
                </AnimatePresence>
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
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
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
              className={`fixed top-0 bottom-0 z-50 w-72 flex flex-col ${
                isRTL ? 'left-0' : 'right-0'
              }`}
              style={{
                background: 'var(--surface-1)',
                borderLeft: isRTL ? 'none' : '1px solid var(--ov-med)',
                borderRight: isRTL ? '1px solid var(--ov-med)' : 'none',
              }}
            >
              {/* Gold top accent */}
              <div
                className="absolute top-0 left-0 right-0 h-px"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(251,191,36,0.4), transparent)' }}
              />

              {/* Drawer header */}
              <div
                className="flex items-center justify-between px-6 py-5"
                style={{ borderBottom: '1px solid var(--ov-med)' }}
              >
                <span className="font-mono font-bold text-lg tracking-tight">
                  <span className="text-white">&lt;Handla </span>
                  <span style={{ color: '#fbbf24' }}>/</span>
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
                  style={{
                    background: 'rgba(251,191,36,0.05)',
                    border: '1px solid rgba(251,191,36,0.12)',
                  }}
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
                    <p className="text-[10px] truncate mt-0.5" style={{ color: 'var(--ink-6)' }}>{user.email}</p>
                    <span
                      className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
                      style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24' }}
                    >
                      {isAdmin ? 'Admin' : 'Client'}
                    </span>
                  </div>
                </div>
              )}

              {/* Nav links */}
              <div className="flex-1 px-4 py-5 space-y-0.5 overflow-y-auto">
                {NAV_KEYS.map((link, i) => {
                  const isActive =
                    link.type === 'page'
                      ? pathname === link.href
                      : onLanding && activeLink === link.hash;

                  const style = {
                    color: isActive ? '#fbbf24' : 'var(--ink-3)',
                    background: isActive ? 'rgba(251,191,36,0.06)' : 'transparent',
                  };
                  const onEnter = (e: React.MouseEvent<HTMLElement>) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.color = 'var(--ink-1)';
                      (e.currentTarget as HTMLElement).style.background = 'var(--ov-soft)';
                    }
                  };
                  const onLeave = (e: React.MouseEvent<HTMLElement>) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.color = 'var(--ink-3)';
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }
                  };
                  const cls =
                    'flex items-center px-4 py-3 min-h-[44px] text-sm font-medium rounded-xl transition-all duration-200';

                  return link.type === 'page' ? (
                    <motion.div
                      key={link.href}
                      initial={{ opacity: 0, x: isRTL ? -20 : 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <Link
                        href={link.href}
                        onClick={() => setMobileOpen(false)}
                        className={cls}
                        style={style}
                        onMouseEnter={onEnter}
                        onMouseLeave={onLeave}
                      >
                        {t(link.key)}
                      </Link>
                    </motion.div>
                  ) : (
                    <motion.a
                      key={link.href}
                      href={link.href}
                      onClick={(e) => handleAnchorClick(e, link.hash)}
                      initial={{ opacity: 0, x: isRTL ? -20 : 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={cls}
                      style={style}
                      onMouseEnter={onEnter}
                      onMouseLeave={onLeave}
                    >
                      {t(link.key)}
                    </motion.a>
                  );
                })}

                {/* ── Authenticated: dashboard + sign-out ── */}
                {isLoggedIn && (
                  <div
                    className="pt-3 mt-2 space-y-1"
                    style={{ borderTop: '1px solid var(--ov-soft)' }}
                  >
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
                        style={{ background: 'rgba(239,68,68,0.08)' }}
                      >
                        <LogOut className="w-3.5 h-3.5 text-[#f87171]" />
                      </span>
                      <span>Sign out</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Drawer footer */}
              <div
                className="px-4 py-5 space-y-2"
                style={{ borderTop: '1px solid var(--ov-soft)' }}
              >
                <button
                  type="button"
                  onClick={toggleTheme}
                  aria-label={t('common.theme.toggle')}
                  className="w-full flex items-center gap-2 px-4 py-3 min-h-[44px] text-sm text-[#a0a0a0] hover:text-white rounded-xl hover:bg-white/5 transition-colors"
                >
                  {theme === 'dark'
                    ? <Sun className="w-4 h-4" aria-hidden="true" />
                    : <Moon className="w-4 h-4" aria-hidden="true" />}
                  <span>{theme === 'dark' ? t('common.theme.light') : t('common.theme.dark')}</span>
                </button>

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
                    className="flex items-center gap-2 px-4 py-3 min-h-[44px] text-sm font-semibold rounded-xl transition-all duration-200"
                    style={{
                      background: 'rgba(251,191,36,0.08)',
                      border: '1px solid rgba(251,191,36,0.15)',
                      color: '#fbbf24',
                    }}
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
