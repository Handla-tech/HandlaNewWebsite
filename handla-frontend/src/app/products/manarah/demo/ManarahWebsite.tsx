'use client';

/**
 * Manarah — public SCHOOL WEBSITE demo (view-only).
 * Mirrors real Manarah website routes: about, academics, admissions,
 * careers, contact, events, news. All actions Inert. Light green theme.
 */

import React from 'react';
import Link from 'next/link';
import { GraduationCap, CalendarDays, Newspaper, Phone, ChevronRight, Menu } from 'lucide-react';
import { DemoProvider, DemoTheme, useDemo, Inert } from '@/components/product-demos/demo-shared';

const lightTheme: DemoTheme = {
  accent: '#16a34a',
  accentSoft: 'rgba(22,163,74,0.12)',
  accentBorder: 'rgba(22,163,74,0.3)',
  sidebar: '#ffffff',
  canvas: '#f4faf6',
  panel: '#ffffff',
  subtle: '#eef7f1',
  border: 'rgba(0,0,0,0.09)',
  ink: '#0d2417',
  inkMuted: '#4a6b58',
  inkFaint: '#8aa899',
  nameEn: 'Manarah',
  nameAr: 'منارة',
};

const darkTheme: DemoTheme = {
  accent: '#22c55e',
  accentSoft: 'rgba(34,197,94,0.14)',
  accentBorder: 'rgba(34,197,94,0.32)',
  sidebar: '#0c1810',
  canvas: '#07110b',
  panel: '#0e1c13',
  subtle: '#0a1a10',
  border: 'rgba(255,255,255,0.09)',
  ink: '#e6f5ec',
  inkMuted: '#9dc4ac',
  inkFaint: '#5e8570',
  nameEn: 'Manarah',
  nameAr: 'منارة',
};

const themeSet = { dark: darkTheme, light: lightTheme };

