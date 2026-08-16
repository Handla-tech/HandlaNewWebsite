'use client';

/**
 * Matjary — customer STOREFRONT demo (view-only).
 * Mirrors the real Matjary storefront routes: products, categories, cart,
 * checkout, account, search. All actions Inert.
 */

import React, { useState } from 'react';
import Link from 'next/link';
import { Search, ShoppingCart, User, Heart, Menu } from 'lucide-react';
import { DemoProvider, DemoTheme, useDemo, Inert, Badge } from '@/components/product-demos/demo-shared';

const theme: DemoTheme = {
  accent: '#10b981',
  accentSoft: 'rgba(16,185,129,0.14)',
  accentBorder: 'rgba(16,185,129,0.32)',
  sidebar: '#ffffff',
  canvas: '#f4f7f5',
  panel: '#ffffff',
  border: 'rgba(0,0,0,0.09)',
  ink: '#0f2820',
  inkMuted: '#4b6a60',
  inkFaint: '#8aa39a',
  nameEn: 'Matjary',
  nameAr: 'متجري',
};

const CATS: [string, string][] = [
  ['All', 'الكل'], ['Audio', 'الصوتيات'], ['Wearables', 'الأجهزة القابلة للارتداء'],
  ['Accessories', 'الإكسسوارات'], ['Power', 'الطاقة'],
];

const PRODUCTS: { en: string; ar: string; price: string; rating: number; cat: string; badge?: [string, string] }[] = [
  { en: 'Wireless Earbuds Pro', ar: 'سماعات لاسلكية برو', price: '349', rating: 5, cat: 'Audio', badge: ['Best seller', 'الأكثر مبيعاً'] },
  { en: 'Smart Watch S2', ar: 'ساعة ذكية S2', price: '699', rating: 4, cat: 'Wearables', badge: ['New', 'جديد'] },
  { en: 'Clear Phone Case', ar: 'غطاء هاتف شفاف', price: '49', rating: 4, cat: 'Accessories' },
  { en: 'Power Bank 20K', ar: 'بطارية 20 ألف', price: '129', rating: 5, cat: 'Power' },
  { en: 'USB-C Fast Cable', ar: 'كابل USB-C سريع', price: '29', rating: 4, cat: 'Accessories' },
  { en: 'Over-ear Headphones', ar: 'سماعات رأس', price: '459', rating: 5, cat: 'Audio', badge: ['-15%', '-15%'] },
  { en: 'Fitness Band', ar: 'سوار لياقة', price: '199', rating: 4, cat: 'Wearables' },
  { en: 'Wall Charger 65W', ar: 'شاحن حائط 65 واط', price: '89', rating: 5, cat: 'Power' },
];

