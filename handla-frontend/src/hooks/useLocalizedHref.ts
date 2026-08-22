'use client';

/**
 * useLocalizedHref — build locale-prefixed hrefs for public navigation.
 *
 * Reads the active locale from the same source as useTranslation (URL context
 * on public pages, uiStore fallback elsewhere) and prefixes root-relative
 * public paths with /{locale}.
 *
 *   const lh = useLocalizedHref();
 *   lh('/products')            → '/en/products' | '/ar/products'
 *   lh('/')                    → '/en'          | '/ar'
 *   lh('/#contact')            → '/en#contact'  | '/ar#contact'
 *
 * Non-public / already-localized / external / hash-only / auth paths are
 * returned unchanged so private routes (/auth, /dashboard, …) are never
 * accidentally localized.
 */

import { useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useUIStore } from '@/store/uiStore';
import { useLocaleContext } from '@/i18n/LocaleProvider';
import { LOCALES, otherLocale, switchLocalePath, type Locale } from '@/i18n/config';

// Root-relative paths that must NEVER be locale-prefixed (private app routes).
const NON_LOCALIZED_PREFIXES = [
  '/auth',
  '/dashboard',
  '/erp',
  '/profile',
  '/settings',
  '/contract',
  '/invoice',
  '/quotation',
];

export function useLocalizedHref() {
  const urlLocale = useLocaleContext();
  const storeLocale = useUIStore((s) => s.locale) as Locale;
  const locale: Locale = urlLocale ?? storeLocale;

  return useCallback(
    (href: string): string => {
      if (!href) return href;

      // External, protocol-relative, mail/tel, or pure-hash links: leave as-is.
      if (/^([a-z]+:)?\/\//i.test(href) || /^(mailto:|tel:|#)/i.test(href)) {
        return href.startsWith('#') ? `/${locale}${href}` : href;
      }

      // Only touch root-relative paths.
      if (!href.startsWith('/')) return href;

      // Already locale-prefixed (/en… or /ar…): leave as-is.
      const firstSeg = href.split(/[/?#]/).filter(Boolean)[0];
      if (LOCALES.includes(firstSeg as Locale)) return href;

      // Private app routes: never localize.
      if (NON_LOCALIZED_PREFIXES.some((p) => href === p || href.startsWith(`${p}/`) || href.startsWith(`${p}#`) || href.startsWith(`${p}?`))) {
        return href;
      }

      // Home '/' → '/{locale}', preserving any hash/query.
      if (href === '/') return `/${locale}`;
      if (href.startsWith('/#') || href.startsWith('/?')) return `/${locale}${href.slice(1)}`;

      return `/${locale}${href}`;
    },
    [locale],
  );
}

export function useCurrentLocale(): Locale {
  const urlLocale = useLocaleContext();
  const storeLocale = useUIStore((s) => s.locale) as Locale;
  return urlLocale ?? storeLocale;
}

/**
 * useLocaleSwitch — returns a callback that switches to the *other* locale.
 *
 * On public routes (URL-driven locale via LocaleProvider) it NAVIGATES to the
 * equivalent locale URL, e.g. /en/products/manarah → /ar/products/manarah,
 * preserving query + hash. The uiStore locale is kept in sync so any
 * store-driven UI reflects the change without a flash.
 *
 * On private routes (no LocaleProvider context) it falls back to the original
 * store toggle (setLocale) so /dashboard, /erp, … keep their client-side
 * language switch behavior unchanged.
 */
export function useLocaleSwitch() {
  const urlLocale = useLocaleContext();
  const storeLocale = useUIStore((s) => s.locale) as Locale;
  const setLocale = useUIStore((s) => s.setLocale);
  const router = useRouter();
  const pathname = usePathname();

  const current: Locale = urlLocale ?? storeLocale;
  const next = otherLocale(current);

  const switchLocale = useCallback(() => {
    if (urlLocale) {
      // Public URL-driven route → navigate to the equivalent locale URL.
      const targetPath = switchLocalePath(pathname || `/${urlLocale}`, next);
      // Keep store in sync so store-driven consumers don't lag.
      setLocale(next);
      const search = typeof window !== 'undefined' ? window.location.search : '';
      const hash = typeof window !== 'undefined' ? window.location.hash : '';
      router.push(`${targetPath}${search}${hash}`);
    } else {
      // Private route → client-side store toggle (legacy behavior).
      setLocale(next);
    }
  }, [urlLocale, pathname, next, setLocale, router]);

  return { current, next, switchLocale };
}
