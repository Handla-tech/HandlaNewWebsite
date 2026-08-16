'use client';

/**
 * Manarah (منارة) — School Management System — VIEW-ONLY ERP demo.
 *
 * Modules map to REAL Manarah backend Modules verified in the codebase:
 * Students (enrollment/guardians/documents), Teachers/Staff (HR: contracts/
 * leave/payroll), Classes & Academics (years/terms/campuses/grade levels/
 * subjects), Timetable, Attendance, Exams, Grades/Report Cards, Finance & Fees
 * (structures/invoices/payments/tax), Expenses, Admissions, Transportation
 * (vehicles/drivers/routes), Library (titles/copies/loans/fines),
 * Communication, Reports & Analytics, Website, Settings/Localization, Users.
 *
 * View-only: all controls Inert; module switch + language only. Green theme.
 */

import React, { useState } from 'react';
import {
  LayoutDashboard, GraduationCap, Users, CalendarDays, ClipboardCheck,
  FileText, Award, Wallet, Wallet2, UserPlus, Bus, BookMarked,
  MessageSquare, BarChart3, Globe, Settings, ShieldCheck, Building2,
  Plus, Filter, Download, CircleDollarSign,
} from 'lucide-react';
import { DemoProvider, DemoTheme, useDemo, Inert, StatCard, Badge, Panel } from '@/components/product-demos/demo-shared';
import { ErpShell, ErpModule } from '@/components/product-demos/ErpShell';
import { DataTable } from '@/components/product-demos/DataTable';

const darkTheme: DemoTheme = {
  accent: '#22c55e',
  accentSoft: 'rgba(34,197,94,0.14)',
  accentBorder: 'rgba(34,197,94,0.32)',
  sidebar: '#0c1810',
  canvas: '#07110b',
  panel: '#0e1c13',
  subtle: '#0a1a10',
  border: 'rgba(255,255,255,0.08)',
  ink: '#e6f5ec',
  inkMuted: '#9dc4ac',
  inkFaint: '#5e8570',
  nameEn: 'Manarah',
  nameAr: 'منارة',
};

const lightTheme: DemoTheme = {
  accent: '#16a34a',
  accentSoft: 'rgba(22,163,74,0.10)',
  accentBorder: 'rgba(22,163,74,0.26)',
  sidebar: '#ffffff',
  canvas: '#f2f9f4',
  panel: '#ffffff',
  subtle: '#eef7f1',
  border: 'rgba(6,78,59,0.10)',
  ink: '#0a2417',
  inkMuted: '#3f6b53',
  inkFaint: '#89a897',
  nameEn: 'Manarah',
  nameAr: 'منارة',
};

const themeSet = { dark: darkTheme, light: lightTheme };

