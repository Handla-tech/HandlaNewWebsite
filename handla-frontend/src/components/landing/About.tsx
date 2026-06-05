'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Lightbulb, TrendingUp, Users, CheckCircle2 } from 'lucide-react';
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
    { value: t('about.stats.projects'),   label: t('about.stats.projectsLabel'),   icon: '🚀', color: '#fbbf24' },
    { value: t('about.stats.industries'), label: t('about.stats.industriesLabel'), icon: '🌐', color: '#60a5fa' },
    { value: t('about.stats.support'),    label: t('about.stats.supportLabel'),    icon: '🕐', color: '#34d399' },
    { value: t('about.stats.uptime'),     label: t('about.stats.uptimeLabel'),     icon: '✅', color: '#a78bfa' },
  ];

  const FEATURES = [
    { icon: Lightbulb,   title: t('about.features.innovation'), desc: t('about.features.innovationDesc') },
    { icon: TrendingUp,  title: t('about.features.results'),    desc: t('about.features.resultsDesc')    },
    { icon: Users,       title: t('about.features.client'),     desc: t('about.features.clientDesc')     },
  ];

  return (
    <section id="about" ref={ref} className="relative py-24 sm:py-32 overflow-hidden" style={{ background: '#080808' }}>

      {/* Top separator */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06) 30%, rgba(255,255,255,0.06) 70%, transparent)' }}
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
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
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
            background: 'linear-gradient(135deg, rgba(251,191,36,0.08) 0%, rgba(255,255,255,0.02) 50%, rgba(251,191,36,0.04) 100%)',
            border: '1px solid rgba(251,191,36,0.12)',
          }}
        >
          <div
            className="rounded-xl p-6 sm:p-8"
            style={{ background: '#0d0d0d' }}
          >
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
              {STATS.map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 16 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: 0.1 + i * 0.1 }}
                  className="relative text-center group"
                >
                  {/* Vertical separator (except last) */}
                  {i < STATS.length - 1 && (
                    <div
                      className="hidden lg:block absolute right-0 top-1/2 -translate-y-1/2 w-px h-12"
                      style={{ background: 'rgba(255,255,255,0.05)' }}
                    />
                  )}

                  <div className="text-2xl mb-3">{stat.icon}</div>
                  <div
                    className="text-3xl sm:text-4xl font-extrabold mb-1.5 transition-all duration-300"
                    style={{ color: stat.color }}
                  >
                    {stat.value}
                  </div>
                  <div className="text-sm font-medium" style={{ color: '#555' }}>
                    {stat.label}
                  </div>
                </motion.div>
              ))}
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
            {/* Outer glow */}
            <div
              className="absolute -inset-4 rounded-3xl pointer-events-none"
              style={{
                background: 'radial-gradient(ellipse at center, rgba(251,191,36,0.08) 0%, transparent 65%)',
                filter: 'blur(20px)',
              }}
            />

            {/* Photo card */}
            <div
              className="relative rounded-2xl overflow-hidden"
              style={{
                border: '1px solid rgba(251,191,36,0.15)',
                boxShadow: '0 0 80px rgba(251,191,36,0.06), 0 40px 80px rgba(0,0,0,0.6)',
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

              {/* Gradient overlay */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'linear-gradient(to bottom, transparent 60%, rgba(8,8,8,0.4) 100%)',
                }}
              />

              {/* Premium corner decoration */}
              <div
                className="absolute top-0 left-0 w-16 h-16 pointer-events-none"
                style={{
                  background: 'linear-gradient(135deg, rgba(251,191,36,0.12) 0%, transparent 60%)',
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
                  background: '#0d0d0d',
                  border: '1px solid rgba(255,255,255,0.07)',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
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
            {/* Label */}
            <motion.p variants={itemVariants} className="h-label mb-3">
              {t('about.label')}
            </motion.p>

            {/* Headline */}
            <motion.h2
              variants={itemVariants}
              className="text-3xl sm:text-4xl font-extrabold text-white mb-5 leading-tight"
            >
              {t('about.headline')}
            </motion.h2>

            {/* Body */}
            <motion.p
              variants={itemVariants}
              className="text-base leading-relaxed mb-8"
              style={{ color: '#777' }}
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
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.04)',
                  }}
                  whileHover={{
                    backgroundColor: 'rgba(251,191,36,0.04)',
                    borderColor: 'rgba(251,191,36,0.12)',
                  }}
                >
                  <div
                    className="icon-badge flex-shrink-0 transition-all duration-200"
                    style={{ boxShadow: '0 0 0 0 rgba(251,191,36,0)' }}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-white text-sm mb-0.5">{title}</div>
                    <div className="text-sm leading-relaxed" style={{ color: '#666' }}>{desc}</div>
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
