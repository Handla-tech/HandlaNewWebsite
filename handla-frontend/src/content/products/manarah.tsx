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
import type { ProductLandingContent } from '@/components/product-demos/ProductLanding';

const ACCENT = '#22c55e';
const ACCENT_SOFT = 'rgba(34,197,94,0.14)';
const ACCENT_BORDER = 'rgba(34,197,94,0.32)';

function HeroImage() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/products/manarah-hero.webp"
      alt="Manarah school management system"
      style={{ width: '100%', height: 'auto', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 24px 60px rgba(0,0,0,0.45)', display: 'block' }}
    />
  );
}

export const manarahContent: ProductLandingContent = {
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
  heroPreview: <HeroImage />,
};

