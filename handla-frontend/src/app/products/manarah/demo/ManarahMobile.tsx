'use client';

/**
 * Manarah — MOBILE APPS demo (view-only): Parent app + Student app.
 * Tabs map to the REAL mobile apps in the repo (parent-app / student-app):
 * Home, Attendance, Grades, Fees, Messages, Timetable (More).
 * Rendered inside phone frames. All controls Inert.
 */

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Home, ClipboardCheck, Award, Wallet, MessageSquare, CalendarDays,
  Bell,
} from 'lucide-react';
import { DemoProvider, DemoTheme, useDemo, Inert } from '@/components/product-demos/demo-shared';

const theme: DemoTheme = {
  accent: '#16a34a',
  accentSoft: 'rgba(22,163,74,0.12)',
  accentBorder: 'rgba(22,163,74,0.3)',
  sidebar: '#0c1810',
  canvas: '#0a140d',
  panel: '#ffffff',
  border: 'rgba(0,0,0,0.08)',
  ink: '#0d2417',
  inkMuted: '#4a6b58',
  inkFaint: '#8aa899',
  nameEn: 'Manarah',
  nameAr: 'منارة',
};

type Tab = 'home' | 'attendance' | 'grades' | 'fees' | 'messages' | 'timetable';

const TABS: { id: Tab; icon: React.ReactNode; en: string; ar: string }[] = [
  { id: 'home', icon: <Home size={19} />, en: 'Home', ar: 'الرئيسية' },
  { id: 'attendance', icon: <ClipboardCheck size={19} />, en: 'Attendance', ar: 'الحضور' },
  { id: 'grades', icon: <Award size={19} />, en: 'Grades', ar: 'الدرجات' },
  { id: 'fees', icon: <Wallet size={19} />, en: 'Fees', ar: 'الرسوم' },
  { id: 'messages', icon: <MessageSquare size={19} />, en: 'Messages', ar: 'الرسائل' },
];

