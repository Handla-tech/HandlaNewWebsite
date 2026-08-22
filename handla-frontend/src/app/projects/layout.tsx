import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/seo';

/**
 * Server-component layout for the /projects route segment.
 * Declares SEO metadata (title, description, self-canonical, Open Graph,
 * Twitter). The page is a client component and cannot export `metadata`
 * directly. Adds no markup/behaviour; /projects remains index, follow so it
 * stays crawlable and discoverable (real case-study content coming soon).
 */
export const metadata: Metadata = buildPageMetadata({
  title:       'Software Projects & Case Studies | Handla',
  description: 'Explore Handla software projects and case studies across SaaS platforms, ERP systems, websites, mobile applications and custom digital solutions.',
  path:        '/projects',
});

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
