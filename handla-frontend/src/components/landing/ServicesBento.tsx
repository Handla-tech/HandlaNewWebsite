'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Globe, BarChart3, Smartphone, Cloud, ArrowUpRight, Zap, Shield, Clock } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

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

  const SERVICES = [
    {
      icon: Globe,
      title: t('services.web.title'),
      desc: t('services.web.description'),
      pills: ['React', 'Next.js', 'TypeScript'],
      accent: '#60a5fa',
      span: 'col-span-1',
    },
    {
      icon: BarChart3,
      title: t('services.erp.title'),
      desc: t('services.erp.description'),
      pills: ['Inventory', 'Finance', 'CRM'],
      accent: '#fbbf24',
      span: 'col-span-1',
      featured: true,
    },
    {
      icon: Smartphone,
      title: t('services.mobile.title'),
      desc: t('services.mobile.description'),
      pills: ['iOS', 'Android', 'React Native'],
      accent: '#34d399',
      span: 'col-span-1',
    },
    {
      icon: Cloud,
      title: t('services.hosting.title'),
      desc: t('services.hosting.description'),
      pills: ['AWS', 'Docker', 'CI/CD'],
      accent: '#a78bfa',
      span: 'col-span-1',
    },
  ];

  const HIGHLIGHTS = [
    { icon: Zap,    label: 'Fast Delivery', value: '6 weeks avg' },
    { icon: Shield, label: 'Secure & Reliable', value: '99.9% uptime' },
    { icon: Clock,  label: '24/7 Support', value: 'Always online' },
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
          {SERVICES.map(({ icon: Icon, title, desc, pills, accent, featured }, i) => (
            <motion.div
              key={title}
              custom={i}
              variants={cardVariants}
              initial="hidden"
              animate={inView ? 'visible' : 'hidden'}
              className="group relative rounded-2xl p-6 overflow-hidden cursor-pointer transition-all duration-300"
              style={{
                background: featured
                  ? 'linear-gradient(135deg, var(--surface-2) 0%, var(--surface-3) 100%)'
                  : 'var(--surface-1)',
                border: featured
                  ? '1px solid rgba(251,191,36,0.18)'
                  : '1px solid var(--ov-med)',
                boxShadow: 'var(--shadow-card)',
              }}
              whileHover={{
                borderColor: `${accent}40`,
                boxShadow: 'var(--shadow-md)',
                y: -3,
              }}
            >
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
            </motion.div>
          ))}
        </div>

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
