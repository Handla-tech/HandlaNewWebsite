'use client';

/**
 * Madar (مُدار) — Business / Agency Management ERP — VIEW-ONLY demo.
 *
 * Every module below maps to a REAL feature verified in the Madar codebase
 * (backend Models + Controllers + dashboard routes): Clients, Client Projects,
 * Projects (scope / tasks / gallery), Quotations, Proposals, Contracts,
 * Invoices, Orders, Purchases, Expenses, Products (gallery / specs),
 * Categories, Tasks, Reports (Balance / Client / Expense / Ledger / Profit /
 * Revenue / Tax / VAT), Users & Roles.
 *
 * Nothing here fetches or mutates data — all controls are Inert.
 */

import React, { useState } from 'react';
import {
  LayoutDashboard, Users, FolderKanban, FileText, FileCheck2,
  ScrollText, ReceiptText, ShoppingCart, Wallet, Package,
  Tags, ListTodo, BarChart3, ShieldCheck, Plus, Filter, Download,
  TrendingUp, CircleDollarSign, Building2,
} from 'lucide-react';
import { DemoProvider, DemoTheme, useDemo, Inert, StatCard, Badge, Panel } from '@/components/product-demos/demo-shared';
import { ErpShell, ErpModule } from '@/components/product-demos/ErpShell';
import { DataTable } from '@/components/product-demos/DataTable';

const theme: DemoTheme = {
  accent: '#7c6cff',
  accentSoft: 'rgba(124,108,255,0.14)',
  accentBorder: 'rgba(124,108,255,0.32)',
  sidebar: '#131424',
  canvas: '#0d0e1a',
  panel: '#171930',
  border: 'rgba(255,255,255,0.08)',
  ink: '#eceef8',
  inkMuted: '#a9adc7',
  inkFaint: '#6f7396',
  nameEn: 'Madar',
  nameAr: 'مُدار',
};

const modules: ErpModule[] = [
  { id: 'dashboard', labelEn: 'Dashboard', labelAr: 'الرئيسية', icon: <LayoutDashboard size={17} />, groupEn: 'Overview', groupAr: 'نظرة عامة' },
  { id: 'clients', labelEn: 'Clients', labelAr: 'العملاء', icon: <Users size={17} />, groupEn: 'Sales', groupAr: 'المبيعات' },
  { id: 'projects', labelEn: 'Projects', labelAr: 'المشاريع', icon: <FolderKanban size={17} />, groupEn: 'Sales', groupAr: 'المبيعات' },
  { id: 'quotations', labelEn: 'Quotations', labelAr: 'عروض الأسعار', icon: <FileText size={17} />, groupEn: 'Sales', groupAr: 'المبيعات' },
  { id: 'proposals', labelEn: 'Proposals', labelAr: 'العروض الفنية', icon: <FileCheck2 size={17} />, groupEn: 'Sales', groupAr: 'المبيعات' },
  { id: 'contracts', labelEn: 'Contracts', labelAr: 'العقود', icon: <ScrollText size={17} />, groupEn: 'Sales', groupAr: 'المبيعات' },
  { id: 'invoices', labelEn: 'Invoices', labelAr: 'الفواتير', icon: <ReceiptText size={17} />, groupEn: 'Finance', groupAr: 'المالية' },
  { id: 'orders', labelEn: 'Orders', labelAr: 'الطلبات', icon: <ShoppingCart size={17} />, groupEn: 'Finance', groupAr: 'المالية' },
  { id: 'purchases', labelEn: 'Purchases', labelAr: 'المشتريات', icon: <Building2 size={17} />, groupEn: 'Finance', groupAr: 'المالية' },
  { id: 'expenses', labelEn: 'Expenses', labelAr: 'المصروفات', icon: <Wallet size={17} />, groupEn: 'Finance', groupAr: 'المالية' },
  { id: 'products', labelEn: 'Products', labelAr: 'المنتجات', icon: <Package size={17} />, groupEn: 'Catalog', groupAr: 'الكتالوج' },
  { id: 'categories', labelEn: 'Categories', labelAr: 'التصنيفات', icon: <Tags size={17} />, groupEn: 'Catalog', groupAr: 'الكتالوج' },
  { id: 'tasks', labelEn: 'Tasks', labelAr: 'المهام', icon: <ListTodo size={17} />, groupEn: 'Work', groupAr: 'العمل' },
  { id: 'reports', labelEn: 'Reports', labelAr: 'التقارير', icon: <BarChart3 size={17} />, groupEn: 'Insights', groupAr: 'التحليلات' },
  { id: 'users', labelEn: 'Users & Roles', labelAr: 'المستخدمون والصلاحيات', icon: <ShieldCheck size={17} />, groupEn: 'Admin', groupAr: 'الإدارة' },
];

