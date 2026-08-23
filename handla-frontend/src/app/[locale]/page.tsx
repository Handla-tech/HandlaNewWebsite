import type { Metadata } from 'next';
import { JsonLd } from '@/components/JsonLd';
import {
  organizationSchema,
  websiteSchema,
  servicesItemListSchema,
} from '@/lib/structured-data';
import { buildLocaleMetadata } from '@/lib/seo';
import { HOME_SEO } from '@/i18n/seo-content';
import { toLocale, type Locale } from '@/i18n/config';
import Navbar       from '@/components/landing/Navbar';
import Hero          from '@/components/landing/Hero';
import About         from '@/components/landing/About';
import ServicesBento from '@/components/landing/ServicesBento';
import Process       from '@/components/landing/Process';
import Footer        from '@/components/landing/Footer';
import SectionErrorBoundary from '@/components/landing/SectionErrorBoundary';
// Client-only, API-driven sections (Projects/Products/Testimonials/Contact).
// Next.js 15 forbids `dynamic(..., { ssr: false })` in a Server Component, so
// those dynamic imports now live inside this Client Component wrapper.
import ClientLandingSections from '@/components/landing/ClientLandingSections';

// ─── Localized metadata ───────────────────────────────────────────────────────
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: localeParam } = await params;
  const locale = toLocale(localeParam);
  const { title, description } = HOME_SEO[locale];
  return buildLocaleMetadata({ locale, subPath: '', title, description });
}

export default async function LocalizedLandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: localeParam } = await params;
  const locale: Locale = toLocale(localeParam);

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--page-bg)', color: 'var(--ink-1)' }}>
      {/* JSON-LD — Organization + WebSite + Services (locale-aware, stable @id) */}
      <JsonLd data={organizationSchema(locale)} />
      <JsonLd data={websiteSchema(locale)} />
      <JsonLd data={servicesItemListSchema(locale)} />

      <Navbar />
      <main>
        {/* Each section is isolated: a render/hydration crash in ONE section
            can no longer unmount the whole page (the "blank <main>" bug). */}
        <SectionErrorBoundary name="Hero"><Hero /></SectionErrorBoundary>
        <SectionErrorBoundary name="About"><About /></SectionErrorBoundary>
        <SectionErrorBoundary name="ServicesBento"><ServicesBento /></SectionErrorBoundary>
        <SectionErrorBoundary name="Process"><Process /></SectionErrorBoundary>
        {/* Projects / Products / Testimonials / Contact — client-only, lazy. */}
        <ClientLandingSections />
      </main>
      <Footer />
    </div>
  );
}
