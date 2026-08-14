'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Search, Pencil, Code2, Rocket, ArrowRight, ArrowLeft } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

const stepVariants = {
  hidden:  { opacity: 0, y: 28 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.55, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function Process() {
  const ref          = useRef<HTMLDivElement>(null);
  const inView       = useInView(ref, { once: true, margin: '-80px' });
  const { t, isRTL } = useTranslation();

  const STEPS = [
    { icon: Search, num: t('process.steps.discovery.number'), title: t('process.steps.discovery.title'), desc: t('process.steps.discovery.description'), color: '#60a5fa' },
    { icon: Pencil, num: t('process.steps.design.number'),    title: t('process.steps.design.title'),    desc: t('process.steps.design.description'),    color: '#fbbf24' },
    { icon: Code2,  num: t('process.steps.build.number'),     title: t('process.steps.build.title'),     desc: t('process.steps.build.description'),     color: '#34d399' },
    { icon: Rocket, num: t('process.steps.launch.number'),    title: t('process.steps.launch.title'),    desc: t('process.steps.launch.description'),    color: '#a78bfa' },
  ];

  return (
    <section
      id="process"
      ref={ref}
      className="relative py-24 sm:py-32 overflow-hidden"
      style={{ background: 'var(--page-bg)' }}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Top separator */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, var(--ov-med) 30%, var(--ov-med) 70%, transparent)' }}
      />

      {/* Ambient glow */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(251,191,36,0.04) 0%, transparent 70%)' }}
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* ── Section header ──────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="h-label mb-3">{t('process.label')}</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
            {t('process.headline')}
          </h2>
          <p className="text-sm max-w-lg mx-auto" style={{ color: 'var(--ink-5)' }}>
            From idea to launch — a structured, proven process that delivers on time.
          </p>
        </motion.div>

        {/* ── Steps ─────────────────────────────────────────────────── */}
        <div className="relative grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">

          {/* Animated connector line (desktop only) */}
          <div className="hidden lg:block absolute top-8 left-[12.5%] right-[12.5%] h-px z-0">
            <div
              className="absolute inset-0"
              style={{ background: 'var(--ov-soft)' }}
            />
            <motion.div
              className="absolute inset-y-0 left-0"
              style={{ background: 'linear-gradient(90deg, #fbbf24, rgba(251,191,36,0.3))' }}
              initial={{ width: '0%' }}
              animate={inView ? { width: '100%' } : {}}
              transition={{ duration: 1.2, delay: 0.4, ease: 'easeOut' }}
            />
          </div>

          {STEPS.map(({ num, icon: Icon, title, desc, color }, i) => (
            <motion.div
              key={num}
              custom={i}
              variants={stepVariants}
              initial="hidden"
              animate={inView ? 'visible' : 'hidden'}
              className="relative group rounded-2xl p-6 transition-all duration-300"
              style={{
                background: 'var(--surface-1)',
                border: '1px solid var(--ov-soft)',
                zIndex: 1,
              }}
              whileHover={{
                borderColor: `${color}20`,
                boxShadow: `0 0 30px ${color}08`,
                y: -2,
              }}
            >
              {/* Hover inner glow */}
              <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-300"
                style={{ background: `radial-gradient(ellipse at top, ${color}05 0%, transparent 60%)` }}
              />

              {/* Step number watermark */}
              <div
                className={`absolute top-4 ${isRTL ? 'left-4' : 'right-4'} text-5xl font-black leading-none select-none pointer-events-none`}
                style={{ color: `${color}06` }}
              >
                {num}
              </div>

              {/* Icon circle */}
              <div
                className="relative w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-all duration-300 group-hover:scale-110"
                style={{
                  background: `${color}10`,
                  border: `1px solid ${color}18`,
                  color: color,
                }}
              >
                <Icon className="w-5 h-5" />

                {/* Step number badge */}
                <div
                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold"
                  style={{ background: color, color: '#000' }}
                >
                  {i + 1}
                </div>
              </div>

              <h3 className="text-base font-bold text-white mb-2">{title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-5)' }}>{desc}</p>

              {/* Connector arrow (desktop) */}
              {i < STEPS.length - 1 && (
                <div
                  className={`hidden lg:flex absolute top-[3.5rem] ${isRTL ? '-left-5' : '-right-5'} w-10 h-10 items-center justify-center z-20`}
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: 'var(--surface-1)', border: '1px solid var(--ov-strong)' }}
                  >
                    {isRTL
                      ? <ArrowLeft  className="w-3 h-3" style={{ color: 'var(--ink-7)' }} />
                      : <ArrowRight className="w-3 h-3" style={{ color: 'var(--ink-7)' }} />
                    }
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* ── CTA ────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="text-center"
        >
          <a
            href="#contact"
            onClick={(e) => {
              e.preventDefault();
              document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="btn-primary inline-flex items-center gap-2 group"
          >
            {t('process.cta')}
            {isRTL
              ? <ArrowLeft  className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              : <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            }
          </a>
        </motion.div>
      </div>
    </section>
  );
}
