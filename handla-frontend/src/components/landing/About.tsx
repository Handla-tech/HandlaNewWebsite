'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Lightbulb, TrendingUp, Users } from 'lucide-react';
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
    { value: t('about.stats.projects'),   label: t('about.stats.projectsLabel'),   icon: '🚀' },
    { value: t('about.stats.industries'), label: t('about.stats.industriesLabel'), icon: '🌐' },
    { value: t('about.stats.support'),    label: t('about.stats.supportLabel'),    icon: '🕐' },
    { value: t('about.stats.uptime'),     label: t('about.stats.uptimeLabel'),     icon: '✅' },
  ];

  const FEATURES = [
    { icon: Lightbulb,   title: t('about.features.innovation'), desc: t('about.features.innovationDesc') },
    { icon: TrendingUp,  title: t('about.features.results'),    desc: t('about.features.resultsDesc')    },
    { icon: Users,       title: t('about.features.client'),     desc: t('about.features.clientDesc')     },
  ];

  return (
    <section id="about" ref={ref} className="relative py-24 sm:py-32 overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* ── Stats bar ──────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-20 rounded-2xl p-6 sm:p-8"
          style={{
            background: '#111111',
            border: '1px solid #1e1e1e',
            boxShadow: '0 4px 32px rgba(0,0,0,0.4)',
          }}
        >
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {STATS.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 16 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.1 + i * 0.1 }}
                className="text-center"
              >
                <div className="text-2xl mb-2">{stat.icon}</div>
                <div
                  className="text-3xl sm:text-4xl font-extrabold mb-1"
                  style={{ color: '#fbbf24' }}
                >
                  {stat.value}
                </div>
                <div className="text-sm font-medium" style={{ color: '#666' }}>
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* ── About content ──────────────────────────────────────────────── */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* Left: hero photo */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            {/* Outer glow ring */}
            <div
              className="absolute -inset-1 rounded-3xl pointer-events-none"
              style={{
                background: 'radial-gradient(ellipse at center, rgba(251,191,36,0.15) 0%, transparent 70%)',
                filter: 'blur(16px)',
              }}
            />

            {/* Photo card */}
            <div
              className="relative rounded-2xl overflow-hidden"
              style={{
                border: '1px solid rgba(251,191,36,0.18)',
                boxShadow: '0 0 60px rgba(251,191,36,0.08), 0 32px 80px rgba(0,0,0,0.6)',
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

              {/* Clean subtle gradient at bottom — no badge */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'linear-gradient(to bottom, transparent 70%, rgba(10,10,10,0.3) 100%)',
                }}
              />
            </div>
          </motion.div>

          {/* Right: text content */}
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
              style={{ color: '#a0a0a0' }}
            >
              {t('about.description')}
            </motion.p>

            {/* Features */}
            <div className="space-y-4">
              {FEATURES.map(({ icon: Icon, title, desc }) => (
                <motion.div
                  key={title}
                  variants={itemVariants}
                  className="flex items-start gap-4"
                >
                  <div className="icon-badge">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-white text-sm mb-0.5">{title}</div>
                    <div className="text-sm" style={{ color: '#666' }}>{desc}</div>
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
