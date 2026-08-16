'use client';

/**
 * ErpShell — the shared dashboard chrome for the three product ERP demos.
 *
 * Renders a sidebar (module navigation — the ONLY real interaction besides
 * language switching), a topbar (inert search + inert profile), and a content
 * area. The parent provides the module list and a render function.
 *
 * View-only: sidebar switches modules (client-side state only); everything
 * else is Inert.
 */

import React from 'react';
import { Search, Bell, ChevronDown } from 'lucide-react';
import { DemoTheme, useDemo, Inert } from './demo-shared';

export interface ErpModule {
  id: string;
  labelEn: string;
  labelAr: string;
  icon: React.ReactNode;
  /** Optional section grouping label. */
  groupEn?: string;
  groupAr?: string;
}

interface ErpShellProps {
  theme: DemoTheme;
  modules: ErpModule[];
  active: string;
  onSelect: (id: string) => void;
  children: React.ReactNode;
}

export function ErpShell({ theme, modules, active, onSelect, children }: ErpShellProps) {
  const { locale, isRTL } = useDemo();

  const activeMod = modules.find((m) => m.id === active);

  // Group modules by their section label (fallback: single group).
  const groups: { label: string | null; items: ErpModule[] }[] = [];
  for (const m of modules) {
    const gl = locale === 'ar' ? m.groupAr ?? null : m.groupEn ?? null;
    let g = groups.find((x) => x.label === gl);
    if (!g) {
      g = { label: gl, items: [] };
      groups.push(g);
    }
    g.items.push(m);
  }

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 40px)' }}>
      {/* ─── Sidebar ─── */}
      <aside
        style={{
          width: 248,
          flexShrink: 0,
          background: theme.sidebar,
          [isRTL ? 'borderLeft' : 'borderRight']: `1px solid ${theme.border}`,
          padding: '16px 10px',
          position: 'sticky',
          top: 40,
          height: 'calc(100vh - 40px)',
          overflowY: 'auto',
        }}
        className="demo-sidebar"
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '4px 10px 16px',
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              background: theme.accent,
              display: 'grid',
              placeItems: 'center',
              fontWeight: 800,
              color: '#fff',
              fontSize: 16,
            }}
          >
            {(locale === 'ar' ? theme.nameAr : theme.nameEn).charAt(0)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 800, fontSize: 15, color: theme.ink, lineHeight: 1.1 }}>
              {locale === 'ar' ? theme.nameAr : theme.nameEn}
            </span>
            <span style={{ fontSize: 10.5, color: theme.inkFaint }}>
              {locale === 'ar' ? 'لوحة التحكم' : 'Dashboard'}
            </span>
          </div>
        </div>

        {groups.map((g, gi) => (
          <div key={gi} style={{ marginBottom: 10 }}>
            {g.label && (
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                  color: theme.inkFaint,
                  padding: '8px 12px 4px',
                }}
              >
                {g.label}
              </div>
            )}
            {g.items.map((m) => {
              const on = m.id === active;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onSelect(m.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 12px',
                    marginBottom: 2,
                    borderRadius: 9,
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: isRTL ? 'right' : 'left',
                    background: on ? theme.accentSoft : 'transparent',
                    color: on ? theme.accent : theme.inkMuted,
                    fontSize: 13.5,
                    fontWeight: on ? 700 : 500,
                    transition: 'all .15s',
                  }}
                >
                  <span style={{ display: 'inline-flex', flexShrink: 0 }}>{m.icon}</span>
                  <span>{locale === 'ar' ? m.labelAr : m.labelEn}</span>
                </button>
              );
            })}
          </div>
        ))}
      </aside>

      {/* ─── Main ─── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Topbar */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '12px 20px',
            borderBottom: `1px solid ${theme.border}`,
            background: theme.panel,
            position: 'sticky',
            top: 40,
            zIndex: 20,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h1 style={{ fontSize: 17, fontWeight: 800, color: theme.ink, margin: 0 }}>
              {activeMod ? (locale === 'ar' ? activeMod.labelAr : activeMod.labelEn) : ''}
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Inert
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: theme.canvas,
                border: `1px solid ${theme.border}`,
                borderRadius: 9,
                padding: '7px 12px',
                minWidth: 180,
              }}
            >
              <Search size={15} color={theme.inkFaint} />
              <span style={{ fontSize: 13, color: theme.inkFaint }}>
                {locale === 'ar' ? 'بحث...' : 'Search...'}
              </span>
            </Inert>
            <Inert
              as="button"
              style={{
                background: theme.canvas,
                border: `1px solid ${theme.border}`,
                borderRadius: 9,
                padding: 8,
                display: 'inline-flex',
              }}
            >
              <Bell size={16} color={theme.inkMuted} />
            </Inert>
            <Inert
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: theme.canvas,
                border: `1px solid ${theme.border}`,
                borderRadius: 9,
                padding: '5px 10px',
              }}
            >
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  background: theme.accent,
                  color: '#fff',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {locale === 'ar' ? 'م' : 'A'}
              </div>
              <ChevronDown size={14} color={theme.inkFaint} />
            </Inert>
          </div>
        </header>

        {/* Content */}
        <main style={{ padding: 20, flex: 1 }}>{children}</main>
      </div>

      {/* Mobile note: sidebar becomes scrollable; on very small screens we keep
          it visible but narrow. Kept simple for a demo. */}
      <style jsx>{`
        @media (max-width: 720px) {
          .demo-sidebar {
            width: 68px !important;
          }
          .demo-sidebar span {
            display: none;
          }
          .demo-sidebar button span:first-child {
            display: inline-flex !important;
          }
        }
      `}</style>
    </div>
  );
}
