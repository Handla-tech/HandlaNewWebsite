'use client';

/**
 * Manarah — MOBILE APPS demo (view-only): Parent app + Student app.
 *
 * Tabs & screens mirror the REAL Expo apps in the repo:
 *   Parent  (mobile/apps/parent-app):  Home · Attendance · Grades · Fees · Messages · More
 *   Student (mobile/apps/student-app): Home · Timetable · Homework · Grades · More
 *
 * Rendered inside phone frames with a status bar, header, scrollable screen and
 * a bottom tab bar. Switching tabs works; everything else is Inert.
 */

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Home, CheckSquare, Ribbon, CreditCard, MessagesSquare, MoreHorizontal,
  CalendarDays, BookOpen, Bell, ChevronDown, Sparkles, Clock, FileText,
} from 'lucide-react';
import { DemoProvider, DemoTheme, useDemo, Inert } from '@/components/product-demos/demo-shared';

/* Phone UI uses its own compact palette that flips with light/dark mode. */
const lightTheme: DemoTheme = {
  accent: '#16a34a',
  accentSoft: 'rgba(22,163,74,0.12)',
  accentBorder: 'rgba(22,163,74,0.28)',
  sidebar: '#0c1810',
  canvas: '#eef4f0',       // page behind the phones
  panel: '#ffffff',         // phone screen bg
  subtle: '#f3f8f5',        // cards inside phone
  border: 'rgba(6,78,59,0.10)',
  ink: '#0d2417',
  inkMuted: '#4a6b58',
  inkFaint: '#8aa899',
  nameEn: 'Manarah',
  nameAr: 'منارة',
};

const darkTheme: DemoTheme = {
  accent: '#22c55e',
  accentSoft: 'rgba(34,197,94,0.16)',
  accentBorder: 'rgba(34,197,94,0.32)',
  sidebar: '#0c1810',
  canvas: '#0a140d',
  panel: '#111c15',         // phone screen bg
  subtle: '#152219',        // cards inside phone
  border: 'rgba(255,255,255,0.09)',
  ink: '#e6f5ec',
  inkMuted: '#9dc4ac',
  inkFaint: '#5e8570',
  nameEn: 'Manarah',
  nameAr: 'منارة',
};

const themeSet = { dark: darkTheme, light: lightTheme };

type ParentTab = 'home' | 'attendance' | 'grades' | 'fees' | 'messages' | 'more';
type StudentTab = 'home' | 'timetable' | 'homework' | 'grades' | 'more';

const PARENT_TABS: { id: ParentTab; icon: React.ReactNode; en: string; ar: string }[] = [
  { id: 'home', icon: <Home size={18} />, en: 'Home', ar: 'الرئيسية' },
  { id: 'attendance', icon: <CheckSquare size={18} />, en: 'Attendance', ar: 'الحضور' },
  { id: 'grades', icon: <Ribbon size={18} />, en: 'Grades', ar: 'الدرجات' },
  { id: 'fees', icon: <CreditCard size={18} />, en: 'Fees', ar: 'الرسوم' },
  { id: 'messages', icon: <MessagesSquare size={18} />, en: 'Messages', ar: 'الرسائل' },
  { id: 'more', icon: <MoreHorizontal size={18} />, en: 'More', ar: 'المزيد' },
];

const STUDENT_TABS: { id: StudentTab; icon: React.ReactNode; en: string; ar: string }[] = [
  { id: 'home', icon: <Home size={18} />, en: 'Home', ar: 'الرئيسية' },
  { id: 'timetable', icon: <CalendarDays size={18} />, en: 'Timetable', ar: 'الجدول' },
  { id: 'homework', icon: <BookOpen size={18} />, en: 'Homework', ar: 'الواجبات' },
  { id: 'grades', icon: <Ribbon size={18} />, en: 'Grades', ar: 'الدرجات' },
  { id: 'more', icon: <MoreHorizontal size={18} />, en: 'More', ar: 'المزيد' },
];