// ─── Inert toolbar (Add / Filter / Export) ────────────────────────────────────
function Toolbar() {
  const { locale } = useDemo();
  const t = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <Inert as="button" style={btn(theme, true)}>
        <Filter size={14} /> {t('Filter', 'تصفية')}
      </Inert>
      <Inert as="button" style={btn(theme, true)}>
        <Download size={14} /> {t('Export', 'تصدير')}
      </Inert>
      <Inert as="button" style={btn(theme, false)}>
        <Plus size={14} /> {t('New', 'إضافة')}
      </Inert>
    </div>
  );
}

function btn(th: DemoTheme, ghost: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12.5,
    fontWeight: 700,
    padding: '7px 13px',
    borderRadius: 9,
    border: `1px solid ${ghost ? th.border : th.accentBorder}`,
    background: ghost ? 'transparent' : th.accent,
    color: ghost ? th.inkMuted : '#fff',
  };
}

// ─── Content per module ───────────────────────────────────────────────────────

function Content({ active }: { active: string }) {
  const { locale } = useDemo();
  const t = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const money = (n: string) => (locale === 'ar' ? `${n} ر.س` : `SAR ${n}`);

  if (active === 'dashboard') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(190px,1fr))' }}>
          <StatCard theme={theme} label={t('Revenue (MTD)', 'الإيرادات (الشهر)')} value={money('284,500')} sub={t('+12% vs last month', '+12% عن الشهر الماضي')} icon={<CircleDollarSign size={16} />} />
          <StatCard theme={theme} label={t('Active Projects', 'مشاريع نشطة')} value="18" sub={t('4 due this week', '4 تستحق هذا الأسبوع')} icon={<FolderKanban size={16} />} />
          <StatCard theme={theme} label={t('Open Invoices', 'فواتير مفتوحة')} value="27" sub={money('96,300')} icon={<ReceiptText size={16} />} />
          <StatCard theme={theme} label={t('Clients', 'العملاء')} value="63" sub={t('9 new this quarter', '9 جدد هذا الربع')} icon={<Users size={16} />} />
        </div>

        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1.6fr 1fr' }} className="md-dash-grid">
          <Panel theme={theme} title={t('Revenue vs Expenses', 'الإيرادات مقابل المصروفات')} action={<Badge color={theme.accent} bg={theme.accentSoft}>{t('Last 6 months', 'آخر 6 أشهر')}</Badge>}>
            <MiniBars />
          </Panel>
          <Panel theme={theme} title={t('Recent Activity', 'آخر النشاطات')}>
            <div style={{ padding: 8 }}>
              {[
                [t('Invoice #INV-1043 issued', 'إصدار فاتورة #INV-1043'), money('12,400')],
                [t('Project “Rebrand” updated', 'تحديث مشروع «إعادة الهوية»'), t('2h ago', 'قبل ساعتين')],
                [t('Quotation #Q-208 sent', 'إرسال عرض سعر #Q-208'), money('34,000')],
                [t('New client: Nline Co.', 'عميل جديد: شركة نلاين'), t('Today', 'اليوم')],
                [t('Contract #C-77 signed', 'توقيع عقد #C-77'), t('Yesterday', 'أمس')],
              ].map(([a, b], i) => (
                <Inert key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 10px', borderRadius: 8, fontSize: 13 }}>
                  <span style={{ color: theme.inkMuted }}>{a}</span>
                  <span style={{ color: theme.inkFaint, fontWeight: 600 }}>{b}</span>
                </Inert>
              ))}
            </div>
          </Panel>
        </div>
        <style jsx>{`@media (max-width: 900px){:global(.md-dash-grid){grid-template-columns:1fr !important;}}`}</style>
      </div>
    );
  }

  if (active === 'clients') {
    return (
      <Panel theme={theme} title={t('Clients', 'العملاء')} action={<Toolbar />}>
        <DataTable
          theme={theme}
          columns={[
            { key: 'name', label: t('Client', 'العميل') },
            { key: 'contact', label: t('Contact', 'جهة الاتصال') },
            { key: 'projects', label: t('Projects', 'المشاريع'), align: 'center' },
            { key: 'balance', label: t('Balance', 'الرصيد'), align: 'end' },
            { key: 'status', label: t('Status', 'الحالة'), align: 'center' },
          ]}
          rows={[
            { name: 'Nline Co.', contact: 'Sara A.', projects: 3, balance: money('12,400'), status: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('Active', 'نشط')}</Badge> },
            { name: 'Falcon Group', contact: 'Omar K.', projects: 5, balance: money('0'), status: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('Active', 'نشط')}</Badge> },
            { name: 'BlueSky Media', contact: 'Lina M.', projects: 1, balance: money('3,900'), status: <Badge color="#fbbf24" bg="rgba(251,191,36,.14)">{t('Pending', 'معلّق')}</Badge> },
            { name: 'Horizon Labs', contact: 'Yousef R.', projects: 2, balance: money('7,250'), status: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('Active', 'نشط')}</Badge> },
            { name: 'Atlas Trading', contact: 'Hana S.', projects: 0, balance: money('0'), status: <Badge color="#94a3b8" bg="rgba(148,163,184,.14)">{t('Lead', 'محتمل')}</Badge> },
          ]}
        />
      </Panel>
    );
  }

  if (active === 'projects') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(170px,1fr))' }}>
          <StatCard theme={theme} label={t('In progress', 'قيد التنفيذ')} value="12" />
          <StatCard theme={theme} label={t('Completed', 'مكتملة')} value="46" />
          <StatCard theme={theme} label={t('On hold', 'متوقفة')} value="3" />
          <StatCard theme={theme} label={t('Overdue', 'متأخرة')} value="2" />
        </div>
        <Panel theme={theme} title={t('Projects', 'المشاريع')} action={<Toolbar />}>
          <DataTable
            theme={theme}
            columns={[
              { key: 'name', label: t('Project', 'المشروع') },
              { key: 'client', label: t('Client', 'العميل') },
              { key: 'scope', label: t('Scope', 'النطاق'), align: 'center' },
              { key: 'progress', label: t('Progress', 'الإنجاز') },
              { key: 'status', label: t('Status', 'الحالة'), align: 'center' },
            ]}
            rows={[
              { name: t('Website Rebrand', 'إعادة تصميم الموقع'), client: 'Nline Co.', scope: '8 ' + t('items', 'بنود'), progress: <Bar pct={72} />, status: <Badge color="#7c6cff" bg={theme.accentSoft}>{t('In progress', 'قيد التنفيذ')}</Badge> },
              { name: t('Mobile App', 'تطبيق جوال'), client: 'Falcon Group', scope: '14 ' + t('items', 'بنود'), progress: <Bar pct={40} />, status: <Badge color="#7c6cff" bg={theme.accentSoft}>{t('In progress', 'قيد التنفيذ')}</Badge> },
              { name: t('Brand Guide', 'دليل الهوية'), client: 'BlueSky Media', scope: '5 ' + t('items', 'بنود'), progress: <Bar pct={100} />, status: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('Completed', 'مكتمل')}</Badge> },
              { name: t('SEO Campaign', 'حملة SEO'), client: 'Horizon Labs', scope: '6 ' + t('items', 'بنود'), progress: <Bar pct={20} />, status: <Badge color="#fbbf24" bg="rgba(251,191,36,.14)">{t('On hold', 'متوقف')}</Badge> },
            ]}
          />
        </Panel>
      </div>
    );
  }

  if (active === 'quotations' || active === 'proposals' || active === 'contracts') {
    const titleMap: Record<string, [string, string]> = {
      quotations: ['Quotations', 'عروض الأسعار'],
      proposals: ['Proposals', 'العروض الفنية'],
      contracts: ['Contracts', 'العقود'],
    };
    const [en, ar] = titleMap[active];
    const prefix = active === 'quotations' ? 'Q' : active === 'proposals' ? 'P' : 'C';
    return (
      <Panel theme={theme} title={t(en, ar)} action={<Toolbar />}>
        <DataTable
          theme={theme}
          columns={[
            { key: 'no', label: t('Number', 'الرقم') },
            { key: 'client', label: t('Client', 'العميل') },
            { key: 'date', label: t('Date', 'التاريخ') },
            { key: 'total', label: t('Total', 'الإجمالي'), align: 'end' },
            { key: 'status', label: t('Status', 'الحالة'), align: 'center' },
          ]}
          rows={[
            { no: `${prefix}-208`, client: 'Nline Co.', date: '2026-08-02', total: money('34,000'), status: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('Accepted', 'مقبول')}</Badge> },
            { no: `${prefix}-207`, client: 'Falcon Group', date: '2026-07-28', total: money('58,500'), status: <Badge color="#fbbf24" bg="rgba(251,191,36,.14)">{t('Sent', 'مُرسل')}</Badge> },
            { no: `${prefix}-206`, client: 'Horizon Labs', date: '2026-07-21', total: money('12,900'), status: <Badge color="#94a3b8" bg="rgba(148,163,184,.14)">{t('Draft', 'مسودة')}</Badge> },
            { no: `${prefix}-205`, client: 'BlueSky Media', date: '2026-07-15', total: money('7,400'), status: <Badge color="#f87171" bg="rgba(248,113,113,.14)">{t('Rejected', 'مرفوض')}</Badge> },
          ]}
        />
      </Panel>
    );
  }

  if (active === 'invoices' || active === 'orders' || active === 'purchases') {
    const map: Record<string, [string, string, string]> = {
      invoices: ['Invoices', 'الفواتير', 'INV'],
      orders: ['Orders', 'الطلبات', 'ORD'],
      purchases: ['Purchases', 'المشتريات', 'PO'],
    };
    const [en, ar, pfx] = map[active];
    return (
      <Panel theme={theme} title={t(en, ar)} action={<Toolbar />}>
        <DataTable
          theme={theme}
          columns={[
            { key: 'no', label: t('Number', 'الرقم') },
            { key: 'party', label: active === 'purchases' ? t('Supplier', 'المورّد') : t('Client', 'العميل') },
            { key: 'date', label: t('Date', 'التاريخ') },
            { key: 'total', label: t('Total', 'الإجمالي'), align: 'end' },
            { key: 'status', label: t('Status', 'الحالة'), align: 'center' },
          ]}
          rows={[
            { no: `${pfx}-1043`, party: 'Nline Co.', date: '2026-08-10', total: money('12,400'), status: <Badge color="#fbbf24" bg="rgba(251,191,36,.14)">{t('Unpaid', 'غير مدفوع')}</Badge> },
            { no: `${pfx}-1042`, party: 'Falcon Group', date: '2026-08-06', total: money('58,500'), status: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('Paid', 'مدفوع')}</Badge> },
            { no: `${pfx}-1041`, party: 'Horizon Labs', date: '2026-08-01', total: money('7,250'), status: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('Paid', 'مدفوع')}</Badge> },
            { no: `${pfx}-1040`, party: 'BlueSky Media', date: '2026-07-27', total: money('3,900'), status: <Badge color="#f87171" bg="rgba(248,113,113,.14)">{t('Overdue', 'متأخر')}</Badge> },
          ]}
        />
      </Panel>
    );
  }

  if (active === 'expenses') {
    return (
      <Panel theme={theme} title={t('Expenses', 'المصروفات')} action={<Toolbar />}>
        <DataTable
          theme={theme}
          columns={[
            { key: 'title', label: t('Expense', 'المصروف') },
            { key: 'cat', label: t('Category', 'التصنيف') },
            { key: 'date', label: t('Date', 'التاريخ') },
            { key: 'amount', label: t('Amount', 'المبلغ'), align: 'end' },
          ]}
          rows={[
            { title: t('Office Rent', 'إيجار المكتب'), cat: t('Facilities', 'مرافق'), date: '2026-08-01', amount: money('9,000') },
            { title: t('Software Licenses', 'تراخيص برمجية'), cat: t('Tools', 'أدوات'), date: '2026-08-03', amount: money('2,300') },
            { title: t('Ad Spend', 'إنفاق إعلاني'), cat: t('Marketing', 'تسويق'), date: '2026-08-05', amount: money('5,600') },
            { title: t('Team Lunch', 'غداء الفريق'), cat: t('HR', 'موارد بشرية'), date: '2026-08-08', amount: money('640') },
          ]}
        />
      </Panel>
    );
  }

  if (active === 'products' || active === 'categories') {
    const isCat = active === 'categories';
    return (
      <Panel theme={theme} title={isCat ? t('Categories', 'التصنيفات') : t('Products', 'المنتجات')} action={<Toolbar />}>
        {isCat ? (
          <DataTable
            theme={theme}
            columns={[
              { key: 'name', label: t('Category', 'التصنيف') },
              { key: 'count', label: t('Products', 'المنتجات'), align: 'center' },
            ]}
            rows={[
              { name: t('Design Services', 'خدمات التصميم'), count: 12 },
              { name: t('Development', 'تطوير'), count: 9 },
              { name: t('Consulting', 'استشارات'), count: 5 },
              { name: t('Hardware', 'أجهزة'), count: 7 },
            ]}
          />
        ) : (
          <DataTable
            theme={theme}
            columns={[
              { key: 'name', label: t('Product', 'المنتج') },
              { key: 'cat', label: t('Category', 'التصنيف') },
              { key: 'specs', label: t('Specs', 'المواصفات'), align: 'center' },
              { key: 'price', label: t('Price', 'السعر'), align: 'end' },
            ]}
            rows={[
              { name: t('Landing Page Package', 'باقة صفحة هبوط'), cat: t('Design Services', 'خدمات التصميم'), specs: '4', price: money('4,500') },
              { name: t('Brand Identity Kit', 'حزمة هوية بصرية'), cat: t('Design Services', 'خدمات التصميم'), specs: '6', price: money('9,000') },
              { name: t('Web App (Basic)', 'تطبيق ويب (أساسي)'), cat: t('Development', 'تطوير'), specs: '8', price: money('28,000') },
              { name: t('SEO Retainer', 'اشتراك SEO'), cat: t('Consulting', 'استشارات'), specs: '3', price: money('3,200') },
            ]}
          />
        )}
      </Panel>
    );
  }

  if (active === 'tasks') {
    const cols = [
      { key: 'todo', en: 'To Do', ar: 'قيد الانتظار' },
      { key: 'doing', en: 'In Progress', ar: 'قيد التنفيذ' },
      { key: 'done', en: 'Done', ar: 'مكتمل' },
    ];
    const cards: Record<string, [string, string][]> = {
      todo: [['Draft proposal for Atlas', 'مسودة عرض لأطلس'], ['Collect brand assets', 'تجميع أصول الهوية']],
      doing: [['Design homepage v2', 'تصميم الصفحة الرئيسية v2'], ['API integration', 'ربط الـ API'], ['Content review', 'مراجعة المحتوى']],
      done: [['Kickoff meeting', 'اجتماع الانطلاق'], ['Wireframes', 'المخططات']],
    };
    return (
      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(3, 1fr)' }} className="md-kanban">
        {cols.map((c) => (
          <div key={c.key} style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: theme.inkMuted }}>
              {t(c.en, c.ar)} <span style={{ color: theme.inkFaint }}>· {cards[c.key].length}</span>
            </div>
            {cards[c.key].map(([en, ar], i) => (
              <Inert key={i} style={{ background: theme.canvas, border: `1px solid ${theme.border}`, borderRadius: 10, padding: '10px 12px', marginBottom: 8, fontSize: 13, color: theme.ink }}>
                {t(en, ar)}
              </Inert>
            ))}
          </div>
        ))}
        <style jsx>{`@media (max-width:820px){:global(.md-kanban){grid-template-columns:1fr !important;}}`}</style>
      </div>
    );
  }

  if (active === 'reports') {
    const reports: [string, string, React.ReactNode][] = [
      ['Balance Sheet', 'الميزانية العمومية', <BarChart3 key="a" size={18} />],
      ['Client Report', 'تقرير العملاء', <Users key="b" size={18} />],
      ['Expense Report', 'تقرير المصروفات', <Wallet key="c" size={18} />],
      ['Ledger', 'دفتر الأستاذ', <ScrollText key="d" size={18} />],
      ['Profit', 'الأرباح', <TrendingUp key="e" size={18} />],
      ['Revenue', 'الإيرادات', <CircleDollarSign key="f" size={18} />],
      ['Tax / VAT', 'الضريبة / القيمة المضافة', <ReceiptText key="g" size={18} />],
    ];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Panel theme={theme} title={t('Profit & Revenue', 'الأرباح والإيرادات')} action={<Badge color={theme.accent} bg={theme.accentSoft}>{t('Last 6 months', 'آخر 6 أشهر')}</Badge>}>
          <MiniBars />
        </Panel>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))' }}>
          {reports.map(([en, ar, icon], i) => (
            <Inert key={i} style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ color: theme.accent, background: theme.accentSoft, borderRadius: 9, padding: 8, display: 'inline-flex' }}>{icon}</span>
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

  if (active === 'users') {
    return (
      <Panel theme={theme} title={t('Users & Roles', 'المستخدمون والصلاحيات')} action={<Toolbar />}>
        <DataTable
          theme={theme}
          columns={[
            { key: 'name', label: t('User', 'المستخدم') },
            { key: 'email', label: t('Email', 'البريد') },
            { key: 'role', label: t('Role', 'الدور'), align: 'center' },
            { key: 'status', label: t('Status', 'الحالة'), align: 'center' },
          ]}
          rows={[
            { name: 'Sara Ahmed', email: 'sara@madar.co', role: <Badge color="#7c6cff" bg={theme.accentSoft}>{t('Admin', 'مدير')}</Badge>, status: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('Active', 'نشط')}</Badge> },
            { name: 'Omar Khalid', email: 'omar@madar.co', role: <Badge color="#38bdf8" bg="rgba(56,189,248,.14)">{t('Manager', 'مشرف')}</Badge>, status: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('Active', 'نشط')}</Badge> },
            { name: 'Lina Mansour', email: 'lina@madar.co', role: <Badge color="#94a3b8" bg="rgba(148,163,184,.14)">{t('Staff', 'موظف')}</Badge>, status: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('Active', 'نشط')}</Badge> },
          ]}
        />
      </Panel>
    );
  }

  return null;
}

