import type { Metadata } from 'next';
import ErpShellLayout from './ErpShellLayout';

/**
 * Server-component layout for the /erp route segment (admin / staff area).
 *
 * Adds `noindex, nofollow` metadata (private, authenticated admin area) and
 * renders the existing client-side ERP shell unchanged. The shell logic was
 * moved verbatim to `ErpShellLayout.tsx`; only this metadata wrapper is new.
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

export default function ErpLayout({ children }: { children: React.ReactNode }) {
  return <ErpShellLayout>{children}</ErpShellLayout>;
}
