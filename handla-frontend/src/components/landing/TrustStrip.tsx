'use client';

import { motion } from 'framer-motion';
import { useTranslation } from '@/hooks/useTranslation';

const TECH_STACK = [
  { name: 'Next.js',      icon: '▲' },
  { name: 'NestJS',       icon: '🦁' },
  { name: 'TypeScript',   icon: 'TS' },
  { name: 'PostgreSQL',   icon: '🐘' },
  { name: 'Redis',        icon: '⚡' },
  { name: 'AWS',          icon: '☁' },
  { name: 'Docker',       icon: '🐳' },
  { name: 'React',        icon: '⚛' },
  { name: 'Tailwind',     icon: '🎨' },
  { name: 'Socket.io',    icon: '🔌' },
  { name: 'GraphQL',      icon: '◉' },
  { name: 'Kubernetes',   icon: '☸' },
] as const;

// Duplicate for seamless looping
const ITEMS = [...TECH_STACK, ...TECH_STACK];

export default function TrustStrip() {
  const { t } = useTranslation();
  return (
    <section
      className="relative py-10 overflow-hidden"
      style={{
        background: 'var(--page-bg)',
        borderTop:    '1px solid var(--ov-soft)',
        borderBottom: '1px solid var(--ov-soft)',
      }}
    >
      {/* Subtle gold top highlight */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-px pointer-events-none"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(251,191,36,0.2), transparent)' }}
      />

      {/* Fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-32 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to right, var(--page-bg), transparent)' }} />
      <div className="absolute right-0 top-0 bottom-0 w-32 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to left, var(--page-bg), transparent)' }} />

      {/* Label */}
      <div className="flex items-center gap-4 mb-5 justify-center">
        <div
          className="h-px flex-1 max-w-16"
          style={{ background: 'linear-gradient(to right, transparent, var(--ov-strong))' }}
        />
        <p
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: 'var(--ink-7)' }}
        >
          {t('contact.trustStrip')}
        </p>
        <div
          className="h-px flex-1 max-w-16"
          style={{ background: 'linear-gradient(to left, transparent, var(--ov-strong))' }}
        />
      </div>

      {/* Marquee track */}
      <div className="overflow-hidden">
        <motion.div
          animate={{ x: [0, '-50%'] }}
          transition={{
            duration: 30,
            repeat: Infinity,
            ease: 'linear',
          }}
          className="flex gap-3 w-max"
        >
          {ITEMS.map(({ name, icon }, idx) => (
            <div
              key={`${name}-${idx}`}
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl cursor-default select-none shrink-0 group transition-all duration-300"
              style={{
                background: 'var(--ov-weak)',
                border: '1px solid var(--ov-soft)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(251,191,36,0.05)';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(251,191,36,0.2)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 0 16px rgba(251,191,36,0.08)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'var(--ov-weak)';
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--ov-soft)';
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
              }}
            >
              <span
                className="text-base leading-none transition-transform duration-300 group-hover:scale-110"
                aria-hidden
              >
                {icon}
              </span>
              <span
                className="text-sm font-medium transition-colors duration-300"
                style={{ color: 'var(--ink-6)' }}
              >
                {name}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
