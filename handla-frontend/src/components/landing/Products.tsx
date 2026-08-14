'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { websiteProductApi } from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';
import type { WebsiteProduct } from '@/types';
import ProductCard from './ProductCard';

// ─── Static fallback (shown while loading or when no products exist yet) ──────
const FALLBACK: WebsiteProduct[] = [
  {
    id: 'fpr1',
    name: 'School ERP',
    tagline: 'All-in-one school management',
    description: 'A complete school management platform covering admissions, attendance, grading, fees and parent communication.',
    category: 'Education',
    imageUrl: null,
    productUrl: null,
    price: null,
    features: ['Student & staff management', 'Fees & billing', 'Bilingual (Arabic-first)'],
    featured: true,
    sortOrder: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'fpr2',
    name: 'HR & Payroll',
    tagline: 'People operations made simple',
    description: 'Manage employees, attendance, leave, payroll and end-of-service — fully compliant and automated.',
    category: 'HR',
    imageUrl: null,
    productUrl: null,
    price: null,
    features: ['Automated payroll', 'Leave & attendance', 'End-of-service calc'],
    featured: true,
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'fpr3',
    name: 'POS & Inventory',
    tagline: 'Retail, unified',
    description: 'A fast point-of-sale with real-time inventory, multi-branch support and detailed sales reporting.',
    category: 'Retail',
    imageUrl: null,
    productUrl: null,
    price: null,
    features: ['Real-time inventory', 'Multi-branch', 'Sales analytics'],
    featured: true,
    sortOrder: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export default function Products() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const { t } = useTranslation();

  const { data } = useQuery({
    queryKey: ['website-products-featured'],
    queryFn: async () => {
      try {
        // 1) Prefer featured products.
        const featuredRes = await websiteProductApi.getAll({ page: 1, limit: 6, featured: true });
        const featured: WebsiteProduct[] = featuredRes.data?.data?.products ?? [];
        if (featured.length > 0) return featured;

        // 2) No featured ones yet — show the most recent products instead,
        //    so content added via the ERP still surfaces on the homepage.
        const anyRes = await websiteProductApi.getAll({ page: 1, limit: 6 });
        const any: WebsiteProduct[] = anyRes.data?.data?.products ?? [];
        return any;
      } catch {
        return [] as WebsiteProduct[];
      }
    },
    staleTime: 5 * 60_000,
  });

  // Use real data whenever the API returns any products (featured or not).
  // The hardcoded FALLBACK only shows while loading or when the DB is empty.
  const items = (data && data.length > 0) ? data : FALLBACK;

  return (
    <section
      id="products"
      ref={ref}
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
        className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.04) 0%, transparent 70%)' }}
      />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">

        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <p className="h-label mb-3">{t('products.label')}</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
            {t('products.title')}
          </h2>
          <p className="mx-auto max-w-2xl text-base" style={{ color: 'var(--ink-5)' }}>
            {t('products.subtitle')}
          </p>
        </motion.div>

        {/* Featured grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.slice(0, 6).map((product, i) => (
            <ProductCard key={product.id} product={product} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