/* ── Small building blocks scoped to the phone ───────────────────────────── */

function useMoney() {
  const { locale } = useDemo();
  return (n: string) => (locale === 'ar' ? `${n} ر.س` : `SAR ${n}`);
}

function Card({ children, pad = 12 }: { children: React.ReactNode; pad?: number }) {
  const { theme } = useDemo();
  return (
    <div style={{ background: theme.subtle, border: `1px solid ${theme.border}`, borderRadius: 14, padding: pad }}>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  const { theme } = useDemo();
  return <div style={{ fontSize: 13.5, fontWeight: 800, color: theme.ink, margin: '6px 2px 2px' }}>{children}</div>;
}

function StatTile({ label, value, color }: { label: string; value: string; color: string }) {
  const { theme } = useDemo();
  return (
    <Inert style={{ flex: 1, background: theme.subtle, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 12 }}>
      <div style={{ fontSize: 11, color: theme.inkFaint }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 900, color, marginTop: 3 }}>{value}</div>
    </Inert>
  );
}

function AiCard() {
  const { theme, locale } = useDemo();
  const t = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  return (
    <div style={{ border: `1px dashed ${theme.accentBorder}`, background: theme.accentSoft, borderRadius: 14, padding: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
      <Sparkles size={18} color={theme.accent} />
      <span style={{ fontSize: 12.5, color: theme.inkMuted, lineHeight: 1.4 }}>
        {t('AI assistant — summaries & study tips (coming soon).', 'المساعد الذكي — ملخصات ونصائح دراسية (قريباً).')}
      </span>
    </div>
  );
}

/* ── Screens ─────────────────────────────────────────────────────────────── */

function ParentScreen({ tab }: { tab: ParentTab }) {
  const { theme, locale, isRTL } = useDemo();
  const t = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const money = useMoney();

  if (tab === 'home') {
    return (
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Child switcher (real app has one) */}
        <Inert style={{ display: 'flex', alignItems: 'center', gap: 10, background: theme.subtle, border: `1px solid ${theme.border}`, borderRadius: 14, padding: '10px 12px' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: theme.accent, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800 }}>S</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: theme.ink }}>{t('Sara Ahmed', 'سارة أحمد')}</div>
            <div style={{ fontSize: 11.5, color: theme.inkFaint }}>{t('Grade 5 · Section A', 'الصف الخامس · شعبة أ')}</div>
          </div>
          <ChevronDown size={17} color={theme.inkFaint} />
        </Inert>

        <SectionTitle>{t('Today’s summary', 'ملخص اليوم')}</SectionTitle>
        <div style={{ display: 'flex', gap: 10 }}>
          <StatTile label={t('Attendance', 'نسبة الحضور')} value="96%" color="#22c55e" />
          <StatTile label={t('Due fees', 'رسوم مستحقة')} value={money('0')} color="#22c55e" />
        </div>

        <SectionTitle>{t('Latest announcement', 'آخر إعلان')}</SectionTitle>
        <Card>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: theme.ink, marginBottom: 3 }}>{t('Mid-term schedule released', 'صدور جدول منتصف الفصل')}</div>
          <div style={{ fontSize: 12.5, color: theme.inkMuted, lineHeight: 1.5 }}>{t('Exams start Sunday. Please check the timetable in the More tab.', 'تبدأ الاختبارات الأحد. يرجى مراجعة الجدول في تبويب المزيد.')}</div>
        </Card>

        <AiCard />
      </div>
    );
  }

  if (tab === 'attendance') {
    const rows: [string, string, string][] = [
      [t('Sun, Aug 10', 'الأحد 10 أغسطس'), t('Present', 'حاضر'), '#22c55e'],
      [t('Mon, Aug 11', 'الاثنين 11 أغسطس'), t('Present', 'حاضر'), '#22c55e'],
      [t('Tue, Aug 12', 'الثلاثاء 12 أغسطس'), t('Late', 'متأخر'), '#f59e0b'],
      [t('Wed, Aug 13', 'الأربعاء 13 أغسطس'), t('Absent', 'غائب'), '#ef4444'],
      [t('Thu, Aug 14', 'الخميس 14 أغسطس'), t('Present', 'حاضر'), '#22c55e'],
    ];
    return (
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <StatTile label={t('This month', 'هذا الشهر')} value="96%" color="#22c55e" />
          <StatTile label={t('Absences', 'الغياب')} value="1" color="#ef4444" />
          <StatTile label={t('Late', 'التأخير')} value="1" color="#f59e0b" />
        </div>
        <SectionTitle>{t('Recent days', 'الأيام الأخيرة')}</SectionTitle>
        {rows.map(([d, s, c], i) => (
          <Inert key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: theme.subtle, border: `1px solid ${theme.border}`, borderRadius: 11, padding: '11px 12px' }}>
            <span style={{ fontSize: 13, color: theme.ink }}>{d}</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: c }}>{s}</span>
          </Inert>
        ))}
      </div>
    );
  }

  if (tab === 'grades') return <GradesScreen />;

  if (tab === 'fees') {
    return (
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ background: theme.accentSoft, border: `1px solid ${theme.accentBorder}`, borderRadius: 16, padding: 18, textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: theme.inkMuted }}>{t('Outstanding balance', 'الرصيد المستحق')}</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: theme.accent, margin: '4px 0' }}>{money('0')}</div>
          <div style={{ fontSize: 12, color: theme.inkFaint }}>{t('All fees paid — thank you!', 'تم سداد جميع الرسوم — شكراً!')}</div>
        </div>
        <SectionTitle>{t('Payment history', 'سجل المدفوعات')}</SectionTitle>
        {[
          ['INV-3021', t('Term 1 Tuition', 'رسوم الفصل 1'), '9,500'],
          ['INV-2980', t('Bus — Term 1', 'النقل — الفصل 1'), '2,300'],
          ['INV-2955', t('Uniform & Books', 'الزي والكتب'), '840'],
        ].map(([no, label, amt], i) => (
          <Inert key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: theme.subtle, border: `1px solid ${theme.border}`, borderRadius: 11, padding: '11px 12px' }}>
            <div><div style={{ fontSize: 13, color: theme.ink }}>{label}</div><div style={{ fontSize: 11, color: theme.inkFaint }}>{no}</div></div>
            <div style={{ textAlign: isRTL ? 'left' : 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: theme.ink }}>{money(amt)}</div>
              <div style={{ fontSize: 11, color: '#22c55e' }}>{t('Paid', 'مدفوع')}</div>
            </div>
          </Inert>
        ))}
      </div>
    );
  }

  if (tab === 'messages') {
    return (
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 9 }}>
        <SectionTitle>{t('Inbox', 'الوارد')}</SectionTitle>
        {[
          [t('Ms. Mona (Math)', 'أ. منى (رياضيات)'), t('Great progress this week!', 'تقدّم رائع هذا الأسبوع!'), true],
          [t('School Admin', 'إدارة المدرسة'), t('Mid-term schedule attached', 'جدول منتصف الفصل مرفق'), true],
          [t('Bus Coordinator', 'منسق النقل'), t('Route 4 timing update', 'تحديث توقيت المسار 4'), false],
          [t('Nurse', 'الممرضة'), t('Annual health check reminder', 'تذكير بالفحص الصحي السنوي'), false],
        ].map(([who, msg, unread], i) => (
          <Inert key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', background: theme.subtle, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '11px 12px' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: theme.accentSoft, color: theme.accent, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 13 }}>
              {(who as string).charAt(0)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: theme.ink }}>{who}</div>
              <div style={{ fontSize: 12, color: theme.inkFaint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg}</div>
            </div>
            {unread && <span style={{ width: 8, height: 8, borderRadius: '50%', background: theme.accent }} />}
          </Inert>
        ))}
      </div>
    );
  }

  // more — mirrors parent More menu (announcements, homework, report cards, timetable, transport, consents, settings)
  return <MoreScreen items={[
    [t('Announcements', 'الإعلانات'), <Bell key="a" size={17} />],
    [t('Homework', 'الواجبات'), <BookOpen key="b" size={17} />],
    [t('Report Cards', 'كشوف العلامات'), <FileText key="c" size={17} />],
    [t('Timetable', 'الجدول الدراسي'), <CalendarDays key="d" size={17} />],
    [t('Transport', 'النقل المدرسي'), <Clock key="e" size={17} />],
    [t('Consents', 'الموافقات'), <CheckSquare key="f" size={17} />],
  ]} />;
}

