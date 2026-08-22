import type { Metadata } from 'next';
import { buildLocaleMetadata } from '@/lib/seo';
import { PRODUCTS_SEO } from '@/i18n/seo-content';
import { toLocale } from '@/i18n/config';
import ProductsCatalog from '@/components/landing/ProductsCatalog';

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const locale = toLocale(params.locale);
  const { title, description } = PRODUCTS_SEO[locale];
  return buildLocaleMetadata({ locale, subPath: '/products', title, description });
}

export default function ProductsPage() {
  return <ProductsCatalog />;
}
