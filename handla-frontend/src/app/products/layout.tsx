import type { Metadata } from 'next';

/**
 * Server-component layout for the /products route segment.
 * Declares the self-referencing canonical for the /products listing page
 * (https://handla.tech/products).
 *
 * IMPORTANT: child segments override this canonical with their own:
 *   - /products/manarah|madar|matjary each declare a self-canonical via
 *     their own layout.tsx
 *   - /products/*\/demo/* declare `noindex, follow` via their page metadata
 * so this canonical only ever applies to the /products index itself.
 *
 * This wrapper adds no markup or behaviour and does not change indexing —
 * /products remains index, follow (default).
 */
export const metadata: Metadata = {
  alternates: {
    canonical: '/products',
  },
};

export default function ProductsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
