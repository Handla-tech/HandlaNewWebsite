'use client';

import Link from 'next/link';
import { useTranslation } from '@/hooks/useTranslation';

// ─── Nav link keys ────────────────────────────────────────────────────────────

const LINK_KEYS: { href: string; key: string }[] = [
  { href: '#about',     key: 'nav.about'    },
  { href: '#services',  key: 'nav.services' },
  { href: '#solutions', key: 'nav.solutions'},
  { href: '#process',   key: 'nav.process'  },
  { href: '#contact',   key: 'nav.contact'  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function Footer() {
  const { t } = useTranslation();
  const year   = new Date().getFullYear();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <footer
      role="contentinfo"
      className="relative"
      style={{ borderTop: '1px solid #1a1a1a' }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">

          {/* Logo */}
          <Link href="/" className="flex items-center group" aria-label="Handla — Home">
            <span className="font-mono font-bold text-sm tracking-tight">
              <span className="text-white">&lt;Handla </span><span className="text-[#fbbf24]">/</span><span className="text-white">&gt;</span>
            </span>
          </Link>

          {/* Nav links */}
          <nav
            className="flex items-center flex-wrap gap-x-6 gap-y-2 justify-center"
            aria-label="Footer navigation"
          >
            {LINK_KEYS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => handleClick(e, link.href)}
                className="text-sm transition-colors py-1 min-h-[44px] flex items-center"
                style={{ color: '#666' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#666')}
              >
                {t(link.key)}
              </a>
            ))}
          </nav>

          {/* Copyright */}
          <p className="text-xs" style={{ color: '#444' }}>
            {t('footer.copyright', { year: String(year) })}
          </p>

        </div>
      </div>
    </footer>
  );
}
