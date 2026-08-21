import type { Metadata } from 'next';

/**
 * Server-component layout for the /profile route segment.
 * Attaches `noindex, nofollow` metadata — the user profile is a private,
 * authenticated page that must never appear in search results. Adds no
 * markup or behaviour; the page remains a client component.
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

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
