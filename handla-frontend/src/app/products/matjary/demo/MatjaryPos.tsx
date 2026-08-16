'use client';

/**
 * Matjary — dedicated POINT OF SALE (POS) terminal demo (view-only).
 *
 * A full-screen cashier register — NOT the admin dashboard. Mirrors the real
 * Matjary POS module: product grid + category tabs, a live cart with qty/line
 * totals, subtotal / VAT / total, customer + shift chips, and pay actions
 * (Cash / Card / Split), plus held carts and refunds. All controls Inert;
 * only category switching and language/theme toggles work.
 */

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Search, User, Pause, RotateCcw, Trash2, Plus, Minus,
  Banknote, CreditCard, SplitSquareHorizontal, Grid3x3,
} from 'lucide-react';
import { DemoProvider, DemoTheme, useDemo, Inert, Badge } from '@/components/product-demos/demo-shared';

const lightTheme: DemoTheme = {
  accent: '#10b981',
  accentSoft: 'rgba(16,185,129,0.12)',
  accentBorder: 'rgba(16,185,129,0.30)',
  sidebar: '#ffffff',
  canvas: '#eef2f1',
  panel: '#ffffff',
  subtle: '#f1f5f4',
  border: 'rgba(6,78,59,0.10)',
  ink: '#0b2a20',
  inkMuted: '#3f6b5b',
  inkFaint: '#89a89c',
  nameEn: 'Matjary',
  nameAr: 'متجري',
};

const darkTheme: DemoTheme = {
  accent: '#10b981',
  accentSoft: 'rgba(16,185,129,0.16)',
  accentBorder: 'rgba(16,185,129,0.34)',
  sidebar: '#0e1a17',
  canvas: '#060f0d',
  panel: '#0f1f1b',
  subtle: '#0b1714',
  border: 'rgba(255,255,255,0.09)',
  ink: '#e6f2ee',
  inkMuted: '#9fc3b6',
  inkFaint: '#5f8377',
  nameEn: 'Matjary',
  nameAr: 'متجري',
};

const themeSet = { dark: darkTheme, light: lightTheme };

const CATS: [string, string][] = [
  ['All', 'الكل'], ['Audio', 'الصوتيات'], ['Wearables', 'الأجهزة'],
  ['Accessories', 'الإكسسوارات'], ['Power', 'الطاقة'],
];

const PRODUCTS: { en: string; ar: string; price: number; cat: string }[] = [
  { en: 'Wireless Earbuds', ar: 'سماعات لاسلكية', price: 349, cat: 'Audio' },
  { en: 'Over-ear Headphones', ar: 'سماعات رأس', price: 459, cat: 'Audio' },
  { en: 'Bluetooth Speaker', ar: 'مكبر صوت', price: 199, cat: 'Audio' },
  { en: 'Smart Watch S2', ar: 'ساعة ذكية S2', price: 699, cat: 'Wearables' },
  { en: 'Fitness Band', ar: 'سوار لياقة', price: 199, cat: 'Wearables' },
  { en: 'Phone Case', ar: 'غطاء هاتف', price: 49, cat: 'Accessories' },
  { en: 'USB-C Cable', ar: 'كابل USB-C', price: 29, cat: 'Accessories' },
  { en: 'Screen Protector', ar: 'واقي شاشة', price: 39, cat: 'Accessories' },
  { en: 'Power Bank 20K', ar: 'بطارية 20 ألف', price: 129, cat: 'Power' },
  { en: 'Wall Charger 65W', ar: 'شاحن 65 واط', price: 89, cat: 'Power' },
  { en: 'Car Charger', ar: 'شاحن سيارة', price: 59, cat: 'Power' },
  { en: 'Wireless Pad', ar: 'شاحن لاسلكي', price: 119, cat: 'Power' },
];

/** A fixed, illustrative cart (view-only — quantities don't change). */
const CART: { en: string; ar: string; qty: number; price: number }[] = [
  { en: 'Wireless Earbuds', ar: 'سماعات لاسلكية', qty: 1, price: 349 },
  { en: 'Phone Case', ar: 'غطاء هاتف', qty: 2, price: 49 },
  { en: 'USB-C Cable', ar: 'كابل USB-C', qty: 1, price: 29 },
];

