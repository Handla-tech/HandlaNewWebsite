'use client';

/**
 * ServicesIndex — public Services listing (/[locale]/services).
 *
 * Lists Handla's genuine services (from i18n/services-data). Each card links to
 * the service detail page. Reuses the landing Navbar/Footer and the site design
 * tokens; locale comes from the URL via useTranslation.
 */

import Link from 'next/link';
import { motion } from 'framer-motion';
import * as Icons from 'lucide-react';
import { ArrowUpRight } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import Breadcrumbs from '@/components/seo/Breadcrumbs';
import { useTranslation } from '@/hooks/useTranslation';
import { useLocalizedHref } from '@/hooks/useLocalizedHref';
import { SERVICES } from '@/i18n/services-data';

function Icon({ name, color }: { name: string; color: string }) {
  const Cmp = (Icons as unknown as Record<string, React.ComponentType<{ size?: number; color?: string }>>)[name] || Icons.Boxes;
  return <Cmp size={22} color={color} />;
}

export default function ServicesIndex() {
  const { locale, isRTL } = useTranslation();
  const lh = useLocalizedHref();

  const heading = locale === 'ar' ? 'خدماتنا' : 'Our Services';
  const sub =
    locale === 'ar'
      ? 'حلول برمجية شاملة من التطوير إلى البنية السحابية — مصمّمة حول احتياجات عملك.'
      : 'End-to-end software solutions, from development to cloud infrastructure — built around your business needs.';
  const homeLabel = locale === 'ar' ? 'الرئيسية' : 'Home';
  const servicesLabel = locale === 'ar' ? 'الخدمات' : 'Services';

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--page-bg)', color: 'var(--ink-1)' }} dir={isRTL ? 'rtl' : 'ltr'}>
      <Navbar />

      <Breadcrumbs items={[{ label: homeLabel, href: lh('/') }, { label: servicesLabel }]} />

      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pb-24">
        <header className="py-10 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-4xl sm:text-5xl font-extrabold text-white mb-4"
          >
            {heading}
          </motion.h1>
          <p className="mx-auto max-w-2xl text-base" style={{ color: 'var(--ink-5)' }}>
            {sub}
          </p>
        </header>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s, i) => (
            <motion.div
              key={s.slug}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: Math.min(i * 0.08, 0.32) }}
            >
              <Link
                href={lh(`/services/${s.slug}`)}
                className="group flex h-full flex-col gap-3 rounded-2xl p-6 transition-all hover:-translate-y-1"
                style={{ background: 'var(--surface-1)', border: '1px solid var(--ov-med)', boxShadow: 'var(--shadow-card)' }}
              >
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-xl"
                  style={{ background: `${s.accent}22`, border: `1px solid ${s.accent}55` }}
                >
                  <Icon name={s.icon} color={s.accent} />
                </span>
                <h2 className="text-lg font-bold text-white">{s.title[locale]}</h2>
                <p className="flex-1 text-sm leading-relaxed" style={{ color: 'var(--ink-3)' }}>
                  {s.summary[locale]}
                </p>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: s.accent }}>
                  {locale === 'ar' ? 'اكتشف الخدمة' : 'Learn more'}
                  <ArrowUpRight className={`h-4 w-4 ${isRTL ? 'rotate-[-90deg]' : ''}`} />
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
