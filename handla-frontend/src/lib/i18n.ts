/**
 * i18n configuration for Handla.
 *
 * Strategy: next-i18next for App Router / Pages Router hybrid.
 * Locale files live at: public/locales/{en|ar}/common.json
 * Default locale: 'en'
 * Supported locales: ['en', 'ar']
 *
 * RTL is activated by setting <html dir="rtl"> when locale === 'ar'.
 * The uiStore.setLocale() and the root layout.tsx handle this automatically.
 */

export const i18nConfig = {
  defaultLocale: 'en' as const,
  locales: ['en', 'ar'] as const,
  localePath: 'public/locales',
  defaultNS: 'common',
  ns: ['common'],
  reloadOnPrerender: process.env.NODE_ENV === 'development',
} as const;

export type SupportedLocale = (typeof i18nConfig.locales)[number];

export const RTL_LOCALES: SupportedLocale[] = ['ar'];

/** Returns true if the given locale uses right-to-left text direction. */
export function isRTL(locale: SupportedLocale): boolean {
  return RTL_LOCALES.includes(locale);
}

/** Returns the HTML `dir` attribute value for the given locale. */
export function getDir(locale: SupportedLocale): 'ltr' | 'rtl' {
  return isRTL(locale) ? 'rtl' : 'ltr';
}

/** Returns the HTML `lang` attribute value for the given locale. */
export function getLang(locale: SupportedLocale): string {
  const langMap: Record<SupportedLocale, string> = {
    en: 'en',
    ar: 'ar',
  };
  return langMap[locale];
}

/**
 * next-i18next config object — consumed by next-i18next.config.js if needed.
 * When using App Router directly, import i18nConfig above.
 */
export const nextI18NextConfig = {
  i18n: {
    defaultLocale: i18nConfig.defaultLocale,
    locales: [...i18nConfig.locales],
  },
  defaultNS: i18nConfig.defaultNS,
  ns: [...i18nConfig.ns],
  localePath: i18nConfig.localePath,
  reloadOnPrerender: i18nConfig.reloadOnPrerender,
};

export default nextI18NextConfig;
