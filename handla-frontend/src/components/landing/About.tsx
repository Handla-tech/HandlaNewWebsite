'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Lightbulb, TrendingUp, Users, CheckCircle2, Rocket, Globe, Clock, ShieldCheck } from 'lucide-react';
import Image from 'next/image';
import { useTranslation } from '@/hooks/useTranslation';

const containerVariants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};

export default function About() {
  const ref    = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const { t }  = useTranslation();

  const STATS = [
    { value: t('about.stats.projects'),   label: t('about.stats.projectsLabel'),   icon: Rocket,      color: '#fbbf24' },
    { value: t('about.stats.industries'), label: t('about.stats.industriesLabel'), icon: Globe,       color: '#60a5fa' },
    { value: t('about.stats.support'),    label: t('about.stats.supportLabel'),    icon: Clock,       color: '#34d399' },
    { value: t('about.stats.uptime'),     label: t('about.stats.uptimeLabel'),     icon: ShieldCheck, color: '#a78bfa' },
  ];

  const FEATURES = [
    { icon: Lightbulb,   title: t('about.features.innovation'), desc: t('about.features.innovationDesc') },
    { icon: TrendingUp,  title: t('about.features.results'),    desc: t('about.features.resultsDesc')    },
    { icon: Users,       title: t('about.features.client'),     desc: t('about.features.clientDesc')     },
  ];

  return (
    <section id="about" ref={ref} className="relative py-24 sm:py-32 overflow-hidden" style={{ background: 'var(--page-bg)' }}>

      {/* Top separator */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, var(--ov-med) 30%, var(--ov-med) 70%, transparent)' }}
      />

      {/* Ambient glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.03) 0%, transparent 70%)' }}
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* ── Section header ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <p className="h-label mb-3">{t('about.label')}</p>
          <h2 className="h-heading">
            {t('about.headline')}
          </h2>
        </motion.div>

        {/* ── Stats bar ──────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-20 rounded-2xl p-1"
          style={{
            background: 'linear-gradient(135deg, rgba(251,191,36,0.08) 0%, var(--ov-weak) 50%, rgba(251,191,36,0.04) 100%)',
            border: '1px solid rgba(251,191,36,0.12)',
          }}
        >
          <div
            className="rounded-xl p-6 sm:p-8"
            style={{ background: 'var(--surface-1)' }}
          >
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
              {STATS.map((stat, i) => {
                const Icon = stat.icon;
                return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 16 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: 0.1 + i * 0.1 }}
                  className="relative flex flex-col items-center text-center group"
                >
                  {/* Vertical separator (except last) */}
                  {i < STATS.length - 1 && (
                    <div
                      className="hidden lg:block absolute right-0 top-1/2 -translate-y-1/2 w-px h-12"
                      style={{ background: 'var(--ov-soft)' }}
                    />
                  )}

                  {/* Icon badge — consistent lucide icon in a tinted tile */}
                  <div
                    className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110"
                    style={{ background: `${stat.color}14`, border: `1px solid ${stat.color}26` }}
                  >
                    <Icon className="h-5 w-5" style={{ color: stat.color }} />
                  </div>
                  <div
                    className="text-3xl sm:text-4xl font-extrabold mb-1 transition-all duration-300"
                    style={{ color: stat.color }}
                  >
                    {stat.value}
                  </div>
                  <div className="text-sm font-medium" style={{ color: 'var(--ink-4)' }}>
                    {stat.label}
                  </div>
                </motion.div>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* ── About content ──────────────────────────────────────────────── */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* Left: photo */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            {/* Photo card */}
            <div
              className="relative rounded-2xl overflow-hidden"
              style={{
                border: '1px solid var(--ov-med)',
                boxShadow: 'var(--shadow-lg)',
                aspectRatio: '4/3',
              }}
            >
              <Image
                src="/about-hero.jpg"
                alt="Handla — professional workspace with ERP dashboard, mobile app and website on devices; business handshake in background"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
                priority
              />

              {/* Subtle bottom gradient — keeps depth without heavy fog */}
              <div
                className="absolute inset-x-0 bottom-0 h-1/3 pointer-events-none"
                style={{
                  background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.18))',
                }}
              />
            </div>

            {/* Floating checkmarks */}
            {[
              { text: 'Certified Team', delay: 1.0 },
              { text: 'ISO Compliant',  delay: 1.2 },
            ].map(({ text, delay }, i) => (
              <motion.div
                key={text}
                className="absolute flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{
                  bottom: i === 0 ? '1.5rem' : undefined,
                  top: i === 1 ? '1.5rem' : undefined,
                  right: '-1rem',
                  background: 'var(--surface-1)',
                  border: '1px solid var(--ov-med)',
                  boxShadow: 'var(--shadow-md)',
                }}
                initial={{ opacity: 0, x: 16 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.5, delay }}
              >
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#22c55e' }} />
                <span className="text-xs font-medium text-white whitespace-nowrap">{text}</span>
              </motion.div>
            ))}
          </motion.div>

          {/* Right: text */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate={inView ? 'visible' : 'hidden'}
          >
            {/* Body */}
            <motion.p
              variants={itemVariants}
              className="text-base leading-relaxed mb-8 max-w-prose"
              style={{ color: 'var(--ink-3)' }}
            >
              {t('about.description')}
            </motion.p>

            {/* Features */}
            <div className="space-y-3">
              {FEATURES.map(({ icon: Icon, title, desc }) => (
                <motion.div
                  key={title}
                  variants={itemVariants}
                  className="flex items-start gap-4 p-4 rounded-xl transition-all duration-200 group"
                  style={{
                    background: 'var(--ov-weak)',
                    border: '1px solid var(--ov-soft)',
                  }}
                  whileHover={{
                    y: -2,
                    backgroundColor: 'rgba(251,191,36,0.05)',
                    borderColor: 'rgba(251,191,36,0.18)',
                  }}
                >
                  <div className="icon-badge flex-shrink-0 transition-transform duration-200 group-hover:scale-105">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-white text-sm mb-1">{title}</div>
                    <div className="text-sm leading-relaxed" style={{ color: 'var(--ink-3)' }}>{desc}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
