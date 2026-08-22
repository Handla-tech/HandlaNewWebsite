/**
 * i18n config — the single source of truth for Handla's supported locales.
 *
 * Public SEO pages live under /[locale]/… where locale ∈ { 'en', 'ar' }.
 * This module is import-safe from BOTH server and client components (no
 * 'use client', no browser globals) so route handlers, layouts, sitemap and
 * metadata builders can all share the same definitions.
 */

export const LOCALES = ['en', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

/** True when `value` is one of the supported locales. */
export function isLocale(value: string | undefined | null): value is Locale {
  return value === 'en' || value === 'ar';
}

/** Narrow an arbitrary string to a Locale, falling back to the default. */
export function toLocale(value: string | undefined | null): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Text direction for a locale. */
export function dirFor(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

/** BCP-47 `og:locale` value (e.g. en_US / ar_SA). */
export function ogLocale(locale: Locale): string {
  return locale === 'ar' ? 'ar_SA' : 'en_US';
}

/** The "other" locale — used by the language switcher. */
export function otherLocale(locale: Locale): Locale {
  return locale === 'ar' ? 'en' : 'ar';
}

/**
 * Given a public pathname whose first segment is a locale (e.g. /en/products/manarah),
 * return the equivalent pathname under `target` (e.g. /ar/products/manarah). If the
 * path is NOT locale-prefixed (a private route like /dashboard), it is returned
 * unchanged so the language switcher never rewrites private application paths.
 *
 * Query string and hash are preserved by the caller (this operates on pathname only).
 */
export function switchLocalePath(pathname: string, target: Locale): string {
  const parts = pathname.split('/'); // ['', 'en', 'products', ...]
  const first = parts[1];
  if (!isLocale(first)) {
    // Not a locale-prefixed public route — leave as-is (e.g. /dashboard, /auth).
    return pathname;
  }
  parts[1] = target;
  const rebuilt = parts.join('/');
  return rebuilt === '' ? `/${target}` : rebuilt;
}
