'use client';

/**
 * useTranslation — lightweight i18n hook for Handla
 *
 * Reads locale from uiStore (persisted to localStorage).
 * Loads the correct JSON from /public/locales/{locale}/common.json
 * at module-init time (bundled as static imports so no network round-trips).
 *
 * Usage:
 *   const { t, locale, isRTL } = useTranslation();
 *   t('nav.signIn')          // → "Sign In" | "تسجيل الدخول"
 *   t('footer.copyright', { year: '2026' })  // interpolates {{year}}
 */

import { useMemo } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useLocaleContext } from '@/i18n/LocaleProvider';

// ─── Static locale bundles ────────────────────────────────────────────────────
// Import at build time so they are bundled, not fetched at runtime.

import enStrings from '../../public/locales/en/common.json';
import arStrings from '../../public/locales/ar/common.json';

type LocaleStrings = typeof enStrings;
type Locale = 'en' | 'ar';

const BUNDLES: Record<Locale, LocaleStrings> = {
  en: enStrings,
  ar: arStrings as unknown as LocaleStrings,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve a dot-notation key against a nested object.
 * e.g. getNestedValue(obj, 'nav.signIn') → obj.nav.signIn
 */
function getNestedValue(obj: Record<string, unknown>, key: string): string {
  const parts = key.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current !== null && typeof current === 'object') {
      current = (current as Record<string, unknown>)[part];
    } else {
      return key; // key not found — return key as fallback
    }
  }

  return typeof current === 'string' ? current : key;
}

/**
 * Replace {{placeholder}} tokens in a string.
 * e.g. interpolate('Hello {{name}}!', { name: 'World' }) → 'Hello World!'
 */
function interpolate(
  str: string,
  params?: Record<string, string | number>,
): string {
  if (!params) return str;
  return str.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
    params[key] !== undefined ? String(params[key]) : `{{${key}}}`,
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTranslation() {
  // ── Locale resolution order ──────────────────────────────────────────────
  //  1. URL-driven LocaleProvider context (public /[locale]/… pages). This is
  //     a SERVER-known value passed as a prop, so the initial server render
  //     already produces the correct language — no localStorage dependency.
  //  2. uiStore (persisted) — fallback for private application routes
  //     (/auth, /dashboard, /erp, /profile) that render outside the provider.
  //
  // Selecting the store value unconditionally (then overriding) keeps the
  // Zustand subscription stable so private routes still re-render on toggle.
  const urlLocale   = useLocaleContext();
  const storeLocale = useUIStore((s) => s.locale) as Locale;
  const locale: Locale = urlLocale ?? storeLocale;
  const isRTL  = locale === 'ar';

  const bundle = BUNDLES[locale] ?? BUNDLES.en;

  /**
   * t(key, params?) — translate a dot-notation key with optional interpolation.
   *
   * Falls back to English if key is missing in the active locale.
   * Falls back to the raw key string if missing in both locales.
   */
  const t = useMemo(
    () =>
      (key: string, params?: Record<string, string | number>): string => {
        const str =
          getNestedValue(bundle as unknown as Record<string, unknown>, key) ??
          getNestedValue(BUNDLES.en as unknown as Record<string, unknown>, key) ??
          key;
        return interpolate(str, params);
      },
    [bundle],
  );

  return { t, locale, isRTL };
}
