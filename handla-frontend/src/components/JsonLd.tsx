/**
 * JsonLd — injects JSON-LD structured data into <head>.
 *
 * Used by the landing page to describe the Organization and its Services
 * to search engines (Google rich results, etc.).
 *
 * Rendered server-side — no 'use client' needed.
 */

import { safeJsonLd } from '@/lib/json-ld';

interface JsonLdProps {
  data: Record<string, unknown>;
}

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON is HTML-escaped by safeJsonLd (XSS-01)
      dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }}
    />
  );
}

// ─── Structured-data schemas ───────────────────────────────────────────────────
// The pre-built, non-locale schema constants that previously lived here have
// been superseded by the locale-aware builders in `@/lib/structured-data`
// (organizationSchema(locale), websiteSchema(locale), servicesItemListSchema,
// softwareApplicationSchema, serviceSchema, breadcrumbSchema). This module now
// only exposes the <JsonLd> renderer. Import schema builders from
// `@/lib/structured-data`.
