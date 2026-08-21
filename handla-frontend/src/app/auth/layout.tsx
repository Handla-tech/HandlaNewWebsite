import type { Metadata } from 'next';

/**
 * Server-component layout for the /auth route segment.
 * Its only job is to attach `noindex, nofollow` metadata so authentication
 * pages are never indexed by search engines. The page itself remains a
 * client component; this wrapper adds no markup or behaviour.
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

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
