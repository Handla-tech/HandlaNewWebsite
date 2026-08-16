'use client';

/**
 * Manarah (منارة) — School Management System — product landing page.
 * K-12 SaaS. Own GREEN brand (per user preference).
 * Feature copy maps to REAL Manarah modules (verified in the codebase).
 */

import React from 'react';
import {
  GraduationCap, Users, Award, Wallet, Bus,
  BookMarked, MessageSquare, LayoutDashboard, Globe, Smartphone,
  CalendarDays,
} from 'lucide-react';
import { ProductLanding, ProductLandingContent } from '@/components/product-demos/ProductLanding';

const ACCENT = '#22c55e';
const ACCENT_SOFT = 'rgba(34,197,94,0.14)';
const ACCENT_BORDER = 'rgba(34,197,94,0.32)';

function HeroPreview() {
  return (
    <div style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', background: '#0e1c13', boxShadow: '0 24px 60px rgba(0,0,0,0.45)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57' }} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e' }} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840' }} />
        <span style={{ marginInlineStart: 10, fontSize: 12, color: '#5e8570' }}>manarah.edu / dashboard</span>
      </div>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          {[['Students', '1,248', ACCENT], ['Attendance', '96%', '#38bdf8'], ['Fees', '88%', '#c084fc']].map(([l, v, c], i) => (
            <div key={i} style={{ background: '#0a160f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, color: '#5e8570' }}>{l}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: c as string }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ background: '#0a160f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 96 }}>
            {[82, 88, 79, 94, 90, 96].map((h, i) => (
              <div key={i} style={{ flex: 1, height: `${h}%`, background: 'linear-gradient(180deg,#22c55e,#16a34a)', borderRadius: '4px 4px 0 0' }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const content: ProductLandingContent = {
  slug: 'manarah',
  nameEn: 'Manarah',
  nameAr: 'منارة',
  categoryEn: 'School Management System (K–12)',
  categoryAr: 'نظام إدارة المدارس (روضة حتى ثانوي)',
  taglineEn: 'The whole school, beautifully in sync.',
  taglineAr: 'المدرسة بالكامل، في تناغم تام.',
  introEn:
    'Manarah is an all-in-one school management platform — students and enrollment, teachers and HR, classes, timetable, attendance, exams, grades and report cards, fees and finance, admissions, transportation, library and communication — plus a public school website and dedicated parent & student mobile apps.',
  introAr:
    'منارة منصة متكاملة لإدارة المدارس — الطلاب والتسجيل، والمعلمون والموارد البشرية، والفصول والجدول الدراسي والحضور والاختبارات والدرجات وكشوف العلامات، والرسوم والمالية، والقبول، والنقل المدرسي، والمكتبة والتواصل — بالإضافة إلى موقع عام للمدرسة وتطبيقين مخصّصين لولي الأمر والطالب.',
  demoHref: '/products/manarah/demo',
  accent: ACCENT,
  accentSoft: ACCENT_SOFT,
  accentBorder: ACCENT_BORDER,
  gradientFrom: '#22c55e',
  gradientTo: '#4ade80',
  featuresHeadingEn: 'Everything a school needs to run',
  featuresHeadingAr: 'كل ما تحتاجه المدرسة لإدارتها',
  featuresSubEn: 'One connected system for staff, students and families — in Arabic and English.',
  featuresSubAr: 'نظام واحد متصل للطاقم والطلاب والعائلات — بالعربية والإنجليزية.',
  stats: [
    { valueEn: '15+', valueAr: '+15', labelEn: 'Modules', labelAr: 'وحدة' },
    { valueEn: '2 apps', valueAr: 'تطبيقان', labelEn: 'Parent & Student', labelAr: 'ولي الأمر والطالب' },
    { valueEn: 'K–12', valueAr: 'روضة–ثانوي', labelEn: 'Full range', labelAr: 'كل المراحل' },
    { valueEn: 'AR / EN', valueAr: 'عربي / إنجليزي', labelEn: 'Bilingual', labelAr: 'ثنائي اللغة' },
  ],
  features: [
    { icon: <GraduationCap size={20} />, titleEn: 'Students & Enrollment', titleAr: 'الطلاب والتسجيل', descEn: 'Student records, guardians, documents and enrollment in one place.', descAr: 'سجلات الطلاب وأولياء الأمور والمستندات والتسجيل في مكان واحد.' },
    { icon: <Users size={20} />, titleEn: 'Teachers & HR', titleAr: 'المعلمون والموارد البشرية', descEn: 'Staff, contracts, leave requests and payroll for the whole team.', descAr: 'الموظفون والعقود وطلبات الإجازة والرواتب لكامل الفريق.' },
    { icon: <CalendarDays size={20} />, titleEn: 'Classes, Timetable & Attendance', titleAr: 'الفصول والجدول والحضور', descEn: 'Academic years, terms, subjects, timetables and daily attendance.', descAr: 'الأعوام الدراسية والفصول والمواد والجداول والحضور اليومي.' },
    { icon: <Award size={20} />, titleEn: 'Exams, Grades & Report Cards', titleAr: 'الاختبارات والدرجات والكشوف', descEn: 'Schedule exams, record grades and generate report cards.', descAr: 'جدولة الاختبارات وتسجيل الدرجات وإصدار كشوف العلامات.' },
    { icon: <Wallet size={20} />, titleEn: 'Finance & Fees', titleAr: 'المالية والرسوم', descEn: 'Fee structures, invoices, payments and tax — plus expenses.', descAr: 'هياكل الرسوم والفواتير والمدفوعات والضريبة — بالإضافة إلى المصروفات.' },
    { icon: <Bus size={20} />, titleEn: 'Admissions & Transportation', titleAr: 'القبول والنقل المدرسي', descEn: 'Applications with stages, plus routes, vehicles and drivers.', descAr: 'طلبات القبول بمراحلها، بالإضافة إلى المسارات والمركبات والسائقين.' },
    { icon: <BookMarked size={20} />, titleEn: 'Library & Communication', titleAr: 'المكتبة والتواصل', descEn: 'Titles, copies, loans and fines, with announcements and messaging.', descAr: 'العناوين والنسخ والإعارة والغرامات، مع الإعلانات والمراسلة.' },
    { icon: <MessageSquare size={20} />, titleEn: 'Reports, Website & more', titleAr: 'التقارير والموقع والمزيد', descEn: 'Analytics, a public school website, localization, roles and files.', descAr: 'التحليلات وموقع عام للمدرسة واللغات والأدوار والملفات.' },
  ],
  surfaces: [
    {
      icon: <LayoutDashboard size={22} />,
      labelEn: 'Admin Dashboard',
      labelAr: 'لوحة التحكم',
      descEn: 'Explore students, staff, academics, finance, transport and more — view-only.',
      descAr: 'استكشف الطلاب والطاقم والأكاديمي والمالية والنقل والمزيد — للقراءة فقط.',
      href: '/products/manarah/demo',
      ctaEn: 'Open admin demo',
      ctaAr: 'افتح لوحة التحكم',
    },
    {
      icon: <Globe size={22} />,
      labelEn: 'School Website',
      labelAr: 'موقع المدرسة',
      descEn: 'The public-facing site — about, academics, admissions, events and news.',
      descAr: 'الموقع العام — عن المدرسة والأكاديمي والقبول والفعاليات والأخبار.',
      href: '/products/manarah/demo/website',
      ctaEn: 'Open website demo',
      ctaAr: 'افتح الموقع',
    },
    {
      icon: <Smartphone size={22} />,
      labelEn: 'Parent & Student Apps',
      labelAr: 'تطبيقا ولي الأمر والطالب',
      descEn: 'Mobile apps for attendance, grades, fees and messages — try both.',
      descAr: 'تطبيقات الجوال للحضور والدرجات والرسوم والرسائل — جرّب كليهما.',
      href: '/products/manarah/demo/mobile',
      ctaEn: 'Open mobile demo',
      ctaAr: 'افتح التطبيقات',
    },
  ],
  heroPreview: <HeroPreview />,
};

export default function ManarahLandingPage() {
  return <ProductLanding content={content} />;
}
