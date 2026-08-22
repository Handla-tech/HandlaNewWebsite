import type { Locale, WebsiteProject } from '@/types';

/**
 * Locale-aware accessors for a WebsiteProject.
 *
 * The backend stores a single canonical row per project with optional Arabic
 * columns (titleAr / summaryAr / descriptionAr / categoryAr). On /ar we prefer
 * the Arabic value and gracefully fall back to the English/default value when
 * the Arabic field is null/empty — so a project with only English copy still
 * renders correctly on the Arabic routes.
 */

export function projectTitle(p: WebsiteProject, locale: Locale): string {
  if (locale === 'ar' && p.titleAr) return p.titleAr;
  return p.title;
}

export function projectCategory(p: WebsiteProject, locale: Locale): string | null {
  if (locale === 'ar' && p.categoryAr) return p.categoryAr;
  return p.category;
}

export function projectSummary(p: WebsiteProject, locale: Locale): string | null {
  if (locale === 'ar' && p.summaryAr) return p.summaryAr;
  return p.summary;
}

export function projectDescription(p: WebsiteProject, locale: Locale): string {
  if (locale === 'ar' && p.descriptionAr) return p.descriptionAr;
  return p.description;
}

/** Best available short blurb for a card: summary → description. */
export function projectBlurb(p: WebsiteProject, locale: Locale): string {
  return projectSummary(p, locale) || projectDescription(p, locale);
}
