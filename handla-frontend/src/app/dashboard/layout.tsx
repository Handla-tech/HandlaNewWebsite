import type { Metadata } from 'next';
import DashboardShell from './DashboardShell';

/**
 * Server-component layout for the /dashboard route segment.
 *
 * Adds `noindex, nofollow` metadata (private, authenticated area) and renders
 * the existing client-side dashboard shell unchanged. The shell logic was
 * moved verbatim to `DashboardShell.tsx`; only this metadata wrapper is new.
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

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
