'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Code2,
  LayoutDashboard, ShoppingCart, Package, Wallet,
  Users, FolderKanban, BarChart2, Settings,
  TrendingUp, TrendingDown,
} from 'lucide-react';
import Link from 'next/link';
import { useTranslation } from '@/hooks/useTranslation';
import { track } from '@/lib/track';

// ── Bilingual rotating phrases with per-word highlight spec ───────────────────
const PHRASES_EN = [
  { phrase: 'Become Digital Experiences',        highlight: ['Digital', 'Experiences'] },
  { phrase: 'Transform Into Managed Success',    highlight: ['Managed', 'Success']     },
  { phrase: 'Shape the Future of Your Business', highlight: ['Future']                 },
];

const PHRASES_AR = [
  { phrase: 'واقعاً رقمياً مبهراً',    highlight: ['رقمياً', 'مبهراً']  },
  { phrase: 'نجاحاً مُداراً باحتراف',  highlight: ['مُداراً', 'باحتراف'] },
  { phrase: 'مستقبلاً لأعمالك',        highlight: ['مستقبلاً']           },
];

// ── Renders a phrase with highlighted words in gold ───────────────────────────
function HighlightedPhrase({
  phrase,
  highlight,
}: {
  phrase: string;
  highlight: string[];
}) {
  const words = phrase.split(' ');
  return (
    <>
      {words.map((word, i) => {
        const isHighlighted = highlight.includes(word);
        return (
          <span
            key={i}
            style={{
              color: isHighlighted ? '#fbbf24' : 'var(--ink-1)',
              textShadow: isHighlighted ? '0 0 40px rgba(251,191,36,0.4)' : 'none',
            }}
          >
            {i > 0 ? ' ' : ''}{word}
          </span>
        );
      })}
    </>
  );
}

// ── Phrase indicator dots ─────────────────────────────────────────────────────
function PhraseDots({ total, active }: { total: number; active: number }) {
  return (
    <div className="flex items-center gap-1.5 mt-4">
      {Array.from({ length: total }).map((_, i) => (
        <motion.div
          key={i}
          className="rounded-full"
          animate={{
            width: i === active ? 20 : 6,
            background: i === active ? '#fbbf24' : 'var(--surface-8)',
          }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          style={{ height: 4 }}
        />
      ))}
    </div>
  );
}

// ── Mini sparkline bar chart ──────────────────────────────────────────────────
function Sparkline({ heights, color = '#fbbf24' }: { heights: number[]; color?: string }) {
  return (
    <div className="flex items-end gap-px" style={{ height: 24, width: 56 }}>
      {heights.map((h, i) => (
        <motion.div
          key={i}
          style={{
            flex: 1,
            height: `${h}%`,
            background: i === heights.length - 1 ? color : `${color}50`,
            borderRadius: '1px 1px 0 0',
          }}
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 0.35, delay: 0.9 + i * 0.04 }}
        />
      ))}
    </div>
  );
}

// ── World map dots (static decorative) ───────────────────────────────────────
function WorldMapDots() {
  const dots = [
    { x: 22, y: 38 },
    { x: 48, y: 35 },
    { x: 55, y: 48 },
    { x: 70, y: 30 },
    { x: 82, y: 55 },
    { x: 87, y: 70 },
  ];
  return (
    <div className="relative w-full" style={{ height: 52 }}>
      <svg
        viewBox="0 0 200 100"
        className="absolute inset-0 w-full h-full"
        style={{ opacity: 0.18 }}
      >
        <path d="M18 20 Q22 15 28 20 Q32 28 30 40 Q26 55 22 65 Q18 70 16 60 Q12 45 14 30 Z" fill="var(--ink-6)" />
        <path d="M85 18 Q92 14 98 20 Q100 28 96 34 Q90 38 85 34 Q82 28 85 18 Z" fill="var(--ink-6)" />
        <path d="M90 40 Q98 36 104 42 Q108 52 106 65 Q102 75 96 72 Q90 65 88 55 Q87 46 90 40 Z" fill="var(--ink-6)" />
        <path d="M105 18 Q130 10 155 14 Q165 20 162 32 Q155 40 140 38 Q120 36 108 30 Q103 24 105 18 Z" fill="var(--ink-6)" />
        <path d="M148 65 Q158 60 165 66 Q168 74 162 80 Q154 82 148 76 Q144 70 148 65 Z" fill="var(--ink-6)" />
      </svg>
      {dots.map((d, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: 5, height: 5,
            background: '#fbbf24',
            left: `${d.x}%`,
            top: `${d.y}%`,
            boxShadow: '0 0 8px #fbbf24, 0 0 16px rgba(251,191,36,0.4)',
            transform: 'translate(-50%,-50%)',
          }}
          animate={{ scale: [1, 1.6, 1], opacity: [1, 0.4, 1] }}
          transition={{ duration: 2, delay: i * 0.4, repeat: Infinity }}
        />
      ))}
    </div>
  );
}

