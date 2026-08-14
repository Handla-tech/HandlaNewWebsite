'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { GraduationCap, Users, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

const containerVariants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.12 } },
};

const itemVariants = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};

// Feature check list item
function Feature({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: '#fbbf24' }} />
      <span className="text-sm" style={{ color: 'var(--ink-4)' }}>{text}</span>
    </div>
  );
}

export default function Solutions() {
  const ref    = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const { t }  = useTranslation();

  const SOLUTIONS = [
    {
      icon: GraduationCap,
      title: t('solutions.schoolErp.title'),
      desc:  t('solutions.schoolErp.description'),
      cta:   t('solutions.schoolErp.learnMore'),
      href:  '#contact',
      features: ['Student Management', 'Grade Tracking', 'Parent Portal'],
      accent: '#60a5fa',
      stat: { value: '50+', label: 'Schools onboarded' },
    },
    {
      icon: Users,
      title: t('solutions.hrPayroll.title'),
      desc:  t('solutions.hrPayroll.description'),
      cta:   t('solutions.hrPayroll.learnMore'),
      href:  '#contact',
      features: ['Payroll Automation', 'Leave Management', 'Attendance Tracking'],
      accent: '#fbbf24',
      stat: { value: '10K+', label: 'Employees managed' },
    },
  ];

  return (
    <section
      id="solutions"
      ref={ref}
      className="relative py-24 sm:py-32 overflow-hidden"
      style={{ background: 'var(--page-bg)' }}
    >
      {/* Top separator */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, var(--ov-med) 30%, var(--ov-med) 70%, transparent)' }}
      />

      {/* Gold center ambient glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(251,191,36,0.03) 0%, transparent 70%)' }}
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* ── Section header ──────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <p className="h-label mb-3">{t('solutions.label')}</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
            {t('solutions.headline')}
          </h2>
          <p className="text-base max-w-2xl mx-auto" style={{ color: 'var(--ink-5)' }}>
            {t('solutions.description')}
          </p>
        </motion.div>

        {/* ── Solution cards ──────────────────────────────────────────── */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          className="grid sm:grid-cols-2 gap-6"
        >
          {SOLUTIONS.map(({ icon: Icon, title, desc, cta, href, features, accent, stat }) => (
            <motion.div
              key={title}
              variants={itemVariants}
              className="group relative rounded-2xl p-8 overflow-hidden transition-all duration-300"
              style={{
                background: 'var(--surface-1)',
                border: '1px solid var(--ov-med)',
              }}
              whileHover={{
                borderColor: `${accent}20`,
                boxShadow: `0 0 40px ${accent}08`,
              }}
            >
              {/* Inner gradient accent on hover */}
              <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-500"
                style={{ background: `radial-gradient(ellipse at top left, ${accent}05 0%, transparent 60%)` }}
              />

              {/* Top accent line */}
              <div
                className="absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: `linear-gradient(90deg, transparent, ${accent}40, transparent)` }}
              />

              <div className="relative">
                {/* Icon + stat */}
                <div className="flex items-start justify-between mb-6">
                  <div
                    className="w-13 h-13 w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110"
                    style={{
                      background: `${accent}10`,
                      border: `1px solid ${accent}18`,
                      color: accent,
                    }}
                  >
                    <Icon className="w-6 h-6" />
                  </div>

                  {/* Stat badge */}
                  <div
                    className="text-right px-3 py-2 rounded-xl"
                    style={{
                      background: 'var(--ov-weak)',
                      border: '1px solid var(--ov-soft)',
                    }}
                  >
                    <div className="text-base font-extrabold" style={{ color: accent }}>{stat.value}</div>
                    <div className="text-xs" style={{ color: 'var(--ink-6)' }}>{stat.label}</div>
                  </div>
                </div>

                <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
                <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--ink-5)' }}>{desc}</p>

                {/* Features checklist */}
                <div className="space-y-2.5 mb-7">
                  {features.map((f) => <Feature key={f} text={f} />)}
                </div>

                {/* CTA */}
                <a
                  href={href}
                  onClick={(e) => {
                    e.preventDefault();
                    document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold transition-all duration-200 group/link"
                  style={{ color: accent }}
                >
                  {cta}
                  <ArrowRight className="w-4 h-4 group-hover/link:translate-x-0.5 transition-transform" />
                </a>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