function StudentScreen({ tab }: { tab: StudentTab }) {
  const { theme, locale } = useDemo();
  const t = (en: string, ar: string) => (locale === 'ar' ? ar : en);

  if (tab === 'home') {
    return (
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SectionTitle>{t('Today', 'اليوم')}</SectionTitle>
        <div style={{ display: 'flex', gap: 10 }}>
          <StatTile label={t('Next class', 'الحصة القادمة')} value={t('Math', 'رياضيات')} color={theme.accent} />
          <StatTile label={t('Homework due', 'واجبات مستحقة')} value="2" color="#f59e0b" />
        </div>
        <SectionTitle>{t('Schedule', 'الجدول')}</SectionTitle>
        {[
          [t('Math', 'رياضيات'), '08:00', t('Room 12', 'قاعة 12')],
          [t('Science', 'علوم'), '09:00', t('Lab 2', 'مختبر 2')],
          [t('English', 'إنجليزي'), '10:00', t('Room 8', 'قاعة 8')],
        ].map(([subj, time, room], i) => (
          <Inert key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: theme.subtle, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '11px 12px' }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: theme.accent, minWidth: 42 }}>{time}</span>
            <span style={{ flex: 1, fontSize: 13, color: theme.ink }}>{subj}</span>
            <span style={{ fontSize: 11.5, color: theme.inkFaint }}>{room}</span>
          </Inert>
        ))}
        <AiCard />
      </div>
    );
  }

  if (tab === 'timetable') {
    const days = [t('Sun', 'أحد'), t('Mon', 'اثن'), t('Tue', 'ثلا'), t('Wed', 'أرب'), t('Thu', 'خمي')];
    const subjects = [
      [t('Math', 'رياضيات'), t('Arabic', 'عربي'), t('Sci', 'علوم'), t('Math', 'رياضيات'), t('PE', 'رياضة')],
      [t('Eng', 'إنجليزي'), t('Math', 'رياضيات'), t('Art', 'فنون'), t('Sci', 'علوم'), t('Eng', 'إنجليزي')],
      [t('Sci', 'علوم'), t('Eng', 'إنجليزي'), t('Math', 'رياضيات'), t('Arabic', 'عربي'), t('IT', 'حاسب')],
    ];
    return (
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <SectionTitle>{t('Weekly timetable', 'الجدول الأسبوعي')}</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: `36px repeat(${days.length}, 1fr)`, gap: 4 }}>
          <div />
          {days.map((d, i) => (
            <div key={i} style={{ fontSize: 10.5, fontWeight: 800, color: theme.inkMuted, textAlign: 'center', padding: '4px 0' }}>{d}</div>
          ))}
          {subjects.map((row, r) => (
            <React.Fragment key={r}>
              <div style={{ fontSize: 10, color: theme.inkFaint, display: 'grid', placeItems: 'center' }}>{`P${r + 1}`}</div>
              {row.map((s, c) => (
                <Inert key={c} style={{ background: theme.accentSoft, borderRadius: 8, padding: '9px 2px', textAlign: 'center', fontSize: 10.5, fontWeight: 700, color: theme.accent }}>
                  {s}
                </Inert>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  }

  if (tab === 'homework') {
    return (
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 9 }}>
        <SectionTitle>{t('Assignments', 'الواجبات')}</SectionTitle>
        {[
          [t('Math — Exercises 4.1', 'رياضيات — تمارين 4.1'), t('Due tomorrow', 'يُسلَّم غداً'), '#f59e0b'],
          [t('Science — Lab report', 'علوم — تقرير المختبر'), t('Due in 3 days', 'خلال 3 أيام'), theme.accent],
          [t('English — Essay draft', 'إنجليزي — مسودة مقال'), t('Submitted', 'تم التسليم'), '#22c55e'],
          [t('Arabic — Reading', 'عربي — قراءة'), t('Submitted', 'تم التسليم'), '#22c55e'],
        ].map(([title, due, c], i) => (
          <Inert key={i} style={{ background: theme.subtle, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '12px' }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: theme.ink, marginBottom: 4 }}>{title}</div>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: c }}>{due}</span>
          </Inert>
        ))}
      </div>
    );
  }

  if (tab === 'grades') return <GradesScreen />;

  return <MoreScreen items={[
    [t('Exams', 'الاختبارات'), <FileText key="a" size={17} />],
    [t('Report Cards', 'كشوف العلامات'), <Ribbon key="b" size={17} />],
    [t('Materials', 'المواد التعليمية'), <BookOpen key="c" size={17} />],
    [t('Calendar', 'التقويم'), <CalendarDays key="d" size={17} />],
    [t('Notifications', 'الإشعارات'), <Bell key="e" size={17} />],
  ]} />;
}

