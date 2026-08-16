'use client';

/**
 * Matjary (متجري) — "Handla Commerce Platform" — VIEW-ONLY ERP demo.
 *
 * Modules map to REAL Matjary backend Modules verified in the codebase:
 * Catalog (products/variants/brands/categories), Orders, POS, Customers/CRM,
 * Inventory (movements/adjustments/counts/transfers/warehouses), Purchases &
 * Suppliers, Branches, Shipping, Coupons, Loyalty, Marketing, Reviews,
 * Accounting, Expenses, Tax, Payments, Reports & Analytics, CMS/Blog/SEO,
 * Settings, Users & Roles, Webhooks.
 *
 * View-only: all controls Inert; module switch + language only.
 */

import React, { useState } from 'react';
import {
  LayoutDashboard, Package, ShoppingBag, Store, Users2, Boxes,
  Truck, Ticket, Gift, Megaphone, Star, BookOpen, Wallet,
  Percent, CreditCard, BarChart3, Settings, ShieldCheck,
  Plus, Filter, Download, CircleDollarSign, Building2, Warehouse,
} from 'lucide-react';
import { DemoProvider, DemoTheme, useDemo, Inert, StatCard, Badge, Panel } from '@/components/product-demos/demo-shared';
import { ErpShell, ErpModule } from '@/components/product-demos/ErpShell';
import { DataTable } from '@/components/product-demos/DataTable';

const ACCENT = '#10b981';
const ACCENT_SOFT = 'rgba(16,185,129,0.14)';
const ACCENT_BORDER = 'rgba(16,185,129,0.32)';

const darkTheme: DemoTheme = {
  accent: ACCENT,
  accentSoft: ACCENT_SOFT,
  accentBorder: ACCENT_BORDER,
  sidebar: '#0e1a17',
  canvas: '#081210',
  panel: '#0f1f1b',
  subtle: '#0b1714',
  border: 'rgba(255,255,255,0.08)',
  ink: '#e6f2ee',
  inkMuted: '#9fc3b6',
  inkFaint: '#5f8377',
  nameEn: 'Matjary',
  nameAr: 'متجري',
};

const lightTheme: DemoTheme = {
  accent: '#059669',
  accentSoft: 'rgba(5,150,105,0.10)',
  accentBorder: 'rgba(5,150,105,0.26)',
  sidebar: '#ffffff',
  canvas: '#f2f8f5',
  panel: '#ffffff',
  subtle: '#eef6f1',
  border: 'rgba(6,78,59,0.10)',
  ink: '#0b2a20',
  inkMuted: '#3f6b5b',
  inkFaint: '#8aa89c',
  nameEn: 'Matjary',
  nameAr: 'متجري',
};

const themeSet = { dark: darkTheme, light: lightTheme };

