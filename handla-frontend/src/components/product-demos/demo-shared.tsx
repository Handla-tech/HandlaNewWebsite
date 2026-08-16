'use client';

/**
 * Shared building blocks for the three product DEMO mockups
 * (Madar, Matjary, Manarah).
 *
 * IMPORTANT — these are VIEW-ONLY, high-fidelity mockups:
 *   • No data is ever fetched or mutated.
 *   • Every interactive-looking control (buttons, inputs, rows) is INERT —
 *     clicks are swallowed and a small "View-only demo" toast is shown.
 *   • The ONLY things that actually work are: switching demo module/tab,
 *     switching language (EN/AR), and navigation back to the landing page.
 *
 * Each product passes its own `theme` (colors) so the demos look distinct.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import Link from 'next/link';
import { useUIStore } from '@/store/uiStore';

// ─── Theme ────────────────────────────────────────────────────────────────────

export interface DemoTheme {
  /** Brand accent (buttons, active states). */
  accent: string;
  /** Softer accent tint for backgrounds. */
  accentSoft: string;
  /** Accent border tint. */
  accentBorder: string;
  /** Sidebar / chrome background. */
  sidebar: string;
  /** Main canvas background. */
  canvas: string;
  /** Card / panel background. */
  panel: string;
  /** Border color for panels. */
  border: string;
  /** Strong text. */
  ink: string;
  /** Muted text. */
  inkMuted: string;
  /** Faint text. */
  inkFaint: string;
  /** Product display name (EN). */
  nameEn: string;
  /** Product display name (AR). */
  nameAr: string;
}

// ─── Locale ─────────────────────────────────────────────────────────────────

type Locale = 'en' | 'ar';

interface DemoCtx {
  locale: Locale;
  isRTL: boolean;
  theme: DemoTheme;
  /** Fire the "view-only" feedback toast (called by inert controls). */
  notifyInert: () => void;
}

const Ctx = createContext<DemoCtx | null>(null);

export function useDemo(): DemoCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useDemo must be used inside <DemoProvider>');
  return ctx;
}

/** Pick EN/AR string based on current demo locale. */
export function useT() {
  const { locale } = useDemo();
  return useCallback((en: string, ar: string) => (locale === 'ar' ? ar : en), [locale]);
}

// ─── Provider + chrome ──────────────────────────────────────────────────────

interface DemoProviderProps {
  theme: DemoTheme;
  children: React.ReactNode;
}

/**
 * Wraps a demo, providing theme + locale + the inert-action toast.
 * Reads locale from the shared Handla uiStore so the language toggle on the
 * marketing site carries into the demo, but also renders its own toggle.
 */
export function DemoProvider({ theme, children }: DemoProviderProps) {
  const storeLocale = useUIStore((s) => s.locale);
  const setStoreLocale = useUIStore((s) => s.setLocale);
  const [locale, setLocale] = useState<Locale>(storeLocale === 'ar' ? 'ar' : 'en');
  const [toast, setToast] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep local demo locale synced from the store on mount.
  useEffect(() => {
    setLocale(storeLocale === 'ar' ? 'ar' : 'en');
  }, [storeLocale]);

  const isRTL = locale === 'ar';

  const notifyInert = useCallback(() => {
    setToast(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(false), 1600);
  }, []);

  const toggleLocale = useCallback(() => {
    const next: Locale = locale === 'ar' ? 'en' : 'ar';
    setLocale(next);
    setStoreLocale(next);
  }, [locale, setStoreLocale]);

  return (
    <Ctx.Provider value={{ locale, isRTL, theme, notifyInert }}>
      <div
        dir={isRTL ? 'rtl' : 'ltr'}
        lang={locale}
        style={{ background: theme.canvas, color: theme.ink, minHeight: '100vh' }}
        className="antialiased"
      >
        {/* Top view-only ribbon — always visible, communicates the demo nature. */}
        <DemoRibbon theme={theme} locale={locale} onToggleLocale={toggleLocale} />
        {children}

        {/* Inert-action toast */}
        <div
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: `translateX(-50%) translateY(${toast ? '0' : '16px'})`,
            opacity: toast ? 1 : 0,
            transition: 'all .25s ease',
            pointerEvents: 'none',
            zIndex: 9999,
            background: 'rgba(17,17,17,0.94)',
            color: '#fff',
            border: `1px solid ${theme.accentBorder}`,
            borderRadius: 12,
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: 600,
            boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
          }}
        >
          {locale === 'ar'
            ? '🔒 عرض توضيحي للقراءة فقط — الإجراءات معطّلة'
            : '🔒 View-only demo — actions are disabled'}
        </div>
      </div>
    </Ctx.Provider>
  );
}

