'use client';

import { useRef, useState, useCallback } from 'react';
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
        <Star key={i} className={`w-4 h-4 ${i < rating ? 'fill-[#fbbf24] text-[#fbbf24]' : 'text-[#2a2a2a]'}`} />
      ))}
    </div>
  );
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

export default function Testimonials() {
  const ref    = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const [index, setIndex] = useState(0);
  const { t }  = useTranslation();

  const { data } = useQuery({
    queryKey: ['testimonials-landing'],
    queryFn: async () => {
      try {
        const res = await testimonialApi.getAll({ page: 1, limit: 8 });
        // API shape: { message: string, data: { testimonials: Testimonial[], total, page, pages } }
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

  return (
    <section id="testimonials" ref={ref} className="relative py-24 sm:py-32">
      {/* Top separator */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, #1e1e1e 30%, #1e1e1e 70%, transparent)' }}
      />

      <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">

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
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.98 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="relative rounded-2xl p-8 sm:p-10"
              style={{
                background: '#111111',
                border: '1px solid #1e1e1e',
                boxShadow: '0 4px 40px rgba(0,0,0,0.4)',
              }}
            >
              {/* Quote icon */}
              <Quote
                className="absolute top-6 right-6 w-10 h-10"
                style={{ color: 'rgba(251,191,36,0.1)' }}
              />

              <StarRating rating={current.rating} />

              <blockquote className="mt-5 text-lg sm:text-xl font-medium leading-relaxed text-white">
                &ldquo;{current.content}&rdquo;
              </blockquote>

              <div className="mt-8 flex items-center gap-4">
                {/* Avatar */}
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-black flex-shrink-0"
                  style={{ background: '#fbbf24' }}
                >
                  {getInitials(current.clientName)}
                </div>
                <div>
                  <div className="font-semibold text-white">{current.clientName}</div>
                  {current.clientCompany && (
                    <div className="text-sm" style={{ color: '#666' }}>{current.clientCompany}</div>
                  )}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4 mt-6">
            <button
              onClick={prev}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:border-[#fbbf24]/40"
              style={{ background: '#111111', border: '1px solid #1e1e1e', color: '#666' }}
              aria-label="Previous"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {/* Dots */}
            <div className="flex items-center gap-2">
              {items.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIndex(i)}
                  className="h-1.5 rounded-full transition-all duration-300"
                  style={{
                    width: i === index ? '1.5rem' : '0.375rem',
                    background: i === index ? '#fbbf24' : '#2a2a2a',
                  }}
                  aria-label={`Testimonial ${i + 1}`}
                />
              ))}
            </div>

            <button
              onClick={next}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:border-[#fbbf24]/40"
              style={{ background: '#111111', border: '1px solid #1e1e1e', color: '#666' }}
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
