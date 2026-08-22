import type { Metadata } from 'next';
import { JsonLd } from '@/components/JsonLd';
import { ProductLanding } from '@/components/product-demos/ProductLanding';
import { matjaryContent } from '@/content/products/matjary';
import { buildLocaleMetadata } from '@/lib/seo';
import { MATJARY_SEO, PRODUCTS_SEO } from '@/i18n/seo-content';
import { softwareApplicationSchema, breadcrumbSchema } from '@/lib/structured-data';
import { toLocale, type Locale } from '@/i18n/config';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: localeParam } = await params;
  const locale = toLocale(localeParam);
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

export default async function MatjaryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: localeParam } = await params;
  const locale: Locale = toLocale(localeParam);
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
