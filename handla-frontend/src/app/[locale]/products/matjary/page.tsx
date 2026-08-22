import type { Metadata } from 'next';
import { JsonLd } from '@/components/JsonLd';
import { ProductLanding } from '@/components/product-demos/ProductLanding';
import { matjaryContent } from '@/content/products/matjary';
import { buildLocaleMetadata } from '@/lib/seo';
import { MATJARY_SEO, PRODUCTS_SEO } from '@/i18n/seo-content';
import { softwareApplicationSchema, breadcrumbSchema } from '@/lib/structured-data';
import { toLocale, type Locale } from '@/i18n/config';

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const locale = toLocale(params.locale);
  const { title, description } = MATJARY_SEO[locale];
  return buildLocaleMetadata({
    locale,
    subPath: '/products/matjary',
    title,
    description,
    image: '/products/matjary-hero.webp',
    imageWidth: 1600,
    imageHeight: 893,
  });
}

export default function MatjaryPage({ params }: { params: { locale: string } }) {
  const locale: Locale = toLocale(params.locale);
  const homeLabel = locale === 'ar' ? 'الرئيسية' : 'Home';

  return (
    <>
      <JsonLd
        data={softwareApplicationSchema({
          locale,
          name: 'Matjary',
          slug: 'matjary',
          description: MATJARY_SEO[locale].description,
          applicationSubCategory: 'Commerce, POS & Inventory',
          operatingSystem: 'Web',
        })}
      />
      <JsonLd
        data={breadcrumbSchema(locale, [
          { name: homeLabel, subPath: '' },
          { name: PRODUCTS_SEO[locale].title.split('|')[0].trim(), subPath: '/products' },
          { name: 'Matjary', subPath: '/products/matjary' },
        ])}
      />
      <ProductLanding content={matjaryContent} initialLocale={locale} />
    </>
  );
}
