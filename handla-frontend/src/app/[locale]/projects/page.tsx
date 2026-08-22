import type { Metadata } from 'next';
import { buildLocaleMetadata } from '@/lib/seo';
import { PROJECTS_SEO } from '@/i18n/seo-content';
import { toLocale } from '@/i18n/config';
import ProjectsCatalog from '@/components/landing/ProjectsCatalog';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: localeParam } = await params;
  const locale = toLocale(localeParam);
  const { title, description } = PROJECTS_SEO[locale];
  return buildLocaleMetadata({ locale, subPath: '/projects', title, description });
}

export default function ProjectsPage() {
  return <ProjectsCatalog />;
}
