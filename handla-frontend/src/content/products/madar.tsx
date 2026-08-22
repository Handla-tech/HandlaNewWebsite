'use client';

/**
 * Madar (مُدار) — product landing page.
 * Business / Agency Management ERP. Own indigo/violet brand.
 * All feature copy maps to REAL Madar modules (verified in the codebase).
 */

import React from 'react';
import {
  Users, FolderKanban, ReceiptText, FileCheck2, BarChart3, ShieldCheck,
  Globe, LayoutDashboard, ScrollText, Wallet,
} from 'lucide-react';
import type { ProductLandingContent } from '@/components/product-demos/ProductLanding';

const ACCENT = '#7c6cff';
const ACCENT_SOFT = 'rgba(124,108,255,0.14)';
const ACCENT_BORDER = 'rgba(124,108,255,0.32)';

// ── Hero preview: a small, static dashboard glimpse ──────────────────────────
function HeroImage() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/products/madar-hero.webp"
      alt="Madar agency ERP"
      style={{ width: '100%', height: 'auto', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 24px 60px rgba(0,0,0,0.45)', display: 'block' }}
    />
  );
}

export const madarContent: ProductLandingContent = {
  slug: 'madar',
  nameEn: 'Madar',
  nameAr: 'مُدار',
  categoryEn: 'Business & Agency Management ERP',
  categoryAr: 'نظام إدارة الأعمال والوكالات',
  taglineEn: 'Run your whole agency from one place.',
  taglineAr: 'أدر وكالتك بالكامل من مكان واحد.',
  introEn:
    'Madar is an all-in-one ERP for agencies and service businesses — manage clients and projects, send quotations, proposals and contracts, issue invoices, track orders, purchases and expenses, and see the full financial picture with built-in reports.',
  introAr:
    'مُدار نظام تخطيط موارد متكامل للوكالات والشركات الخدمية — أدر العملاء والمشاريع، وأرسل عروض الأسعار والعروض الفنية والعقود، وأصدر الفواتير، وتابع الطلبات والمشتريات والمصروفات، واطّلع على الصورة المالية الكاملة عبر التقارير المدمجة.',
  demoHref: '/products/madar/demo',
  accent: ACCENT,
  accentSoft: ACCENT_SOFT,
  accentBorder: ACCENT_BORDER,
  gradientFrom: '#7c6cff',
  gradientTo: '#a78bfa',
  featuresHeadingEn: 'Everything your agency runs on',
  featuresHeadingAr: 'كل ما تحتاجه وكالتك',
  featuresSubEn: 'From the first lead to the final invoice — and the reports that tie it all together.',
  featuresSubAr: 'من أول عميل محتمل حتى الفاتورة الأخيرة — والتقارير التي تربط كل ذلك معاً.',
  stats: [
    { valueEn: '15+', valueAr: '+15', labelEn: 'Modules', labelAr: 'وحدة' },
    { valueEn: '7', valueAr: '7', labelEn: 'Report types', labelAr: 'أنواع تقارير' },
    { valueEn: 'AR / EN', valueAr: 'عربي / إنجليزي', labelEn: 'Bilingual', labelAr: 'ثنائي اللغة' },
    { valueEn: '100%', valueAr: '100%', labelEn: 'Web-based', labelAr: 'عبر الويب' },
  ],
  features: [
    { icon: <Users size={20} />, titleEn: 'Clients & Client Projects', titleAr: 'العملاء ومشاريعهم', descEn: 'Keep every client, their contacts, projects and balances in one organized place.', descAr: 'احتفظ بكل عميل وجهات اتصاله ومشاريعه وأرصدته في مكان واحد منظّم.' },
    { icon: <FolderKanban size={20} />, titleEn: 'Projects, Scope & Tasks', titleAr: 'المشاريع والنطاق والمهام', descEn: 'Plan projects with scope items, task boards and progress tracking.', descAr: 'خطّط للمشاريع ببنود النطاق ولوحات المهام وتتبّع الإنجاز.' },
    { icon: <FileCheck2 size={20} />, titleEn: 'Quotations & Proposals', titleAr: 'عروض الأسعار والعروض الفنية', descEn: 'Create, send and track quotations and proposals through to acceptance.', descAr: 'أنشئ وأرسل وتابع عروض الأسعار والعروض الفنية حتى القبول.' },
    { icon: <ScrollText size={20} />, titleEn: 'Contracts', titleAr: 'العقود', descEn: 'Turn accepted proposals into contracts with printable, shareable documents.', descAr: 'حوّل العروض المقبولة إلى عقود بمستندات قابلة للطباعة والمشاركة.' },
    { icon: <ReceiptText size={20} />, titleEn: 'Invoices, Orders & Purchases', titleAr: 'الفواتير والطلبات والمشتريات', descEn: 'Bill clients, manage orders and record purchases from suppliers.', descAr: 'حرّر فواتير العملاء وأدر الطلبات وسجّل المشتريات من المورّدين.' },
    { icon: <Wallet size={20} />, titleEn: 'Expenses', titleAr: 'المصروفات', descEn: 'Log and categorize expenses to keep spending under control.', descAr: 'سجّل المصروفات وصنّفها للسيطرة على الإنفاق.' },
    { icon: <BarChart3 size={20} />, titleEn: 'Financial Reports', titleAr: 'التقارير المالية', descEn: 'Balance, ledger, profit, revenue, client, expense and Tax/VAT reports.', descAr: 'تقارير الميزانية ودفتر الأستاذ والأرباح والإيرادات والعملاء والمصروفات والضريبة/القيمة المضافة.' },
    { icon: <ShieldCheck size={20} />, titleEn: 'Users & Roles + more', titleAr: 'المستخدمون والصلاحيات والمزيد', descEn: 'Manage team access with roles, plus a product catalog, categories and a public website.', descAr: 'أدر وصول الفريق بالأدوار، بالإضافة إلى كتالوج المنتجات والتصنيفات وموقع عام.' },
  ],
  surfaces: [
    {
      icon: <LayoutDashboard size={22} />,
      labelEn: 'ERP Dashboard',
      labelAr: 'لوحة تحكم النظام',
      descEn: 'Explore every module — clients, projects, sales documents, finance and reports — in a view-only demo.',
      descAr: 'استكشف كل وحدة — العملاء والمشاريع ومستندات المبيعات والمالية والتقارير — في عرض للقراءة فقط.',
      href: '/products/madar/demo',
      ctaEn: 'Open ERP demo',
      ctaAr: 'افتح عرض النظام',
    },
    {
      icon: <Globe size={22} />,
      labelEn: 'Public Website',
      labelAr: 'الموقع العام',
      descEn: 'A public-facing agency website — hero, services, portfolio projects and an online store.',
      descAr: 'موقع عام للوكالة — واجهة رئيسية والخدمات ومعرض الأعمال ومتجر إلكتروني.',
      href: '/products/madar/demo/website',
      ctaEn: 'Open website demo',
      ctaAr: 'افتح الموقع التجريبي',
    },
  ],
  heroPreview: <HeroImage />,
};