// ─── Tiny chart + progress helpers ────────────────────────────────────────────
function MiniBars() {
  const data = [
    { rev: 62, exp: 40 }, { rev: 78, exp: 52 }, { rev: 55, exp: 48 },
    { rev: 90, exp: 60 }, { rev: 72, exp: 45 }, { rev: 96, exp: 58 },
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, height: 180, padding: 20 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', gap: 5, alignItems: 'flex-end', height: '100%' }}>
          <div style={{ flex: 1, height: `${d.rev}%`, background: '#7c6cff', borderRadius: '5px 5px 0 0' }} />
          <div style={{ flex: 1, height: `${d.exp}%`, background: 'rgba(255,255,255,0.14)', borderRadius: '5px 5px 0 0' }} />
        </div>
      ))}
    </div>
  );
}

function Bar({ pct }: { pct: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 110 }}>
      <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 999 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: '#7c6cff', borderRadius: 999 }} />
      </div>
      <span style={{ fontSize: 12, color: '#a9adc7', width: 32 }}>{pct}%</span>
    </div>
  );
}

// ─── Entry ────────────────────────────────────────────────────────────────────
export default function MadarDemo() {
  const [active, setActive] = useState('dashboard');
  return (
    <DemoProvider theme={theme}>
      <ErpShell theme={theme} modules={modules} active={active} onSelect={setActive}>
        <Content active={active} />
      </ErpShell>
    </DemoProvider>
  );
}
