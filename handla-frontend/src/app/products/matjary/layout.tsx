import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/seo';
import { JsonLd, matjarySchema } from '@/components/JsonLd';

/**
 * Server-component layout for the /products/matjary route segment.
 * Declares SEO metadata (title, description, self-canonical, Open Graph,
 * Twitter) for this primary product landing page. The page is a client
 * component and cannot export `metadata` directly. Uses the real product
 * hero artwork (1600×893, ~1.79:1) as the social image. Adds no
 * markup/behaviour; stays index, follow.
 *
 * The nested /products/matjary/demo/* routes override this with their own
 * `noindex, follow` metadata.
 */
export const metadata: Metadata = buildPageMetadata({
  title:       'Matjary | Commerce, POS & Inventory Management Platform',
  description: 'Matjary is a commerce management platform combining online sales, POS, inventory, customers, loyalty and business analytics in one system.',
  path:        '/products/matjary',
  image:       '/products/matjary-hero.webp',
  imageWidth:  1600,
  imageHeight: 893,
});

export default function MatjaryLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={matjarySchema} />
      {children}
    </>
  );
}
