'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { motion, useInView } from 'framer-motion';
import { Globe, BarChart3, Smartphone, Cloud, Video, Mic, Palette, TrendingUp, ArrowUpRight, ArrowRight, Zap, Shield, Clock } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useLocalizedHref } from '@/hooks/useLocalizedHref';

const cardVariants = {
  hidden:  { opacity: 0, y: 28 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] },
  }),
};

// Mini feature pills inside a card
function FeaturePill({ text }: { text: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
      style={{
        background: 'var(--ov-soft)',
        border: '1px solid var(--ov-med)',
        color: 'var(--ink-3)',
      }}
    >
      <span className="w-1 h-1 rounded-full" style={{ background: '#fbbf24' }} />
      {text}
    </span>
  );
}

export default function ServicesBento() {
  const ref    = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const { t }  = useTranslation();
  const lh     = useLocalizedHref();

  // The canonical 8 Handla services. Each card links to its dedicated
  // /[locale]/services/[slug] landing page (internal SEO linking). All 8 are
  // genuine services with real detail content (see i18n/services-data.ts), so
  // every card carries a `slug` and links to a real detail page — the visible
  // catalog and the structured/sitemap catalog stay in sync.
  const SERVICES = [
    {
      icon: Globe,
      title: t('services.web.title'),
      desc: t('services.web.description'),
      pills: ['React', 'Next.js', 'TypeScript'],
      accent: '#60a5fa',
      span: 'col-span-1',
      slug: 'web-development',
    },
    {
      icon: BarChart3,
      title: t('services.erp.title'),
      desc: t('services.erp.description'),
      pills: ['Inventory', 'Finance', 'CRM'],
      accent: '#fbbf24',
      span: 'col-span-1',
      featured: true,
      slug: 'erp-crm',
    },
    {
      icon: Smartphone,
      title: t('services.mobile.title'),
      desc: t('services.mobile.description'),
      pills: ['iOS', 'Android', 'React Native'],
      accent: '#34d399',
      span: 'col-span-1',
      slug: 'mobile-applications',
    },
    {
      icon: Cloud,
      title: t('services.hosting.title'),
      desc: t('services.hosting.description'),
      pills: ['AWS', 'Docker', 'CI/CD'],
      accent: '#a78bfa',
      span: 'col-span-1',
      slug: 'cloud-infrastructure',
    },
    {
      icon: Video,
      title: t('services.videoEditing.title'),
      desc: t('services.videoEditing.description'),
      pills: ['Reels', 'Long Videos', 'Motion Graphics'],
      accent: '#f472b6',
      span: 'col-span-1',
      slug: 'video-editing',
    },
    {
      icon: Mic,
      title: t('services.podcastEditing.title'),
      desc: t('services.podcastEditing.description'),
      pills: ['Video Podcast', 'Audio', 'Short Clips'],
      accent: '#22d3ee',
      span: 'col-span-1',
      slug: 'podcast-editing',
    },
    {
      icon: Palette,
      title: t('services.design.title'),
      desc: t('services.design.description'),
      pills: ['Logo', 'Brand Identity', 'Social Design'],
      accent: '#fb923c',
      span: 'col-span-1',
      slug: 'design-visual-identity',
    },
    {
      icon: TrendingUp,
      title: t('services.marketing.title'),
      desc: t('services.marketing.description'),
      pills: ['Brand Strategy', 'Marketing Plan', 'Launch Plan'],
      accent: '#4ade80',
      span: 'col-span-1',
      slug: 'strategy-marketing',
    },
  ];

  const HIGHLIGHTS = [
    { icon: Zap,    label: t('services.highlights.delivery.label'),  value: t('services.highlights.delivery.value')  },
    { icon: Shield, label: t('services.highlights.security.label'),  value: t('services.highlights.security.value')  },
    { icon: Clock,  label: t('services.highlights.support.label'),   value: t('services.highlights.support.value')   },
  ];

  return (
    <section
      id="services"
      ref={ref}
      className="relative py-24 sm:py-32 overflow-hidden"
      style={{ background: 'var(--page-bg)' }}
    >
      {/* Top separator */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, var(--ov-med) 30%, var(--ov-med) 70%, transparent)' }}
      />

      {/* Ambient glows */}
      <div
        className="absolute top-0 right-0 w-[500px] h-[500px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.04) 0%, transparent 70%)' }}
      />
      <div
        className="absolute bottom-0 left-0 w-[400px] h-[400px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(96,165,250,0.03) 0%, transparent 70%)' }}
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* ── Section header ──────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <p className="h-label mb-3">{t('services.label')}</p>
          <h2 className="h-heading mb-4">
            {t('services.headline')}
          </h2>
          <p className="h-intro max-w-xl mx-auto">
            {t('services.description')}
          </p>
        </motion.div>

        {/* ── Bento grid ───────────────────────────────────────────────── */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {SERVICES.map(({ icon: Icon, title, desc, pills, accent, featured, slug }, i) => {
            const cardInner = (
              <>
                {/* Featured gold top border */}
                {featured && (
                  <div
                    className="absolute top-0 left-0 right-0 h-px"
                    style={{ background: 'linear-gradient(90deg, transparent, rgba(251,191,36,0.5), transparent)' }}
                  />
                )}

                {/* Inner glow on hover */}
                <div
                  className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-300"
                  style={{ background: `radial-gradient(ellipse at top left, ${accent}05 0%, transparent 60%)` }}
                />

                <div className="relative">
                  {/* Icon + arrow row */}
                  <div className="flex items-start justify-between mb-5">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:scale-110"
                      style={{
                        background: `${accent}12`,
                        border: `1px solid ${accent}20`,
                        color: accent,
                      }}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <ArrowUpRight
                      className="w-4 h-4 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      style={{ color: 'var(--ink-8)' }}
                    />
                  </div>

                  <h3 className="text-lg font-bold text-white mb-2 leading-tight">{title}</h3>
                  <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--ink-3)' }}>{desc}</p>

                  {/* Pills */}
                  <div className="flex flex-wrap gap-1.5">
                    {pills.map((pill) => (
                      <FeaturePill key={pill} text={pill} />
                    ))}
                  </div>
                </div>
              </>
            );

            const cardClass =
              'group relative block rounded-2xl p-6 overflow-hidden transition-all duration-300 h-full';
            const cardStyle = {
              background: featured
                ? 'linear-gradient(135deg, var(--surface-2) 0%, var(--surface-3) 100%)'
                : 'var(--surface-1)',
              border: featured
                ? '1px solid rgba(251,191,36,0.18)'
                : '1px solid var(--ov-med)',
              boxShadow: 'var(--shadow-card)',
            } as const;
            const hover = {
              borderColor: `${accent}40`,
              boxShadow: 'var(--shadow-md)',
              y: -3,
            };

            return (
              <motion.div
                key={title}
                custom={i}
                variants={cardVariants}
                initial="hidden"
                animate={inView ? 'visible' : 'hidden'}
                whileHover={hover}
                className="h-full"
              >
                {slug ? (
                  <Link
                    href={lh(`/services/${slug}`)}
                    className={`${cardClass} cursor-pointer`}
                    style={cardStyle}
                    aria-label={title}
                  >
                    {cardInner}
                  </Link>
                ) : (
                  <div className={cardClass} style={cardStyle}>
                    {cardInner}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* ── Explore all services CTA ─────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="mb-6 flex justify-center"
        >
          <Link
            href={lh('/services')}
            className="group inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all duration-200"
            style={{
              background: 'rgba(251,191,36,0.1)',
              border: '1px solid rgba(251,191,36,0.25)',
              color: '#fbbf24',
            }}
          >
            {t('services.viewAll')}
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
        </motion.div>

        {/* ── Highlights strip ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="grid sm:grid-cols-3 gap-4"
        >
          {HIGHLIGHTS.map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="flex items-center gap-4 rounded-xl px-5 py-4 transition-all duration-200"
              style={{
                background: 'var(--surface-1)',
                border: '1px solid var(--ov-med)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.18)' }}
              >
                <Icon className="w-4 h-4" style={{ color: '#fbbf24' }} />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">{label}</div>
                <div className="text-xs mt-0.5 font-medium" style={{ color: '#fbbf24' }}>{value}</div>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
