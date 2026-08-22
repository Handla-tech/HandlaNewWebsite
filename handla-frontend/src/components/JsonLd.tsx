/**
 * JsonLd — injects JSON-LD structured data into <head>.
 *
 * Used by the landing page to describe the Organization and its Services
 * to search engines (Google rich results, etc.).
 *
 * Rendered server-side — no 'use client' needed.
 */

interface JsonLdProps {
  data: Record<string, unknown>;
}

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: controlled server-side data
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

// ─── Pre-built schemas ────────────────────────────────────────────────────────

export const organizationSchema = {
  '@context':   'https://schema.org',
  '@type':      'Organization',
  name:         'Handla',
  url:          'https://handla.tech',
  // Branded logo (1200×630 site image doubles as the reference until a
  // dedicated square logo asset is added). Points at an intended asset path.
  logo:         'https://handla.tech/og-image.png',
  description:  'Handla builds custom software, ERP systems, SaaS platforms, websites and mobile applications for businesses, schools and growing organizations.',
  contactPoint: {
    '@type':       'ContactPoint',
    contactType:   'customer support',
    availableLanguage: ['English', 'Arabic'],
  },
  sameAs: [
    'https://linkedin.com/company/handla-tech',
  ],
};

/**
 * WebSite schema — enables the site name in search results and declares the
 * canonical site URL. No SearchAction/sitelinks-searchbox is included because
 * the site has no verified public search endpoint (avoids inventing data).
 */
export const websiteSchema = {
  '@context': 'https://schema.org',
  '@type':    'WebSite',
  name:       'Handla',
  url:        'https://handla.tech',
  inLanguage: ['en', 'ar'],
  publisher:  { '@type': 'Organization', name: 'Handla' },
};

// ─── Product (SoftwareApplication) schemas ────────────────────────────────────
// Minimal, valid SoftwareApplication schemas — NO invented offers, prices,
// ratings, reviews or download counts. Only name/description/category/URL and
// the verified bilingual support + Handla as provider.

export const manarahSchema = {
  '@context':          'https://schema.org',
  '@type':             'SoftwareApplication',
  name:                'Manarah',
  applicationCategory: 'BusinessApplication',
  applicationSubCategory: 'School Management System',
  operatingSystem:     'Web, iOS, Android',
  url:                 'https://handla.tech/products/manarah',
  description:
    'Manarah is an all-in-one school management system for students, teachers, attendance, exams, grades, fees, HR, transportation and parent and student apps.',
  inLanguage:          ['en', 'ar'],
  provider:            { '@type': 'Organization', name: 'Handla', url: 'https://handla.tech' },
};

export const madarSchema = {
  '@context':          'https://schema.org',
  '@type':             'SoftwareApplication',
  name:                'Madar',
  applicationCategory: 'BusinessApplication',
  applicationSubCategory: 'ERP & Business Management',
  operatingSystem:     'Web',
  url:                 'https://handla.tech/products/madar',
  description:
    'Madar is a business management and ERP platform for clients, projects, quotations, contracts, invoices, expenses and operational reporting.',
  inLanguage:          ['en', 'ar'],
  provider:            { '@type': 'Organization', name: 'Handla', url: 'https://handla.tech' },
};

export const matjarySchema = {
  '@context':          'https://schema.org',
  '@type':             'SoftwareApplication',
  name:                'Matjary',
  applicationCategory: 'BusinessApplication',
  applicationSubCategory: 'Commerce, POS & Inventory',
  operatingSystem:     'Web',
  url:                 'https://handla.tech/products/matjary',
  description:
    'Matjary is a commerce management platform combining online sales, POS, inventory, customers, loyalty and business analytics in one system.',
  inLanguage:          ['en', 'ar'],
  provider:            { '@type': 'Organization', name: 'Handla', url: 'https://handla.tech' },
};

export const softwareServicesSchema = {
  '@context': 'https://schema.org',
  '@type':    'ItemList',
  name:       'Handla Software Services',
  itemListElement: [
    {
      '@type':    'Service',
      position:   1,
      name:       'Custom Web Development',
      description: 'Full-stack web applications tailored to your business needs.',
      provider:   { '@type': 'Organization', name: 'Handla' },
    },
    {
      '@type':    'Service',
      position:   2,
      name:       'ERP Systems',
      description: 'Enterprise Resource Planning solutions including School ERP and HR & Payroll systems.',
      provider:   { '@type': 'Organization', name: 'Handla' },
    },
    {
      '@type':    'Service',
      position:   3,
      name:       'Mobile Applications',
      description: 'Cross-platform iOS and Android apps built with modern frameworks.',
      provider:   { '@type': 'Organization', name: 'Handla' },
    },
    {
      '@type':    'Service',
      position:   4,
      name:       'CRM & Business Automation',
      description: 'Customer relationship management and workflow automation platforms.',
      provider:   { '@type': 'Organization', name: 'Handla' },
    },
  ],
};
