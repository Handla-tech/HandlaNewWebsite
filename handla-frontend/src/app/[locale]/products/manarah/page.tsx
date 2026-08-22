import type { Metadata } from 'next';
import { JsonLd } from '@/components/JsonLd';
import { ProductLanding } from '@/components/product-demos/ProductLanding';
import { manarahContent } from '@/content/products/manarah';
import { buildLocaleMetadata } from '@/lib/seo';
import { MANARAH_SEO, PRODUCTS_SEO } from '@/i18n/seo-content';
import { softwareApplicationSchema, breadcrumbSchema } from '@/lib/structured-data';
import { toLocale, type Locale } from '@/i18n/config';

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const locale = toLocale(params.locale);
  const { title, description } = MANARAH_SEO[locale];
  return buildLocaleMetadata({
    locale,
    subPath: '/products/manarah',
    title,
    description,
    image: '/products/manarah-hero.webp',
    imageWidth: 1600,
    imageHeight: 893,
  });
}

export default function ManarahPage({ params }: { params: { locale: string } }) {
  const locale: Locale = toLocale(params.locale);
  const homeLabel = locale === 'ar' ? 'الرئيسية' : 'Home';

  return (
    <>
      <JsonLd
        data={softwareApplicationSchema({
          locale,
          name: 'Manarah',
          slug: 'manarah',
          description: MANARAH_SEO[locale].description,
          applicationSubCategory: 'School Management System',
          operatingSystem: 'Web, iOS, Android',
        })}
      />
      <JsonLd
        data={breadcrumbSchema(locale, [
          { name: homeLabel, subPath: '' },
          { name: PRODUCTS_SEO[locale].title.split('|')[0].trim(), subPath: '/products' },
          { name: 'Manarah', subPath: '/products/manarah' },
        ])}
      />
      <ProductLanding content={manarahContent} initialLocale={locale} />
    </>
  );
}
