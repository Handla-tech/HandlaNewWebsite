import type { Metadata } from 'next';

/**
 * Server-component layout for the /products/matjary route segment.
 * Declares the self-referencing canonical (https://handla.tech/products/matjary)
 * for this primary product landing page. The page is a client component and
 * cannot export `metadata` directly. Adds no markup/behaviour; the page stays
 * index, follow (a primary SEO landing page).
 *
 * The nested /products/matjary/demo/* routes override this with their own
 * `noindex, follow` metadata.
 */
export const metadata: Metadata = {
  alternates: {
    canonical: '/products/matjary',
  },
};

export default function MatjaryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