function StoreInner() {
  const { locale, isRTL } = useDemo();
  const t = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const money = (n: string) => (locale === 'ar' ? `${n} ر.س` : `SAR ${n}`);
  const [cat, setCat] = useState('All');

  const list = cat === 'All' ? PRODUCTS : PRODUCTS.filter((p) => p.cat === cat);

  return (
    <div style={{ minHeight: 'calc(100vh - 40px)', background: theme.canvas, color: theme.ink }}>
      {/* Storefront header */}
      <header style={{ background: theme.panel, borderBottom: `1px solid ${theme.border}`, position: 'sticky', top: 40, zIndex: 20 }}>
        <div style={{ maxWidth: 1140, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px' }}>
          <Inert as="button" style={{ background: 'none', border: 'none', display: 'inline-flex' }}><Menu size={20} color={theme.inkMuted} /></Inert>
          <span style={{ fontSize: 20, fontWeight: 900, color: theme.accent }}>{locale === 'ar' ? 'متجري' : 'Matjary'}</span>
          <Inert style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: theme.canvas, border: `1px solid ${theme.border}`, borderRadius: 10, padding: '9px 14px', maxWidth: 480 }}>
            <Search size={16} color={theme.inkFaint} />
            <span style={{ fontSize: 14, color: theme.inkFaint }}>{t('Search products…', 'ابحث عن المنتجات…')}</span>
          </Inert>
          <div style={{ display: 'flex', gap: 6, marginInlineStart: 'auto' }}>
            <Inert as="button" style={iconBtn}><Heart size={19} color={theme.inkMuted} /></Inert>
            <Inert as="button" style={iconBtn}><User size={19} color={theme.inkMuted} /></Inert>
            <Inert as="button" style={{ ...iconBtn, position: 'relative' }}>
              <ShoppingCart size={19} color={theme.inkMuted} />
              <span style={{ position: 'absolute', top: 2, [isRTL ? 'left' : 'right']: 2, background: theme.accent, color: '#fff', borderRadius: 999, fontSize: 10, fontWeight: 700, padding: '1px 5px' }}>2</span>
            </Inert>
          </div>
        </div>
      </header>

      {/* Hero banner */}
      <div style={{ maxWidth: 1140, margin: '20px auto 0', padding: '0 20px' }}>
        <div style={{ borderRadius: 18, padding: '40px 32px', background: 'linear-gradient(120deg, #059669, #10b981)', color: '#fff' }}>
          <h1 style={{ fontSize: 30, fontWeight: 900, margin: '0 0 10px' }}>{t('New tech, delivered fast', 'أحدث التقنية، توصيل سريع')}</h1>
          <p style={{ fontSize: 15, opacity: 0.92, margin: '0 0 18px' }}>{t('Up to 25% off on selected gadgets this week.', 'خصومات تصل إلى 25% على أجهزة مختارة هذا الأسبوع.')}</p>
          <Inert as="button" style={{ background: '#fff', color: '#059669', border: 'none', borderRadius: 10, padding: '11px 22px', fontWeight: 800, fontSize: 14 }}>
            {t('Shop now', 'تسوّق الآن')}
          </Inert>
        </div>
      </div>

      {/* Category chips */}
      <div style={{ maxWidth: 1140, margin: '20px auto 0', padding: '0 20px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {CATS.map(([en, ar]) => {
          const on = cat === en;
          return (
            <button key={en} type="button" onClick={() => setCat(en)}
              style={{ fontSize: 13, fontWeight: 700, padding: '8px 16px', borderRadius: 999, cursor: 'pointer',
                border: `1px solid ${on ? theme.accentBorder : theme.border}`,
                background: on ? theme.accent : theme.panel, color: on ? '#fff' : theme.inkMuted }}>
              {t(en, ar)}
            </button>
          );
        })}
      </div>

      {/* Product grid */}
      <div style={{ maxWidth: 1140, margin: '20px auto', padding: '0 20px 40px' }}>
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))' }}>
          {list.map((p, i) => (
            <Inert key={i} style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ position: 'relative', height: 150, background: 'linear-gradient(135deg, #e6f6f0, #d1f0e4)', display: 'grid', placeItems: 'center' }}>
                <ShoppingCart size={40} color="#10b981" opacity={0.5} />
                {p.badge && (
                  <span style={{ position: 'absolute', top: 10, [isRTL ? 'right' : 'left']: 10 }}>
                    <Badge color="#fff" bg={theme.accent}>{t(p.badge[0], p.badge[1])}</Badge>
                  </span>
                )}
              </div>
              <div style={{ padding: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: theme.ink, marginBottom: 4 }}>{locale === 'ar' ? p.ar : p.en}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
                  <span style={{ color: '#fbbf24', fontSize: 13 }}>{'★'.repeat(p.rating)}<span style={{ color: theme.inkFaint }}>{'★'.repeat(5 - p.rating)}</span></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 16, fontWeight: 900, color: theme.accent }}>{money(p.price)}</span>
                  <span style={{ background: theme.accentSoft, color: theme.accent, borderRadius: 8, padding: 7, display: 'inline-flex' }}>
                    <ShoppingCart size={16} />
                  </span>
                </div>
              </div>
            </Inert>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer style={{ background: theme.panel, borderTop: `1px solid ${theme.border}`, padding: '24px 20px', textAlign: 'center' }}>
        <span style={{ fontSize: 13, color: theme.inkFaint }}>{t('Matjary storefront — view-only demo', 'واجهة متجري — عرض للقراءة فقط')}</span>
        <div style={{ marginTop: 10 }}>
          <Link href="/products/matjary" style={{ fontSize: 13, color: theme.accent, textDecoration: 'none', fontWeight: 700 }}>
            {t('← Back to product', '← عودة للمنتج')}
          </Link>
        </div>
      </footer>
    </div>
  );
}

const iconBtn: React.CSSProperties = { background: 'none', border: 'none', padding: 8, borderRadius: 9, display: 'inline-flex', cursor: 'pointer' };

export default function MatjaryStore() {
  return (
    <DemoProvider theme={theme}>
      <StoreInner />
    </DemoProvider>
  );
}
