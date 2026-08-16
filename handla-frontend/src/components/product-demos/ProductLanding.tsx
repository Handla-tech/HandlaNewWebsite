'use client';

/**
 * ProductLanding — the shared marketing landing-page layout for a single
 * product (Madar / Matjary / Manarah).
 *
 * Each product supplies its own theme (colors) and bilingual content. The page
 * has its OWN look — it does not reuse the Handla marketing CSS variables — so
 * the three products feel like distinct brands, as the user requested.
 *
 * Sections: sticky nav · hero (+ demo CTA) · stats · feature grid ·
 *           "surfaces" (what the product ships: web / storefront / mobile) ·
 *           closing CTA · footer.
 */

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, ArrowLeft, Play, Globe } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';

// ─── Content shape ────────────────────────────────────────────────────────────

export interface LandingFeature {
  icon: React.ReactNode;
  titleEn: string;
  titleAr: string;
  descEn: string;
  descAr: string;
}

export interface LandingSurface {
  icon: React.ReactNode;
  labelEn: string;
  labelAr: string;
  descEn: string;
  descAr: string;
  /** Where "View" goes (a demo route). */
  href: string;
  ctaEn: string;
  ctaAr: string;
}

export interface LandingStat {
  valueEn: string;
  valueAr: string;
  labelEn: string;
  labelAr: string;
}

