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
import { Sun, Moon } from 'lucide-react';
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
  /** A subtly-recessed surface (e.g. table header, chips) — optional. */
  subtle?: string;
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

export type DemoMode = 'dark' | 'light';

/**
 * A product supplies BOTH a dark and light palette. The demo chrome lets the
 * viewer flip between them, and it initializes from the shared Handla uiStore
 * theme so the site-wide toggle carries through.
 */
export interface DemoThemeSet {
  dark: DemoTheme;
  light: DemoTheme;
}

/** Build a light DemoTheme from an accent + a few sensible defaults. */
export function makeLightTheme(
  accent: string,
  accentSoft: string,
  accentBorder: string,
  nameEn: string,
  nameAr: string,
): DemoTheme {
  return {
    accent,
    accentSoft,
    accentBorder,
    sidebar: '#ffffff',
    canvas: '#f4f6fb',
    panel: '#ffffff',
    subtle: '#f1f4f9',
    border: 'rgba(15,23,42,0.10)',
    ink: '#0f172a',
    inkMuted: '#475569',
    inkFaint: '#94a3b8',
    nameEn,
    nameAr,
  };
}

// ─── Locale ─────────────────────────────────────────────────────────────────

type Locale = 'en' | 'ar';

interface DemoCtx {
  locale: Locale;
  isRTL: boolean;
  theme: DemoTheme;
  mode: DemoMode;
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
  /** Either a single theme (dark-only, legacy) or a dark/light pair. */
  theme?: DemoTheme;
  themeSet?: DemoThemeSet;
  children: React.ReactNode;
}

/**
 * Wraps a demo, providing theme + locale + light/dark mode + the inert toast.
 * Reads locale AND theme from the shared Handla uiStore so the site-wide
 * toggles carry into the demo, but also renders its own toggles.
 */
export function DemoProvider({ theme: singleTheme, themeSet, children }: DemoProviderProps) {
  const storeLocale = useUIStore((s) => s.locale);
  const setStoreLocale = useUIStore((s) => s.setLocale);
  const storeTheme = useUIStore((s) => s.theme);

  // Resolve the theme pair. If only a single theme was given, derive a light
  // sibling from its accent so light mode still works everywhere.
  const set: DemoThemeSet = themeSet ?? {
    dark: singleTheme!,
    light: makeLightTheme(
      singleTheme!.accent,
      singleTheme!.accentSoft,
      singleTheme!.accentBorder,
      singleTheme!.nameEn,
      singleTheme!.nameAr,
    ),
  };

  const [locale, setLocale] = useState<Locale>(storeLocale === 'ar' ? 'ar' : 'en');
  const [mode, setMode] = useState<DemoMode>(storeTheme === 'light' ? 'light' : 'dark');
  const [toast, setToast] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep local demo locale synced from the store on mount / change.
  useEffect(() => {
    setLocale(storeLocale === 'ar' ? 'ar' : 'en');
  }, [storeLocale]);
  // Keep local demo mode synced from the store on mount / change.
  useEffect(() => {
    setMode(storeTheme === 'light' ? 'light' : 'dark');
  }, [storeTheme]);

  const theme = mode === 'light' ? set.light : set.dark;
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

  const toggleMode = useCallback(() => {
    setMode((m) => (m === 'light' ? 'dark' : 'light'));
  }, []);

  return (
    <Ctx.Provider value={{ locale, isRTL, theme, mode, notifyInert }}>
      <div
        dir={isRTL ? 'rtl' : 'ltr'}
        lang={locale}
        style={{ background: theme.canvas, color: theme.ink, minHeight: '100vh', transition: 'background .2s ease, color .2s ease' }}
        className="antialiased"
      >
        {/* Top view-only ribbon — always visible, communicates the demo nature. */}
        <DemoRibbon theme={theme} locale={locale} mode={mode} onToggleLocale={toggleLocale} onToggleMode={toggleMode} />
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
  mode,
  onToggleLocale,
  onToggleMode,
}: {
  theme: DemoTheme;
  locale: Locale;
  mode: DemoMode;
  onToggleLocale: () => void;
  onToggleMode: () => void;
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
          onClick={onToggleMode}
          title={mode === 'light' ? 'Dark mode' : 'Light mode'}
          aria-label={mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: theme.ink,
            background: theme.panel,
            border: `1px solid ${theme.border}`,
            borderRadius: 8,
            padding: '5px 9px',
            cursor: 'pointer',
          }}
        >
          {mode === 'light' ? <Moon size={15} /> : <Sun size={15} />}
        </button>
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
