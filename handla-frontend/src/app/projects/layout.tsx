import type { Metadata } from 'next';

/**
 * Server-component layout for the /projects route segment.
 * Its only job is to declare the self-referencing canonical URL
 * (https://handla.tech/projects). The page itself is a client component
 * and therefore cannot export `metadata` directly. This wrapper adds no
 * markup or behaviour and does NOT alter indexing — /projects remains
 * index, follow (default) so it stays crawlable and discoverable.
 */
export const metadata: Metadata = {
  alternates: {
    canonical: '/projects',
  },
};

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
