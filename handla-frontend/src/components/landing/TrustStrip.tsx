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
    <section className="relative py-10 overflow-hidden border-y border-white/5">
      {/* Fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-r from-[#0a0a12] to-transparent pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-l from-[#0a0a12] to-transparent pointer-events-none" />

      <div className="flex items-center gap-4 mb-4 justify-center">
        <div className="h-px flex-1 max-w-16 bg-gradient-to-r from-transparent to-white/20" />
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          {t('contact.trustStrip')}
        </p>
        <div className="h-px flex-1 max-w-16 bg-gradient-to-l from-transparent to-white/20" />
      </div>

      {/* Marquee track */}
      <div className="overflow-hidden">
        <motion.div
          animate={{ x: [0, '-50%'] }}
          transition={{
            duration: 28,
            repeat: Infinity,
            ease: 'linear',
          }}
          className="flex gap-4 w-max"
        >
          {ITEMS.map(({ name, icon }, idx) => (
            <div
              key={`${name}-${idx}`}
              className="flex items-center gap-3 px-5 py-3 glass rounded-xl border border-white/5 hover:border-electric-500/30 hover:bg-electric-500/5 transition-all duration-300 group cursor-default select-none shrink-0"
            >
              <span className="text-lg leading-none group-hover:scale-110 transition-transform duration-300" aria-hidden>
                {icon}
              </span>
              <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors duration-300">
                {name}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
