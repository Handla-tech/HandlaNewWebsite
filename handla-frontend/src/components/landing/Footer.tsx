'use client';

import Link from 'next/link';
import { useTranslation } from '@/hooks/useTranslation';

// ─── Nav links ────────────────────────────────────────────────────────────────

const LINK_KEYS: { href: string; key: string }[] = [
  { href: '#about',     key: 'nav.about'    },
  { href: '#services',  key: 'nav.services' },
  { href: '/projects',  key: 'nav.projects' },
  { href: '/products',  key: 'nav.products' },
  { href: '#contact',   key: 'nav.contact'  },
];

// ─── Inline social icons ──────────────────────────────────────────────────────

function SocialIcon({ label }: { label: string }) {
  switch (label) {
    case 'X':
      return <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>;
    case 'LinkedIn':
      return <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2zM4 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/></svg>;
    case 'GitHub':
      return <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>;
    default:
      return null;
  }
}

const SOCIALS = [
  { label: 'X',        href: '#' },
  { label: 'LinkedIn', href: '#' },
  { label: 'GitHub',   href: '#' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function Footer() {
  const { t } = useTranslation();
  const year   = new Date().getFullYear();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    // In-page hash links → smooth-scroll. Page routes (e.g. /projects) → let
    // the browser navigate normally.
    if (!href.startsWith('#')) return;
    e.preventDefault();
    document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <footer
      role="contentinfo"
      className="relative overflow-hidden"
      style={{ background: 'var(--page-bg)' }}
    >
      {/* Gold top separator */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(251,191,36,0.2) 30%, rgba(251,191,36,0.3) 50%, rgba(251,191,36,0.2) 70%, transparent)' }}
      />

      {/* Subtle ambient glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-32 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(251,191,36,0.04) 0%, transparent 70%)' }}
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* ── Top row: logo + nav + socials ──────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 py-8">

          {/* Logo */}
          <Link href="/" className="flex items-center group flex-shrink-0" aria-label="Handla — Home">
            <span className="font-mono font-bold text-base tracking-tight">
              <span className="text-white">&lt;Handla </span>
              <span
                className="transition-all duration-300"
                style={{ color: '#fbbf24' }}
              >/</span>
              <span className="text-white">&gt;</span>
            </span>
          </Link>

          {/* Nav links */}
          <nav
            className="flex items-center flex-wrap gap-x-5 gap-y-2 justify-center"
            aria-label="Footer navigation"
          >
            {LINK_KEYS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => handleClick(e, link.href)}
                className="text-sm transition-colors py-1 min-h-[44px] flex items-center"
                style={{ color: 'var(--ink-3)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#fbbf24')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-3)')}
              >
                {t(link.key)}
              </a>
            ))}
          </nav>

          {/* Social icons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {SOCIALS.map(({ label, href }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200"
                style={{
                  background: 'var(--ov-soft)',
                  border: '1px solid var(--ov-med)',
                  color: 'var(--ink-3)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.color = '#fbbf24';
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(251,191,36,0.25)';
                  (e.currentTarget as HTMLElement).style.background = 'rgba(251,191,36,0.06)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color = 'var(--ink-3)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--ov-med)';
                  (e.currentTarget as HTMLElement).style.background = 'var(--ov-soft)';
                }}
              >
                <SocialIcon label={label} />
              </a>
            ))}
          </div>
        </div>

        {/* ── Bottom bar ─────────────────────────────────────────────────── */}
        <div
          className="flex flex-col sm:flex-row items-center justify-between gap-3 py-4"
          style={{ borderTop: '1px solid var(--ov-soft)' }}
        >
          <p className="text-xs" style={{ color: 'var(--ink-5)' }}>
            {t('footer.copyright', { year: String(year) })}
          </p>

          <div className="flex items-center gap-4">
            {['Privacy Policy', 'Terms of Service'].map((item) => (
              <a
                key={item}
                href="#"
                className="text-xs transition-colors"
                style={{ color: 'var(--ink-5)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink-2)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-5)')}
              >
                {item}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#22c55e', boxShadow: '0 0 4px rgba(34,197,94,0.6)' }} />
            <span className="text-xs" style={{ color: 'var(--ink-5)' }}>All systems operational</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
