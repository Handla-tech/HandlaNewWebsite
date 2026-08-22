import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/seo';
import { JsonLd, manarahSchema } from '@/components/JsonLd';

/**
 * Server-component layout for the /products/manarah route segment.
 * Declares SEO metadata (title, description, self-canonical, Open Graph,
 * Twitter) for this primary product landing page. The page is a client
 * component and cannot export `metadata` directly. Uses the real product
 * hero artwork (1600×893, ~1.79:1) as the social image. Adds no
 * markup/behaviour; stays index, follow.
 *
 * The nested /products/manarah/demo/* routes override this with their own
 * `noindex, follow` metadata.
 */
export const metadata: Metadata = buildPageMetadata({
  title:       'Manarah | School Management System & School ERP',
  description: 'Manarah is an all-in-one school management system for students, teachers, attendance, exams, grades, fees, HR, transportation and parent and student apps.',
  path:        '/products/manarah',
  image:       '/products/manarah-hero.webp',
  imageWidth:  1600,
  imageHeight: 893,
});

export default function ManarahLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={manarahSchema} />
      {children}
    </>
  );
}