function WebsiteInner() {
  const { locale, theme, mode } = useDemo();
  const t = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const imgBg = mode === 'light'
    ? 'linear-gradient(135deg, #d1fae5, #a7f3d0)'
    : 'linear-gradient(135deg, #0f2a1c, #123a26)';
  const cardImgBg = mode === 'light'
    ? 'linear-gradient(135deg,#dcfce7,#bbf7d0)'
    : 'linear-gradient(135deg,#0f2a1c,#123a26)';

  const nav: [string, string][] = [
    ['About', 'عن المدرسة'], ['Academics', 'الأكاديمي'], ['Admissions', 'القبول'],
    ['Events', 'الفعاليات'], ['News', 'الأخبار'], ['Careers', 'الوظائف'], ['Contact', 'اتصل بنا'],
  ];

  return (
    <div style={{ minHeight: 'calc(100vh - 40px)', background: theme.canvas, color: theme.ink }}>
      {/* Header */}
      <header style={{ background: theme.panel, borderBottom: `1px solid ${theme.border}`, position: 'sticky', top: 40, zIndex: 20 }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 20, padding: '14px 20px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 19, fontWeight: 900, color: theme.accent }}>
            <GraduationCap size={24} /> {locale === 'ar' ? 'منارة' : 'Manarah'}
          </span>
          <nav style={{ display: 'flex', gap: 4, marginInlineStart: 'auto', flexWrap: 'wrap' }} className="mn-web-nav">
            {nav.map(([en, ar], i) => (
              <Inert key={i} as="span" style={{ fontSize: 13.5, fontWeight: 600, color: i === 0 ? theme.accent : theme.inkMuted, padding: '7px 11px', borderRadius: 8 }}>
                {t(en, ar)}
              </Inert>
            ))}
          </nav>
          <Inert as="button" style={{ background: theme.accent, color: '#fff', border: 'none', borderRadius: 9, padding: '9px 18px', fontWeight: 700, fontSize: 13.5 }}>
            {t('Apply Now', 'قدّم الآن')}
          </Inert>
          <Inert as="button" style={{ background: 'none', border: 'none', display: 'none' }} className="mn-web-burger"><Menu size={22} color={theme.inkMuted} /></Inert>
        </div>
      </header>

      {/* Hero */}
      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '48px 20px', display: 'grid', gap: 32, gridTemplateColumns: '1fr' }} className="mn-web-hero">
        <div>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: theme.accent, background: theme.accentSoft, borderRadius: 999, padding: '5px 13px' }}>
            {t('Est. 2004 · K–12', 'تأسست 2004 · روضة حتى ثانوي')}
          </span>
          <h1 style={{ fontSize: 'clamp(30px,4.5vw,46px)', fontWeight: 900, lineHeight: 1.1, margin: '18px 0 14px' }}>
            {t('A place where every student shines.', 'مكان يتألق فيه كل طالب.')}
          </h1>
          <p style={{ fontSize: 16, lineHeight: 1.7, color: theme.inkMuted, maxWidth: 520, margin: '0 0 24px' }}>
            {t(
              'Nurturing curious minds with a bilingual, values-driven education from kindergarten through high school.',
              'نُنمّي العقول الفضولية بتعليم ثنائي اللغة قائم على القيم من الروضة حتى الثانوية.',
            )}
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Inert as="button" style={{ background: theme.accent, color: '#fff', border: 'none', borderRadius: 10, padding: '12px 24px', fontWeight: 700, fontSize: 14.5 }}>
              {t('Book a tour', 'احجز جولة')}
            </Inert>
            <Inert as="button" style={{ background: theme.panel, color: theme.ink, border: `1px solid ${theme.border}`, borderRadius: 10, padding: '12px 24px', fontWeight: 700, fontSize: 14.5 }}>
              {t('View programs', 'عرض البرامج')}
            </Inert>
          </div>
          <div style={{ display: 'flex', gap: 28, marginTop: 30 }}>
            {[['1,248', t('Students', 'طالب')], ['112', t('Educators', 'معلم')], ['98%', t('Graduation', 'التخرّج')]].map(([v, l], i) => (
              <div key={i}>
                <div style={{ fontSize: 24, fontWeight: 900, color: theme.accent }}>{v}</div>
                <div style={{ fontSize: 13, color: theme.inkFaint }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ borderRadius: 18, background: imgBg, minHeight: 280, display: 'grid', placeItems: 'center' }}>
          <GraduationCap size={80} color={theme.accent} opacity={0.55} />
        </div>
      </section>

      {/* Quick links */}
      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '0 20px 24px' }}>
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(240px,1fr))' }}>
          {[
            [<CalendarDays key="a" size={22} />, t('Academic Calendar', 'التقويم الأكاديمي'), t('Terms, holidays & key dates.', 'الفصول والعطلات والمواعيد المهمة.')],
            [<GraduationCap key="b" size={22} />, t('Admissions', 'القبول والتسجيل'), t('How to apply, step by step.', 'كيفية التقديم، خطوة بخطوة.')],
            [<Newspaper key="c" size={22} />, t('Latest News', 'آخر الأخبار'), t('Events and achievements.', 'الفعاليات والإنجازات.')],
          ].map(([icon, title, desc], i) => (
            <Inert key={i} style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 20 }}>
              <span style={{ display: 'inline-flex', color: theme.accent, background: theme.accentSoft, borderRadius: 10, padding: 10, marginBottom: 12 }}>{icon}</span>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 6px' }}>{title}</h3>
              <p style={{ fontSize: 13.5, color: theme.inkMuted, margin: '0 0 10px' }}>{desc}</p>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: theme.accent, fontWeight: 700, fontSize: 13 }}>
                {t('Learn more', 'اعرف المزيد')} <ChevronRight size={15} />
              </span>
            </Inert>
          ))}
        </div>
      </section>

      {/* News */}
      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '20px 20px 48px' }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 16px' }}>{t('School News & Events', 'أخبار وفعاليات المدرسة')}</h2>
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(260px,1fr))' }}>
          {[
            [t('Annual Science Fair 2026', 'معرض العلوم السنوي 2026'), t('Sep 18', '18 سبتمبر')],
            [t('Open House for New Families', 'اليوم المفتوح للعائلات الجدد'), t('Oct 02', '2 أكتوبر')],
            [t('Inter-school Football Cup', 'كأس كرة القدم بين المدارس'), t('Oct 15', '15 أكتوبر')],
          ].map(([title, date], i) => (
            <Inert key={i} style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ height: 130, background: cardImgBg, display: 'grid', placeItems: 'center' }}>
                <Newspaper size={34} color={theme.accent} opacity={0.5} />
              </div>
              <div style={{ padding: 16 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: theme.accent }}>{date}</span>
                <h3 style={{ fontSize: 15, fontWeight: 800, margin: '6px 0 0' }}>{title}</h3>
              </div>
            </Inert>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: '#0d2417', color: '#a7f3d0', padding: '28px 20px', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
          <Phone size={15} /><span style={{ fontSize: 13 }}>+966 11 000 0000 · info@manarah.edu</span>
        </div>
        <span style={{ fontSize: 12.5, opacity: 0.7 }}>{t('Manarah school website — view-only demo', 'موقع مدرسة منارة — عرض للقراءة فقط')}</span>
        <div style={{ marginTop: 10 }}>
          <Link href="/products/manarah" style={{ fontSize: 13, color: '#4ade80', textDecoration: 'none', fontWeight: 700 }}>
            {t('← Back to product', '← عودة للمنتج')}
          </Link>
        </div>
      </footer>

      <style jsx>{`
        @media (min-width: 820px) {
          :global(.mn-web-hero) { grid-template-columns: 1.05fr 0.95fr !important; align-items: center; }
        }
        @media (max-width: 720px) {
          :global(.mn-web-nav) { display: none !important; }
          :global(.mn-web-burger) { display: inline-flex !important; }
        }
      `}</style>
    </div>
  );
}

export default function ManarahWebsite() {
  return (
    <DemoProvider themeSet={themeSet}>
      <WebsiteInner />
    </DemoProvider>
  );
}
