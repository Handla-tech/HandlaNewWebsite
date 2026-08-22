'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { motion, useInView } from 'framer-motion';
import { ArrowRight, ArrowUpRight, Package, Check } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { websiteProductApi } from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';
import { useLocalizedHref } from '@/hooks/useLocalizedHref';
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

export default function Products() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const { t } = useTranslation();
  const lh = useLocalizedHref();

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

  // Only show the DB-managed website products grid when there is real content.
  // The three flagship products above are always shown and cover the core
  // offering, so we no longer render hardcoded placeholder cards when empty.
  const items = data && data.length > 0 ? data : [];

  return (
    <section
      id="products"
      ref={ref}
      className="relative pt-24 pb-16 sm:pt-32 sm:pb-20 overflow-hidden"
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

        {/* Additional DB-managed website products (only when real content exists).
            Layout adapts to product count: 1 → featured · 2 → two-up · 3+ → grid. */}
        {items.length > 0 && (
          items.length === 1 ? (
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
          )
        )}

        {/* Closing call-to-action for all products */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-14 flex flex-col items-center gap-4 text-center"
        >
          <p className="text-base" style={{ color: 'var(--ink-3)' }}>
            {t('products.ctaText')}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href={lh('/#contact')}
              className="group inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold transition-all duration-200"
              style={{
                background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                color: '#1a1a1a',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = '0 0 28px rgba(251,191,36,0.35)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
              }}
            >
              {t('products.ctaButton')}
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
            <Link
              href={lh('/products')}
              className="group inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all duration-200"
              style={{
                background: 'rgba(251,191,36,0.1)',
                border: '1px solid rgba(251,191,36,0.25)',
                color: '#fbbf24',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(251,191,36,0.16)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(251,191,36,0.1)';
              }}
            >
              {t('products.viewAll')}
              <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
