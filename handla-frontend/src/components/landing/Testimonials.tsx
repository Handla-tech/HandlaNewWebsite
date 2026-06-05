'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Star, Quote } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { testimonialApi } from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';
import type { Testimonial } from '@/types';

// ─── Static fallback testimonials ─────────────────────────────────────────────
const FALLBACK: Testimonial[] = [
  {
    id: 'f1',
    clientName: 'Sarah Al-Rashid',
    clientCompany: 'TechFlow SaaS',
    content: 'Handla transformed our idea into a production-ready SaaS platform in just 6 weeks. The quality and attention to detail were outstanding. Our investors were impressed.',
    imageUrl: null,
    rating: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'f2',
    clientName: 'Omar Al-Khatib',
    clientCompany: 'RetailPro Arabia',
    content: 'The ERP system they built for us handles 10,000+ daily transactions without a hiccup. Professional team, on-time delivery, and excellent post-launch support.',
    imageUrl: null,
    rating: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'f3',
    clientName: 'Leila Mansour',
    clientCompany: 'HealthBridge Clinic',
    content: 'Their bilingual team was perfect for our Arabic-first patient portal. Lightning fast, and the RTL support is flawless. Highly recommended.',
    imageUrl: null,
    rating: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'f4',
    clientName: 'Ahmed Benali',
    clientCompany: 'GovDigital',
    content: 'Handla built our ministry portal with exceptional security and accessibility standards. They navigated regulatory requirements like experts. Truly impressive.',
    imageUrl: null,
    rating: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-4 h-4 transition-colors ${i < rating ? 'fill-[#fbbf24] text-[#fbbf24]' : 'text-[#2a2a2a]'}`}
          style={i < rating ? { filter: 'drop-shadow(0 0 4px rgba(251,191,36,0.5))' } : {}}
        />
      ))}
    </div>
  );
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

// Avatar gradient colors
const AVATAR_COLORS = [
  { bg: 'linear-gradient(135deg, #fbbf24, #f59e0b)', text: '#000' },
  { bg: 'linear-gradient(135deg, #60a5fa, #3b82f6)', text: '#fff' },
  { bg: 'linear-gradient(135deg, #34d399, #10b981)', text: '#000' },
  { bg: 'linear-gradient(135deg, #a78bfa, #8b5cf6)', text: '#fff' },
];

export default function Testimonials() {
  const ref    = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const { t }  = useTranslation();

  const { data } = useQuery({
    queryKey: ['testimonials-landing'],
    queryFn: async () => {
      try {
        const res = await testimonialApi.getAll({ page: 1, limit: 8 });
        const list: Testimonial[] = res.data?.data?.testimonials ?? [];
        return list;
      } catch {
        return [] as Testimonial[];
      }
    },
    staleTime: 5 * 60_000,
  });

  const items = (data && data.length > 0) ? data : FALLBACK;
  const prev = useCallback(() => setIndex((i) => (i - 1 + items.length) % items.length), [items.length]);
  const next = useCallback(() => setIndex((i) => (i + 1) % items.length), [items.length]);
  const current = items[index];

  // Auto-play every 5s
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % items.length);
    }, 5000);
    return () => clearInterval(id);
  }, [items.length, paused]);

  const avatarStyle = AVATAR_COLORS[index % AVATAR_COLORS.length];

  return (
    <section
      id="testimonials"
      ref={ref}
      className="relative py-24 sm:py-32 overflow-hidden"
      style={{ background: '#080808' }}
    >
      {/* Top separator */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06) 30%, rgba(255,255,255,0.06) 70%, transparent)' }}
      />

      {/* Ambient gold glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.04) 0%, transparent 70%)' }}
      />

      <div
        className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >

        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <p className="h-label mb-3">{t('testimonials.label')}</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
            {t('testimonials.title')}
          </h2>
          <p className="text-base" style={{ color: '#666' }}>
            {t('testimonials.subtitle')}
          </p>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, x: 24, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -24, scale: 0.98 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="relative rounded-2xl p-8 sm:p-10 overflow-hidden"
              style={{
                background: 'linear-gradient(145deg, #0d0d0d 0%, #0a0a0a 100%)',
                border: '1px solid rgba(255,255,255,0.07)',
                boxShadow: '0 4px 60px rgba(0,0,0,0.5)',
              }}
            >
              {/* Gold top accent */}
              <div
                className="absolute top-0 left-0 right-0 h-px"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(251,191,36,0.3), transparent)' }}
              />

              {/* Large decorative quote */}
              <div
                className="absolute top-6 right-8 pointer-events-none select-none"
                style={{
                  fontSize: 120,
                  fontFamily: 'Georgia, serif',
                  lineHeight: 1,
                  color: 'rgba(251,191,36,0.04)',
                  transform: 'scaleX(-1)',
                }}
              >
                &ldquo;
              </div>

              {/* Quote icon */}
              <Quote
                className="w-8 h-8 mb-5"
                style={{ color: 'rgba(251,191,36,0.2)' }}
              />

              <StarRating rating={current.rating} />

              <blockquote className="mt-5 text-lg sm:text-xl font-medium leading-relaxed text-white relative">
                &ldquo;{current.content}&rdquo;
              </blockquote>

              <div className="mt-8 flex items-center gap-4">
                {/* Avatar */}
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{
                    background: avatarStyle.bg,
                    color: avatarStyle.text,
                    boxShadow: '0 0 20px rgba(251,191,36,0.2)',
                  }}
                >
                  {getInitials(current.clientName)}
                </div>
                <div>
                  <div className="font-semibold text-white">{current.clientName}</div>
                  {current.clientCompany && (
                    <div className="text-sm mt-0.5" style={{ color: '#555' }}>{current.clientCompany}</div>
                  )}
                </div>

                {/* Gold verified badge */}
                <div
                  className="ml-auto px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{ background: 'rgba(251,191,36,0.08)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.15)' }}
                >
                  ✓ Verified Client
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4 mt-6">
            <button
              onClick={prev}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                color: '#666',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(251,191,36,0.3)';
                (e.currentTarget as HTMLElement).style.color = '#fbbf24';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)';
                (e.currentTarget as HTMLElement).style.color = '#666';
              }}
              aria-label="Previous"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {/* Dots with progress */}
            <div className="flex items-center gap-2">
              {items.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIndex(i)}
                  className="h-1.5 rounded-full transition-all duration-300"
                  style={{
                    width: i === index ? '1.75rem' : '0.375rem',
                    background: i === index ? '#fbbf24' : 'rgba(255,255,255,0.1)',
                    boxShadow: i === index ? '0 0 8px rgba(251,191,36,0.5)' : 'none',
                  }}
                  aria-label={`Testimonial ${i + 1}`}
                />
              ))}
            </div>

            <button
              onClick={next}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                color: '#666',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(251,191,36,0.3)';
                (e.currentTarget as HTMLElement).style.color = '#fbbf24';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)';
                (e.currentTarget as HTMLElement).style.color = '#666';
              }}
              aria-label="Next"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
