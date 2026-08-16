'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { motion, useInView } from 'framer-motion';
import { ArrowRight, ArrowUpRight, Package, Check } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { websiteProductApi } from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';
import type { WebsiteProduct } from '@/types';
import ProductCard from './ProductCard';
import FlagshipProducts from './FlagshipProducts';

// ── Branded placeholder visual (used when a product has no image) ────────────
function BrandedVisual({ label }: { label?: string | null }) {
  return (
    <div
      className="relative flex h-full w-full items-center justify-center overflow-hidden"
      style={{ background: 'linear-gradient(135deg, var(--surface-3) 0%, var(--surface-1) 100%)' }}
    >
      <div
        className="absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage:
            'linear-gradient(var(--ov-soft) 1px, transparent 1px), linear-gradient(90deg, var(--ov-soft) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
      <div
        className="absolute -top-16 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.10) 0%, transparent 70%)' }}
      />
      <div className="relative flex flex-col items-center gap-3">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.22)' }}
        >
          <Package className="h-6 w-6" style={{ color: '#fbbf24' }} />
        </div>
        <span className="font-mono text-sm font-bold tracking-tight">
          <span className="text-white">&lt;Handla </span>
          <span style={{ color: '#fbbf24' }}>/</span>
          <span className="text-white">&gt;</span>
        </span>
        {label && (
          <span className="text-xs font-medium" style={{ color: 'var(--ink-5)' }}>{label}</span>
        )}
      </div>
    </div>
  );
}

// ── Featured product — large side-by-side layout for a single product ────────
function FeaturedProduct({ product }: { product: WebsiteProduct }) {
  const body = (
    <div
      className="group grid overflow-hidden rounded-2xl lg:grid-cols-2 h-card h-card-interactive"
      style={{ boxShadow: 'var(--shadow-md)' }}
    >
      {/* Visual */}
      <div className="relative min-h-[240px] overflow-hidden lg:min-h-[380px]">
        {product.imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <BrandedVisual label={product.category} />
        )}
        {product.category && (
          <span
            className="absolute left-4 top-4 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider"
            style={{ background: 'rgba(0,0,0,0.55)', color: '#fbbf24', backdropFilter: 'blur(6px)' }}
          >
            {product.category}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col justify-center gap-4 p-7 sm:p-9">
        {product.tagline && (
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-5)' }}>
            {product.tagline}
          </span>
        )}
        <h3 className="text-2xl font-extrabold leading-tight text-white sm:text-3xl">
          {product.name}
        </h3>
        <p className="text-base leading-relaxed" style={{ color: 'var(--ink-3)' }}>
          {product.description}
        </p>

        {product.features && product.features.length > 0 && (
          <ul className="grid gap-2 pt-1 sm:grid-cols-2">
            {product.features.slice(0, 6).map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-sm" style={{ color: 'var(--ink-3)' }}>
                <Check className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: '#fbbf24' }} />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-2 flex items-center gap-4">
          {product.price && (
            <span className="text-lg font-bold" style={{ color: '#fbbf24' }}>{product.price}</span>
          )}
          <span
            className="inline-flex items-center gap-1.5 text-sm font-semibold"
            style={{ color: '#fbbf24' }}
          >
            Learn more
            <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </span>
        </div>
      </div>
    </div>
  );

  if (product.productUrl) {
    return (
      <a href={product.productUrl} target="_blank" rel="noopener noreferrer" aria-label={`${product.name} — open product`}>
        {body}
      </a>
    );
  }
  return body;
}

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
          <h2 className="h-heading mb-4">
            {t('products.title')}
          </h2>
          <p className="h-intro mx-auto max-w-2xl">
            {t('products.subtitle')}
          </p>
        </motion.div>

        {/* ── Flagship products — our three real products, each with its own
            branded landing page + view-only live demo. ── */}
        <FlagshipProducts />

        {/* Layout adapts to product count:
            1 → large featured layout · 2 → two-up · 3+ → responsive grid. */}
        {items.length === 1 ? (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <FeaturedProduct product={items[0]} />
          </motion.div>
        ) : (
          <div
            className={`grid gap-6 ${
              items.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'
            }`}
          >
            {items.slice(0, 6).map((product, i) => (
              <ProductCard key={product.id} product={product} index={i} />
            ))}
          </div>
        )}

        {/* View all button */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-12 flex justify-center"
        >
          <Link
            href="/products"
            className="group inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all duration-200"
            style={{
              background: 'rgba(251,191,36,0.1)',
              border: '1px solid rgba(251,191,36,0.25)',
              color: '#fbbf24',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(251,191,36,0.16)';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 0 24px rgba(251,191,36,0.18)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(251,191,36,0.1)';
              (e.currentTarget as HTMLElement).style.boxShadow = 'none';
            }}
          >
            {t('products.viewAll')}
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
