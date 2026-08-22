import type { Metadata } from 'next';
import { LOCALES, ogLocale, type Locale } from '@/i18n/config';

/**
 * Centralised SEO metadata helpers for the public Handla pages.
 *
 * Builds fully-formed Next.js App Router `Metadata` objects for the localized
 * `/[locale]/…` routes with:
 *   • a self-referencing canonical (per locale, never cross-canonical),
 *   • reciprocal hreflang alternates (en, ar, x-default → en),
 *   • matching Open Graph (localized og:locale + og:url == canonical) and
 *   • Twitter summary_large_image.
 *
 * Relative asset URLs (og:image) resolve against `metadataBase` (root layout →
 * https://handla.tech). Canonical/hreflang/og:url are emitted as absolute
 * locale paths.
 *
 * This module only affects <head> metadata — no UI/routing/robots changes.
 */

// Canonical production origin.
export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://handla.tech').replace(/\/$/, '');
export const SITE_NAME = 'Handla';

/**
 * Default branded social-preview image (1200×630). Product pages override this
 * with their real hero artwork. We never ship a low-quality placeholder.
 */
export const DEFAULT_OG_IMAGE = '/og-image.png';

/**
 * Build the absolute locale path for a given "sub-path".
 *   localePath('en', '/products')        → '/en/products'
 *   localePath('ar', '/')                → '/ar'
 *   localePath('en', '')                 → '/en'
 * The value is root-relative; Next resolves it to an absolute URL via
 * metadataBase for canonical/og:url/hreflang.
 */
export function localePath(locale: Locale, subPath = ''): string {
  const clean = subPath.replace(/^\/+/, '').replace(/\/+$/, '');
  return clean ? `/${locale}/${clean}` : `/${locale}`;
}

/**
 * Reciprocal hreflang map for a sub-path shared across locales.
 * x-default points at the English/default equivalent (Part 5).
 */
export function languageAlternates(subPath = ''): Record<string, string> {
  const map: Record<string, string> = {};
  for (const l of LOCALES) map[l] = localePath(l, subPath);
  map['x-default'] = localePath('en', subPath);
  return map;
}

interface LocalizedSeoInput {
  locale: Locale;
  /** Shared sub-path WITHOUT the locale prefix, e.g. '/products/manarah' or ''. */
  subPath?: string;
  /** Localized <title> (verbatim; bypasses the root title.template). */
  title: string;
  description: string;
  /** Optional page-specific OG image (root-relative or absolute). */
  image?: string;
  imageWidth?: number;
  imageHeight?: number;
}

/**
 * Build a complete, locale-aware Metadata object for a public /[locale]/… page:
 * self-canonical + reciprocal hreflang + localized Open Graph + Twitter.
 */
export function buildLocaleMetadata({
  locale,
  subPath = '',
  title,
  description,
  image = DEFAULT_OG_IMAGE,
  imageWidth = 1200,
  imageHeight = 630,
}: LocalizedSeoInput): Metadata {
  const canonical = localePath(locale, subPath);

  return {
    title: { absolute: title },
    description,
    alternates: {
      canonical,
      languages: languageAlternates(subPath),
    },
    openGraph: {
      type:     'website',
      siteName: SITE_NAME,
      title,
      description,
      url:      canonical,
      locale:   ogLocale(locale),
      alternateLocale: locale === 'en' ? ['ar_SA'] : ['en_US'],
      images: [{ url: image, width: imageWidth, height: imageHeight, alt: title }],
    },
    twitter: {
      card:        'summary_large_image',
      title,
      description,
      images:      [image],
    },
  };
}

// ─── Legacy (non-localized) builder ────────────────────────────────────────
// Retained only for any transitional callers. New localized routes use
// buildLocaleMetadata above. Kept identical to the previous behaviour.
interface PageSeoInput {
  title: string;
  description: string;
  path: string;
  image?: string;
  imageWidth?: number;
  imageHeight?: number;
}

export function buildPageMetadata({
  title,
  description,
  path,
  image = DEFAULT_OG_IMAGE,
  imageWidth = 1200,
  imageHeight = 630,
}: PageSeoInput): Metadata {
  const canonicalPath = path === '/' ? '/' : path;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      type:     'website',
      siteName: SITE_NAME,
      title,
      description,
      url:      canonicalPath,
      locale:   'en_US',
      alternateLocale: ['ar_SA'],
      images: [{ url: image, width: imageWidth, height: imageHeight, alt: title }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}
