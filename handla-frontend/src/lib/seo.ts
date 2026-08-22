import type { Metadata } from 'next';

/**
 * Centralised SEO metadata helpers for the public Handla pages.
 *
 * These build fully-formed Next.js App Router `Metadata` objects with a
 * self-referencing canonical + matching Open Graph / Twitter cards for each
 * public route. Relative URLs (canonical, og:url, og:image) are resolved by
 * Next.js against `metadataBase` (set in the root layout to
 * https://handla.tech), so they always render as absolute production URLs.
 *
 * NOTE: This module only affects <head> metadata — no UI, routing, robots,
 * sitemap, or canonical *behaviour* changes. Canonicals remain self-
 * referencing exactly as before.
 */

// Canonical production origin.
export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://handla.tech').replace(/\/$/, '');
export const SITE_NAME = 'Handla';

/**
 * Default branded social-preview image.
 *
 * `/og-image.png` (1200×630) is the intended site-wide default. It is wired
 * here so every page has a valid og:image entry the moment that asset is
 * added to /public — we deliberately do NOT ship a low-quality placeholder.
 * Product pages override this with their real existing hero artwork below.
 */
export const DEFAULT_OG_IMAGE = '/og-image.png';

interface PageSeoInput {
  /** Full <title> for this page (used verbatim, not run through the template). */
  title: string;
  description: string;
  /** Root-relative path, e.g. '/products/manarah'. Used for canonical + og:url. */
  path: string;
  /** Optional page-specific OG image (root-relative or absolute). */
  image?: string;
  /** Optional OG image dimensions when known. */
  imageWidth?: number;
  imageHeight?: number;
}

/**
 * Build a complete Metadata object for a public page:
 * self-referencing canonical + Open Graph + Twitter, all consistent.
 */
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
    // `absolute` bypasses the root `title.template` ('%s | Handla') so titles
    // that already contain the brand aren't doubled to "… | Handla | Handla".
    title: { absolute: title },
    description,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      type:     'website',
      siteName: SITE_NAME,
      title,
      description,
      url:      canonicalPath,
      locale:   'en_US',
      alternateLocale: ['ar_SA'],
      images: [
        {
          url:    image,
          width:  imageWidth,
          height: imageHeight,
          alt:    title,
        },
      ],
    },
    twitter: {
      card:        'summary_large_image',
      title,
      description,
      images:      [image],
    },
  };
}