function PosInner() {
  const { locale, isRTL, theme } = useDemo();
  const t = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const money = (n: number) => (locale === 'ar' ? `${n.toLocaleString()} ر.س` : `SAR ${n.toLocaleString()}`);
  const [cat, setCat] = useState('All');

  const list = cat === 'All' ? PRODUCTS : PRODUCTS.filter((p) => p.cat === cat);
  const subtotal = CART.reduce((s, i) => s + i.qty * i.price, 0);
  const vat = Math.round(subtotal * 0.15);
  const total = subtotal + vat;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 380px',
        gap: 0,
        minHeight: 'calc(100vh - 40px)',
      }}
      className="pos-grid"
    >
      {/* ─── Left: catalog ─── */}
      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
        {/* Top bar: search + shift/cashier */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Inert style={{ flex: 1, minWidth: 180, display: 'flex', alignItems: 'center', gap: 8, background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 11, padding: '10px 14px' }}>
            <Search size={16} color={theme.inkFaint} />
            <span style={{ fontSize: 14, color: theme.inkFaint }}>{t('Scan barcode or search product…', 'امسح الباركود أو ابحث عن منتج…')}</span>
          </Inert>
          <Badge color={theme.accent} bg={theme.accentSoft}>{t('Shift #42 · open', 'الوردية #42 · مفتوحة')}</Badge>
          <Inert style={{ display: 'flex', alignItems: 'center', gap: 7, background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 11, padding: '7px 12px' }}>
            <User size={15} color={theme.inkMuted} />
            <span style={{ fontSize: 13, color: theme.ink, fontWeight: 600 }}>{t('Cashier: Omar', 'الكاشير: عمر')}</span>
          </Inert>
        </div>

        {/* Category tabs */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {CATS.map(([en, ar]) => {
            const on = cat === en;
            return (
              <button
                key={en}
                type="button"
                onClick={() => setCat(en)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: 13, fontWeight: 700, padding: '8px 15px', borderRadius: 999, cursor: 'pointer',
                  border: `1px solid ${on ? theme.accentBorder : theme.border}`,
                  background: on ? theme.accent : theme.panel,
                  color: on ? '#fff' : theme.inkMuted,
                }}
              >
                {en === 'All' && <Grid3x3 size={14} />}
                {t(en, ar)}
              </button>
            );
          })}
        </div>

        {/* Product grid */}
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
          {list.map((p, i) => (
            <Inert
              key={i}
              style={{
                background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 14,
                overflow: 'hidden', display: 'flex', flexDirection: 'column',
              }}
            >
              <div style={{ height: 84, background: theme.subtle, display: 'grid', placeItems: 'center', color: theme.accent, fontSize: 26, fontWeight: 900 }}>
                {(locale === 'ar' ? p.ar : p.en).charAt(0)}
              </div>
              <div style={{ padding: '10px 12px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: theme.ink, lineHeight: 1.3, minHeight: 34 }}>
                  {locale === 'ar' ? p.ar : p.en}
                </div>
                <div style={{ fontSize: 14, fontWeight: 900, color: theme.accent, marginTop: 4 }}>{money(p.price)}</div>
              </div>
            </Inert>
          ))}
        </div>
      </div>

      {/* ─── Right: current sale / register ─── */}
      <aside
        style={{
          background: theme.panel,
          [isRTL ? 'borderRight' : 'borderLeft']: `1px solid ${theme.border}`,
          display: 'flex', flexDirection: 'column',
          position: 'sticky', top: 40, height: 'calc(100vh - 40px)',
        }}
        className="pos-cart"
      >
        {/* Cart header */}
        <div style={{ padding: '16px 18px', borderBottom: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: theme.ink }}>{t('Current Sale', 'البيع الحالي')}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <Inert as="button" title={t('Hold', 'تعليق')} style={miniBtn(theme)}><Pause size={15} /></Inert>
            <Inert as="button" title={t('Refund', 'استرداد')} style={miniBtn(theme)}><RotateCcw size={15} /></Inert>
            <Inert as="button" title={t('Void', 'إلغاء')} style={miniBtn(theme)}><Trash2 size={15} /></Inert>
          </div>
        </div>

        {/* Customer chip */}
        <div style={{ padding: '10px 18px', borderBottom: `1px solid ${theme.border}` }}>
          <Inert style={{ display: 'flex', alignItems: 'center', gap: 9, background: theme.subtle, border: `1px solid ${theme.border}`, borderRadius: 11, padding: '9px 12px' }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: theme.accentSoft, color: theme.accent, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 13 }}>A</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: theme.ink }}>{t('Ahmed M.', 'أحمد م.')}</div>
              <div style={{ fontSize: 11, color: theme.inkFaint }}>{t('Loyalty · 1,240 pts', 'ولاء · 1,240 نقطة')}</div>
            </div>
            <Plus size={16} color={theme.inkFaint} />
          </Inert>
        </div>

        {/* Line items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
          {CART.map((it, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 6px', borderBottom: `1px solid ${theme.border}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: theme.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {locale === 'ar' ? it.ar : it.en}
                </div>
                <div style={{ fontSize: 12, color: theme.inkFaint }}>{money(it.price)}</div>
              </div>
              {/* qty stepper (inert) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Inert as="button" style={stepBtn(theme)}><Minus size={13} /></Inert>
                <span style={{ fontSize: 13, fontWeight: 800, color: theme.ink, minWidth: 16, textAlign: 'center' }}>{it.qty}</span>
                <Inert as="button" style={stepBtn(theme)}><Plus size={13} /></Inert>
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: theme.ink, minWidth: 74, textAlign: isRTL ? 'left' : 'right' }}>
                {money(it.qty * it.price)}
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div style={{ padding: '14px 18px', borderTop: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', gap: 7 }}>
          <Row label={t('Subtotal', 'المجموع الفرعي')} value={money(subtotal)} theme={theme} />
          <Row label={t('VAT (15%)', 'ضريبة القيمة المضافة (15%)')} value={money(vat)} theme={theme} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, marginTop: 2, borderTop: `1px dashed ${theme.border}` }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: theme.ink }}>{t('Total', 'الإجمالي')}</span>
            <span style={{ fontSize: 22, fontWeight: 900, color: theme.accent }}>{money(total)}</span>
          </div>
        </div>

        {/* Pay actions */}
        <div style={{ padding: '0 18px 18px', display: 'grid', gap: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Inert as="button" style={payGhost(theme)}><Banknote size={16} /> {t('Cash', 'نقدي')}</Inert>
            <Inert as="button" style={payGhost(theme)}><CreditCard size={16} /> {t('Card', 'بطاقة')}</Inert>
          </div>
          <Inert as="button" style={payGhost(theme)}><SplitSquareHorizontal size={16} /> {t('Split payment', 'دفع مقسّم')}</Inert>
          <Inert as="button" style={payPrimary(theme)}>
            {t('Charge', 'تحصيل')} {money(total)}
          </Inert>
        </div>
      </aside>

      <style jsx>{`
        @media (max-width: 880px) {
          :global(.pos-grid) { grid-template-columns: 1fr !important; }
          :global(.pos-cart) { position: relative !important; height: auto !important; top: 0 !important; }
        }
      `}</style>
    </div>
  );
}

