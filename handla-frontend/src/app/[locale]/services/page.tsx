import type { Metadata } from 'next';
import { buildLocaleMetadata } from '@/lib/seo';
import { SERVICES_SEO } from '@/i18n/seo-content';
import { servicesItemListSchema } from '@/lib/structured-data';
import { JsonLd } from '@/components/JsonLd';
import { toLocale, type Locale } from '@/i18n/config';
import ServicesIndex from '@/components/services/ServicesIndex';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: localeParam } = await params;
  const locale = toLocale(localeParam);
  const { title, description } = SERVICES_SEO[locale];
  return buildLocaleMetadata({ locale, subPath: '/services', title, description });
}

export default async function ServicesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: localeParam } = await params;
  const locale: Locale = toLocale(localeParam);
  return (
    <>
      <JsonLd data={servicesItemListSchema(locale)} />
      <ServicesIndex />
    </>
  );
}
