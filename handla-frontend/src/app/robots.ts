import type { MetadataRoute } from 'next';

/**
 * Next.js App Router robots.ts — generates /robots.txt programmatically.
 * Supplements the static public/robots.txt.
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://handla.tech';

  return {
    rules: [
      {
        userAgent: '*',
        allow:     '/',
        disallow:  ['/dashboard/', '/admin/', '/api/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