const modules: ErpModule[] = [
  { id: 'dashboard', labelEn: 'Dashboard', labelAr: 'الرئيسية', icon: <LayoutDashboard size={17} />, groupEn: 'Overview', groupAr: 'نظرة عامة' },
  { id: 'students', labelEn: 'Students', labelAr: 'الطلاب', icon: <GraduationCap size={17} />, groupEn: 'People', groupAr: 'الأشخاص' },
  { id: 'teachers', labelEn: 'Teachers & HR', labelAr: 'المعلمون والموارد البشرية', icon: <Users size={17} />, groupEn: 'People', groupAr: 'الأشخاص' },
  { id: 'admissions', labelEn: 'Admissions', labelAr: 'القبول والتسجيل', icon: <UserPlus size={17} />, groupEn: 'People', groupAr: 'الأشخاص' },
  { id: 'classes', labelEn: 'Classes & Academics', labelAr: 'الفصول والأكاديمي', icon: <Building2 size={17} />, groupEn: 'Academics', groupAr: 'الأكاديمي' },
  { id: 'timetable', labelEn: 'Timetable', labelAr: 'الجدول الدراسي', icon: <CalendarDays size={17} />, groupEn: 'Academics', groupAr: 'الأكاديمي' },
  { id: 'attendance', labelEn: 'Attendance', labelAr: 'الحضور', icon: <ClipboardCheck size={17} />, groupEn: 'Academics', groupAr: 'الأكاديمي' },
  { id: 'exams', labelEn: 'Exams', labelAr: 'الاختبارات', icon: <FileText size={17} />, groupEn: 'Academics', groupAr: 'الأكاديمي' },
  { id: 'grades', labelEn: 'Grades & Report Cards', labelAr: 'الدرجات وكشوف العلامات', icon: <Award size={17} />, groupEn: 'Academics', groupAr: 'الأكاديمي' },
  { id: 'finance', labelEn: 'Finance & Fees', labelAr: 'المالية والرسوم', icon: <Wallet size={17} />, groupEn: 'Finance', groupAr: 'المالية' },
  { id: 'expenses', labelEn: 'Expenses', labelAr: 'المصروفات', icon: <Wallet2 size={17} />, groupEn: 'Finance', groupAr: 'المالية' },
  { id: 'transport', labelEn: 'Transportation', labelAr: 'النقل المدرسي', icon: <Bus size={17} />, groupEn: 'Operations', groupAr: 'العمليات' },
  { id: 'library', labelEn: 'Library', labelAr: 'المكتبة', icon: <BookMarked size={17} />, groupEn: 'Operations', groupAr: 'العمليات' },
  { id: 'communication', labelEn: 'Communication', labelAr: 'التواصل', icon: <MessageSquare size={17} />, groupEn: 'Operations', groupAr: 'العمليات' },
  { id: 'reports', labelEn: 'Reports & Analytics', labelAr: 'التقارير والتحليلات', icon: <BarChart3 size={17} />, groupEn: 'Insights', groupAr: 'التحليلات' },
  { id: 'website', labelEn: 'School Website', labelAr: 'موقع المدرسة', icon: <Globe size={17} />, groupEn: 'Content', groupAr: 'المحتوى' },
  { id: 'settings', labelEn: 'Settings', labelAr: 'الإعدادات', icon: <Settings size={17} />, groupEn: 'Admin', groupAr: 'الإدارة' },
  { id: 'users', labelEn: 'Users & Roles', labelAr: 'المستخدمون والصلاحيات', icon: <ShieldCheck size={17} />, groupEn: 'Admin', groupAr: 'الإدارة' },
];

function Toolbar() {
  const { locale, theme } = useDemo();
  const t = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <Inert as="button" style={btn(theme, true)}><Filter size={14} /> {t('Filter', 'تصفية')}</Inert>
      <Inert as="button" style={btn(theme, true)}><Download size={14} /> {t('Export', 'تصدير')}</Inert>
      <Inert as="button" style={btn(theme, false)}><Plus size={14} /> {t('New', 'إضافة')}</Inert>
    </div>
  );
}
function btn(th: DemoTheme, ghost: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700,
    padding: '7px 13px', borderRadius: 9,
    border: `1px solid ${ghost ? th.border : th.accentBorder}`,
    background: ghost ? 'transparent' : th.accent, color: ghost ? th.inkMuted : '#ffffff',
  };
}