/** Shared grades / report-card screen (both apps expose grades). */
function GradesScreen() {
  const { theme, locale } = useDemo();
  const t = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  return (
    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 9 }}>
      <div style={{ background: theme.accentSoft, border: `1px solid ${theme.accentBorder}`, borderRadius: 16, padding: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 12, color: theme.inkMuted }}>{t('Term 1 · GPA', 'الفصل 1 · المعدل')}</div>
        <div style={{ fontSize: 26, fontWeight: 900, color: theme.accent, marginTop: 2 }}>3.8 / 4.0</div>
      </div>
      <SectionTitle>{t('Subjects', 'المواد')}</SectionTitle>
      {[
        [t('Mathematics', 'الرياضيات'), '95', 'A'],
        [t('Science', 'العلوم'), '88', 'B+'],
        [t('English', 'الإنجليزية'), '92', 'A−'],
        [t('Arabic', 'العربية'), '90', 'A−'],
        [t('Art', 'الفنون'), '97', 'A'],
      ].map(([subj, score, grade], i) => (
        <Inert key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: theme.subtle, border: `1px solid ${theme.border}`, borderRadius: 11, padding: '11px 12px' }}>
          <span style={{ fontSize: 13, color: theme.ink }}>{subj}</span>
          <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: theme.inkMuted }}>{score}</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: theme.accent, background: theme.accentSoft, borderRadius: 6, padding: '2px 8px' }}>{grade}</span>
          </span>
        </Inert>
      ))}
    </div>
  );
}

