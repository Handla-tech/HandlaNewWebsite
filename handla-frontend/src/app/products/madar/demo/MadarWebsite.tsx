'use client';

/**
 * Madar — public agency WEBSITE demo (view-only).
 *
 * Mirrors the real Madar public site structure (Frontend/src/app):
 * Hero → Company Intro → Services → Stats → Featured Projects (portfolio) →
 * Featured Products (store) → CTA → Footer. Nav: Home, About, Services,
 * Projects, Store, Contact. Every control is Inert.
 *
 * Its own indigo/violet brand — distinct from the Handla marketing site.
 */

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Menu, ArrowRight, Palette, Code2, Megaphone, LineChart,
  Briefcase, Mail, Phone, MapPin, Star,
} from 'lucide-react';
import { DemoProvider, DemoTheme, useDemo, Inert } from '@/components/product-demos/demo-shared';

const darkTheme: DemoTheme = {
  accent: '#7c6cff',
  accentSoft: 'rgba(124,108,255,0.14)',
  accentBorder: 'rgba(124,108,255,0.32)',
  sidebar: '#0d0e1a',
  canvas: '#0a0b14',
  panel: '#131424',
  subtle: '#171930',
  border: 'rgba(255,255,255,0.09)',
  ink: '#eceef8',
  inkMuted: '#a9adc7',
  inkFaint: '#6f7396',
  nameEn: 'Madar',
  nameAr: 'مُدار',
};

const lightTheme: DemoTheme = {
  accent: '#6d5cf5',
  accentSoft: 'rgba(109,92,245,0.10)',
  accentBorder: 'rgba(109,92,245,0.26)',
  sidebar: '#ffffff',
  canvas: '#f6f6fc',
  panel: '#ffffff',
  subtle: '#f1f0fb',
  border: 'rgba(23,25,48,0.10)',
  ink: '#1a1836',
  inkMuted: '#5a5878',
  inkFaint: '#9a98b5',
  nameEn: 'Madar',
  nameAr: 'مُدار',
};

const themeSet = { dark: darkTheme, light: lightTheme };

const NAV: [string, string][] = [
  ['Home', 'الرئيسية'], ['About', 'من نحن'], ['Services', 'خدماتنا'],
  ['Projects', 'أعمالنا'], ['Store', 'المتجر'], ['Contact', 'تواصل'],
];