// ─── View-only ribbon ─────────────────────────────────────────────────────────

function DemoRibbon({
  theme,
  locale,
  onToggleLocale,
}: {
  theme: DemoTheme;
  locale: Locale;
  onToggleLocale: () => void;
}) {
  const name = locale === 'ar' ? theme.nameAr : theme.nameEn;
  const productSlug =
    theme.nameEn.toLowerCase().includes('madar')
      ? 'madar'
      : theme.nameEn.toLowerCase().includes('matjary')
        ? 'matjary'
        : 'manarah';

  return (
    <div
      style={{
        background: theme.sidebar,
        borderBottom: `1px solid ${theme.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '8px 16px',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            color: theme.accent,
            background: theme.accentSoft,
            border: `1px solid ${theme.accentBorder}`,
            borderRadius: 999,
            padding: '3px 10px',
          }}
        >
          {locale === 'ar' ? 'عرض توضيحي' : 'Live Demo'}
        </span>
        <span style={{ fontSize: 13, color: theme.inkMuted }}>
          {locale === 'ar'
            ? `${name} — للعرض فقط، لا حفظ / تعديل / إضافة`
            : `${name} — view-only, no save / edit / add`}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          onClick={onToggleLocale}
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: theme.ink,
            background: theme.panel,
            border: `1px solid ${theme.border}`,
            borderRadius: 8,
            padding: '5px 12px',
            cursor: 'pointer',
          }}
        >
          {locale === 'ar' ? 'English' : 'العربية'}
        </button>
        <Link
          href={`/products/${productSlug}`}
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: theme.accent,
            background: theme.accentSoft,
            border: `1px solid ${theme.accentBorder}`,
            borderRadius: 8,
            padding: '5px 12px',
            textDecoration: 'none',
          }}
        >
          {locale === 'ar' ? '← عودة للمنتج' : '← Back to product'}
        </Link>
      </div>
    </div>
  );
}

// ─── Inert wrapper ────────────────────────────────────────────────────────────

/**
 * Wrap any "actionable-looking" element so a click triggers the view-only
 * toast instead of doing anything. Use for buttons, add/save/delete controls,
 * table rows that "would" open a record, etc.
 */
export function Inert({
  children,
  className,
  style,
  title,
  as = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  as?: 'div' | 'button' | 'span' | 'tr';
}) {
  const { notifyInert } = useDemo();
  const handle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    notifyInert();
  };
  const Comp = as as React.ElementType;
  return (
    <Comp
      className={className}
      style={{ cursor: 'pointer', ...style }}
      title={title}
      onClick={handle}
      {...(as === 'button' ? { type: 'button' } : {})}
    >
      {children}
    </Comp>
  );
}

// ─── Small presentational helpers reused across demos ──────────────────────────

export function StatCard({
  label,
  value,
  sub,
  theme,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  theme: DemoTheme;
  icon?: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: theme.panel,
        border: `1px solid ${theme.border}`,
        borderRadius: 14,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: theme.inkMuted, fontWeight: 600 }}>{label}</span>
        {icon && (
          <span
            style={{
              color: theme.accent,
              background: theme.accentSoft,
              borderRadius: 8,
              padding: 5,
              display: 'inline-flex',
            }}
          >
            {icon}
          </span>
        )}
      </div>
      <span style={{ fontSize: 24, fontWeight: 800, color: theme.ink }}>{value}</span>
      {sub && <span style={{ fontSize: 12, color: theme.inkFaint }}>{sub}</span>}
    </div>
  );
}

export function Badge({
  children,
  color,
  bg,
}: {
  children: React.ReactNode;
  color: string;
  bg: string;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 11,
        fontWeight: 700,
        color,
        background: bg,
        borderRadius: 999,
        padding: '3px 9px',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

export function Panel({
  title,
  action,
  children,
  theme,
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  theme: DemoTheme;
}) {
  return (
    <div
      style={{
        background: theme.panel,
        border: `1px solid ${theme.border}`,
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      {(title || action) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px',
            borderBottom: `1px solid ${theme.border}`,
          }}
        >
          {title && <span style={{ fontWeight: 700, fontSize: 14, color: theme.ink }}>{title}</span>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
