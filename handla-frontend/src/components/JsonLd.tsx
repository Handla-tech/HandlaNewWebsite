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
  logo:         'https://handla.tech/logo.png',
  description:  'Professional software services platform — web development, ERP, CRM, mobile apps, and custom software solutions.',
  contactPoint: {
    '@type':       'ContactPoint',
    contactType:   'customer support',
    availableLanguage: ['English', 'Arabic'],
  },
  sameAs: [
    'https://linkedin.com/company/handla-tech',
  ],
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
