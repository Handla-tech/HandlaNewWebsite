'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Search, Pencil, Code2, Rocket, ArrowRight, ArrowLeft } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

const containerVariants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const stepVariants = {
  hidden:  { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};

export default function Process() {
  const ref          = useRef<HTMLDivElement>(null);
  const inView       = useInView(ref, { once: true, margin: '-80px' });
  const { t, isRTL } = useTranslation();

  const STEPS = [
    { icon: Search, num: t('process.steps.discovery.number'), title: t('process.steps.discovery.title'), desc: t('process.steps.discovery.description') },
    { icon: Pencil, num: t('process.steps.design.number'),    title: t('process.steps.design.title'),    desc: t('process.steps.design.description')    },
    { icon: Code2,  num: t('process.steps.build.number'),     title: t('process.steps.build.title'),     desc: t('process.steps.build.description')     },
    { icon: Rocket, num: t('process.steps.launch.number'),    title: t('process.steps.launch.title'),    desc: t('process.steps.launch.description')    },
  ];

  const ConnectorArrow = isRTL
    ? <ArrowLeft  className="w-5 h-5" style={{ color: '#2a2a2a' }} />
    : <ArrowRight className="w-5 h-5" style={{ color: '#2a2a2a' }} />;

  return (
    <section id="process" ref={ref} className="relative py-24 sm:py-32" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Top separator */}
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
          <p className="h-label mb-3">{t('process.label')}</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
            {t('process.headline')}
          </h2>
        </motion.div>

        {/* ── Steps ───────────────────────────────────────────────────── */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {STEPS.map(({ num, icon: Icon, title, desc }, i) => (
            <motion.div
              key={num}
              variants={stepVariants}
              className="relative group rounded-2xl p-6 transition-all duration-300 h-card h-card-gold"
            >
              {/*
                Step number decorative bg:
                — LTR: top-right corner
                — RTL: top-left corner
              */}
              <div
                className={`absolute top-4 ${isRTL ? 'left-4' : 'right-4'} text-5xl font-black leading-none select-none pointer-events-none`}
                style={{ color: 'rgba(251,191,36,0.06)' }}
              >
                {num}
              </div>

              {/* Icon badge */}
              <div className="icon-badge mb-5">
                <Icon className="w-4 h-4" />
              </div>

              {/* Step number pill */}
              <div
                className="inline-block text-xs font-bold px-2 py-0.5 rounded-full mb-3"
                style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24' }}
              >
                {num}
              </div>

              <h3 className="text-base font-bold text-white mb-2">{title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: '#666' }}>{desc}</p>

              {/* Connector arrow — flips side and direction in RTL */}
              {i < STEPS.length - 1 && (
                <div
                  className={`hidden lg:block absolute top-1/2 -translate-y-1/2 z-10 ${
                    isRTL ? '-left-3' : '-right-3'
                  }`}
                >
                  {ConnectorArrow}
                </div>
              )}
            </motion.div>
          ))}
        </motion.div>

        {/* ── CTA ─────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="text-center mt-12"
        >
          <a
            href="#contact"
            onClick={(e) => {
              e.preventDefault();
              document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="btn-primary inline-flex items-center gap-2"
          >
            {t('process.cta')}
            {isRTL
              ? <ArrowLeft  className="w-4 h-4" />
              : <ArrowRight className="w-4 h-4" />
            }
          </a>
        </motion.div>
      </div>
    </section>
  );
}
