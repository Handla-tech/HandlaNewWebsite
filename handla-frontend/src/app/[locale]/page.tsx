import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
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

// ── Client-only sections (API-driven) ─────────────────────────────────────────
const Projects = dynamic(() => import('@/components/landing/Projects'), {
  ssr: false,
  loading: () => (
    <section className="py-24 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: '#fbbf24', borderTopColor: 'transparent' }} />
    </section>
  ),
});
const Products = dynamic(() => import('@/components/landing/Products'), {
  ssr: false,
  loading: () => (
    <section className="py-24 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: '#fbbf24', borderTopColor: 'transparent' }} />
    </section>
  ),
});
const Testimonials = dynamic(() => import('@/components/landing/Testimonials'), {
  ssr: false,
  loading: () => (
    <section className="py-24 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: '#fbbf24', borderTopColor: 'transparent' }} />
    </section>
  ),
});
const Contact = dynamic(() => import('@/components/landing/Contact'), {
  ssr: false,
  loading: () => <section className="py-24" />,
});

// ─── Localized metadata ───────────────────────────────────────────────────────
export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const locale = toLocale(params.locale);
  const { title, description } = HOME_SEO[locale];
  return buildLocaleMetadata({ locale, subPath: '', title, description });
}

export default function LocalizedLandingPage({ params }: { params: { locale: string } }) {
  const locale: Locale = toLocale(params.locale);

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--page-bg)', color: 'var(--ink-1)' }}>
      {/* JSON-LD — Organization + WebSite + Services (locale-aware, stable @id) */}
      <JsonLd data={organizationSchema(locale)} />
      <JsonLd data={websiteSchema(locale)} />
      <JsonLd data={servicesItemListSchema(locale)} />

      <Navbar />
      <main>
        <Hero />
        <About />
        <ServicesBento />
        <Process />
        <Projects />
        <Products />
        <Testimonials />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}
