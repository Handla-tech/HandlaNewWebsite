'use client';

/**
 * ServiceDetail — premium, content-rich landing page for a single Handla
 * service, brought fully into the Handla design system.
 *
 * All copy is genuine and comes from i18n/services-data (no filler, no
 * fabricated stats/results/reviews). The "Relevant projects" section is
 * DATABASE-BACKED: it fetches the public Website Projects API and only renders
 * projects that genuinely map to this service by category — never fabricated
 * substitutes. Locale comes from the URL via useTranslation; internal links
 * are localized. The component is a client component but is still statically
 * rendered to HTML at build time (SSG), so core content ships in the SSR HTML.
 */

import { useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import * as Icons from 'lucide-react';
import {
  Check,
  ArrowRight,
  ArrowUpRight,
  MessagesSquare,
  PencilRuler,
  Hammer,
  Rocket,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import Breadcrumbs from '@/components/seo/Breadcrumbs';
import { useTranslation } from '@/hooks/useTranslation';
import { useLocalizedHref } from '@/hooks/useLocalizedHref';
import { getService } from '@/i18n/services-data';
import { websiteProjectApi } from '@/lib/api';
import type { WebsiteProject, Locale } from '@/types';
import { projectTitle, projectCategory, projectBlurb } from '@/lib/website-project';

const PRODUCT_NAMES: Record<string, { en: string; ar: string }> = {
  manarah: { en: 'Manarah', ar: 'منارة' },
  madar:   { en: 'Madar',   ar: 'مدار' },
  matjary: { en: 'Matjary', ar: 'متجري' },
};

/**
 * Genuine service → project category mapping. A service only shows a
 * "Relevant projects" section when we have a real, admin-managed project in
 * one of these categories. Categories are matched case-insensitively against
 * the canonical (English) project.category value coming from the ERP.
 *
 * Only the three genuinely delivered projects exist in the catalog today:
 *   • Web Development     → Tameer Home
 *   • E-Commerce          → Homy Perfumes
 *   • Visual Identity     → Emdad
 * Services without a genuine match render no projects section at all.
 */
const SERVICE_PROJECT_CATEGORIES: Record<string, string[]> = {
  'web-development': ['web development', 'e-commerce', 'ecommerce'],
  'erp-crm': ['web development'],
  'design-visual-identity': ['visual identity'],
};

function Icon({ name, color, size = 26 }: { name: string; color: string; size?: number }) {
  const Cmp =
    (Icons as unknown as Record<string, React.ComponentType<{ size?: number; color?: string }>>)[name] ||
    Icons.Boxes;
  return <Cmp size={size} color={color} />;
}

// ── How We Work — genuine, generic process copy (no fabricated timelines) ────
function processSteps(locale: Locale) {
  const en = [
    { icon: MessagesSquare, title: 'Discovery', desc: 'We learn your goals, users and constraints before writing any code.' },
    { icon: PencilRuler, title: 'Design & Plan', desc: 'We shape the approach, scope and design so expectations are clear.' },
    { icon: Hammer, title: 'Build & Iterate', desc: 'We build in focused steps and share progress so you can give feedback early.' },
    { icon: Rocket, title: 'Launch & Support', desc: 'We ship, help you go live and stay available for ongoing improvements.' },
  ];
  const ar = [
    { icon: MessagesSquare, title: 'الاستكشاف', desc: 'نفهم أهدافك ومستخدميك ومتطلباتك قبل كتابة أي سطر برمجي.' },
    { icon: PencilRuler, title: 'التصميم والتخطيط', desc: 'نحدّد المنهجية والنطاق والتصميم لتكون التوقعات واضحة.' },
    { icon: Hammer, title: 'البناء والتطوير', desc: 'نبني على خطوات مركّزة ونشاركك التقدّم لتقدّم ملاحظاتك مبكراً.' },
    { icon: Rocket, title: 'الإطلاق والدعم', desc: 'نطلق المنتج ونساعدك على التشغيل ونبقى إلى جانبك للتحسين المستمر.' },
  ];
  return locale === 'ar' ? ar : en;
}

// ── Relevant projects (DATABASE-BACKED, genuine only) ────────────────────────
function RelevantProjects({
  slug,
  accent,
  locale,
  heading,
}: {
  slug: string;
  accent: string;
  locale: Locale;
  heading: string;
}) {
  const wantedCategories = SERVICE_PROJECT_CATEGORIES[slug];

  const { data } = useQuery({
    queryKey: ['website-projects', 'service-relevant'],
    enabled: !!wantedCategories,
    queryFn: async () => {
      try {
        const res = await websiteProjectApi.getAll({ page: 1, limit: 24 });
        const projects: WebsiteProject[] = res.data?.data?.projects ?? [];
        return projects;
      } catch {
        return [] as WebsiteProject[];
      }
    },
    staleTime: 5 * 60_000,
  });

  const matches = useMemo(() => {
    if (!wantedCategories || !data) return [];
    const wanted = wantedCategories.map((c) => c.toLowerCase());
    return data.filter((p) => {
      const cat = (p.category ?? '').trim().toLowerCase();
      return cat && wanted.includes(cat);
    });
  }, [data, wantedCategories]);

  // Genuine content only — render nothing when there is no real match.
  if (!wantedCategories || matches.length === 0) return null;

  return (
    <section className="mt-16">
      <h2 className="mb-6 text-2xl font-bold text-white">{heading}</h2>
      <div className="grid gap-5 sm:grid-cols-2">
        {matches.map((p) => {
          const title = projectTitle(p, locale);
          const cat = projectCategory(p, locale);
          const blurb = projectBlurb(p, locale);
          const card = (
            <div
              className="group h-card h-card-interactive flex h-full flex-col overflow-hidden rounded-2xl"
              style={{ boxShadow: 'var(--shadow-card)' }}
            >
              {p.imageUrl && (
                <div
                  className="relative flex items-center justify-center overflow-hidden"
                  style={{ aspectRatio: '16 / 9', background: 'var(--surface-3)' }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.imageUrl}
                    alt={title}
                    loading="lazy"
                    className={`h-full w-full ${
                      p.imageUrl.startsWith('/projects/')
                        ? 'object-cover'
                        : 'object-contain p-4'
                    } transition-transform duration-500 group-hover:scale-[1.03]`}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
              <div className="flex flex-1 flex-col gap-2 p-5">
                {cat && (
                  <span
                    className="text-xs font-semibold uppercase tracking-wider"
                    style={{ color: accent }}
                  >
                    {cat}
                  </span>
                )}
                <h3 className="text-lg font-bold text-white">{title}</h3>
                {blurb && (
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-4)' }}>
                    {blurb}
                  </p>
                )}
              </div>
            </div>
          );

          // Link out only when a genuine, public project URL exists.
          return p.projectUrl ? (
            <a
              key={p.id}
              href={p.projectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              {card}
            </a>
          ) : (
            <div key={p.id}>{card}</div>
          );
        })}
      </div>
    </section>
  );
}

export default function ServiceDetail({ slug }: { slug: string }) {
  const { locale, isRTL } = useTranslation();
  const lh = useLocalizedHref();
  const svc = getService(slug);
  if (!svc) return null;

  const homeLabel = locale === 'ar' ? 'الرئيسية' : 'Home';
  const servicesLabel = locale === 'ar' ? 'الخدمات' : 'Services';
  const audienceHeading = locale === 'ar' ? 'لمن هذه الخدمة' : 'Who this is for';
  const deliverHeading = locale === 'ar' ? 'ما الذي نقدّمه' : 'What we deliver';
  const capHeading = locale === 'ar' ? 'القدرات والتقنيات' : 'Capabilities & technologies';
  const processHeading = locale === 'ar' ? 'كيف نعمل' : 'How we work';
  const relatedHeading = locale === 'ar' ? 'منتجات ذات صلة' : 'Related products';
  const projectsHeading = locale === 'ar' ? 'مشاريع ذات صلة' : 'Relevant projects';
  const ctaTitle = locale === 'ar' ? 'هل لديك مشروع في ذهنك؟' : 'Have a project in mind?';
  const ctaText =
    locale === 'ar'
      ? 'تواصل معنا لمناقشة احتياجاتك ونقترح لك الحل المناسب.'
      : 'Get in touch to discuss your needs and we’ll propose the right approach.';
  const primaryCta = locale === 'ar' ? 'ابدأ الآن' : 'Get started';
  const secondaryCta = locale === 'ar' ? 'تصفّح الخدمات' : 'Explore services';
  const allServices = locale === 'ar' ? 'كل الخدمات' : 'All services';
  const badgeLabel = locale === 'ar' ? 'خدمة من هاندلا' : 'Handla service';

  const steps = processSteps(locale);

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: 'var(--page-bg)', color: 'var(--ink-1)' }}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <Navbar />

      <Breadcrumbs
        items={[
          { label: homeLabel, href: lh('/') },
          { label: servicesLabel, href: lh('/services') },
          { label: svc.title[locale] },
        ]}
      />

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden">
        {/* Ambient accent glow */}
        <div
          className="pointer-events-none absolute -top-24 left-1/2 h-[420px] w-[720px] -translate-x-1/2"
          style={{ background: `radial-gradient(circle, ${svc.accent}18 0%, transparent 70%)` }}
        />
        {/* Subtle grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              'linear-gradient(var(--ov-soft) 1px, transparent 1px), linear-gradient(90deg, var(--ov-soft) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            maskImage: 'radial-gradient(ellipse 70% 60% at 50% 0%, black, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 0%, black, transparent 75%)',
          }}
        />

        <div className="relative mx-auto max-w-5xl px-4 pt-10 pb-14 sm:px-6 sm:pt-14 lg:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_auto]">
            {/* Text column */}
            <div>
              <motion.span
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="mb-5 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider"
                style={{ background: `${svc.accent}1a`, border: `1px solid ${svc.accent}44`, color: svc.accent }}
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: svc.accent }}
                />
                {badgeLabel}
              </motion.span>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.05 }}
                className="text-4xl font-extrabold leading-[1.1] text-white sm:text-5xl lg:text-6xl"
              >
                {svc.title[locale]}
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.12 }}
                className="mt-5 max-w-2xl text-lg leading-relaxed"
                style={{ color: 'var(--ink-4)' }}
              >
                {svc.intro[locale]}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="mt-8 flex flex-wrap items-center gap-3"
              >
                <a
                  href={lh('/#contact')}
                  className="group inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold transition-all hover:-translate-y-0.5"
                  style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', color: '#1a1a1a' }}
                >
                  {primaryCta}
                  <ArrowRight
                    className={`h-4 w-4 transition-transform group-hover:translate-x-1 ${
                      isRTL ? 'rotate-180 group-hover:-translate-x-1' : ''
                    }`}
                  />
                </a>
                <Link
                  href={lh('/services')}
                  className="btn-secondary inline-flex items-center gap-2 rounded-xl border px-6 py-3 text-sm font-semibold transition-all hover:text-white"
                  style={{ borderColor: 'var(--ov-med)', color: 'var(--ink-3)' }}
                >
                  {secondaryCta}
                </Link>
              </motion.div>
            </div>

            {/* Supporting visual — large accented service icon */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="hidden lg:flex"
              aria-hidden="true"
            >
              <div
                className="relative flex h-44 w-44 items-center justify-center rounded-[2rem]"
                style={{
                  background: `linear-gradient(145deg, ${svc.accent}22, var(--surface-1))`,
                  border: `1px solid ${svc.accent}44`,
                  boxShadow: `0 0 60px ${svc.accent}22`,
                }}
              >
                <div
                  className="flex h-24 w-24 items-center justify-center rounded-3xl"
                  style={{ background: 'var(--surface-3)', border: `1px solid ${svc.accent}55` }}
                >
                  <Icon name={svc.icon} color={svc.accent} size={44} />
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-24 sm:px-6 lg:px-8">
        {/* ── What we deliver — capability CARDS ─────────────────────────── */}
        <section className="mt-4">
          <p className="h-label mb-3">{deliverHeading}</p>
          <h2 className="mb-7 text-2xl font-bold text-white sm:text-3xl">
            {locale === 'ar' ? 'ما تحصل عليه معنا' : 'What you get with us'}
          </h2>
          <div className="grid gap-5 sm:grid-cols-3">
            {svc.deliverables[locale].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.45, delay: i * 0.06 }}
                className="group h-card h-card-interactive flex flex-col gap-3 rounded-2xl p-6"
              >
                <span
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110"
                  style={{ background: `${svc.accent}1a`, border: `1px solid ${svc.accent}44` }}
                >
                  <Icon name={svc.icon} color={svc.accent} size={20} />
                </span>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-3)' }}>
                  {item}
                </p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── Capabilities & technologies — accented chip cards ──────────── */}
        <section className="mt-16">
          <p className="h-label mb-3">{capHeading}</p>
          <h2 className="mb-7 text-2xl font-bold text-white sm:text-3xl">
            {locale === 'ar' ? 'الأدوات والتقنيات التي نعتمدها' : 'Tools & technologies we rely on'}
          </h2>
          <div className="flex flex-wrap gap-2.5">
            {svc.capabilities.map((c) => (
              <span
                key={c}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all hover:-translate-y-0.5"
                style={{ background: 'var(--surface-1)', border: '1px solid var(--ov-med)', color: 'var(--ink-2)' }}
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: svc.accent }} />
                {c}
              </span>
            ))}
          </div>
        </section>

        {/* ── Who this is for ────────────────────────────────────────────── */}
        <section className="mt-16">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div>
              <p className="h-label mb-3">{audienceHeading}</p>
              <h2 className="text-2xl font-bold text-white sm:text-3xl">
                {locale === 'ar' ? 'مصمّمة لك إذا كنت' : 'Built for you if you’re'}
              </h2>
            </div>
            <ul className="space-y-4">
              {svc.audience[locale].map((item, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: isRTL ? 16 : -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.4, delay: i * 0.06 }}
                  className="flex items-start gap-3 rounded-xl p-4"
                  style={{ background: 'var(--surface-1)', border: '1px solid var(--ov-med)' }}
                >
                  <span
                    className="mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg"
                    style={{ background: `${svc.accent}1a`, border: `1px solid ${svc.accent}44` }}
                  >
                    <Check className="h-3.5 w-3.5" style={{ color: svc.accent }} />
                  </span>
                  <span className="text-sm leading-relaxed" style={{ color: 'var(--ink-3)' }}>
                    {item}
                  </span>
                </motion.li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── How we work ────────────────────────────────────────────────── */}
        <section className="mt-16">
          <p className="h-label mb-3">{processHeading}</p>
          <h2 className="mb-7 text-2xl font-bold text-white sm:text-3xl">
            {locale === 'ar' ? 'طريقة عملنا معك' : 'How we work with you'}
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.45, delay: i * 0.06 }}
                className="group h-card h-card-interactive relative flex flex-col gap-3 rounded-2xl p-6"
              >
                <span
                  className="text-xs font-bold tabular-nums"
                  style={{ color: svc.accent }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110"
                  style={{ background: `${svc.accent}1a`, border: `1px solid ${svc.accent}44` }}
                >
                  <step.icon className="h-5 w-5" style={{ color: svc.accent }} />
                </span>
                <h3 className="text-base font-bold text-white">{step.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-4)' }}>
                  {step.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── Related products ───────────────────────────────────────────── */}
        {svc.relatedProducts.length > 0 && (
          <section className="mt-16">
            <p className="h-label mb-3">{relatedHeading}</p>
            <h2 className="mb-7 text-2xl font-bold text-white sm:text-3xl">
              {locale === 'ar' ? 'منتجاتنا التي تدعم هذه الخدمة' : 'Our products that power this service'}
            </h2>
            <div className="flex flex-wrap gap-3">
              {svc.relatedProducts.map((p) => (
                <Link
                  key={p}
                  href={lh(`/products/${p}`)}
                  className="group inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all hover:-translate-y-0.5"
                  style={{ background: 'var(--surface-1)', border: '1px solid var(--ov-med)', color: 'var(--ink-2)' }}
                >
                  {PRODUCT_NAMES[p]?.[locale] ?? p}
                  <ArrowUpRight
                    className={`h-4 w-4 transition-transform group-hover:translate-x-0.5 ${
                      isRTL ? 'rotate-[-90deg]' : ''
                    }`}
                    style={{ color: svc.accent }}
                  />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Relevant projects (DATABASE-BACKED, genuine only) ──────────── */}
        <RelevantProjects
          slug={svc.slug}
          accent={svc.accent}
          locale={locale}
          heading={projectsHeading}
        />

        {/* ── Final CTA ──────────────────────────────────────────────────── */}
        <section
          className="relative mt-20 flex flex-col items-center gap-4 overflow-hidden rounded-3xl px-6 py-14 text-center"
          style={{ background: 'var(--surface-1)', border: '1px solid var(--ov-med)' }}
        >
          <div
            className="pointer-events-none absolute -top-16 left-1/2 h-56 w-72 -translate-x-1/2"
            style={{ background: `radial-gradient(circle, ${svc.accent}22 0%, transparent 70%)` }}
          />
          <h2 className="relative text-2xl font-bold text-white sm:text-3xl">{ctaTitle}</h2>
          <p className="relative mx-auto max-w-xl text-sm leading-relaxed" style={{ color: 'var(--ink-4)' }}>
            {ctaText}
          </p>
          <div className="relative mt-3 flex flex-wrap items-center justify-center gap-3">
            <a
              href={lh('/#contact')}
              className="group inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold transition-all hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', color: '#1a1a1a' }}
            >
              {primaryCta}
              <ArrowRight
                className={`h-4 w-4 transition-transform group-hover:translate-x-1 ${
                  isRTL ? 'rotate-180 group-hover:-translate-x-1' : ''
                }`}
              />
            </a>
            <Link
              href={lh('/services')}
              className="btn-secondary inline-flex items-center gap-2 rounded-xl border px-6 py-3 text-sm font-semibold transition-all hover:text-white"
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
