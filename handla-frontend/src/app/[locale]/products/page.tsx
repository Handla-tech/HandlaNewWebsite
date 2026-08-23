import type { Metadata } from 'next';
import { buildLocaleMetadata } from '@/lib/seo';
import { PRODUCTS_SEO } from '@/i18n/seo-content';
import { toLocale } from '@/i18n/config';
import ProductsCatalog from '@/components/landing/ProductsCatalog';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: localeParam } = await params;
  const locale = toLocale(localeParam);
  const { title, description } = PRODUCTS_SEO[locale];
  return buildLocaleMetadata({ locale, subPath: '/products', title, description });
}

export default function ProductsPage() {
  return <ProductsCatalog />;
}
