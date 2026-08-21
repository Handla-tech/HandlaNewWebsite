import type { MetadataRoute } from 'next';

/**
 * Next.js App Router robots.ts — generates /robots.txt programmatically.
 *
 * NOTE: A static `public/robots.txt` also exists and, per Next.js precedence,
 * the static file is what is actually served. This dynamic version is kept in
 * sync as a fallback should the static file ever be removed.
 *
 * Public crawling is allowed; authenticated / internal areas are blocked.
 * (`noindex` metadata on those pages is the primary indexing guard — see
 * the per-route layouts — with robots.txt as a secondary crawl hint.)
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://handla.tech').replace(/\/$/, '');

  return {
    rules: [
      {
        userAgent: '*',
        allow:     '/',
        disallow:  ['/auth', '/dashboard/', '/admin/', '/erp/', '/api/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
