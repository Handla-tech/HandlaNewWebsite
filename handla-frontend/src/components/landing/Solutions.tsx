'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { GraduationCap, Users, ArrowRight } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

const containerVariants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.12 } },
};

const itemVariants = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};

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
    },
    {
      icon: Users,
      title: t('solutions.hrPayroll.title'),
      desc:  t('solutions.hrPayroll.description'),
      cta:   t('solutions.hrPayroll.learnMore'),
      href:  '#contact',
    },
  ];

  return (
    <section id="solutions" ref={ref} className="relative py-24 sm:py-32">
      {/* Subtle separator */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, #1e1e1e 30%, #1e1e1e 70%, transparent)' }}
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
          <p className="text-base max-w-2xl mx-auto" style={{ color: '#666' }}>
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
          {SOLUTIONS.map(({ icon: Icon, title, desc, cta, href }) => (
            <motion.div
              key={title}
              variants={itemVariants}
              className="group rounded-2xl p-8 transition-all duration-300 h-card h-card-gold"
            >
              {/* Icon */}
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6"
                style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)' }}
              >
                <Icon className="w-6 h-6" style={{ color: '#fbbf24' }} />
              </div>

              <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
              <p className="text-sm leading-relaxed mb-6" style={{ color: '#666' }}>{desc}</p>

              <a
                href={href}
                onClick={(e) => {
                  e.preventDefault();
                  document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-1.5 text-sm font-semibold transition-colors"
                style={{ color: '#fbbf24' }}
              >
                {cta}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </a>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
