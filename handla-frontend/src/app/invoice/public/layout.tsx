import type { Metadata } from 'next';

/**
 * Server-component layout for /invoice/public/* shareable links.
 * These are per-record document links (accessed via a specific id/token) and
 * must not be indexed by search engines. Adds `noindex, nofollow` only.
 */
export const metadata: Metadata = {
  robots: {
    index:  false,
    follow: false,
    googleBot: {
      index:  false,
      follow: false,
    },
  },
};

export default function InvoicePublicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