export interface ProductLandingContent {
  slug: string;
  nameEn: string;
  nameAr: string;
  /** e.g. "Business Management ERP" */
  categoryEn: string;
  categoryAr: string;
  taglineEn: string;
  taglineAr: string;
  introEn: string;
  introAr: string;
  demoHref: string;
  /** Colors */
  accent: string;
  accentSoft: string;
  accentBorder: string;
  gradientFrom: string;
  gradientTo: string;
  stats: LandingStat[];
  features: LandingFeature[];
  /** Section heading for features. */
  featuresHeadingEn: string;
  featuresHeadingAr: string;
  featuresSubEn: string;
  featuresSubAr: string;
  surfaces: LandingSurface[];
  /** Hero preview element (a small mock of the product). */
  heroPreview: React.ReactNode;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProductLanding({ content }: { content: ProductLandingContent }) {
  const storeLocale = useUIStore((s) => s.locale);
  const setStoreLocale = useUIStore((s) => s.setLocale);
  const [locale, setLocale] = useState<'en' | 'ar'>(storeLocale === 'ar' ? 'ar' : 'en');
  const isRTL = locale === 'ar';
  const t = (en: string, ar: string) => (locale === 'ar' ? ar : en);

  const toggle = () => {
    const next = locale === 'ar' ? 'en' : 'ar';
    setLocale(next);
    setStoreLocale(next);
  };

  const BackIcon = isRTL ? ArrowRight : ArrowLeft;
  const FwdIcon = isRTL ? ArrowLeft : ArrowRight;

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      lang={locale}
      style={{ background: '#0b0d12', color: '#e8eaf0', minHeight: '100vh' }}
      className="antialiased"
    >
      {/* ─── Nav ─── */}
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          background: 'rgba(11,13,18,0.8)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <Link
          href="/#products"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: '#9aa0ad',
            textDecoration: 'none',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <BackIcon size={16} />
          {t('Handla', 'هاندلا')}
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              fontWeight: 800,
              fontSize: 16,
              background: `linear-gradient(90deg, ${content.gradientFrom}, ${content.gradientTo})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {locale === 'ar' ? content.nameAr : content.nameEn}
          </span>
        </div>

        <button
          type="button"
          onClick={toggle}
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            color: '#e8eaf0',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            padding: '6px 12px',
            cursor: 'pointer',
          }}
        >
          {locale === 'ar' ? 'English' : 'العربية'}
        </button>
      </nav>

      {/* ─── Hero ─── */}
      <header style={{ position: 'relative', overflow: 'hidden' }}>
        <div
          style={{
            position: 'absolute',
            top: -120,
            [isRTL ? 'left' : 'right']: -80,
            width: 520,
            height: 520,
            background: `radial-gradient(circle, ${content.accentSoft} 0%, transparent 70%)`,
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            maxWidth: 1120,
            margin: '0 auto',
            padding: '64px 20px 40px',
            display: 'grid',
            gap: 40,
            gridTemplateColumns: '1fr',
            alignItems: 'center',
          }}
          className="ph-hero-grid"
        >
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span
              style={{
                display: 'inline-block',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                color: content.accent,
                background: content.accentSoft,
                border: `1px solid ${content.accentBorder}`,
                borderRadius: 999,
                padding: '5px 14px',
                marginBottom: 20,
              }}
            >
              {locale === 'ar' ? content.categoryAr : content.categoryEn}
            </span>
            <h1
              style={{
                fontSize: 'clamp(34px, 5vw, 54px)',
                fontWeight: 900,
                lineHeight: 1.08,
                margin: '0 0 18px',
                letterSpacing: -0.5,
              }}
            >
              {locale === 'ar' ? content.taglineAr : content.taglineEn}
            </h1>
            <p
              style={{
                fontSize: 17,
                lineHeight: 1.7,
                color: '#a6acba',
                maxWidth: 560,
                margin: '0 0 30px',
              }}
            >
              {locale === 'ar' ? content.introAr : content.introEn}
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link
                href={content.demoHref}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: `linear-gradient(90deg, ${content.gradientFrom}, ${content.gradientTo})`,
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 15,
                  padding: '13px 26px',
                  borderRadius: 12,
                  textDecoration: 'none',
                  boxShadow: `0 10px 30px ${content.accentSoft}`,
                }}
              >
                <Play size={17} fill="#fff" />
                {t('View Live Demo', 'عرض توضيحي مباشر')}
              </Link>
              <a
                href="#features"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'rgba(255,255,255,0.05)',
                  color: '#e8eaf0',
                  fontWeight: 600,
                  fontSize: 15,
                  padding: '13px 24px',
                  borderRadius: 12,
                  textDecoration: 'none',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                {t('Explore features', 'استكشف المزايا')}
                <FwdIcon size={16} />
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.15 }}
          >
            {content.heroPreview}
          </motion.div>
        </div>
      </header>

      {/* ─── Stats ─── */}
      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '10px 20px 20px' }}>
        <div
          style={{
            display: 'grid',
            gap: 14,
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          }}
        >
          {content.stats.map((s, i) => (
            <div
              key={i}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 14,
                padding: '18px 20px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 26, fontWeight: 900, color: content.accent }}>
                {locale === 'ar' ? s.valueAr : s.valueEn}
              </div>
              <div style={{ fontSize: 13, color: '#9aa0ad', marginTop: 4 }}>
                {locale === 'ar' ? s.labelAr : s.labelEn}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Features ─── */}
      <section id="features" style={{ maxWidth: 1120, margin: '0 auto', padding: '48px 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h2 style={{ fontSize: 32, fontWeight: 900, margin: '0 0 12px' }}>
            {locale === 'ar' ? content.featuresHeadingAr : content.featuresHeadingEn}
          </h2>
          <p style={{ fontSize: 16, color: '#9aa0ad', maxWidth: 620, margin: '0 auto' }}>
            {locale === 'ar' ? content.featuresSubAr : content.featuresSubEn}
          </p>
        </div>
        <div
          style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          }}
        >
          {content.features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.45, delay: (i % 3) * 0.06 }}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16,
                padding: 22,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 11,
                  background: content.accentSoft,
                  border: `1px solid ${content.accentBorder}`,
                  color: content.accent,
                  display: 'grid',
                  placeItems: 'center',
                  marginBottom: 14,
                }}
              >
                {f.icon}
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 8px' }}>
                {locale === 'ar' ? f.titleAr : f.titleEn}
              </h3>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: '#9aa0ad', margin: 0 }}>
                {locale === 'ar' ? f.descAr : f.descEn}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── Surfaces (what ships) ─── */}
      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '20px 20px 56px' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h2 style={{ fontSize: 28, fontWeight: 900, margin: '0 0 10px' }}>
            {t('Explore the product', 'استكشف المنتج')}
          </h2>
          <p style={{ fontSize: 15, color: '#9aa0ad' }}>
            {t(
              'Open a view-only demo of each part of the platform.',
              'افتح عرضاً توضيحياً للقراءة فقط لكل جزء من المنصة.',
            )}
          </p>
        </div>
        <div
          style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          }}
        >
          {content.surfaces.map((s, i) => (
            <div
              key={i}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16,
                padding: 22,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 12,
                  background: content.accentSoft,
                  border: `1px solid ${content.accentBorder}`,
                  color: content.accent,
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                {s.icon}
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
                {locale === 'ar' ? s.labelAr : s.labelEn}
              </h3>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: '#9aa0ad', margin: 0, flex: 1 }}>
                {locale === 'ar' ? s.descAr : s.descEn}
              </p>
              <Link
                href={s.href}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  color: content.accent,
                  fontWeight: 700,
                  fontSize: 14,
                  textDecoration: 'none',
                }}
              >
                {locale === 'ar' ? s.ctaAr : s.ctaEn}
                <FwdIcon size={15} />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Closing CTA ─── */}
      <section
        style={{
          maxWidth: 1120,
          margin: '0 auto 64px',
          padding: '0 20px',
        }}
      >
        <div
          style={{
            borderRadius: 22,
            padding: '48px 32px',
            textAlign: 'center',
            background: `linear-gradient(135deg, ${content.accentSoft}, transparent)`,
            border: `1px solid ${content.accentBorder}`,
          }}
        >
          <h2 style={{ fontSize: 30, fontWeight: 900, margin: '0 0 12px' }}>
            {t(`See ${content.nameEn} in action`, `شاهد ${content.nameAr} أثناء العمل`)}
          </h2>
          <p style={{ fontSize: 16, color: '#a6acba', maxWidth: 540, margin: '0 auto 26px' }}>
            {t(
              'Take a guided, view-only tour through every module — no signup needed.',
              'قم بجولة إرشادية للقراءة فقط عبر جميع الوحدات — دون الحاجة للتسجيل.',
            )}
          </p>
          <Link
            href={content.demoHref}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: `linear-gradient(90deg, ${content.gradientFrom}, ${content.gradientTo})`,
              color: '#fff',
              fontWeight: 700,
              fontSize: 15,
              padding: '14px 30px',
              borderRadius: 12,
              textDecoration: 'none',
            }}
          >
            <Play size={17} fill="#fff" />
            {t('Launch the demo', 'ابدأ العرض التوضيحي')}
          </Link>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer
        style={{
          borderTop: '1px solid rgba(255,255,255,0.07)',
          padding: '24px 20px',
          textAlign: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Globe size={14} color="#6b7280" />
          <span style={{ fontSize: 13, color: '#6b7280' }}>
            {t(
              'A Handla product · built for the region, Arabic-first',
              'منتج من هاندلا · مصمم للمنطقة، بالعربية أولاً',
            )}
          </span>
        </div>
        <Link
          href="/#products"
          style={{
            display: 'inline-block',
            marginTop: 12,
            fontSize: 13,
            color: content.accent,
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          {t('← Back to all Handla products', '← العودة إلى جميع منتجات هاندلا')}
        </Link>
      </footer>

      <style jsx>{`
        @media (min-width: 880px) {
          :global(.ph-hero-grid) {
            grid-template-columns: 1.05fr 0.95fr !important;
          }
        }
      `}</style>
    </div>
  );
}
