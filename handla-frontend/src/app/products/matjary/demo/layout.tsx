import type { Metadata } from 'next';

/**
 * Server-component layout for the /products/matjary/demo/* route segment.
 * Product demo pages are interactive, view-only previews — NOT primary SEO
 * landing pages — so they must not compete with the primary product page
 * in search results.
 *
 * Applied to this segment and all nested demo routes (pos, store, …):
 *   robots: index=false, follow=true  → "noindex, follow"
 * Google may still crawl and follow links, but the demo pages themselves are
 * kept out of the index. Demos are intentionally NOT blocked in robots.txt.
 *
 * This also clears any inherited canonical from the parent product layout so
 * demo pages do not carry a /products/matjary canonical.
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

export default function MatjaryDemoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
