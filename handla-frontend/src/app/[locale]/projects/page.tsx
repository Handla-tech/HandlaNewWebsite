import type { Metadata } from 'next';
import { buildLocaleMetadata } from '@/lib/seo';
import { PROJECTS_SEO } from '@/i18n/seo-content';
import { toLocale } from '@/i18n/config';
import ProjectsCatalog from '@/components/landing/ProjectsCatalog';

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const locale = toLocale(params.locale);
  const { title, description } = PROJECTS_SEO[locale];
  return buildLocaleMetadata({ locale, subPath: '/projects', title, description });
}

export default function ProjectsPage() {
  return <ProjectsCatalog />;
}