function MoreScreen({ items }: { items: [string, React.ReactNode][] }) {
  const { theme } = useDemo();
  return (
    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map(([label, icon], i) => (
        <Inert key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, background: theme.subtle, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '13px 14px' }}>
          <span style={{ color: theme.accent, background: theme.accentSoft, borderRadius: 9, padding: 8, display: 'inline-flex' }}>{icon}</span>
          <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: theme.ink }}>{label}</span>
          <span style={{ color: theme.inkFaint, fontSize: 18 }}>›</span>
        </Inert>
      ))}
    </div>
  );
}

/* ── Phone frame ─────────────────────────────────────────────────────────── */

function Phone({ app }: { app: 'parent' | 'student' }) {
  const { theme, locale } = useDemo();
  const t = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const isParent = app === 'parent';
  const [pTab, setPTab] = useState<ParentTab>('home');
  const [sTab, setSTab] = useState<StudentTab>('home');

  const tabs = isParent ? PARENT_TABS : STUDENT_TABS;
  const activeId = isParent ? pTab : sTab;
  const activeLabel = tabs.find((x) => x.id === activeId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: theme.ink }}>
        {isParent ? t('Parent App', 'تطبيق ولي الأمر') : t('Student App', 'تطبيق الطالب')}
      </div>

      {/* Frame */}
      <div style={{ width: 300, borderRadius: 38, border: `11px solid ${theme.sidebar}`, background: theme.sidebar, boxShadow: '0 30px 70px rgba(0,0,0,0.45)', overflow: 'hidden' }}>
        <div style={{ background: theme.panel, height: 580, display: 'flex', flexDirection: 'column' }}>
          {/* Status bar */}
          <div style={{ height: 26, background: theme.panel, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px', color: theme.inkMuted, fontSize: 11, fontWeight: 700 }}>
            <span>9:41</span>
            <span style={{ display: 'inline-flex', gap: 4 }}>●●● ▮</span>
          </div>
          {/* App header */}
          <div style={{ background: theme.accent, color: '#fff', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 11, opacity: 0.85 }}>{isParent ? t('Manarah · Parent', 'منارة · ولي الأمر') : t('Manarah · Student', 'منارة · الطالب')}</div>
              <div style={{ fontSize: 15, fontWeight: 800 }}>{locale === 'ar' ? activeLabel?.ar : activeLabel?.en}</div>
            </div>
            <Inert as="button" style={{ position: 'relative', background: 'rgba(255,255,255,0.18)', border: 'none', borderRadius: 9, padding: 7 }}>
              <Bell size={16} color="#fff" />
              <span style={{ position: 'absolute', top: 4, right: 4, width: 7, height: 7, borderRadius: '50%', background: '#fde047' }} />
            </Inert>
          </div>
          {/* Screen */}
          <div style={{ flex: 1, overflowY: 'auto', background: theme.panel }}>
            {isParent ? <ParentScreen tab={pTab} /> : <StudentScreen tab={sTab} />}
          </div>
          {/* Tab bar */}
          <div style={{ display: 'flex', borderTop: `1px solid ${theme.border}`, background: theme.panel }}>
            {tabs.map((tb) => {
              const on = tb.id === activeId;
              return (
                <button
                  key={tb.id}
                  type="button"
                  onClick={() => (isParent ? setPTab(tb.id as ParentTab) : setSTab(tb.id as StudentTab))}
                  style={{ flex: 1, border: 'none', background: 'none', cursor: 'pointer', padding: '8px 0 9px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, color: on ? theme.accent : theme.inkFaint }}
                >
                  {tb.icon}
                  <span style={{ fontSize: 9, fontWeight: on ? 800 : 500 }}>{locale === 'ar' ? tb.ar : tb.en}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileInner() {
  const { locale, theme } = useDemo();
  const t = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  return (
    <div style={{ minHeight: 'calc(100vh - 40px)', padding: '32px 20px 48px', background: theme.canvas }}>
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: theme.ink, margin: '0 0 8px' }}>
          {t('Manarah Mobile Apps', 'تطبيقات منارة للجوال')}
        </h1>
        <p style={{ fontSize: 14, color: theme.inkMuted, margin: 0 }}>
          {t('Parent & Student apps — tap the tabs to explore each screen. View-only.', 'تطبيقا ولي الأمر والطالب — اضغط على التبويبات لاستكشاف كل شاشة. للقراءة فقط.')}
        </p>
      </div>
      <div style={{ display: 'flex', gap: 44, justifyContent: 'center', flexWrap: 'wrap', marginTop: 24 }}>
        <Phone app="parent" />
        <Phone app="student" />
      </div>
      <div style={{ textAlign: 'center', marginTop: 32 }}>
        <Link href="/products/manarah" style={{ fontSize: 13, color: theme.accent, textDecoration: 'none', fontWeight: 700 }}>
          {t('← Back to product', '← عودة للمنتج')}
        </Link>
      </div>
    </div>
  );
}

export default function ManarahMobile() {
  return (
    <DemoProvider themeSet={themeSet}>
      <MobileInner />
    </DemoProvider>
  );
}