// ── Full ERP Dashboard illustration ──────────────────────────────────────────
function ERPDashboard() {
  const statCards = [
    { label: 'Total Revenue',     value: '$4,250,000', trend: '+12.6%', up: true  },
    { label: 'Total Receivables', value: '$1,850,000', trend: '-4.2%',  up: false },
    { label: 'Top Profit',        value: '$2,400,000', trend: '+3.8%',  up: true  },
    { label: 'Total Clients',     value: '1,390',      trend: '+4.0%',  up: true  },
  ];

  const sidebarItems = [
    { icon: LayoutDashboard, label: 'Dashboard', active: true  },
    { icon: ShoppingCart,    label: 'Sales',     active: false },
    { icon: Package,         label: 'Purchases', active: false },
    { icon: Package,         label: 'Inventory', active: false },
    { icon: Wallet,          label: 'Finance',   active: false },
    { icon: Users,           label: 'CRM',       active: false },
    { icon: FolderKanban,    label: 'Projects',  active: false },
    { icon: BarChart2,       label: 'Reports',   active: false },
    { icon: Settings,        label: 'Settings',  active: false },
  ];

  const orders = [
    { id: 'A002-9930', customer: 'Alvina',       date: 'May 11, 2023', amount: '$120.00', status: 'Completed', color: '#22c55e' },
    { id: 'A011-4889', customer: 'Zara Theil',   date: 'May 21, 2023', amount: '$280.00', status: 'Cancelled', color: '#ef4444' },
    { id: 'A003-6540', customer: 'Lyford Fennel',date: 'May 25, 2023', amount: '$192.50', status: 'Pending',   color: '#fbbf24' },
  ];

  return (
    <div
      className="relative flex w-full overflow-hidden rounded-xl"
      style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--ov-med)',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 10,
        height: 420,
      }}
    >
      {/* ── Sidebar ─────────────────────────────────────── */}
      <div
        className="flex-shrink-0 flex flex-col"
        style={{ width: 96, background: 'var(--page-bg)', borderRight: '1px solid var(--ov-soft)', padding: '12px 0' }}
      >
        {/* Logo */}
        <div className="px-3 pb-3 mb-2" style={{ borderBottom: '1px solid var(--ov-soft)' }}>
          <div className="flex items-center gap-0" style={{ fontWeight: 800, fontSize: 12, letterSpacing: '-0.02em' }}>
            <span style={{ color: 'var(--ink-1)' }}>&lt;Handla&nbsp;</span>
            <span style={{ color: '#fbbf24', textShadow: '0 0 8px rgba(251,191,36,0.6)' }}>/</span>
            <span style={{ color: 'var(--ink-1)' }}>&gt;</span>
          </div>
        </div>

        {/* Nav items */}
        <div className="flex-1 overflow-hidden px-2" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {sidebarItems.map(({ icon: Icon, label, active }) => (
            <div
              key={label}
              className="flex items-center rounded-lg"
              style={{
                gap: 6,
                padding: '5px 8px',
                background: active ? '#fbbf24' : 'transparent',
                color: active ? '#0a0a0a' : 'var(--ink-6)',
              }}
            >
              <Icon style={{ width: 10, height: 10, flexShrink: 0 }} />
              <span style={{ fontSize: 9, fontWeight: active ? 700 : 400 }}>{label}</span>
            </div>
          ))}
        </div>

        {/* User */}
        <div className="px-3 pt-2 mt-auto" style={{ borderTop: '1px solid var(--ov-soft)' }}>
          <div className="flex items-center" style={{ gap: 7 }}>
            <div
              className="rounded-full flex items-center justify-center"
              style={{ width: 22, height: 22, background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)', fontSize: 9, fontWeight: 700, color: '#fbbf24', flexShrink: 0 }}
            >
              S
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: 'var(--ink-1)', fontSize: 8, fontWeight: 600, whiteSpace: 'nowrap' }}>Admin</div>
              <div style={{ color: 'var(--ink-6)', fontSize: 7 }}>Administrator</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main area ───────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col" style={{ padding: '12px 14px', gap: 9 }}>

        {/* Page title */}
        <div style={{ color: 'var(--ink-1)', fontWeight: 700, fontSize: 13 }}>Dashboard</div>

        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-2">
          {statCards.map((s, i) => (
            <motion.div
              key={s.label}
              className="rounded-lg"
              style={{ background: 'var(--surface-3)', border: '1px solid var(--ov-soft)', padding: '7px 8px' }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.5 + i * 0.07 }}
            >
              <div style={{ color: 'var(--ink-6)', fontSize: 7.5, marginBottom: 3 }}>{s.label}</div>
              <div style={{ color: 'var(--ink-1)', fontWeight: 700, fontSize: 10, marginBottom: 2 }}>{s.value}</div>
              <div className="flex items-center gap-0.5">
                {s.up
                  ? <TrendingUp style={{ width: 8, height: 8, color: '#22c55e' }} />
                  : <TrendingDown style={{ width: 8, height: 8, color: '#ef4444' }} />
                }
                <span style={{ color: s.up ? '#22c55e' : '#ef4444', fontSize: 8 }}>{s.trend}</span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Middle row: Revenue chart + Performance */}
        <div className="flex gap-1.5" style={{ flex: '1 1 0', minHeight: 0 }}>

          {/* Revenue overview */}
          <motion.div
            className="flex-1 rounded-lg flex flex-col"
            style={{ background: 'var(--surface-3)', border: '1px solid var(--ov-soft)', minWidth: 0, padding: '10px 10px 8px' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.7 }}
          >
            <div className="flex items-center justify-between mb-2">
              <span style={{ color: 'var(--ink-3)', fontSize: 9, fontWeight: 600 }}>Revenue Overview</span>
              <span style={{ color: '#fbbf24', fontSize: 8 }}>New Year ▾</span>
            </div>
            {/* Area chart */}
            <div className="flex-1 relative" style={{ minHeight: 0 }}>
              <svg
                viewBox="0 0 120 48"
                className="w-full h-full"
                preserveAspectRatio="none"
              >
                {[0.25, 0.5, 0.75].map((y, i) => (
                  <line
                    key={i}
                    x1="0" y1={y * 48} x2="120" y2={y * 48}
                    stroke="var(--ov-soft)" strokeWidth="0.5"
                  />
                ))}
                <defs>
                  <linearGradient id="heroAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <motion.path
                  d="M0,38 L10,32 L20,36 L30,24 L40,30 L50,18 L60,26 L70,20 L80,28 L90,14 L100,20 L110,12 L120,8 L120,48 L0,48 Z"
                  fill="url(#heroAreaGrad)"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.85 }}
                />
                <motion.path
                  d="M0,38 L10,32 L20,36 L30,24 L40,30 L50,18 L60,26 L70,20 L80,28 L90,14 L100,20 L110,12 L120,8"
                  fill="none" stroke="#fbbf24" strokeWidth="1.2"
                  style={{ filter: 'drop-shadow(0 0 3px rgba(251,191,36,0.5))' }}
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1, delay: 0.85, ease: 'easeOut' }}
                />
              </svg>
            </div>
            <div className="flex justify-between mt-1">
              {['Jan','Mar','May','Jul','Sep','Nov','Dec'].map((m) => (
                <span key={m} style={{ color: 'var(--ink-7)', fontSize: 7 }}>{m}</span>
              ))}
            </div>
          </motion.div>

          {/* Performance panel */}
          <motion.div
            className="rounded-lg"
            style={{
              background: 'var(--surface-3)',
              border: '1px solid var(--ov-soft)',
              width: 130,
              flexShrink: 0,
              padding: '10px 11px 10px',
              display: 'flex',
              flexDirection: 'column',
              gap: 9,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.8 }}
          >
            <span style={{ color: 'var(--ink-3)', fontSize: 9, fontWeight: 600 }}>Performance</span>
            {[
              { label: 'On-time',  value: '98%',   color: '#22c55e', bar: 98 },
              { label: 'Uptime',   value: '99.9%', color: '#fbbf24', bar: 99 },
              { label: 'Clients',  value: '1,390', color: '#60a5fa', bar: 72 },
            ].map((kpi) => (
              <div key={kpi.label} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--ink-4)', fontSize: 8 }}>{kpi.label}</span>
                  <span style={{ color: kpi.color, fontSize: 8.5, fontWeight: 700 }}>{kpi.value}</span>
                </div>
                <div style={{ height: 3, background: 'var(--ov-med)', borderRadius: 99 }}>
                  <motion.div
                    style={{ height: '100%', borderRadius: 99, background: kpi.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${kpi.bar}%` }}
                    transition={{ duration: 0.8, delay: 1.0 }}
                  />
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Bottom row */}
        <div className="flex gap-1.5" style={{ flex: '0 0 auto' }}>

          {/* Recent orders */}
          <motion.div
            className="flex-1 rounded-lg"
            style={{ background: 'var(--surface-3)', border: '1px solid var(--ov-soft)', minWidth: 0, padding: '10px 10px 8px' }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.9 }}
          >
            <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
              <span style={{ color: 'var(--ink-3)', fontSize: 9, fontWeight: 600 }}>Recent Orders</span>
              <span style={{ color: '#fbbf24', fontSize: 8 }}>Sale All →</span>
            </div>
            <div className="grid" style={{ gridTemplateColumns: '1.8fr 1.4fr 1.8fr 1fr 1.1fr', gap: '0 8px', marginBottom: 5 }}>
              {['Order ID','Customer','Date','Revenue','Status'].map((h) => (
                <span key={h} style={{ color: 'var(--ink-7)', fontSize: 7.5 }}>{h}</span>
              ))}
            </div>
            {orders.map((o) => (
              <div
                key={o.id}
                className="grid"
                style={{
                  gridTemplateColumns: '1.8fr 1.4fr 1.8fr 1fr 1.1fr',
                  gap: '0 8px',
                  padding: '5px 0',
                  borderTop: '1px solid var(--ov-soft)',
                  alignItems: 'center',
                }}
              >
                <span style={{ color: 'var(--ink-4)', fontSize: 8 }}>{o.id}</span>
                <span style={{ color: 'var(--ink-2)', fontSize: 8 }}>{o.customer}</span>
                <span style={{ color: 'var(--ink-6)', fontSize: 8 }}>{o.date}</span>
                <span style={{ color: 'var(--ink-1)', fontSize: 8 }}>{o.amount}</span>
                <span
                  className="rounded-full inline-flex items-center justify-center"
                  style={{
                    background: `${o.color}15`,
                    color: o.color,
                    fontSize: 7,
                    padding: '1px 5px',
                    border: `1px solid ${o.color}28`,
                  }}
                >
                  {o.status}
                </span>
              </div>
            ))}
          </motion.div>

          {/* Sales by region */}
          <motion.div
            className="rounded-lg flex flex-col"
            style={{ background: 'var(--surface-3)', border: '1px solid var(--ov-soft)', width: 110, padding: '10px 10px 8px' }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 1.0 }}
          >
            <span style={{ color: 'var(--ink-3)', fontSize: 9, fontWeight: 600, marginBottom: 6, display: 'block' }}>Sales by Region</span>
            <WorldMapDots />
            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { region: 'Americas', pct: 68 },
                { region: 'Europe',   pct: 82 },
                { region: 'Asia',     pct: 55 },
              ].map((r) => (
                <div key={r.region}>
                  <div className="flex justify-between" style={{ marginBottom: 3 }}>
                    <span style={{ color: 'var(--ink-6)', fontSize: 7.5 }}>{r.region}</span>
                    <span style={{ color: '#fbbf24', fontSize: 7.5 }}>{r.pct}%</span>
                  </div>
                  <div style={{ height: 3, background: 'var(--ov-med)', borderRadius: 2 }}>
                    <motion.div
                      style={{ height: '100%', borderRadius: 2, background: '#fbbf24' }}
                      initial={{ width: 0 }}
                      animate={{ width: `${r.pct}%` }}
                      transition={{ duration: 0.7, delay: 1.1 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function Hero() {
  const [phraseIdx, setPhraseIdx] = useState(0);
  const { t, locale, isRTL } = useTranslation();
  const PHRASES = isRTL ? PHRASES_AR : PHRASES_EN;

  useEffect(() => {
    setPhraseIdx(0);
  }, [locale]);

  useEffect(() => {
    const id = setInterval(() => {
      setPhraseIdx((i) => (i + 1) % PHRASES.length);
    }, 3000);
    return () => clearInterval(id);
  }, [PHRASES.length]);

  return (
    <section
      id="home"
      className="relative min-h-screen flex items-center overflow-hidden"
      style={{ background: 'var(--page-bg)' }}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* ── Background layers ─────────────────────────────────────────────── */}

      {/* Subtle grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(var(--ov-weak) 1px, transparent 1px), linear-gradient(90deg, var(--ov-weak) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Radial vignette overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 0%, transparent 0%, var(--vignette) 100%)',
        }}
      />

      {/* Gold right-side glow */}
      <div
        className={`absolute ${isRTL ? 'left-0' : 'right-0'} top-1/2 -translate-y-1/2 w-[800px] h-[800px] pointer-events-none`}
        style={{
          background: 'radial-gradient(circle, rgba(251,191,36,0.06) 0%, transparent 65%)',
        }}
      />

      {/* ── Floating particles (reduced to 3 for restraint) ────────────────── */}
      {[
        { x: '15%', y: '20%', size: 2, delay: 0,   dur: 4  },
        { x: '85%', y: '18%', size: 1.5, delay: 1, dur: 5  },
        { x: '78%', y: '72%', size: 2, delay: 2,   dur: 4.5},
      ].map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            background: '#fbbf24',
            boxShadow: `0 0 ${p.size * 4}px rgba(251,191,36,0.6)`,
          }}
          animate={{ opacity: [0.2, 0.8, 0.2], scale: [1, 1.5, 1] }}
          transition={{ duration: p.dur, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-24 pb-16 w-full">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-10 items-center min-h-[calc(100vh-6rem)]">

          {/* ── Left: Copy ─────────────────────────────────────────────────── */}
          <div className="flex flex-col justify-center">

            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-6"
            >
              <span
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase"
                style={{
                  background: 'rgba(251,191,36,0.08)',
                  color: '#fbbf24',
                  border: '1px solid rgba(251,191,36,0.2)',
                  boxShadow: '0 0 20px rgba(251,191,36,0.08)',
                }}
              >
                <motion.span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: '#fbbf24' }}
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                {t('hero.badge')}
              </span>
            </motion.div>

            {/* Headline */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mb-2"
            >
              <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-extrabold text-white leading-[1.15] tracking-tight m-0 p-0">
                <span className="block">{t('hero.staticLine')}</span>

                {/* Animated slider — reserves space for a two-line phrase
                    (1.15 line-height × 2 ≈ 2.3em). English phrases like
                    "Transform Into Managed Success" wrap to two lines, so the
                    container must be tall enough or the second line gets
                    clipped by overflow-hidden. RTL (Arabic) phrases are shorter
                    but the same height keeps both layouts consistent. */}
                <span
                  className="block relative overflow-hidden"
                  style={{ height: '2.4em' }}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={phraseIdx}
                      initial={{ y: '100%', opacity: 0 }}
                      animate={{ y: '0%', opacity: 1 }}
                      exit={{ y: '-100%', opacity: 0 }}
                      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                      className="absolute inset-0 font-extrabold leading-[1.15] tracking-tight"
                      dir={isRTL ? 'rtl' : 'ltr'}
                    >
                      <HighlightedPhrase
                        phrase={PHRASES[phraseIdx].phrase}
                        highlight={PHRASES[phraseIdx].highlight}
                      />
                    </motion.span>
                  </AnimatePresence>
                </span>
              </h1>

              <PhraseDots total={PHRASES.length} active={phraseIdx} />
            </motion.div>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-base sm:text-lg leading-relaxed mb-8 max-w-lg"
              style={{ color: 'var(--ink-3)' }}
            >
              {t('hero.subtitle')}
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-wrap gap-3"
            >
              <Link
                href="#contact"
                onClick={() => track('cta_hero_primary', { target: '#contact' })}
                className="btn-primary flex items-center gap-2 text-sm group"
                style={{ boxShadow: '0 0 0 0 rgba(251,191,36,0)' }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 0 30px rgba(251,191,36,0.3)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 0 rgba(251,191,36,0)';
                }}
              >
                {t('hero.ctaPrimary')}
                <ArrowRight className={`w-4 h-4 transition-transform group-hover:translate-x-0.5 ${isRTL ? 'rotate-180' : ''}`} />
              </Link>
              <a
                href="#products"
                onClick={(e) => {
                  e.preventDefault();
                  track('cta_hero_secondary', { target: '#products' });
                  document.querySelector('#products')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                {t('hero.ctaSecondary')}
              </a>
            </motion.div>

            {/* Trust indicators */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="flex items-center gap-5 mt-8 pt-6"
              style={{ borderTop: '1px solid var(--ov-soft)' }}
            >
              {[
                { value: '200+', label: 'Projects Delivered' },
                { value: '98%',  label: 'Client Satisfaction' },
                { value: '24/7', label: 'Support' },
              ].map((stat, i) => (
                <div key={i} className="flex flex-col">
                  <span className="text-base font-extrabold" style={{ color: '#fbbf24' }}>{stat.value}</span>
                  <span className="text-xs" style={{ color: 'var(--ink-4)' }}>{stat.label}</span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* ── Right: ERP Dashboard ─────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, x: isRTL ? -50 : 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="relative hidden lg:flex flex-col items-center justify-center"
          >
            {/* Tablet frame */}
            <div
              className="relative w-full"
              style={{
                maxWidth: 520,
                borderRadius: 20,
                padding: 10,
                background: 'linear-gradient(145deg, var(--surface-5) 0%, var(--surface-3) 100%)',
                border: '1px solid var(--ov-med)',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              {/* Tablet notch bar */}
              <div
                className="flex items-center justify-between mb-2 px-1"
                style={{ height: 14 }}
              >
                <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--ov-med)' }} />
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'var(--ov-med)', flexShrink: 0 }} />
                <div className="flex gap-1.5 items-center">
                  {[0,1,2].map((i) => (
                    <div key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--ov-strong)' }} />
                  ))}
                </div>
              </div>

              {/* Dashboard screen */}
              <ERPDashboard />

              {/* Bottom bar */}
              <div className="flex justify-center pt-2">
                <div style={{ width: 52, height: 4, borderRadius: 2, background: 'var(--ov-med)' }} />
              </div>
            </div>

            {/* Code badge top-left */}
            <motion.div
              className={`absolute -top-4 ${isRTL ? '-right-4' : '-left-4'} hidden lg:flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono`}
              style={{
                background: 'var(--surface-3)',
                border: '1px solid var(--ov-strong)',
                color: '#fbbf24',
                boxShadow: 'var(--shadow-md)',
              }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 1.2 }}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>ERP · Mobile App · Website</span>
            </motion.div>

            {/* Floating stat badge bottom-right */}
            <motion.div
              className={`absolute -bottom-4 ${isRTL ? '-left-2' : '-right-2'} hidden lg:flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl`}
              style={{
                background: 'var(--surface-3)',
                border: '1px solid var(--ov-strong)',
                boxShadow: 'var(--shadow-md)',
              }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.3 }}
            >
              <div
                className="flex items-center justify-center rounded-lg"
                style={{ width: 28, height: 28, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.18)' }}
              >
                <TrendingUp style={{ width: 14, height: 14, color: '#22c55e' }} />
              </div>
              <div>
                <div style={{ color: 'var(--ink-1)', fontWeight: 700, fontSize: 13 }}>+18%</div>
                <div style={{ color: 'var(--ink-4)', fontSize: 10 }}>Revenue Growth</div>
              </div>
            </motion.div>

            {/* Live badge top-right */}
            <motion.div
              className={`absolute top-8 ${isRTL ? '-left-6' : '-right-6'} hidden lg:flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold`}
              style={{
                background: 'var(--surface-3)',
                border: '1px solid var(--ov-strong)',
                color: 'var(--ink-1)',
                boxShadow: 'var(--shadow-md)',
              }}
              initial={{ opacity: 0, x: isRTL ? -16 : 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 1.4 }}
            >
              <motion.div
                className="rounded-full"
                style={{ width: 7, height: 7, background: '#22c55e', flexShrink: 0, boxShadow: '0 0 6px rgba(34,197,94,0.8)' }}
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.4, repeat: Infinity }}
              />
              Live · 1,390 clients
            </motion.div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
