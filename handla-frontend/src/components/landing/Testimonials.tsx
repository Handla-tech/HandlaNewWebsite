'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Star, Quote } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { testimonialApi } from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';
import type { Testimonial } from '@/types';

// NOTE: No hardcoded fallback testimonials. Client testimonials are shown ONLY
// when the backend API returns genuine, admin-managed records. When the API is
// empty the entire section is hidden (see the early return in the component) —
// we never fabricate reviews, names, companies, or ratings.

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-4 h-4 transition-colors ${i < rating ? 'fill-[#fbbf24] text-[#fbbf24]' : ''}`}
          style={i < rating ? {} : { color: 'var(--ov-strong)' }}
        />
      ))}
    </div>
  );
}

function getInitials(name: string) {
  return (name || '')
    .split(' ')
    .map((n) => n[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// Avatar gradient colors
const AVATAR_COLORS = [
  { bg: 'linear-gradient(135deg, #fbbf24, #f59e0b)', text: '#000' },
  { bg: 'linear-gradient(135deg, #60a5fa, #3b82f6)', text: 'var(--ink-1)' },
  { bg: 'linear-gradient(135deg, #34d399, #10b981)', text: '#000' },
  { bg: 'linear-gradient(135deg, #a78bfa, #8b5cf6)', text: 'var(--ink-1)' },
];

export default function Testimonials() {
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

  const items = (data && data.length > 0) ? data : [];
  const safeLen = items.length || 1;
  const prev = useCallback(() => setIndex((i) => (i - 1 + safeLen) % safeLen), [safeLen]);
  const next = useCallback(() => setIndex((i) => (i + 1) % safeLen), [safeLen]);

  // Auto-play every 5s
  useEffect(() => {
    if (paused || items.length === 0) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % items.length);
    }, 5000);
    return () => clearInterval(id);
  }, [items.length, paused]);

  // Hide the whole section when the API returns no genuine testimonials —
  // never fabricate reviews. All hooks above run unconditionally first.
  if (items.length === 0) return null;

  // Defensive: `index` can briefly point past the array during auto-play /
  // data-refresh transitions. Clamp so `current` is always a valid record —
  // an out-of-range `current` (undefined) would throw while reading
  // current.content and crash the whole section into a blank space.
  const safeIndex = ((index % items.length) + items.length) % items.length;
  const current = items[safeIndex];
  if (!current) return null;
  const avatarStyle = AVATAR_COLORS[safeIndex % AVATAR_COLORS.length];

  return (
    <section
      id="testimonials"
      className="relative py-24 sm:py-32 overflow-hidden"
      style={{ background: 'var(--page-bg)' }}
    >
      {/* Top separator */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, var(--ov-med) 30%, var(--ov-med) 70%, transparent)' }}
      />

      {/* Ambient gold glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.04) 0%, transparent 70%)' }}
      />

      <div
        className="relative mx-auto max-w-3xl px-4 sm:px-6 lg:px-8"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >

        {/* Section header
            Uses whileInView (self-contained per element) instead of a shared
            `inView ? … : {}` gate. The old gate could leave the content stuck
            at opacity:0 forever if the section's IntersectionObserver never
            fired (e.g. Safari timing, or jumping straight to the section) —
            producing a rendered-but-invisible card (the "empty testimonials"
            bug). whileInView + `once` reveals reliably and, if the observer
            never fires, the content is still laid out (no permanent invisibility). */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <p className="h-label mb-3">{t('testimonials.label')}</p>
          <h2 className="h-heading mb-4">
            {t('testimonials.title')}
          </h2>
          <p className="h-intro">
            {t('testimonials.subtitle')}
          </p>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, x: 24, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -24, scale: 0.98 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="relative rounded-2xl p-7 sm:p-8 overflow-hidden"
              style={{
                background: 'var(--surface-1)',
                border: '1px solid var(--ov-med)',
                boxShadow: 'var(--shadow-md)',
              }}
            >
              {/* Gold top accent */}
              <div
                className="absolute top-0 left-0 right-0 h-px"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(251,191,36,0.3), transparent)' }}
              />

              {/* Quote icon + stars on one row for a tighter header */}
              <div className="flex items-center justify-between mb-4">
                <Quote className="w-7 h-7" style={{ color: 'rgba(251,191,36,0.35)' }} />
                <StarRating rating={Number(current.rating) || 0} />
              </div>

              <blockquote className="text-lg sm:text-xl font-medium leading-relaxed text-white relative">
                &ldquo;{current.content ?? ''}&rdquo;
              </blockquote>

              <div className="mt-6 flex items-center gap-4 pt-5" style={{ borderTop: '1px solid var(--ov-soft)' }}>
                {/* Avatar */}
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{
                    background: avatarStyle.bg,
                    color: avatarStyle.text,
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  {getInitials(current.clientName ?? '')}
                </div>
                <div>
                  <div className="font-semibold text-white">{current.clientName}</div>
                  {current.clientCompany && (
                    <div className="text-sm mt-0.5" style={{ color: 'var(--ink-4)' }}>{current.clientCompany}</div>
                  )}
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
                background: 'var(--ov-weak)',
                border: '1px solid var(--ov-med)',
                color: 'var(--ink-5)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(251,191,36,0.3)';
                (e.currentTarget as HTMLElement).style.color = '#fbbf24';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--ov-med)';
                (e.currentTarget as HTMLElement).style.color = 'var(--ink-5)';
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
                    width: i === safeIndex ? '1.75rem' : '0.375rem',
                    background: i === safeIndex ? '#fbbf24' : 'var(--ov-border)',
                    boxShadow: i === safeIndex ? '0 0 8px rgba(251,191,36,0.5)' : 'none',
                  }}
                  aria-label={`Testimonial ${i + 1}`}
                />
              ))}
            </div>

            <button
              onClick={next}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
              style={{
                background: 'var(--ov-weak)',
                border: '1px solid var(--ov-med)',
                color: 'var(--ink-5)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(251,191,36,0.3)';
                (e.currentTarget as HTMLElement).style.color = '#fbbf24';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--ov-med)';
                (e.currentTarget as HTMLElement).style.color = 'var(--ink-5)';
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
