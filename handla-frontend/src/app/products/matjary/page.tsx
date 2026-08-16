'use client';

/**
 * Matjary (متجري) — "Handla Commerce Platform" — product landing page.
 * Multi-tenant SaaS commerce. Own emerald/teal brand.
 * Feature copy maps to REAL Matjary modules (verified in the codebase).
 */

import React from 'react';
import {
  Package, ShoppingBag, Store, Users2, Boxes, Truck, Gift,
  BarChart3, LayoutDashboard, Globe, CreditCard,
} from 'lucide-react';
import { ProductLanding, ProductLandingContent } from '@/components/product-demos/ProductLanding';

const ACCENT = '#10b981';
const ACCENT_SOFT = 'rgba(16,185,129,0.14)';
const ACCENT_BORDER = 'rgba(16,185,129,0.32)';

function HeroPreview() {
  return (
    <div style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', background: '#0f1f1b', boxShadow: '0 24px 60px rgba(0,0,0,0.45)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57' }} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e' }} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840' }} />
        <span style={{ marginInlineStart: 10, fontSize: 12, color: '#5f8377' }}>matjary.store</span>
      </div>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          {[['Sales', 'SAR 18.2K', ACCENT], ['Orders', '142', '#38bdf8'], ['Customers', '3.4K', '#c084fc']].map(([l, v, c], i) => (
            <div key={i} style={{ background: '#0b1714', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, color: '#5f8377' }}>{l}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: c as string }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ background: '#0b1714', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 96 }}>
            {[55, 72, 60, 88, 74, 96].map((h, i) => (
              <div key={i} style={{ flex: 1, height: `${h}%`, background: 'linear-gradient(180deg,#10b981,#059669)', borderRadius: '4px 4px 0 0' }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const content: ProductLandingContent = {
  slug: 'matjary',
  nameEn: 'Matjary',
  nameAr: 'متجري',
  categoryEn: 'Commerce Platform',
  categoryAr: 'منصة التجارة',
  taglineEn: 'Sell everywhere. Manage from one place.',
  taglineAr: 'بِع في كل مكان. أدِر من مكان واحد.',
  introEn:
    'Matjary is a complete commerce platform — an online storefront, in-store POS, inventory across branches and warehouses, purchasing, CRM, loyalty, marketing, coupons, reviews, accounting and rich analytics. Multi-tenant, Arabic-first, and built to scale.',
  introAr:
    'متجري منصة تجارة متكاملة — متجر إلكتروني ونقطة بيع داخل المتجر ومخزون عبر الفروع والمستودعات، بالإضافة إلى المشتريات وإدارة العملاء والولاء والتسويق والكوبونات والتقييمات والمحاسبة وتحليلات غنية. متعددة المستأجرين، بالعربية أولاً، ومصممة للتوسّع.',
  demoHref: '/products/matjary/demo',
  accent: ACCENT,
  accentSoft: ACCENT_SOFT,
  accentBorder: ACCENT_BORDER,
  gradientFrom: '#10b981',
  gradientTo: '#34d399',
  featuresHeadingEn: 'One platform, the whole store',
  featuresHeadingAr: 'منصة واحدة، المتجر بالكامل',
  featuresSubEn: 'From the storefront to the back office — online and in-store, unified.',
  featuresSubAr: 'من واجهة المتجر إلى الإدارة الخلفية — عبر الإنترنت وداخل المتجر، في مكان واحد.',
  stats: [
    { valueEn: '20+', valueAr: '+20', labelEn: 'Modules', labelAr: 'وحدة' },
    { valueEn: 'Online + POS', valueAr: 'أونلاين + كاشير', labelEn: 'Channels', labelAr: 'قنوات البيع' },
    { valueEn: 'Multi-branch', valueAr: 'متعدد الفروع', labelEn: 'Warehouses', labelAr: 'مستودعات' },
    { valueEn: 'AR / EN', valueAr: 'عربي / إنجليزي', labelEn: 'Bilingual', labelAr: 'ثنائي اللغة' },
  ],
  features: [
    { icon: <Package size={20} />, titleEn: 'Catalog & Variants', titleAr: 'الكتالوج والخيارات', descEn: 'Products, variants, attributes, brands and categories with rich media.', descAr: 'المنتجات والخيارات والسمات والعلامات والتصنيفات مع وسائط غنية.' },
    { icon: <ShoppingBag size={20} />, titleEn: 'Orders & Fulfillment', titleAr: 'الطلبات والتنفيذ', descEn: 'Manage orders end-to-end with a full status timeline.', descAr: 'أدر الطلبات من البداية للنهاية مع سجل زمني كامل للحالة.' },
    { icon: <Store size={20} />, titleEn: 'Point of Sale (POS)', titleAr: 'نقطة البيع', descEn: 'Fast in-store checkout with shifts, held carts, refunds and credit notes.', descAr: 'دفع سريع داخل المتجر مع الورديات والسلال المعلّقة والاستردادات وإشعارات الدائن.' },
    { icon: <Users2 size={20} />, titleEn: 'Customers & CRM', titleAr: 'العملاء وإدارة العلاقات', descEn: 'Segments, tags, notes, timelines and wishlists for every customer.', descAr: 'الشرائح والوسوم والملاحظات والسجل الزمني وقوائم الرغبات لكل عميل.' },
    { icon: <Boxes size={20} />, titleEn: 'Inventory & Warehouses', titleAr: 'المخزون والمستودعات', descEn: 'Stock movements, adjustments, counts and transfers across locations.', descAr: 'حركات المخزون والتسويات والجرد والتحويلات بين المواقع.' },
    { icon: <Truck size={20} />, titleEn: 'Purchasing & Shipping', titleAr: 'المشتريات والشحن', descEn: 'Suppliers, purchase orders, receipts, plus shipping and branches.', descAr: 'الموردون وأوامر الشراء والاستلام، بالإضافة إلى الشحن والفروع.' },
    { icon: <Gift size={20} />, titleEn: 'Loyalty, Coupons & Marketing', titleAr: 'الولاء والكوبونات والتسويق', descEn: 'Reward tiers, coupons, campaigns and product reviews to drive growth.', descAr: 'مستويات المكافآت والكوبونات والحملات وتقييمات المنتجات لدفع النمو.' },
    { icon: <BarChart3 size={20} />, titleEn: 'Accounting, Tax & Analytics + more', titleAr: 'المحاسبة والضرائب والتحليلات والمزيد', descEn: 'Chart of accounts, VAT, payments, reports, CMS/blog/SEO, roles and webhooks.', descAr: 'دليل الحسابات وضريبة القيمة المضافة والمدفوعات والتقارير والمحتوى/المدونة/SEO والأدوار والويب هوك.' },
  ],
  surfaces: [
    {
      icon: <LayoutDashboard size={22} />,
      labelEn: 'Admin Dashboard',
      labelAr: 'لوحة التحكم',
      descEn: 'Explore catalog, orders, POS, inventory, CRM, finance and analytics — view-only.',
      descAr: 'استكشف الكتالوج والطلبات ونقطة البيع والمخزون والعملاء والمالية والتحليلات — للقراءة فقط.',
      href: '/products/matjary/demo',
      ctaEn: 'Open admin demo',
      ctaAr: 'افتح لوحة التحكم',
    },
    {
      icon: <Globe size={22} />,
      labelEn: 'Customer Storefront',
      labelAr: 'واجهة المتجر',
      descEn: 'Browse the shopper-facing store — products, categories, cart and checkout.',
      descAr: 'تصفّح المتجر من منظور العميل — المنتجات والتصنيفات والسلة والدفع.',
      href: '/products/matjary/demo/store',
      ctaEn: 'Open storefront demo',
      ctaAr: 'افتح واجهة المتجر',
    },
    {
      icon: <CreditCard size={22} />,
      labelEn: 'POS Register',
      labelAr: 'نقطة البيع',
      descEn: 'See the in-store point-of-sale register inside the admin demo.',
      descAr: 'شاهد شاشة نقطة البيع داخل لوحة التحكم التجريبية.',
      href: '/products/matjary/demo',
      ctaEn: 'View POS',
      ctaAr: 'عرض نقطة البيع',
    },
  ],
  heroPreview: <HeroPreview />,
};

export default function MatjaryLandingPage() {
  return <ProductLanding content={content} />;
}