function Row({ label, value, theme }: { label: string; value: string; theme: DemoTheme }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
      <span style={{ color: theme.inkMuted }}>{label}</span>
      <span style={{ color: theme.ink, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

const miniBtn = (th: DemoTheme): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  background: th.subtle, border: `1px solid ${th.border}`, color: th.inkMuted,
  borderRadius: 8, padding: 7, cursor: 'pointer',
});
const stepBtn = (th: DemoTheme): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  background: th.subtle, border: `1px solid ${th.border}`, color: th.ink,
  borderRadius: 7, padding: 5, cursor: 'pointer',
});
const payGhost = (th: DemoTheme): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  background: 'transparent', border: `1px solid ${th.border}`, color: th.ink,
  borderRadius: 11, padding: '11px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
});
const payPrimary = (th: DemoTheme): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  background: th.accent, border: `1px solid ${th.accentBorder}`, color: '#fff',
  borderRadius: 12, padding: '14px', fontSize: 15, fontWeight: 800, cursor: 'pointer',
});

function BackLink() {
  const { locale, theme } = useDemo();
  return (
    <div style={{ textAlign: 'center', padding: '14px 0 24px' }}>
      <Link href="/products/matjary" style={{ fontSize: 13, color: theme.accent, textDecoration: 'none', fontWeight: 700 }}>
        {locale === 'ar' ? '← عودة للمنتج' : '← Back to product'}
      </Link>
    </div>
  );
}

export default function MatjaryPos() {
  return (
    <DemoProvider themeSet={themeSet}>
      <PosInner />
      <BackLink />
    </DemoProvider>
  );
}
