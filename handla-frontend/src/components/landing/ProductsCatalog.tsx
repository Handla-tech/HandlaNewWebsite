'use client';

/**
 * ProductsCatalog — the public Products listing (used by /[locale]/products).
 *
 * Shows the full website products/solutions catalog (paginated, optional
 * category filter), preceded by the flagship products grid. Locale comes from
 * the URL via useTranslation (LocaleProvider), so this renders Arabic on
 * /ar/products and English on /en/products server-side.
 *
 * NOTE: these are WEBSITE showcase products managed by admins via
 * /erp/website/products, separate from ERP/SaaS entities.
 */

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import ProductCard from '@/components/landing/ProductCard';
import FlagshipProducts from '@/components/landing/FlagshipProducts';
import { websiteProductApi } from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';
import { useLocalizedHref } from '@/hooks/useLocalizedHref';
import type { WebsiteProduct } from '@/types';

const PAGE_SIZE = 12;

export default function ProductsCatalog() {
  const { t } = useTranslation();
  const lh = useLocalizedHref();
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['website-products-all', page, category],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit: PAGE_SIZE };
      if (category) params.category = category;
      const res = await websiteProductApi.getAll(params);
      const payload = res.data?.data as {
        products?: WebsiteProduct[];
        total?: number;
        pages?: number;
      };
      return {
        items: Array.isArray(payload?.products) ? payload!.products! : [],
        total: payload?.total ?? 0,
        pages: payload?.pages ?? 1,
      };
    },
    staleTime: 60_000,
  });

  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const totalPages = data?.pages ?? 1;

  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((p) => { if (p.category) set.add(p.category); });
    return Array.from(set);
  }, [items]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--page-bg)', color: 'var(--ink-1)' }}>
      <Navbar />

      <main className="pt-24">
        <section className="relative overflow-hidden py-16 sm:py-20">
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.05) 0%, transparent 70%)' }}
          />
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 text-center">
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="h-label mb-3"
            >
              {t('products.label')}
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.05 }}
              className="text-4xl sm:text-5xl font-extrabold text-white mb-4"
            >
              {t('products.pageTitle')}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mx-auto max-w-2xl text-base"
              style={{ color: 'var(--ink-5)' }}
            >
              {t('products.pageSubtitle')}
            </motion.p>
          </div>
        </section>

        <section className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pb-24">
          <FlagshipProducts />

          {categories.length > 0 && (
            <div className="mb-8 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => { setCategory(null); setPage(1); }}
                className="rounded-full px-3.5 py-1.5 text-xs font-medium transition-all"
                style={{
                  background: category === null ? 'rgba(251,191,36,0.15)' : 'var(--ov-soft)',
                  color: category === null ? '#fbbf24' : 'var(--ink-4)',
                  border: `1px solid ${category === null ? 'rgba(251,191,36,0.3)' : 'var(--ov-med)'}`,
                }}
              >
                {t('products.all')}
              </button>
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => { setCategory(c); setPage(1); }}
                  className="rounded-full px-3.5 py-1.5 text-xs font-medium transition-all"
                  style={{
                    background: category === c ? 'rgba(251,191,36,0.15)' : 'var(--ov-soft)',
                    color: category === c ? '#fbbf24' : 'var(--ink-4)',
                    border: `1px solid ${category === c ? 'rgba(251,191,36,0.3)' : 'var(--ov-med)'}`,
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          {isLoading && (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-7 w-7 animate-spin text-[#fbbf24]" />
            </div>
          )}

          {isError && (
            <div className="flex flex-col items-center gap-3 py-24 text-center">
              <AlertCircle className="h-8 w-8 text-red-400" />
              <p className="text-sm" style={{ color: 'var(--ink-5)' }}>{t('products.loadError')}</p>
              <button
                type="button"
                onClick={() => refetch()}
                className="rounded-xl border px-4 py-2 text-xs text-[#aaa] hover:text-white"
                style={{ borderColor: 'var(--ov-med)' }}
              >
                {t('products.retry')}
              </button>
            </div>
          )}

          {!isLoading && !isError && items.length === 0 && (
            <div className="mt-16 flex flex-col items-center gap-4 rounded-2xl border py-14 text-center"
                 style={{ borderColor: 'var(--ov-med)', background: 'var(--surface-1)' }}>
              <p className="mx-auto max-w-xl px-6 text-base" style={{ color: 'var(--ink-3)' }}>
                {t('products.ctaText')}
              </p>
              <a
                href={lh('/#contact')}
                className="group inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold transition-all duration-200"
                style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', color: '#1a1a1a' }}
              >
                {t('products.ctaButton')}
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </a>
            </div>
          )}

          {!isLoading && !isError && items.length > 0 && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((product, i) => (
                <ProductCard key={product.id} product={product} index={i} />
              ))}
            </div>
          )}

          {!isLoading && !isError && totalPages > 1 && (
            <div className="mt-12 flex items-center justify-center gap-3">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-xl border px-4 py-2 text-xs font-medium text-[#aaa] transition-all hover:text-white disabled:opacity-40"
                style={{ borderColor: 'var(--ov-med)' }}
              >
                {t('products.prev')}
              </button>
              <span className="text-xs" style={{ color: 'var(--ink-6)' }}>
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-xl border px-4 py-2 text-xs font-medium text-[#aaa] transition-all hover:text-white disabled:opacity-40"
                style={{ borderColor: 'var(--ov-med)' }}
              >
                {t('products.next')}
              </button>
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