function Phone({ app }: { app: 'parent' | 'student' }) {
  const { locale, isRTL } = useDemo();
  const t = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const money = (n: string) => (locale === 'ar' ? `${n} ر.س` : `SAR ${n}`);
  const [tab, setTab] = useState<Tab>('home');

  const isParent = app === 'parent';
  const childName = t('Sara Ahmed · G5-A', 'سارة أحمد · G5-A');

  const Screen = () => {
    if (tab === 'home') {
      return (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 12, color: theme.inkFaint }}>{isParent ? t('Parent of', 'ولي أمر') : t('Welcome back', 'مرحباً بعودتك')}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: theme.ink }}>{isParent ? childName : t('Sara Ahmed', 'سارة أحمد')}</div>
            </div>
            <Inert as="button" style={{ position: 'relative', background: theme.accentSoft, border: 'none', borderRadius: 10, padding: 8 }}>
              <Bell size={17} color={theme.accent} />
              <span style={{ position: 'absolute', top: 4, [isRTL ? 'left' : 'right']: 4, width: 7, height: 7, borderRadius: '50%', background: '#ef4444' }} />
            </Inert>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              [t('Attendance', 'الحضور'), '96%', '#22c55e'],
              [t('Avg Grade', 'المعدل'), 'A−', '#38bdf8'],
              [t('Fees Due', 'رسوم مستحقة'), money('0'), '#22c55e'],
              [t('Unread', 'غير مقروء'), '2', '#f59e0b'],
            ].map(([l, v, c], i) => (
              <Inert key={i} style={{ background: theme.canvas === '#0a140d' ? '#f4faf6' : '#fff', border: `1px solid ${theme.border}`, borderRadius: 12, padding: 12 }}>
                <div style={{ fontSize: 11, color: theme.inkFaint }}>{l}</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: c as string, marginTop: 2 }}>{v}</div>
              </Inert>
            ))}
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, color: theme.ink, marginTop: 4 }}>{t('Today', 'اليوم')}</div>
          {[
            [<CalendarDays key="a" size={16} />, t('Math · Period 1', 'رياضيات · الحصة 1'), '08:00'],
            [<CalendarDays key="b" size={16} />, t('Science · Period 3', 'علوم · الحصة 3'), '10:00'],
            [<MessageSquare key="c" size={16} />, t('New announcement', 'إعلان جديد'), t('1h', 'قبل ساعة')],
          ].map(([icon, label, meta], i) => (
            <Inert key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f4faf6', border: `1px solid ${theme.border}`, borderRadius: 12, padding: '11px 12px' }}>
              <span style={{ color: theme.accent, background: theme.accentSoft, borderRadius: 8, padding: 6, display: 'inline-flex' }}>{icon}</span>
              <span style={{ flex: 1, fontSize: 13, color: theme.ink }}>{label}</span>
              <span style={{ fontSize: 12, color: theme.inkFaint }}>{meta}</span>
            </Inert>
          ))}
        </div>
      );
    }
    if (tab === 'attendance') {
      return (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: theme.ink, marginBottom: 4 }}>{t('This month', 'هذا الشهر')}</div>
          {[
            [t('Sun, Aug 10', 'الأحد 10 أغسطس'), t('Present', 'حاضر'), '#22c55e'],
            [t('Mon, Aug 11', 'الاثنين 11 أغسطس'), t('Present', 'حاضر'), '#22c55e'],
            [t('Tue, Aug 12', 'الثلاثاء 12 أغسطس'), t('Late', 'متأخر'), '#f59e0b'],
            [t('Wed, Aug 13', 'الأربعاء 13 أغسطس'), t('Absent', 'غائب'), '#ef4444'],
            [t('Thu, Aug 14', 'الخميس 14 أغسطس'), t('Present', 'حاضر'), '#22c55e'],
          ].map(([d, s, c], i) => (
            <Inert key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f4faf6', border: `1px solid ${theme.border}`, borderRadius: 10, padding: '11px 12px' }}>
              <span style={{ fontSize: 13, color: theme.ink }}>{d}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: c as string }}>{s}</span>
            </Inert>
          ))}
        </div>
      );
    }
    if (tab === 'grades') {
      return (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: theme.ink, marginBottom: 4 }}>{t('Term 1 · Report Card', 'الفصل 1 · كشف العلامات')}</div>
          {[
            [t('Mathematics', 'الرياضيات'), '95', 'A'],
            [t('Science', 'العلوم'), '88', 'B+'],
            [t('English', 'الإنجليزية'), '92', 'A−'],
            [t('Arabic', 'العربية'), '90', 'A−'],
            [t('Art', 'الفنون'), '97', 'A'],
          ].map(([subj, score, grade], i) => (
            <Inert key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f4faf6', border: `1px solid ${theme.border}`, borderRadius: 10, padding: '11px 12px' }}>
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
    if (tab === 'fees') {
      return (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ background: theme.accentSoft, border: `1px solid ${theme.accentBorder}`, borderRadius: 12, padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: theme.inkMuted }}>{t('Outstanding balance', 'الرصيد المستحق')}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: theme.accent, margin: '4px 0' }}>{money('0')}</div>
            <div style={{ fontSize: 12, color: theme.inkFaint }}>{t('All fees paid — thank you!', 'تم سداد جميع الرسوم — شكراً!')}</div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, color: theme.ink }}>{t('History', 'السجل')}</div>
          {[
            ['INV-3021', t('Term 1 Tuition', 'رسوم الفصل 1'), money('9,500'), t('Paid', 'مدفوع')],
            ['INV-2980', t('Bus — Term 1', 'النقل — الفصل 1'), money('2,300'), t('Paid', 'مدفوع')],
          ].map(([no, label, amt, st], i) => (
            <Inert key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f4faf6', border: `1px solid ${theme.border}`, borderRadius: 10, padding: '11px 12px' }}>
              <div><div style={{ fontSize: 13, color: theme.ink }}>{label}</div><div style={{ fontSize: 11, color: theme.inkFaint }}>{no}</div></div>
              <div style={{ textAlign: isRTL ? 'left' : 'right' }}><div style={{ fontSize: 13, fontWeight: 700, color: theme.ink }}>{amt}</div><div style={{ fontSize: 11, color: '#22c55e' }}>{st}</div></div>
            </Inert>
          ))}
        </div>
      );
    }
    // messages
    return (
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: theme.ink, marginBottom: 4 }}>{t('Inbox', 'الوارد')}</div>
        {[
          [t('Ms. Mona (Math)', 'أ. منى (رياضيات)'), t('Great progress this week!', 'تقدّم رائع هذا الأسبوع!'), true],
          [t('School Admin', 'إدارة المدرسة'), t('Mid-term schedule attached', 'جدول منتصف الفصل مرفق'), true],
          [t('Bus Coordinator', 'منسق النقل'), t('Route 4 timing update', 'تحديث توقيت المسار 4'), false],
        ].map(([who, msg, unread], i) => (
          <Inert key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', background: '#f4faf6', border: `1px solid ${theme.border}`, borderRadius: 10, padding: '11px 12px' }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: theme.accentSoft, color: theme.accent, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 13 }}>
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
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#e6f5ec' }}>
        {isParent ? t('Parent App', 'تطبيق ولي الأمر') : t('Student App', 'تطبيق الطالب')}
      </div>
      {/* Phone frame */}
      <div style={{ width: 300, borderRadius: 34, border: '10px solid #1a2b20', background: '#000', boxShadow: '0 30px 60px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
        <div style={{ background: theme.panel, height: 560, display: 'flex', flexDirection: 'column' }}>
          {/* status bar */}
          <div style={{ height: 30, background: theme.accent, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', color: '#fff', fontSize: 11, fontWeight: 700 }}>
            <span>9:41</span>
            <span>{isParent ? t('Parent', 'ولي الأمر') : t('Student', 'الطالب')}</span>
            <span>100%</span>
          </div>
          {/* screen */}
          <div style={{ flex: 1, overflowY: 'auto', background: '#fff' }}>
            <Screen />
          </div>
          {/* tab bar */}
          <div style={{ display: 'flex', borderTop: `1px solid ${theme.border}`, background: '#fff' }}>
            {TABS.map((tb) => {
              const on = tb.id === tab;
              return (
                <button key={tb.id} type="button" onClick={() => setTab(tb.id)}
                  style={{ flex: 1, border: 'none', background: 'none', cursor: 'pointer', padding: '9px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, color: on ? theme.accent : theme.inkFaint }}>
                  {tb.icon}
                  <span style={{ fontSize: 9.5, fontWeight: on ? 700 : 500 }}>{locale === 'ar' ? tb.ar : tb.en}</span>
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
  const { locale } = useDemo();
  const t = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  return (
    <div style={{ minHeight: 'calc(100vh - 40px)', padding: '32px 20px 48px' }}>
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#e6f5ec', margin: '0 0 8px' }}>
          {t('Manarah Mobile Apps', 'تطبيقات منارة للجوال')}
        </h1>
        <p style={{ fontSize: 14, color: '#9dc4ac', margin: 0 }}>
          {t('Parent & Student apps — tap the tabs to explore. View-only.', 'تطبيقا ولي الأمر والطالب — اضغط على التبويبات للاستكشاف. للقراءة فقط.')}
        </p>
      </div>
      <div style={{ display: 'flex', gap: 40, justifyContent: 'center', flexWrap: 'wrap', marginTop: 24 }}>
        <Phone app="parent" />
        <Phone app="student" />
      </div>
      <div style={{ textAlign: 'center', marginTop: 32 }}>
        <Link href="/products/manarah" style={{ fontSize: 13, color: '#4ade80', textDecoration: 'none', fontWeight: 700 }}>
          {t('← Back to product', '← عودة للمنتج')}
        </Link>
      </div>
    </div>
  );
}

export default function ManarahMobile() {
  return (
    <DemoProvider theme={theme}>
      <MobileInner />
    </DemoProvider>
  );
}
