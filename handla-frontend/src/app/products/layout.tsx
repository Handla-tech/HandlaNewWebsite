import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/seo';

/**
 * Server-component layout for the /products route segment.
 * Declares SEO metadata (title, description, self-canonical, Open Graph,
 * Twitter) for the /products listing page.
 *
 * IMPORTANT: child segments override this with their own metadata:
 *   - /products/manarah|madar|matjary each declare their own via layout.tsx
 *   - /products/*\/demo/* declare `noindex, follow`
 * so this metadata only ever applies to the /products index itself.
 *
 * Adds no markup/behaviour; /products remains index, follow (default).
 */
export const metadata: Metadata = buildPageMetadata({
  title:       'Software Products & Business Platforms | Handla',
  description: 'Explore Handla products including Manarah for schools, Madar for business management and Matjary for commerce, POS, inventory and customer operations.',
  path:        '/products',
});

export default function ProductsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
