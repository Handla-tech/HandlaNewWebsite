import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/seo';
import { JsonLd, madarSchema } from '@/components/JsonLd';

/**
 * Server-component layout for the /products/madar route segment.
 * Declares SEO metadata (title, description, self-canonical, Open Graph,
 * Twitter) for this primary product landing page. The page is a client
 * component and cannot export `metadata` directly. Uses the real product
 * hero artwork (1600×893, ~1.79:1) as the social image. Adds no
 * markup/behaviour; stays index, follow.
 *
 * The nested /products/madar/demo/* routes override this with their own
 * `noindex, follow` metadata.
 */
export const metadata: Metadata = buildPageMetadata({
  title:       'Madar | ERP & Business Management System',
  description: 'Madar is a business management and ERP platform for clients, projects, quotations, contracts, invoices, expenses and operational reporting.',
  path:        '/products/madar',
  image:       '/products/madar-hero.webp',
  imageWidth:  1600,
  imageHeight: 893,
});

export default function MadarLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={madarSchema} />
      {children}
    </>
  );
}