const modules: ErpModule[] = [
  { id: 'dashboard', labelEn: 'Dashboard', labelAr: 'الرئيسية', icon: <LayoutDashboard size={17} />, groupEn: 'Overview', groupAr: 'نظرة عامة' },
  { id: 'products', labelEn: 'Catalog', labelAr: 'الكتالوج', icon: <Package size={17} />, groupEn: 'Sell', groupAr: 'البيع' },
  { id: 'orders', labelEn: 'Orders', labelAr: 'الطلبات', icon: <ShoppingBag size={17} />, groupEn: 'Sell', groupAr: 'البيع' },
  { id: 'pos', labelEn: 'POS', labelAr: 'نقطة البيع', icon: <Store size={17} />, groupEn: 'Sell', groupAr: 'البيع' },
  { id: 'customers', labelEn: 'Customers (CRM)', labelAr: 'العملاء', icon: <Users2 size={17} />, groupEn: 'Sell', groupAr: 'البيع' },
  { id: 'inventory', labelEn: 'Inventory', labelAr: 'المخزون', icon: <Boxes size={17} />, groupEn: 'Operations', groupAr: 'العمليات' },
  { id: 'purchases', labelEn: 'Purchases & Suppliers', labelAr: 'المشتريات والموردون', icon: <Building2 size={17} />, groupEn: 'Operations', groupAr: 'العمليات' },
  { id: 'branches', labelEn: 'Branches & Warehouses', labelAr: 'الفروع والمستودعات', icon: <Warehouse size={17} />, groupEn: 'Operations', groupAr: 'العمليات' },
  { id: 'shipping', labelEn: 'Shipping', labelAr: 'الشحن', icon: <Truck size={17} />, groupEn: 'Operations', groupAr: 'العمليات' },
  { id: 'coupons', labelEn: 'Coupons', labelAr: 'الكوبونات', icon: <Ticket size={17} />, groupEn: 'Growth', groupAr: 'النمو' },
  { id: 'loyalty', labelEn: 'Loyalty', labelAr: 'الولاء', icon: <Gift size={17} />, groupEn: 'Growth', groupAr: 'النمو' },
  { id: 'marketing', labelEn: 'Marketing', labelAr: 'التسويق', icon: <Megaphone size={17} />, groupEn: 'Growth', groupAr: 'النمو' },
  { id: 'reviews', labelEn: 'Reviews', labelAr: 'التقييمات', icon: <Star size={17} />, groupEn: 'Growth', groupAr: 'النمو' },
  { id: 'accounting', labelEn: 'Accounting', labelAr: 'المحاسبة', icon: <Wallet size={17} />, groupEn: 'Finance', groupAr: 'المالية' },
  { id: 'tax', labelEn: 'Tax', labelAr: 'الضرائب', icon: <Percent size={17} />, groupEn: 'Finance', groupAr: 'المالية' },
  { id: 'payments', labelEn: 'Payments', labelAr: 'المدفوعات', icon: <CreditCard size={17} />, groupEn: 'Finance', groupAr: 'المالية' },
  { id: 'reports', labelEn: 'Reports & Analytics', labelAr: 'التقارير والتحليلات', icon: <BarChart3 size={17} />, groupEn: 'Insights', groupAr: 'التحليلات' },
  { id: 'cms', labelEn: 'CMS / Blog / SEO', labelAr: 'المحتوى والمدونة و SEO', icon: <BookOpen size={17} />, groupEn: 'Content', groupAr: 'المحتوى' },
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
          <StatCard theme={theme} label={t('Sales (Today)', 'مبيعات اليوم')} value={money('18,240')} sub={t('142 orders', '142 طلب')} icon={<CircleDollarSign size={16} />} />
          <StatCard theme={theme} label={t('Orders (Today)', 'طلبات اليوم')} value="142" sub={t('12 pending', '12 معلّق')} icon={<ShoppingBag size={16} />} />
          <StatCard theme={theme} label={t('Customers', 'العملاء')} value="3,420" sub={t('+58 this week', '+58 هذا الأسبوع')} icon={<Users2 size={16} />} />
          <StatCard theme={theme} label={t('Low stock', 'مخزون منخفض')} value="9" sub={t('needs reorder', 'يلزم إعادة طلب')} icon={<Boxes size={16} />} />
        </div>
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1.6fr 1fr' }} className="mt-dash-grid">
          <Panel theme={theme} title={t('Sales — Last 7 days', 'المبيعات — آخر 7 أيام')} action={<Badge color={theme.accent} bg={theme.accentSoft}>{t('This week', 'هذا الأسبوع')}</Badge>}>
            <MiniBars />
          </Panel>
          <Panel theme={theme} title={t('Top Products', 'أفضل المنتجات')}>
            <div style={{ padding: 8 }}>
              {[
                [t('Wireless Earbuds', 'سماعات لاسلكية'), '412'],
                [t('Smart Watch', 'ساعة ذكية'), '318'],
                [t('Phone Case', 'غطاء هاتف'), '287'],
                [t('USB-C Cable', 'كابل USB-C'), '241'],
                [t('Power Bank', 'بطارية محمولة'), '198'],
              ].map(([a, b], i) => (
                <Inert key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', borderRadius: 8, fontSize: 13 }}>
                  <span style={{ color: theme.inkMuted }}>{a}</span>
                  <span style={{ color: theme.accent, fontWeight: 700 }}>{b} {t('sold', 'مبيع')}</span>
                </Inert>
              ))}
            </div>
          </Panel>
        </div>
        <style jsx>{`@media (max-width:900px){:global(.mt-dash-grid){grid-template-columns:1fr !important;}}`}</style>
      </div>
    );
  }

  if (active === 'products') {
    return (
      <Panel theme={theme} title={t('Catalog', 'الكتالوج')} action={<Toolbar />}>
        <DataTable
          theme={theme}
          columns={[
            { key: 'name', label: t('Product', 'المنتج') },
            { key: 'brand', label: t('Brand', 'العلامة') },
            { key: 'variants', label: t('Variants', 'الخيارات'), align: 'center' },
            { key: 'stock', label: t('Stock', 'المخزون'), align: 'center' },
            { key: 'price', label: t('Price', 'السعر'), align: 'end' },
            { key: 'status', label: t('Status', 'الحالة'), align: 'center' },
          ]}
          rows={[
            { name: t('Wireless Earbuds Pro', 'سماعات لاسلكية برو'), brand: 'Soundly', variants: 3, stock: 214, price: money('349'), status: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('Active', 'نشط')}</Badge> },
            { name: t('Smart Watch S2', 'ساعة ذكية S2'), brand: 'Chrono', variants: 5, stock: 88, price: money('699'), status: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('Active', 'نشط')}</Badge> },
            { name: t('Phone Case Clear', 'غطاء هاتف شفاف'), brand: 'Guardex', variants: 8, stock: 6, price: money('49'), status: <Badge color="#fbbf24" bg="rgba(251,191,36,.14)">{t('Low', 'منخفض')}</Badge> },
            { name: t('Power Bank 20K', 'بطارية 20 ألف'), brand: 'Voltra', variants: 2, stock: 0, price: money('129'), status: <Badge color="#f87171" bg="rgba(248,113,113,.14)">{t('Out', 'نفد')}</Badge> },
          ]}
        />
      </Panel>
    );
  }

  if (active === 'orders') {
    return (
      <Panel theme={theme} title={t('Orders', 'الطلبات')} action={<Toolbar />}>
        <DataTable
          theme={theme}
          columns={[
            { key: 'no', label: t('Order', 'الطلب') },
            { key: 'customer', label: t('Customer', 'العميل') },
            { key: 'items', label: t('Items', 'المنتجات'), align: 'center' },
            { key: 'total', label: t('Total', 'الإجمالي'), align: 'end' },
            { key: 'status', label: t('Status', 'الحالة'), align: 'center' },
          ]}
          rows={[
            { no: '#10428', customer: 'Ahmed M.', items: 3, total: money('597'), status: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('Fulfilled', 'تم التنفيذ')}</Badge> },
            { no: '#10427', customer: 'Noura K.', items: 1, total: money('699'), status: <Badge color="#38bdf8" bg="rgba(56,189,248,.14)">{t('Shipped', 'تم الشحن')}</Badge> },
            { no: '#10426', customer: 'Faisal R.', items: 5, total: money('1,240'), status: <Badge color="#fbbf24" bg="rgba(251,191,36,.14)">{t('Processing', 'قيد المعالجة')}</Badge> },
            { no: '#10425', customer: 'Sara T.', items: 2, total: money('178'), status: <Badge color="#f87171" bg="rgba(248,113,113,.14)">{t('Refunded', 'مُسترد')}</Badge> },
          ]}
        />
      </Panel>
    );
  }

  if (active === 'pos') {
    return (
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1.5fr 1fr' }} className="mt-pos-grid">
        <Panel theme={theme} title={t('Register', 'الكاشير')}>
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(3,1fr)', padding: 14 }}>
            {[
              [t('Earbuds', 'سماعات'), '349'], [t('Watch', 'ساعة'), '699'], [t('Case', 'غطاء'), '49'],
              [t('Cable', 'كابل'), '29'], [t('Power Bank', 'بطارية'), '129'], [t('Charger', 'شاحن'), '89'],
            ].map(([n, p], i) => (
              <Inert key={i} style={{ background: theme.canvas, border: `1px solid ${theme.border}`, borderRadius: 10, padding: '16px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: theme.ink }}>{n}</div>
                <div style={{ fontSize: 12, color: theme.accent, marginTop: 4 }}>{money(p)}</div>
              </Inert>
            ))}
          </div>
        </Panel>
        <Panel theme={theme} title={t('Current Sale', 'البيع الحالي')}>
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[[t('Earbuds', 'سماعات'), '349'], [t('Case', 'غطاء'), '49']].map(([n, p], i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: theme.inkMuted }}>
                <span>1 × {n}</span><span>{money(p)}</span>
              </div>
            ))}
            <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontWeight: 800, color: theme.ink }}>
              <span>{t('Total', 'الإجمالي')}</span><span>{money('398')}</span>
            </div>
            <Inert as="button" style={{ ...btn(theme, false), justifyContent: 'center', padding: '11px', marginTop: 6 }}>
              {t('Charge', 'تحصيل')} {money('398')}
            </Inert>
          </div>
        </Panel>
        <style jsx>{`@media (max-width:820px){:global(.mt-pos-grid){grid-template-columns:1fr !important;}}`}</style>
      </div>
    );
  }

  if (active === 'customers') {
    return (
      <Panel theme={theme} title={t('Customers (CRM)', 'العملاء')} action={<Toolbar />}>
        <DataTable
          theme={theme}
          columns={[
            { key: 'name', label: t('Customer', 'العميل') },
            { key: 'segment', label: t('Segment', 'الشريحة'), align: 'center' },
            { key: 'orders', label: t('Orders', 'الطلبات'), align: 'center' },
            { key: 'spent', label: t('Lifetime', 'الإجمالي'), align: 'end' },
          ]}
          rows={[
            { name: 'Ahmed M.', segment: <Badge color="#10b981" bg={theme.accentSoft}>VIP</Badge>, orders: 24, spent: money('12,400') },
            { name: 'Noura K.', segment: <Badge color="#38bdf8" bg="rgba(56,189,248,.14)">{t('Loyal', 'مخلص')}</Badge>, orders: 11, spent: money('5,900') },
            { name: 'Faisal R.', segment: <Badge color="#94a3b8" bg="rgba(148,163,184,.14)">{t('New', 'جديد')}</Badge>, orders: 2, spent: money('820') },
          ]}
        />
      </Panel>
    );
  }

  if (active === 'inventory') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(170px,1fr))' }}>
          <StatCard theme={theme} label={t('SKUs', 'المنتجات')} value="1,284" />
          <StatCard theme={theme} label={t('Warehouses', 'المستودعات')} value="4" />
          <StatCard theme={theme} label={t('Transfers', 'التحويلات')} value="12" />
          <StatCard theme={theme} label={t('Adjustments', 'التسويات')} value="7" />
        </div>
        <Panel theme={theme} title={t('Stock Movements', 'حركات المخزون')} action={<Toolbar />}>
          <DataTable
            theme={theme}
            columns={[
              { key: 'item', label: t('Item', 'الصنف') },
              { key: 'type', label: t('Type', 'النوع'), align: 'center' },
              { key: 'qty', label: t('Qty', 'الكمية'), align: 'center' },
              { key: 'wh', label: t('Warehouse', 'المستودع') },
            ]}
            rows={[
              { item: t('Earbuds Pro', 'سماعات برو'), type: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('Received', 'وارد')}</Badge>, qty: '+200', wh: t('Main WH', 'المستودع الرئيسي') },
              { item: t('Smart Watch S2', 'ساعة S2'), type: <Badge color="#f87171" bg="rgba(248,113,113,.14)">{t('Sold', 'صادر')}</Badge>, qty: '-12', wh: t('Branch 2', 'الفرع 2') },
              { item: t('Phone Case', 'غطاء هاتف'), type: <Badge color="#38bdf8" bg="rgba(56,189,248,.14)">{t('Transfer', 'تحويل')}</Badge>, qty: '±50', wh: t('Branch 3', 'الفرع 3') },
            ]}
          />
        </Panel>
      </div>
    );
  }

  if (active === 'purchases' || active === 'branches' || active === 'shipping') {
    const map: Record<string, [string, string]> = {
      purchases: ['Purchases & Suppliers', 'المشتريات والموردون'],
      branches: ['Branches & Warehouses', 'الفروع والمستودعات'],
      shipping: ['Shipping', 'الشحن'],
    };
    const [en, ar] = map[active];
    if (active === 'branches') {
      return (
        <Panel theme={theme} title={t(en, ar)} action={<Toolbar />}>
          <DataTable theme={theme}
            columns={[
              { key: 'name', label: t('Location', 'الموقع') },
              { key: 'type', label: t('Type', 'النوع'), align: 'center' },
              { key: 'staff', label: t('Staff', 'الموظفون'), align: 'center' },
              { key: 'stock', label: t('Stock value', 'قيمة المخزون'), align: 'end' },
            ]}
            rows={[
              { name: t('Riyadh — Main', 'الرياض — الرئيسي'), type: <Badge color="#10b981" bg={theme.accentSoft}>{t('Branch', 'فرع')}</Badge>, staff: 12, stock: money('420,000') },
              { name: t('Central Warehouse', 'المستودع المركزي'), type: <Badge color="#38bdf8" bg="rgba(56,189,248,.14)">{t('Warehouse', 'مستودع')}</Badge>, staff: 5, stock: money('980,000') },
              { name: t('Jeddah — Branch', 'جدة — فرع'), type: <Badge color="#10b981" bg={theme.accentSoft}>{t('Branch', 'فرع')}</Badge>, staff: 8, stock: money('310,000') },
            ]}
          />
        </Panel>
      );
    }
    if (active === 'shipping') {
      return (
        <Panel theme={theme} title={t(en, ar)} action={<Toolbar />}>
          <DataTable theme={theme}
            columns={[
              { key: 'order', label: t('Order', 'الطلب') },
              { key: 'carrier', label: t('Carrier', 'شركة الشحن') },
              { key: 'city', label: t('City', 'المدينة') },
              { key: 'status', label: t('Status', 'الحالة'), align: 'center' },
            ]}
            rows={[
              { order: '#10427', carrier: 'Aramex', city: t('Riyadh', 'الرياض'), status: <Badge color="#38bdf8" bg="rgba(56,189,248,.14)">{t('In transit', 'قيد النقل')}</Badge> },
              { order: '#10424', carrier: 'SMSA', city: t('Jeddah', 'جدة'), status: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('Delivered', 'تم التوصيل')}</Badge> },
              { order: '#10422', carrier: 'DHL', city: t('Dammam', 'الدمام'), status: <Badge color="#fbbf24" bg="rgba(251,191,36,.14)">{t('Label created', 'تم إنشاء البطاقة')}</Badge> },
            ]}
          />
        </Panel>
      );
    }
    return (
      <Panel theme={theme} title={t(en, ar)} action={<Toolbar />}>
        <DataTable theme={theme}
          columns={[
            { key: 'no', label: t('PO', 'أمر شراء') },
            { key: 'supplier', label: t('Supplier', 'المورّد') },
            { key: 'items', label: t('Items', 'الأصناف'), align: 'center' },
            { key: 'total', label: t('Total', 'الإجمالي'), align: 'end' },
            { key: 'status', label: t('Status', 'الحالة'), align: 'center' },
          ]}
          rows={[
            { no: 'PO-508', supplier: 'Soundly Ltd', items: 12, total: money('84,000'), status: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('Received', 'مُستلم')}</Badge> },
            { no: 'PO-507', supplier: 'Chrono Inc', items: 6, total: money('120,000'), status: <Badge color="#fbbf24" bg="rgba(251,191,36,.14)">{t('Partial', 'جزئي')}</Badge> },
            { no: 'PO-506', supplier: 'Voltra Co', items: 20, total: money('45,000'), status: <Badge color="#94a3b8" bg="rgba(148,163,184,.14)">{t('Ordered', 'تم الطلب')}</Badge> },
          ]}
        />
      </Panel>
    );
  }

  if (active === 'coupons' || active === 'loyalty' || active === 'marketing' || active === 'reviews') {
    const map: Record<string, [string, string]> = {
      coupons: ['Coupons', 'الكوبونات'],
      loyalty: ['Loyalty', 'الولاء'],
      marketing: ['Marketing Campaigns', 'الحملات التسويقية'],
      reviews: ['Reviews', 'التقييمات'],
    };
    const [en, ar] = map[active];
    if (active === 'reviews') {
      return (
        <Panel theme={theme} title={t(en, ar)} action={<Toolbar />}>
          <div style={{ padding: 8 }}>
            {[
              ['Ahmed M.', 5, t('Great sound quality, fast delivery!', 'جودة صوت ممتازة وتوصيل سريع!')],
              ['Noura K.', 4, t('Watch is nice but battery could be better.', 'الساعة جميلة لكن البطارية يمكن أن تكون أفضل.')],
              ['Sara T.', 5, t('Exactly as described. Recommended.', 'مطابق للوصف تماماً. أنصح به.')],
            ].map(([who, stars, text], i) => (
              <Inert key={i} style={{ padding: '12px', borderRadius: 10, border: `1px solid ${theme.border}`, marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: theme.ink }}>{who as string}</span>
                  <span style={{ color: '#fbbf24' }}>{'★'.repeat(stars as number)}<span style={{ color: theme.inkFaint }}>{'★'.repeat(5 - (stars as number))}</span></span>
                </div>
                <p style={{ fontSize: 13, color: theme.inkMuted, margin: 0 }}>{text}</p>
              </Inert>
            ))}
          </div>
        </Panel>
      );
    }
    const rows = active === 'coupons'
      ? [
          { a: 'WELCOME10', b: t('10% off', 'خصم 10%'), c: '312', d: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('Active', 'نشط')}</Badge> },
          { a: 'FREESHIP', b: t('Free shipping', 'شحن مجاني'), c: '204', d: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('Active', 'نشط')}</Badge> },
          { a: 'EID25', b: t('25% off', 'خصم 25%'), c: '1,024', d: <Badge color="#94a3b8" bg="rgba(148,163,184,.14)">{t('Expired', 'منتهٍ')}</Badge> },
        ]
      : active === 'loyalty'
      ? [
          { a: t('Bronze', 'برونزي'), b: t('0–500 pts', '0–500 نقطة'), c: '1,840', d: <Badge color="#c084fc" bg="rgba(192,132,252,.14)">{t('Tier', 'مستوى')}</Badge> },
          { a: t('Silver', 'فضي'), b: t('500–2000 pts', '500–2000 نقطة'), c: '620', d: <Badge color="#c084fc" bg="rgba(192,132,252,.14)">{t('Tier', 'مستوى')}</Badge> },
          { a: t('Gold', 'ذهبي'), b: t('2000+ pts', '+2000 نقطة'), c: '210', d: <Badge color="#c084fc" bg="rgba(192,132,252,.14)">{t('Tier', 'مستوى')}</Badge> },
        ]
      : [
          { a: t('Summer Sale', 'تخفيضات الصيف'), b: t('Email', 'بريد'), c: '8,200', d: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('Sent', 'مُرسل')}</Badge> },
          { a: t('New Arrivals', 'وصل حديثاً'), b: 'SMS', c: '3,100', d: <Badge color="#fbbf24" bg="rgba(251,191,36,.14)">{t('Scheduled', 'مجدول')}</Badge> },
          { a: t('Win-back', 'استعادة العملاء'), b: t('Email', 'بريد'), c: '1,450', d: <Badge color="#94a3b8" bg="rgba(148,163,184,.14)">{t('Draft', 'مسودة')}</Badge> },
        ];
    return (
      <Panel theme={theme} title={t(en, ar)} action={<Toolbar />}>
        <DataTable theme={theme}
          columns={[
            { key: 'a', label: t('Name', 'الاسم') },
            { key: 'b', label: t('Detail', 'التفاصيل') },
            { key: 'c', label: t('Reach / Uses', 'الوصول / الاستخدام'), align: 'center' },
            { key: 'd', label: t('Status', 'الحالة'), align: 'center' },
          ]}
          rows={rows}
        />
      </Panel>
    );
  }

  if (active === 'accounting' || active === 'tax' || active === 'payments') {
    const map: Record<string, [string, string]> = {
      accounting: ['Accounting', 'المحاسبة'],
      tax: ['Tax', 'الضرائب'],
      payments: ['Payments', 'المدفوعات'],
    };
    const [en, ar] = map[active];
    if (active === 'payments') {
      return (
        <Panel theme={theme} title={t(en, ar)} action={<Toolbar />}>
          <DataTable theme={theme}
            columns={[
              { key: 'txn', label: t('Transaction', 'العملية') },
              { key: 'method', label: t('Method', 'الطريقة') },
              { key: 'amount', label: t('Amount', 'المبلغ'), align: 'end' },
              { key: 'status', label: t('Status', 'الحالة'), align: 'center' },
            ]}
            rows={[
              { txn: 'TXN-9021', method: 'Mada', amount: money('597'), status: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('Captured', 'تم التحصيل')}</Badge> },
              { txn: 'TXN-9020', method: 'Visa', amount: money('699'), status: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('Captured', 'تم التحصيل')}</Badge> },
              { txn: 'TXN-9019', method: 'Apple Pay', amount: money('178'), status: <Badge color="#f87171" bg="rgba(248,113,113,.14)">{t('Refunded', 'مُسترد')}</Badge> },
            ]}
          />
        </Panel>
      );
    }
    return (
      <Panel theme={theme} title={t(en, ar)} action={<Toolbar />}>
        <DataTable theme={theme}
          columns={[
            { key: 'acc', label: t('Account', 'الحساب') },
            { key: 'type', label: t('Type', 'النوع'), align: 'center' },
            { key: 'balance', label: t('Balance', 'الرصيد'), align: 'end' },
          ]}
          rows={[
            { acc: t('Sales Revenue', 'إيرادات المبيعات'), type: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('Income', 'إيراد')}</Badge>, balance: money('1,284,000') },
            { acc: t('VAT Payable (15%)', 'ضريبة القيمة المضافة (15%)'), type: <Badge color="#fbbf24" bg="rgba(251,191,36,.14)">{t('Liability', 'التزام')}</Badge>, balance: money('192,600') },
            { acc: t('Cost of Goods Sold', 'تكلفة البضاعة المباعة'), type: <Badge color="#f87171" bg="rgba(248,113,113,.14)">{t('Expense', 'مصروف')}</Badge>, balance: money('742,000') },
          ]}
        />
      </Panel>
    );
  }

  if (active === 'reports') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Panel theme={theme} title={t('Sales Analytics', 'تحليلات المبيعات')} action={<Badge color={theme.accent} bg={theme.accentSoft}>{t('Last 6 months', 'آخر 6 أشهر')}</Badge>}>
          <MiniBars />
        </Panel>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))' }}>
          {[
            ['Sales by Product', 'المبيعات حسب المنتج'], ['Sales by Channel', 'المبيعات حسب القناة'],
            ['Customer Report', 'تقرير العملاء'], ['Inventory Valuation', 'تقييم المخزون'],
            ['Tax / VAT Report', 'تقرير الضريبة'], ['Profit & Loss', 'الأرباح والخسائر'],
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

  if (active === 'cms') {
    return (
      <Panel theme={theme} title={t('CMS / Blog / SEO', 'المحتوى والمدونة و SEO')} action={<Toolbar />}>
        <DataTable theme={theme}
          columns={[
            { key: 'title', label: t('Content', 'المحتوى') },
            { key: 'type', label: t('Type', 'النوع'), align: 'center' },
            { key: 'seo', label: 'SEO', align: 'center' },
            { key: 'status', label: t('Status', 'الحالة'), align: 'center' },
          ]}
          rows={[
            { title: t('About Us', 'من نحن'), type: <Badge color="#38bdf8" bg="rgba(56,189,248,.14)">{t('Page', 'صفحة')}</Badge>, seo: <Badge color="#34d399" bg="rgba(52,211,153,.14)">92</Badge>, status: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('Published', 'منشور')}</Badge> },
            { title: t('Top 10 Gadgets 2026', 'أفضل 10 أجهزة 2026'), type: <Badge color="#c084fc" bg="rgba(192,132,252,.14)">{t('Blog', 'مدونة')}</Badge>, seo: <Badge color="#fbbf24" bg="rgba(251,191,36,.14)">74</Badge>, status: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('Published', 'منشور')}</Badge> },
            { title: t('Ramadan Guide', 'دليل رمضان'), type: <Badge color="#c084fc" bg="rgba(192,132,252,.14)">{t('Blog', 'مدونة')}</Badge>, seo: <Badge color="#94a3b8" bg="rgba(148,163,184,.14)">—</Badge>, status: <Badge color="#94a3b8" bg="rgba(148,163,184,.14)">{t('Draft', 'مسودة')}</Badge> },
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
              { key: 'branch', label: t('Branch', 'الفرع') },
              { key: 'status', label: t('Status', 'الحالة'), align: 'center' },
            ]}
            rows={[
              { name: 'Admin', role: <Badge color="#10b981" bg={theme.accentSoft}>{t('Owner', 'مالك')}</Badge>, branch: t('All', 'الكل'), status: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('Active', 'نشط')}</Badge> },
              { name: 'Cashier 1', role: <Badge color="#38bdf8" bg="rgba(56,189,248,.14)">{t('Cashier', 'كاشير')}</Badge>, branch: t('Riyadh', 'الرياض'), status: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('Active', 'نشط')}</Badge> },
              { name: 'Manager 2', role: <Badge color="#c084fc" bg="rgba(192,132,252,.14)">{t('Manager', 'مدير')}</Badge>, branch: t('Jeddah', 'جدة'), status: <Badge color="#34d399" bg="rgba(52,211,153,.14)">{t('Active', 'نشط')}</Badge> },
            ]}
          />
        </Panel>
      );
    }
    const groups: [string, string, string[]][] = [
      ['Store', 'المتجر', ['Store details', 'Currencies', 'Languages (AR/EN)']],
      ['Checkout', 'الدفع', ['Payment methods', 'Tax (VAT 15%)', 'Shipping zones']],
      ['Advanced', 'متقدم', ['Webhooks', 'API keys', 'Backups & Audit logs']],
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
  const data = [55, 72, 60, 88, 74, 96];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 180, padding: 20 }}>
      {data.map((h, i) => (
        <div key={i} style={{ flex: 1, height: `${h}%`, background: `linear-gradient(180deg, ${theme.accent}, ${theme.accent})`, opacity: 0.9, borderRadius: '6px 6px 0 0' }} />
      ))}
    </div>
  );
}

function MatjaryInner() {
  const { theme } = useDemo();
  const [active, setActive] = useState('dashboard');
  return (
    <ErpShell theme={theme} modules={modules} active={active} onSelect={setActive}>
      <Content active={active} />
    </ErpShell>
  );
}

export default function MatjaryDemo() {
  return (
    <DemoProvider themeSet={themeSet}>
      <MatjaryInner />
    </DemoProvider>
  );
}
