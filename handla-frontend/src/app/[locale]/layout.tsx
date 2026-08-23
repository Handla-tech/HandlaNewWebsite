import { notFound } from 'next/navigation';
import { LocaleProvider } from '@/i18n/LocaleProvider';
import { isLocale, LOCALES, type Locale } from '@/i18n/config';

/**
 * Locale segment layout for all PUBLIC SEO pages (/en/…, /ar/…).
 *
 * Responsibilities:
 *   • Validate the {locale} param (anything other than en|ar → 404).
 *   • Provide the URL locale to client components via <LocaleProvider>, so the
 *     shared useTranslation() hook resolves the correct language on the FIRST
 *     server render (Arabic HTML for /ar/*, English for /en/*). No dependency
 *     on localStorage / Zustand for indexable content.
 *
 * <html lang/dir> is set by the ROOT layout from the same URL locale (via the
 * middleware `x-pathname` header), so this layout adds no extra DOM wrapper.
 *
 * `generateStaticParams` lets Next prerender both locales.
 */
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  // Next.js 15: dynamic route params are async and must be awaited.
  params: Promise<{ locale: string }>;
}) {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale = localeParam as Locale;

  return <LocaleProvider locale={locale}>{children}</LocaleProvider>;
}
