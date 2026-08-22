'use client';

/**
 * ServiceDetail — content-rich landing page for a single Handla service.
 *
 * Renders genuine, human-readable content from i18n/services-data (no filler):
 * intro, who it's for, what we deliver, capabilities, related products, CTA.
 * Locale comes from the URL via useTranslation; internal links are localized.
 */

import Link from 'next/link';
import { motion } from 'framer-motion';
import * as Icons from 'lucide-react';
import { Check, ArrowRight, ArrowUpRight } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import Breadcrumbs from '@/components/seo/Breadcrumbs';
import { useTranslation } from '@/hooks/useTranslation';
import { useLocalizedHref } from '@/hooks/useLocalizedHref';
import { getService } from '@/i18n/services-data';

const PRODUCT_NAMES: Record<string, { en: string; ar: string }> = {
  manarah: { en: 'Manarah', ar: 'منارة' },
  madar:   { en: 'Madar',   ar: 'مدار' },
  matjary: { en: 'Matjary', ar: 'متجري' },
};

function Icon({ name, color }: { name: string; color: string }) {
  const Cmp = (Icons as unknown as Record<string, React.ComponentType<{ size?: number; color?: string }>>)[name] || Icons.Boxes;
  return <Cmp size={26} color={color} />;
}

export default function ServiceDetail({ slug }: { slug: string }) {
  const { locale, isRTL } = useTranslation();
  const lh = useLocalizedHref();
  const svc = getService(slug);
  if (!svc) return null;

  const homeLabel = locale === 'ar' ? 'الرئيسية' : 'Home';
  const servicesLabel = locale === 'ar' ? 'الخدمات' : 'Services';
  const audienceHeading = locale === 'ar' ? 'لمن هذه الخدمة' : 'Who it’s for';
  const deliverHeading = locale === 'ar' ? 'ما الذي نقدّمه' : 'What we deliver';
  const capHeading = locale === 'ar' ? 'القدرات والتقنيات' : 'Capabilities & technologies';
  const relatedHeading = locale === 'ar' ? 'منتجات ذات صلة' : 'Related products';
  const ctaTitle = locale === 'ar' ? 'هل لديك مشروع في ذهنك؟' : 'Have a project in mind?';
  const ctaText =
    locale === 'ar'
      ? 'تواصل معنا لمناقشة احتياجاتك ونقترح لك الحل المناسب.'
      : 'Get in touch to discuss your needs and we’ll propose the right approach.';
  const ctaBtn = locale === 'ar' ? 'ابدأ الآن' : 'Get started';
  const allServices = locale === 'ar' ? 'كل الخدمات' : 'All services';

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--page-bg)', color: 'var(--ink-1)' }} dir={isRTL ? 'rtl' : 'ltr'}>
      <Navbar />

      <Breadcrumbs
        items={[
          { label: homeLabel, href: lh('/') },
          { label: servicesLabel, href: lh('/services') },
          { label: svc.title[locale] },
        ]}
      />

      <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 pb-24">
        {/* Hero */}
        <header className="py-8">
          <span
            className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: `${svc.accent}22`, border: `1px solid ${svc.accent}55` }}
          >
            <Icon name={svc.icon} color={svc.accent} />
          </span>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-4xl sm:text-5xl font-extrabold text-white mb-4"
          >
            {svc.title[locale]}
          </motion.h1>
          <p className="text-lg leading-relaxed" style={{ color: 'var(--ink-4)' }}>
            {svc.intro[locale]}
          </p>
        </header>

        {/* Who it's for */}
        <section className="mt-8">
          <h2 className="text-xl font-bold text-white mb-4">{audienceHeading}</h2>
          <ul className="space-y-2.5">
            {svc.audience[locale].map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed" style={{ color: 'var(--ink-3)' }}>
                <Check className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: svc.accent }} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* What we deliver */}
        <section className="mt-10">
          <h2 className="text-xl font-bold text-white mb-4">{deliverHeading}</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {svc.deliverables[locale].map((item, i) => (
              <div
                key={i}
                className="rounded-2xl p-5 text-sm leading-relaxed"
                style={{ background: 'var(--surface-1)', border: '1px solid var(--ov-med)', color: 'var(--ink-3)' }}
              >
                {item}
              </div>
            ))}
          </div>
        </section>

        {/* Capabilities */}
        <section className="mt-10">
          <h2 className="text-xl font-bold text-white mb-4">{capHeading}</h2>
          <div className="flex flex-wrap gap-2">
            {svc.capabilities.map((c) => (
              <span
                key={c}
                className="rounded-full px-3 py-1.5 text-xs font-medium"
                style={{ background: 'var(--ov-soft)', border: '1px solid var(--ov-med)', color: 'var(--ink-4)' }}
              >
                {c}
              </span>
            ))}
          </div>
        </section>

        {/* Related products */}
        {svc.relatedProducts.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-bold text-white mb-4">{relatedHeading}</h2>
            <div className="flex flex-wrap gap-3">
              {svc.relatedProducts.map((p) => (
                <Link
                  key={p}
                  href={lh(`/products/${p}`)}
                  className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all hover:-translate-y-0.5"
                  style={{ background: 'var(--surface-1)', border: '1px solid var(--ov-med)', color: 'var(--ink-2)' }}
                >
                  {PRODUCT_NAMES[p]?.[locale] ?? p}
                  <ArrowUpRight className={`h-4 w-4 ${isRTL ? 'rotate-[-90deg]' : ''}`} style={{ color: svc.accent }} />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <section
          className="mt-14 flex flex-col items-center gap-4 rounded-2xl px-6 py-12 text-center"
          style={{ background: 'var(--surface-1)', border: '1px solid var(--ov-med)' }}
        >
          <h2 className="text-2xl font-bold text-white">{ctaTitle}</h2>
          <p className="mx-auto max-w-xl text-sm" style={{ color: 'var(--ink-4)' }}>{ctaText}</p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            <a
              href={lh('/#contact')}
              className="group inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold transition-all"
              style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', color: '#1a1a1a' }}
            >
              {ctaBtn}
              <ArrowRight className={`h-4 w-4 transition-transform group-hover:translate-x-1 ${isRTL ? 'rotate-180 group-hover:-translate-x-1' : ''}`} />
            </a>
            <Link
              href={lh('/services')}
              className="inline-flex items-center gap-2 rounded-xl border px-6 py-3 text-sm font-semibold transition-all hover:text-white"
              style={{ borderColor: 'var(--ov-med)', color: 'var(--ink-3)' }}
            >
              {allServices}
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
