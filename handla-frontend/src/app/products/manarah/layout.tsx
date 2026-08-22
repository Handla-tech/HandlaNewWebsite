import type { Metadata } from 'next';

/**
 * Server-component layout for the /products/manarah route segment.
 * Declares the self-referencing canonical (https://handla.tech/products/manarah)
 * for this primary product landing page. The page is a client component and
 * cannot export `metadata` directly. Adds no markup/behaviour; the page stays
 * index, follow (a primary SEO landing page).
 *
 * The nested /products/manarah/demo/* routes override this with their own
 * `noindex, follow` metadata.
 */
export const metadata: Metadata = {
  alternates: {
    canonical: '/products/manarah',
  },
};

export default function ManarahLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