function WebsiteInner() {
  const { locale, isRTL, theme, mode } = useDemo();
  const t = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const money = (n: string) => (locale === 'ar' ? `${n} ر.س` : `SAR ${n}`);
  const [nav, setNav] = useState('Home');

  const heroBg = mode === 'light'
    ? 'linear-gradient(135deg, #ede9fe 0%, #f6f6fc 60%)'
    : 'radial-gradient(1200px 500px at 70% -10%, rgba(124,108,255,0.22), transparent), #0a0b14';

  const services: [React.ReactNode, string, string, string, string][] = [
    [<Palette key="a" size={22} />, 'Brand & Design', 'الهوية والتصميم', 'Logos, brand systems and print-ready identities.', 'شعارات وأنظمة هوية وملفات جاهزة للطباعة.'],
    [<Code2 key="b" size={22} />, 'Web & App Development', 'تطوير المواقع والتطبيقات', 'Marketing sites, web apps and integrations.', 'مواقع تسويقية وتطبيقات ويب وتكاملات.'],
    [<Megaphone key="c" size={22} />, 'Marketing & SEO', 'التسويق و SEO', 'Campaigns, content and search optimization.', 'حملات ومحتوى وتحسين لمحركات البحث.'],
    [<LineChart key="d" size={22} />, 'Consulting', 'الاستشارات', 'Strategy, roadmaps and growth advisory.', 'استراتيجية وخطط طريق واستشارات نمو.'],
  ];

  const projects: [string, string, string, string][] = [
    ['Website Rebrand', 'إعادة تصميم موقع', 'Nline Co.', 'Branding · Web'],
    ['Mobile App', 'تطبيق جوال', 'Falcon Group', 'Product · Dev'],
    ['Brand Identity', 'هوية بصرية', 'BlueSky Media', 'Design'],
    ['SEO Campaign', 'حملة SEO', 'Horizon Labs', 'Marketing'],
  ];

  const products: [string, string, string][] = [
    ['Landing Page Package', 'باقة صفحة هبوط', '4,500'],
    ['Brand Identity Kit', 'حزمة هوية بصرية', '9,000'],
    ['Web App (Basic)', 'تطبيق ويب (أساسي)', '28,000'],
    ['SEO Retainer', 'اشتراك SEO', '3,200'],
  ];

  return (
    <div style={{ minHeight: 'calc(100vh - 40px)', background: theme.canvas, color: theme.ink }}>
      {/* Header */}
      <header style={{ background: theme.panel, borderBottom: `1px solid ${theme.border}`, position: 'sticky', top: 40, zIndex: 20 }}>
        <div style={{ maxWidth: 1140, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 20, padding: '14px 20px' }}>
          <span style={{ fontSize: 21, fontWeight: 900, color: theme.accent }}>{locale === 'ar' ? 'مُدار' : 'Madar'}</span>
          <nav style={{ display: 'flex', gap: 4, marginInlineStart: 'auto', flexWrap: 'wrap' }} className="mw-nav">
            {NAV.map(([en, ar]) => {
              const on = nav === en;
              return (
                <button key={en} type="button" onClick={() => setNav(en)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px 12px', borderRadius: 8, fontSize: 13.5, fontWeight: on ? 700 : 500, color: on ? theme.accent : theme.inkMuted }}>
                  {t(en, ar)}
                </button>
              );
            })}
          </nav>
          <Inert as="button" style={{ background: theme.accent, color: '#fff', border: 'none', borderRadius: 9, padding: '9px 16px', fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap' }}>
            {t('Get a quote', 'اطلب عرض سعر')}
          </Inert>
          <Inert as="button" style={{ background: 'none', border: 'none', display: 'none' }} className="mw-burger"><Menu size={20} color={theme.inkMuted} /></Inert>
        </div>
      </header>

      {/* Hero */}
      <section style={{ background: heroBg }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '72px 20px 60px', textAlign: isRTL ? 'right' : 'left' }}>
          <span style={{ display: 'inline-block', fontSize: 12.5, fontWeight: 700, color: theme.accent, background: theme.accentSoft, border: `1px solid ${theme.accentBorder}`, borderRadius: 999, padding: '5px 13px', marginBottom: 18 }}>
            {t('Creative & Digital Agency', 'وكالة إبداعية ورقمية')}
          </span>
          <h1 style={{ fontSize: 44, lineHeight: 1.15, fontWeight: 900, margin: '0 0 18px', color: theme.ink }}>
            {t('We design, build and grow brands.', 'نصمم ونبني وننمّي العلامات التجارية.')}
          </h1>
          <p style={{ fontSize: 17, color: theme.inkMuted, maxWidth: 620, margin: isRTL ? '0 0 26px auto' : '0 0 26px', lineHeight: 1.6 }}>
            {t('From identity and websites to marketing and consulting — one team for your whole digital presence.', 'من الهوية والمواقع إلى التسويق والاستشارات — فريق واحد لكامل حضورك الرقمي.')}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: isRTL ? 'flex-end' : 'flex-start', flexWrap: 'wrap' }}>
            <Inert as="button" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: theme.accent, color: '#fff', border: 'none', borderRadius: 11, padding: '13px 24px', fontSize: 15, fontWeight: 800 }}>
              {t('Start a project', 'ابدأ مشروعاً')} <ArrowRight size={17} style={{ transform: isRTL ? 'scaleX(-1)' : 'none' }} />
            </Inert>
            <Inert as="button" style={{ background: 'transparent', color: theme.ink, border: `1px solid ${theme.border}`, borderRadius: 11, padding: '13px 24px', fontSize: 15, fontWeight: 700 }}>
              {t('View our work', 'شاهد أعمالنا')}
            </Inert>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section style={{ maxWidth: 1140, margin: '0 auto', padding: '10px 20px 8px' }}>
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          {[
            ['25+', t('Years of excellence', 'عاماً من التميز')],
            ['320+', t('Projects delivered', 'مشروعاً منجزاً')],
            ['180+', t('Happy clients', 'عميلاً سعيداً')],
            ['40+', t('Team members', 'عضواً في الفريق')],
          ].map(([v, l], i) => (
            <div key={i} style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 14, padding: '22px 18px', textAlign: 'center' }}>
              <div style={{ fontSize: 30, fontWeight: 900, color: theme.accent }}>{v}</div>
              <div style={{ fontSize: 13, color: theme.inkMuted, marginTop: 4 }}>{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Services */}
      <Section title={t('What we do', 'ماذا نقدّم')} sub={t('End-to-end services for your brand.', 'خدمات متكاملة لعلامتك التجارية.')}>
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' }}>
          {services.map(([icon, en, ar, den, dar], i) => (
            <Inert key={i} style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 22 }}>
              <span style={{ display: 'inline-flex', color: theme.accent, background: theme.accentSoft, borderRadius: 12, padding: 12, marginBottom: 14 }}>{icon}</span>
              <div style={{ fontSize: 16, fontWeight: 800, color: theme.ink, marginBottom: 6 }}>{t(en, ar)}</div>
              <div style={{ fontSize: 13.5, color: theme.inkMuted, lineHeight: 1.55 }}>{t(den, dar)}</div>
            </Inert>
          ))}
        </div>
      </Section>

      {/* Featured projects / portfolio */}
      <Section title={t('Featured work', 'أعمال مختارة')} sub={t('A few projects we’re proud of.', 'بعض المشاريع التي نفخر بها.')}>
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          {projects.map(([en, ar, client, tag], i) => (
            <Inert key={i} style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ height: 150, background: `linear-gradient(135deg, ${theme.accent}, #a78bfa)`, display: 'grid', placeItems: 'center', color: '#fff', opacity: 0.92 }}>
                <Briefcase size={34} />
              </div>
              <div style={{ padding: 16 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: theme.accent, textTransform: 'uppercase', letterSpacing: 0.5 }}>{tag}</span>
                <div style={{ fontSize: 16, fontWeight: 800, color: theme.ink, margin: '4px 0 2px' }}>{t(en, ar)}</div>
                <div style={{ fontSize: 13, color: theme.inkFaint }}>{client}</div>
              </div>
            </Inert>
          ))}
        </div>
      </Section>

      {/* Featured products / store */}
      <Section title={t('From our store', 'من متجرنا')} sub={t('Productized services you can buy online.', 'خدمات جاهزة يمكنك شراؤها عبر الإنترنت.')}>
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {products.map(([en, ar, price], i) => (
            <Inert key={i} style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 18 }}>
              <div style={{ display: 'flex', gap: 2, color: '#fbbf24', marginBottom: 10 }}>
                {Array.from({ length: 5 }).map((_, s) => <Star key={s} size={14} fill="#fbbf24" />)}
              </div>
              <div style={{ fontSize: 15.5, fontWeight: 800, color: theme.ink, marginBottom: 12, minHeight: 42 }}>{t(en, ar)}</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 18, fontWeight: 900, color: theme.accent }}>{money(price)}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: theme.accent, borderRadius: 9, padding: '8px 14px' }}>{t('Add to cart', 'أضف للسلة')}</span>
              </div>
            </Inert>
          ))}
        </div>
      </Section>

      {/* CTA */}
      <section style={{ maxWidth: 1140, margin: '10px auto 40px', padding: '0 20px' }}>
        <div style={{ borderRadius: 20, padding: '44px 32px', textAlign: 'center', background: `linear-gradient(120deg, ${theme.accent}, #a78bfa)`, color: '#fff' }}>
          <h2 style={{ fontSize: 28, fontWeight: 900, margin: '0 0 10px' }}>{t('Have a project in mind?', 'لديك مشروع في ذهنك؟')}</h2>
          <p style={{ fontSize: 15, opacity: 0.92, margin: '0 0 20px' }}>{t('Let’s build something great together.', 'لنبنِ شيئاً رائعاً معاً.')}</p>
          <Inert as="button" style={{ background: '#fff', color: theme.accent, border: 'none', borderRadius: 11, padding: '13px 26px', fontWeight: 800, fontSize: 15 }}>
            {t('Contact us', 'تواصل معنا')}
          </Inert>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: theme.panel, borderTop: `1px solid ${theme.border}`, padding: '28px 20px' }}>
        <div style={{ maxWidth: 1140, margin: '0 auto', display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'space-between', color: theme.inkMuted, fontSize: 13.5 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Mail size={15} color={theme.accent} /> hello@madar.co</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Phone size={15} color={theme.accent} /> +966 5X XXX XXXX</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><MapPin size={15} color={theme.accent} /> {t('Riyadh, Saudi Arabia', 'الرياض، السعودية')}</span>
        </div>
        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <Link href="/products/madar" style={{ fontSize: 13, color: theme.accent, textDecoration: 'none', fontWeight: 700 }}>
            {t('← Back to product', '← عودة للمنتج')}
          </Link>
        </div>
      </footer>

      <style jsx>{`
        @media (max-width: 760px) {
          :global(.mw-nav) { display: none !important; }
          :global(.mw-burger) { display: inline-flex !important; }
        }
      `}</style>
    </div>
  );
}

function Section({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  const { theme, isRTL } = useDemo();
  return (
    <section style={{ maxWidth: 1140, margin: '0 auto', padding: '38px 20px 8px' }}>
      <div style={{ textAlign: isRTL ? 'right' : 'left', marginBottom: 20 }}>
        <h2 style={{ fontSize: 26, fontWeight: 900, color: theme.ink, margin: '0 0 6px' }}>{title}</h2>
        <p style={{ fontSize: 15, color: theme.inkMuted, margin: 0 }}>{sub}</p>
      </div>
      {children}
    </section>
  );
}

export default function MadarWebsite() {
  return (
    <DemoProvider themeSet={themeSet}>
      <WebsiteInner />
    </DemoProvider>
  );
}
