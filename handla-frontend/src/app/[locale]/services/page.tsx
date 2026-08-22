import type { Metadata } from 'next';
import { buildLocaleMetadata } from '@/lib/seo';
import { SERVICES_SEO } from '@/i18n/seo-content';
import { servicesItemListSchema } from '@/lib/structured-data';
import { JsonLd } from '@/components/JsonLd';
import { toLocale, type Locale } from '@/i18n/config';
import ServicesIndex from '@/components/services/ServicesIndex';

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const locale = toLocale(params.locale);
  const { title, description } = SERVICES_SEO[locale];
  return buildLocaleMetadata({ locale, subPath: '/services', title, description });
}

export default function ServicesPage({ params }: { params: { locale: string } }) {
  const locale: Locale = toLocale(params.locale);
  return (
    <>
      <JsonLd data={servicesItemListSchema(locale)} />
      <ServicesIndex />
    </>
  );
}
