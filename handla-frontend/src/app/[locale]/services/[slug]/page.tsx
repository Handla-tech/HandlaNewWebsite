import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { JsonLd } from '@/components/JsonLd';
import { buildLocaleMetadata } from '@/lib/seo';
import { serviceSchema, breadcrumbSchema } from '@/lib/structured-data';
import { SERVICES_SEO } from '@/i18n/seo-content';
import { SERVICES, getService } from '@/i18n/services-data';
import { toLocale, LOCALES, type Locale } from '@/i18n/config';
import ServiceDetail from '@/components/services/ServiceDetail';

export function generateStaticParams() {
  return LOCALES.flatMap((locale) =>
    SERVICES.map((s) => ({ locale, slug: s.slug })),
  );
}

export function generateMetadata({
  params,
}: {
  params: { locale: string; slug: string };
}): Metadata {
  const locale = toLocale(params.locale);
  const svc = getService(params.slug);
  if (!svc) return {};
  return buildLocaleMetadata({
    locale,
    subPath: `/services/${svc.slug}`,
    title: svc.seoTitle[locale],
    description: svc.seoDescription[locale],
  });
}

export default function ServiceDetailPage({
  params,
}: {
  params: { locale: string; slug: string };
}) {
  const locale: Locale = toLocale(params.locale);
  const svc = getService(params.slug);
  if (!svc) notFound();

  const homeLabel = locale === 'ar' ? 'الرئيسية' : 'Home';
  const servicesLabel = SERVICES_SEO[locale].title.split('|')[0].trim();

  return (
    <>
      <JsonLd
        data={serviceSchema({
          locale,
          name: svc.title[locale],
          slug: svc.slug,
          description: svc.seoDescription[locale],
        })}
      />
      <JsonLd
        data={breadcrumbSchema(locale, [
          { name: homeLabel, subPath: '' },
          { name: servicesLabel, subPath: '/services' },
          { name: svc.title[locale], subPath: `/services/${svc.slug}` },
        ])}
      />
      <ServiceDetail slug={svc.slug} />
    </>
  );
}
