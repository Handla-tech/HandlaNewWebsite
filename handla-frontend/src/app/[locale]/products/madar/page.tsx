import type { Metadata } from 'next';
import { JsonLd } from '@/components/JsonLd';
import { ProductLanding } from '@/components/product-demos/ProductLanding';
import { madarContent } from '@/content/products/madar';
import { buildLocaleMetadata } from '@/lib/seo';
import { MADAR_SEO, PRODUCTS_SEO } from '@/i18n/seo-content';
import { softwareApplicationSchema, breadcrumbSchema } from '@/lib/structured-data';
import { toLocale, type Locale } from '@/i18n/config';

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const locale = toLocale(params.locale);
  const { title, description } = MADAR_SEO[locale];
  return buildLocaleMetadata({
    locale,
    subPath: '/products/madar',
    title,
    description,
    image: '/products/madar-hero.webp',
    imageWidth: 1600,
    imageHeight: 893,
  });
}

export default function MadarPage({ params }: { params: { locale: string } }) {
  const locale: Locale = toLocale(params.locale);
  const homeLabel = locale === 'ar' ? 'الرئيسية' : 'Home';

  return (
    <>
      <JsonLd
        data={softwareApplicationSchema({
          locale,
          name: 'Madar',
          slug: 'madar',
          description: MADAR_SEO[locale].description,
          applicationSubCategory: 'ERP & Business Management',
          operatingSystem: 'Web',
        })}
      />
      <JsonLd
        data={breadcrumbSchema(locale, [
          { name: homeLabel, subPath: '' },
          { name: PRODUCTS_SEO[locale].title.split('|')[0].trim(), subPath: '/products' },
          { name: 'Madar', subPath: '/products/madar' },
        ])}
      />
      <ProductLanding content={madarContent} initialLocale={locale} />
    </>
  );
}