function Content({ active }: { active: string }) {
  const { locale, theme } = useDemo();
  const t = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const money = (n: string) => (locale === 'ar' ? `${n} ر.س` : `SAR ${n}`);

  if (active === 'dashboard') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(190px,1fr))' }}>
          <StatCard theme={theme} label={t('Students', 'الطلاب')} value="1,248" sub={t('across 32 classes', 'في 32 فصلاً')} icon={<GraduationCap size={16} />} />
          <StatCard theme={theme} label={t('Attendance today', 'حضور اليوم')} value="96.2%" sub={t('47 absent', '47 غائب')} icon={<ClipboardCheck size={16} />} />
          <StatCard theme={theme} label={t('Fees collected', 'الرسوم المُحصّلة')} value="88%" sub={money('2.1M')} icon={<CircleDollarSign size={16} />} />
          <StatCard theme={theme} label={t('Teachers & Staff', 'المعلمون والموظفون')} value="112" sub={t('8 on leave', '8 في إجازة')} icon={<Users size={16} />} />
        </div>
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1.6fr 1fr' }} className="mn-dash-grid">
          <Panel theme={theme} title={t('Attendance — Last 7 days', 'الحضور — آخر 7 أيام')} action={<Badge color={theme.accent} bg={theme.accentSoft}>{t('This week', 'هذا الأسبوع')}</Badge>}>
            <MiniBars />
          </Panel>
          <Panel theme={theme} title={t('Announcements', 'الإعلانات')}>
            <div style={{ padding: 8 }}>
              {[
                [t('Parent-teacher meeting', 'اجتماع أولياء الأمور'), t('Thu', 'الخميس')],
                [t('Mid-term exams begin', 'بدء اختبارات منتصف الفصل'), t('Next week', 'الأسبوع القادم')],
                [t('Science fair registration', 'التسجيل في معرض العلوم'), t('Open', 'مفتوح')],
                [t('Bus route 4 change', 'تغيير مسار الحافلة 4'), t('Today', 'اليوم')],
              ].map(([a, b], i) => (
                <Inert key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', borderRadius: 8, fontSize: 13 }}>
                  <span style={{ color: theme.inkMuted }}>{a}</span>
                  <span style={{ color: theme.inkFaint, fontWeight: 600 }}>{b}</span>
                </Inert>
              ))}
            </div>
          </Panel>
        </div>
        <style jsx>{`@media (max-width:900px){:global(.mn-dash-grid){grid-template-columns:1fr !important;}}`}</style>
      </div>
    );
  }

  if (active === 'students') {
    return (
      <Panel theme={theme} title={t('Students', 'الطلاب')} action={<Toolbar />}>
        <DataTable theme={theme}
          columns={[
            { key: 'name', label: t('Student', 'الطالب') },
            { key: 'grade', label: t('Class', 'الفصل'), align: 'center' },
            { key: 'guardian', label: t('Guardian', 'ولي الأمر') },
            { key: 'fees', label: t('Fees', 'الرسوم'), align: 'center' },
            { key: 'status', label: t('Status', 'الحالة'), align: 'center' },
          ]}
          rows={[
            { name: t('Sara Ahmed', 'سارة أحمد'), grade: 'G5-A', guardian: t('Ahmed M.', 'أحمد م.'), fees: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('Paid', 'مدفوع')}</Badge>, status: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('Enrolled', 'مُسجّل')}</Badge> },
            { name: t('Omar Khalid', 'عمر خالد'), grade: 'G7-B', guardian: t('Khalid R.', 'خالد ر.'), fees: <Badge color="#fbbf24" bg="rgba(251,191,36,.14)">{t('Partial', 'جزئي')}</Badge>, status: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('Enrolled', 'مُسجّل')}</Badge> },
            { name: t('Lina Yousef', 'لينا يوسف'), grade: 'G3-A', guardian: t('Yousef S.', 'يوسف س.'), fees: <Badge color="#f87171" bg="rgba(248,113,113,.14)">{t('Due', 'مستحق')}</Badge>, status: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('Enrolled', 'مُسجّل')}</Badge> },
            { name: t('Faisal Noor', 'فيصل نور'), grade: 'G9-C', guardian: t('Noor A.', 'نور أ.'), fees: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('Paid', 'مدفوع')}</Badge>, status: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('Enrolled', 'مُسجّل')}</Badge> },
          ]}
        />
      </Panel>
    );
  }

  if (active === 'teachers') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(170px,1fr))' }}>
          <StatCard theme={theme} label={t('Teachers', 'المعلمون')} value="86" />
          <StatCard theme={theme} label={t('Staff', 'الموظفون')} value="26" />
          <StatCard theme={theme} label={t('On leave', 'في إجازة')} value="8" />
          <StatCard theme={theme} label={t('Payroll (MTD)', 'الرواتب (الشهر)')} value={money('980,000')} />
        </div>
        <Panel theme={theme} title={t('Teachers & Staff (HR)', 'المعلمون والموظفون')} action={<Toolbar />}>
          <DataTable theme={theme}
            columns={[
              { key: 'name', label: t('Name', 'الاسم') },
              { key: 'role', label: t('Role', 'الدور') },
              { key: 'subject', label: t('Subject', 'المادة') },
              { key: 'contract', label: t('Contract', 'العقد'), align: 'center' },
            ]}
            rows={[
              { name: t('Mona Saleh', 'منى صالح'), role: t('Teacher', 'معلمة'), subject: t('Mathematics', 'الرياضيات'), contract: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('Active', 'نشط')}</Badge> },
              { name: t('Hassan Ali', 'حسن علي'), role: t('Teacher', 'معلم'), subject: t('Science', 'العلوم'), contract: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('Active', 'نشط')}</Badge> },
              { name: t('Rana Fahd', 'رنا فهد'), role: t('Coordinator', 'منسقة'), subject: t('English', 'الإنجليزية'), contract: <Badge color="#fbbf24" bg="rgba(251,191,36,.14)">{t('On leave', 'في إجازة')}</Badge> },
            ]}
          />
        </Panel>
      </div>
    );
  }

  if (active === 'admissions') {
    return (
      <Panel theme={theme} title={t('Admissions', 'القبول والتسجيل')} action={<Toolbar />}>
        <DataTable theme={theme}
          columns={[
            { key: 'applicant', label: t('Applicant', 'المتقدّم') },
            { key: 'grade', label: t('Applying for', 'للصف'), align: 'center' },
            { key: 'stage', label: t('Stage', 'المرحلة'), align: 'center' },
            { key: 'docs', label: t('Documents', 'المستندات'), align: 'center' },
          ]}
          rows={[
            { applicant: t('Yara Nabil', 'يارا نبيل'), grade: 'G1', stage: <Badge color="#38bdf8" bg="rgba(56,189,248,.14)">{t('Interview', 'مقابلة')}</Badge>, docs: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('Complete', 'مكتملة')}</Badge> },
            { applicant: t('Ziad Amr', 'زياد عمرو'), grade: 'G4', stage: <Badge color="#fbbf24" bg="rgba(251,191,36,.14)">{t('Assessment', 'تقييم')}</Badge>, docs: <Badge color="#fbbf24" bg="rgba(251,191,36,.14)">{t('Pending', 'ناقصة')}</Badge> },
            { applicant: t('Maya Tariq', 'مايا طارق'), grade: 'G6', stage: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('Accepted', 'مقبولة')}</Badge>, docs: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('Complete', 'مكتملة')}</Badge> },
          ]}
        />
      </Panel>
    );
  }

  if (active === 'classes') {
    return (
      <Panel theme={theme} title={t('Classes & Academics', 'الفصول والأكاديمي')} action={<Toolbar />}>
        <DataTable theme={theme}
          columns={[
            { key: 'class', label: t('Class', 'الفصل') },
            { key: 'grade', label: t('Grade level', 'المرحلة') },
            { key: 'teacher', label: t('Homeroom', 'رائد الفصل') },
            { key: 'students', label: t('Students', 'الطلاب'), align: 'center' },
            { key: 'subjects', label: t('Subjects', 'المواد'), align: 'center' },
          ]}
          rows={[
            { class: 'G5-A', grade: t('Grade 5', 'الصف الخامس'), teacher: t('Mona Saleh', 'منى صالح'), students: 28, subjects: 9 },
            { class: 'G7-B', grade: t('Grade 7', 'الصف السابع'), teacher: t('Hassan Ali', 'حسن علي'), students: 31, subjects: 11 },
            { class: 'G9-C', grade: t('Grade 9', 'الصف التاسع'), teacher: t('Rana Fahd', 'رنا فهد'), students: 26, subjects: 12 },
          ]}
        />
      </Panel>
    );
  }

  if (active === 'timetable') {
    const periods = [1, 2, 3, 4, 5];
    const days = [
      ['Sun', 'الأحد'], ['Mon', 'الاثنين'], ['Tue', 'الثلاثاء'], ['Wed', 'الأربعاء'], ['Thu', 'الخميس'],
    ];
    const subjects = [
      ['Math', 'رياضيات'], ['Science', 'علوم'], ['English', 'إنجليزي'], ['Arabic', 'عربي'], ['Art', 'فنون'], ['PE', 'رياضة'], ['History', 'تاريخ'],
    ];
    return (
      <Panel theme={theme} title={t('Timetable — G5-A', 'الجدول الدراسي — G5-A')}>
        <div style={{ overflowX: 'auto', padding: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: `70px repeat(${days.length}, 1fr)`, gap: 6, minWidth: 560 }}>
            <div />
            {days.map(([en, ar], i) => (
              <div key={i} style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: theme.inkMuted, padding: 6 }}>{t(en, ar)}</div>
            ))}
            {periods.map((p) => (
              <React.Fragment key={p}>
                <div style={{ fontSize: 11, color: theme.inkFaint, display: 'grid', placeItems: 'center' }}>{t('P', 'ح')}{p}</div>
                {days.map((_, di) => {
                  const s = subjects[(p + di) % subjects.length];
                  return (
                    <Inert key={di} style={{ background: theme.accentSoft, border: `1px solid ${theme.accentBorder}`, borderRadius: 8, padding: '10px 6px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: theme.accent }}>
                      {t(s[0], s[1])}
                    </Inert>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </Panel>
    );
  }

  if (active === 'attendance') {
    return (
      <Panel theme={theme} title={t('Attendance — G5-A · Today', 'الحضور — G5-A · اليوم')} action={<Toolbar />}>
        <DataTable theme={theme}
          columns={[
            { key: 'name', label: t('Student', 'الطالب') },
            { key: 'status', label: t('Status', 'الحالة'), align: 'center' },
            { key: 'time', label: t('Check-in', 'وقت الحضور'), align: 'center' },
          ]}
          rows={[
            { name: t('Sara Ahmed', 'سارة أحمد'), status: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('Present', 'حاضر')}</Badge>, time: '07:42' },
            { name: t('Omar Khalid', 'عمر خالد'), status: <Badge color="#fbbf24" bg="rgba(251,191,36,.14)">{t('Late', 'متأخر')}</Badge>, time: '08:12' },
            { name: t('Lina Yousef', 'لينا يوسف'), status: <Badge color="#f87171" bg="rgba(248,113,113,.14)">{t('Absent', 'غائب')}</Badge>, time: '—' },
            { name: t('Faisal Noor', 'فيصل نور'), status: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('Present', 'حاضر')}</Badge>, time: '07:38' },
          ]}
        />
      </Panel>
    );
  }

  if (active === 'exams' || active === 'grades') {
    const isGrades = active === 'grades';
    return (
      <Panel theme={theme} title={isGrades ? t('Grades & Report Cards', 'الدرجات وكشوف العلامات') : t('Exams', 'الاختبارات')} action={<Toolbar />}>
        {isGrades ? (
          <DataTable theme={theme}
            columns={[
              { key: 'student', label: t('Student', 'الطالب') },
              { key: 'math', label: t('Math', 'رياضيات'), align: 'center' },
              { key: 'sci', label: t('Science', 'علوم'), align: 'center' },
              { key: 'eng', label: t('English', 'إنجليزي'), align: 'center' },
              { key: 'gpa', label: t('Grade', 'التقدير'), align: 'center' },
            ]}
            rows={[
              { student: t('Sara Ahmed', 'سارة أحمد'), math: '95', sci: '88', eng: '92', gpa: <Badge color="#34d399" bg="rgba(52,211,153,.14)">A</Badge> },
              { student: t('Omar Khalid', 'عمر خالد'), math: '78', sci: '82', eng: '74', gpa: <Badge color="#38bdf8" bg="rgba(56,189,248,.14)">B</Badge> },
              { student: t('Lina Yousef', 'لينا يوسف'), math: '64', sci: '70', eng: '68', gpa: <Badge color="#fbbf24" bg="rgba(251,191,36,.14)">C</Badge> },
            ]}
          />
        ) : (
          <DataTable theme={theme}
            columns={[
              { key: 'exam', label: t('Exam', 'الاختبار') },
              { key: 'subject', label: t('Subject', 'المادة') },
              { key: 'date', label: t('Date', 'التاريخ') },
              { key: 'class', label: t('Class', 'الفصل'), align: 'center' },
              { key: 'status', label: t('Status', 'الحالة'), align: 'center' },
            ]}
            rows={[
              { exam: t('Mid-term', 'منتصف الفصل'), subject: t('Mathematics', 'الرياضيات'), date: '2026-09-10', class: 'G5-A', status: <Badge color="#fbbf24" bg="rgba(251,191,36,.14)">{t('Scheduled', 'مجدول')}</Badge> },
              { exam: t('Quiz 2', 'اختبار قصير 2'), subject: t('Science', 'العلوم'), date: '2026-08-20', class: 'G7-B', status: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('Graded', 'مُصحّح')}</Badge> },
              { exam: t('Final', 'النهائي'), subject: t('English', 'الإنجليزية'), date: '2026-12-05', class: 'G9-C', status: <Badge color="#94a3b8" bg="rgba(148,163,184,.14)">{t('Draft', 'مسودة')}</Badge> },
            ]}
          />
        )}
      </Panel>
    );
  }

  if (active === 'finance' || active === 'expenses') {
    const isExp = active === 'expenses';
    return (
      <Panel theme={theme} title={isExp ? t('Expenses', 'المصروفات') : t('Finance & Fees', 'المالية والرسوم')} action={<Toolbar />}>
        {isExp ? (
          <DataTable theme={theme}
            columns={[
              { key: 'title', label: t('Expense', 'المصروف') },
              { key: 'cat', label: t('Category', 'التصنيف') },
              { key: 'date', label: t('Date', 'التاريخ') },
              { key: 'amount', label: t('Amount', 'المبلغ'), align: 'end' },
            ]}
            rows={[
              { title: t('Staff Salaries', 'رواتب الموظفين'), cat: t('Payroll', 'رواتب'), date: '2026-08-01', amount: money('980,000') },
              { title: t('Utilities', 'المرافق'), cat: t('Facilities', 'مرافق'), date: '2026-08-03', amount: money('42,000') },
              { title: t('Lab Equipment', 'معدات المختبر'), cat: t('Academics', 'أكاديمي'), date: '2026-08-06', amount: money('68,000') },
            ]}
          />
        ) : (
          <DataTable theme={theme}
            columns={[
              { key: 'invoice', label: t('Invoice', 'الفاتورة') },
              { key: 'student', label: t('Student', 'الطالب') },
              { key: 'structure', label: t('Fee', 'الرسم') },
              { key: 'total', label: t('Total', 'الإجمالي'), align: 'end' },
              { key: 'status', label: t('Status', 'الحالة'), align: 'center' },
            ]}
            rows={[
              { invoice: 'INV-3021', student: t('Sara Ahmed', 'سارة أحمد'), structure: t('Term 1 Tuition', 'رسوم الفصل 1'), total: money('9,500'), status: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('Paid', 'مدفوع')}</Badge> },
              { invoice: 'INV-3020', student: t('Omar Khalid', 'عمر خالد'), structure: t('Term 1 Tuition', 'رسوم الفصل 1'), total: money('9,500'), status: <Badge color="#fbbf24" bg="rgba(251,191,36,.14)">{t('Partial', 'جزئي')}</Badge> },
              { invoice: 'INV-3019', student: t('Lina Yousef', 'لينا يوسف'), structure: t('Bus + Tuition', 'نقل + رسوم'), total: money('11,800'), status: <Badge color="#f87171" bg="rgba(248,113,113,.14)">{t('Overdue', 'متأخر')}</Badge> },
            ]}
          />
        )}
      </Panel>
    );
  }

  if (active === 'transport') {
    return (
      <Panel theme={theme} title={t('Transportation', 'النقل المدرسي')} action={<Toolbar />}>
        <DataTable theme={theme}
          columns={[
            { key: 'route', label: t('Route', 'المسار') },
            { key: 'driver', label: t('Driver', 'السائق') },
            { key: 'vehicle', label: t('Vehicle', 'المركبة') },
            { key: 'students', label: t('Students', 'الطلاب'), align: 'center' },
            { key: 'status', label: t('Status', 'الحالة'), align: 'center' },
          ]}
          rows={[
            { route: t('Route 1 — North', 'المسار 1 — شمال'), driver: t('Abu Sami', 'أبو سامي'), vehicle: 'Bus 12', students: 34, status: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('On time', 'في الموعد')}</Badge> },
            { route: t('Route 4 — East', 'المسار 4 — شرق'), driver: t('Abu Nasser', 'أبو ناصر'), vehicle: 'Bus 07', students: 28, status: <Badge color="#fbbf24" bg="rgba(251,191,36,.14)">{t('Delayed', 'متأخر')}</Badge> },
            { route: t('Route 6 — West', 'المسار 6 — غرب'), driver: t('Abu Faris', 'أبو فارس'), vehicle: 'Bus 03', students: 31, status: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('On time', 'في الموعد')}</Badge> },
          ]}
        />
      </Panel>
    );
  }

  if (active === 'library') {
    return (
      <Panel theme={theme} title={t('Library', 'المكتبة')} action={<Toolbar />}>
        <DataTable theme={theme}
          columns={[
            { key: 'title', label: t('Title', 'العنوان') },
            { key: 'copies', label: t('Copies', 'النسخ'), align: 'center' },
            { key: 'loaned', label: t('On loan', 'مُعارة'), align: 'center' },
            { key: 'status', label: t('Availability', 'التوفر'), align: 'center' },
          ]}
          rows={[
            { title: t('The Little Prince', 'الأمير الصغير'), copies: 12, loaned: 9, status: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('Available', 'متوفر')}</Badge> },
            { title: t('Science Encyclopedia', 'موسوعة العلوم'), copies: 6, loaned: 6, status: <Badge color="#f87171" bg="rgba(248,113,113,.14)">{t('All out', 'نفدت')}</Badge> },
            { title: t('Arabic Grammar', 'قواعد اللغة العربية'), copies: 20, loaned: 4, status: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('Available', 'متوفر')}</Badge> },
          ]}
        />
      </Panel>
    );
  }

  if (active === 'communication') {
    return (
      <Panel theme={theme} title={t('Communication', 'التواصل')} action={<Toolbar />}>
        <div style={{ padding: 8 }}>
          {[
            [t('Announcement: Mid-term schedule', 'إعلان: جدول اختبارات منتصف الفصل'), t('To: All parents', 'إلى: جميع أولياء الأمور'), t('Sent', 'مُرسل')],
            [t('Message from Ahmed M.', 'رسالة من أحمد م.'), t('Re: Sara\'s absence', 'بخصوص: غياب سارة'), t('Unread', 'غير مقروء')],
            [t('Announcement: Bus route 4 change', 'إعلان: تغيير مسار الحافلة 4'), t('To: Route 4 families', 'إلى: عائلات المسار 4'), t('Sent', 'مُرسل')],
          ].map(([a, b, c], i) => (
            <Inert key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderRadius: 10, border: `1px solid ${theme.border}`, marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: theme.ink }}>{a}</div>
                <div style={{ fontSize: 12, color: theme.inkFaint, marginTop: 2 }}>{b}</div>
              </div>
              <Badge color={theme.accent} bg={theme.accentSoft}>{c}</Badge>
            </Inert>
          ))}
        </div>
      </Panel>
    );
  }

  if (active === 'reports') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Panel theme={theme} title={t('Academic Performance', 'الأداء الأكاديمي')} action={<Badge color={theme.accent} bg={theme.accentSoft}>{t('This term', 'هذا الفصل')}</Badge>}>
          <MiniBars />
        </Panel>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))' }}>
          {[
            ['Attendance Report', 'تقرير الحضور'], ['Grade Analysis', 'تحليل الدرجات'],
            ['Fees Collection', 'تحصيل الرسوم'], ['Enrollment Trends', 'اتجاهات التسجيل'],
            ['Staff Report', 'تقرير الموظفين'], ['Transport Report', 'تقرير النقل'],
          ].map(([en, ar], i) => (
            <Inert key={i} style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ color: theme.accent, background: theme.accentSoft, borderRadius: 9, padding: 8, display: 'inline-flex' }}><BarChart3 size={18} /></span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: theme.ink }}>{t(en, ar)}</span>
                <span style={{ fontSize: 12, color: theme.inkFaint }}>{t('View report', 'عرض التقرير')}</span>
              </div>
            </Inert>
          ))}
        </div>
      </div>
    );
  }

  if (active === 'website') {
    return (
      <Panel theme={theme} title={t('School Website', 'موقع المدرسة')} action={<Toolbar />}>
        <DataTable theme={theme}
          columns={[
            { key: 'title', label: t('Content', 'المحتوى') },
            { key: 'type', label: t('Type', 'النوع'), align: 'center' },
            { key: 'status', label: t('Status', 'الحالة'), align: 'center' },
          ]}
          rows={[
            { title: t('Annual Sports Day', 'اليوم الرياضي السنوي'), type: <Badge color="#c084fc" bg="rgba(192,132,252,.14)">{t('News', 'خبر')}</Badge>, status: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('Published', 'منشور')}</Badge> },
            { title: t('Open House 2026', 'اليوم المفتوح 2026'), type: <Badge color="#38bdf8" bg="rgba(56,189,248,.14)">{t('Event', 'فعالية')}</Badge>, status: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('Published', 'منشور')}</Badge> },
            { title: t('Math Teacher (Vacancy)', 'معلم رياضيات (شاغر)'), type: <Badge color="#fbbf24" bg="rgba(251,191,36,.14)">{t('Job', 'وظيفة')}</Badge>, status: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('Open', 'مفتوح')}</Badge> },
          ]}
        />
      </Panel>
    );
  }

  if (active === 'settings' || active === 'users') {
    if (active === 'users') {
      return (
        <Panel theme={theme} title={t('Users & Roles', 'المستخدمون والصلاحيات')} action={<Toolbar />}>
          <DataTable theme={theme}
            columns={[
              { key: 'name', label: t('User', 'المستخدم') },
              { key: 'role', label: t('Role', 'الدور'), align: 'center' },
              { key: 'status', label: t('Status', 'الحالة'), align: 'center' },
            ]}
            rows={[
              { name: t('Principal', 'المدير'), role: <Badge color="#22c55e" bg={theme.accentSoft}>{t('Admin', 'مدير')}</Badge>, status: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('Active', 'نشط')}</Badge> },
              { name: t('Registrar', 'المُسجّل'), role: <Badge color="#38bdf8" bg="rgba(56,189,248,.14)">{t('Staff', 'موظف')}</Badge>, status: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('Active', 'نشط')}</Badge> },
              { name: t('Accountant', 'المحاسب'), role: <Badge color="#c084fc" bg="rgba(192,132,252,.14)">{t('Finance', 'مالية')}</Badge>, status: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('Active', 'نشط')}</Badge> },
            ]}
          />
        </Panel>
      );
    }
    const groups: [string, string, string[]][] = [
      ['School', 'المدرسة', ['School profile', 'Campuses', 'Academic years & terms']],
      ['Localization', 'اللغة', ['Languages (AR/EN)', 'Currency', 'Time zone']],
      ['Advanced', 'متقدم', ['Roles & permissions', 'Notifications', 'Files & backups']],
    ];
    return (
      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(240px,1fr))' }}>
        {groups.map(([en, ar, items], i) => (
          <Panel key={i} theme={theme} title={t(en, ar)}>
            <div style={{ padding: 8 }}>
              {items.map((it, j) => (
                <Inert key={j} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 12px', borderRadius: 8, fontSize: 13, color: theme.inkMuted }}>
                  <span>{it}</span><span style={{ color: theme.inkFaint }}>›</span>
                </Inert>
              ))}
            </div>
          </Panel>
        ))}
      </div>
    );
  }

  return null;
}

function MiniBars() {
  const { theme } = useDemo();
  const data = [82, 88, 79, 94, 90, 96];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 180, padding: 20 }}>
      {data.map((h, i) => (
        <div key={i} style={{ flex: 1, height: `${h}%`, background: theme.accent, opacity: 0.9, borderRadius: '6px 6px 0 0' }} />
      ))}
    </div>
  );
}

function ManarahInner() {
  const { theme } = useDemo();
  const [active, setActive] = useState('dashboard');
  return (
    <ErpShell theme={theme} modules={modules} active={active} onSelect={setActive}>
      <Content active={active} />
    </ErpShell>
  );
}

export default function ManarahDemo() {
  return (
    <DemoProvider themeSet={themeSet}>
      <ManarahInner />
    </DemoProvider>
  );
}
