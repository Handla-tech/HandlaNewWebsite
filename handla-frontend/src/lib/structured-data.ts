/**
 * Locale-aware JSON-LD builders.
 *
 * All URLs are absolute and locale-specific. Stable @id values
 * (https://handla.tech/#organization, /#website) let the graph reference a
 * single Organization/WebSite entity across pages without duplicating it.
 *
 * STRICT: no fabricated data. No reviews, ratings, prices, offers, download
 * counts, client names, statistics, awards or certifications anywhere.
 */

import { SITE_URL } from './seo';
import { localePath } from './seo';
import type { Locale } from '@/i18n/config';
import { SERVICES } from '@/i18n/services-data';

const ORG_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;

/** The real, crawlable square logo asset (see PART 18). */
const LOGO_URL = `${SITE_URL}/logo.png`;

/** Organization entity — referenced by @id elsewhere. */
export function organizationSchema(locale: Locale) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORG_ID,
    name: 'Handla',
    url: `${SITE_URL}${localePath(locale)}`,
    logo: {
      '@type': 'ImageObject',
      url: LOGO_URL,
      width: 512,
      height: 512,
    },
    description:
      locale === 'ar'
        ? 'هاندلا تقدّم حلول تطوير البرمجيات وأنظمة ERP ومنصات SaaS والمواقع والتطبيقات للشركات والمؤسسات والمدارس.'
        : 'Handla builds custom software, ERP systems, SaaS platforms, websites and mobile applications for businesses, schools and growing organizations.',
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      availableLanguage: ['English', 'Arabic'],
    },
    sameAs: ['https://linkedin.com/company/handla-tech'],
  };
}

/** WebSite entity — references the Organization as publisher. */
export function websiteSchema(locale: Locale) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: 'Handla',
    url: `${SITE_URL}${localePath(locale)}`,
    inLanguage: locale,
    publisher: { '@id': ORG_ID },
  };
}

/** ItemList of the genuine services (homepage). */
export function servicesItemListSchema(locale: Locale) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: locale === 'ar' ? 'خدمات هاندلا البرمجية' : 'Handla Software Services',
    itemListElement: SERVICES.map((s, i) => ({
      '@type': 'Service',
      position: i + 1,
      name: s.title[locale],
      description: s.summary[locale],
      url: `${SITE_URL}${localePath(locale, `/services/${s.slug}`)}`,
      provider: { '@id': ORG_ID },
    })),
  };
}

/** SoftwareApplication for a product page (localized url/description). */
export function softwareApplicationSchema(opts: {
  locale: Locale;
  name: string;
  slug: string;
  description: string;
  applicationSubCategory: string;
  operatingSystem: string;
}) {
  const { locale, name, slug, description, applicationSubCategory, operatingSystem } = opts;
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name,
    applicationCategory: 'BusinessApplication',
    applicationSubCategory,
    operatingSystem,
    url: `${SITE_URL}${localePath(locale, `/products/${slug}`)}`,
    description,
    inLanguage: ['en', 'ar'],
    provider: { '@id': ORG_ID },
  };
}

/** Service schema for a service detail page. */
export function serviceSchema(opts: {
  locale: Locale;
  name: string;
  slug: string;
  description: string;
}) {
  const { locale, name, slug, description } = opts;
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name,
    serviceType: name,
    url: `${SITE_URL}${localePath(locale, `/services/${slug}`)}`,
    description,
    provider: { '@id': ORG_ID },
    areaServed: 'Worldwide',
    availableLanguage: ['English', 'Arabic'],
  };
}

/**
 * BreadcrumbList with locale-specific URLs and localized names.
 * `trail` is an ordered list of { name, subPath } where subPath is WITHOUT the
 * locale prefix ('' = home).
 */
export function breadcrumbSchema(
  locale: Locale,
  trail: Array<{ name: string; subPath: string }>,
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${localePath(locale, item.subPath)}`,
    })),
  };
}
