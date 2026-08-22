import type { Metadata } from 'next';

/**
 * Server-component layout for the /products/madar/demo/* route segment.
 * Product demo pages are interactive, view-only previews — NOT primary SEO
 * landing pages — so they must not compete with the primary product page
 * in search results.
 *
 * Applied to this segment and all nested demo routes (website, …):
 *   robots: index=false, follow=true  → "noindex, follow"
 * Google may still crawl and follow links, but the demo pages themselves are
 * kept out of the index. Demos are intentionally NOT blocked in robots.txt.
 *
 * This also clears any inherited canonical from the parent product layout so
 * demo pages do not carry a /products/madar canonical.
 */
export const metadata: Metadata = {
  robots: {
    index:  false,
    follow: true,
    googleBot: {
      index:  false,
      follow: true,
    },
  },
};

export default function MadarDemoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
