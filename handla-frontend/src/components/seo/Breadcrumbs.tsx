'use client';

/**
 * Breadcrumbs — visible breadcrumb trail for deeper public pages.
 *
 * Renders a semantic <nav aria-label> with locale-aware links. The matching
 * BreadcrumbList JSON-LD is emitted separately by the page (server) via
 * lib/structured-data → breadcrumbSchema, so structured data and the visible
 * trail stay in sync.
 *
 * `items` are ordered Home → … → current. The last item is the current page
 * (rendered as plain text, not a link).
 */

import Link from 'next/link';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

export interface Crumb {
  label: string;
  /** Locale-prefixed href, e.g. '/en/products'. Omitted for the current page. */
  href?: string;
}

export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  const { isRTL } = useTranslation();
  const Sep = isRTL ? ChevronLeft : ChevronRight;

  return (
    <nav
      aria-label="Breadcrumb"
      className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-24 pb-2"
    >
      <ol className="flex flex-wrap items-center gap-1.5 text-xs" style={{ color: 'var(--ink-5)' }}>
        {items.map((c, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={i} className="flex items-center gap-1.5">
              {c.href && !isLast ? (
                <Link
                  href={c.href}
                  className="transition-colors hover:text-white"
                  style={{ color: 'var(--ink-4)' }}
                >
                  {c.label}
                </Link>
              ) : (
                <span aria-current={isLast ? 'page' : undefined} style={{ color: isLast ? 'var(--ink-2)' : undefined }}>
                  {c.label}
                </span>
              )}
              {!isLast && <Sep className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
