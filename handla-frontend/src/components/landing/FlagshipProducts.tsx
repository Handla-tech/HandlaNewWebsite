'use client';

/**
 * FlagshipProducts — showcases Handla's three flagship products
 * (Madar, Matjary, Manarah), each linking to its OWN landing page
 * (/products/<slug>) with a distinct brand color.
 *
 * Rendered inside the landing "Products" section, above the DB-managed
 * website products grid.
 */

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowUpRight, Briefcase, ShoppingBag, GraduationCap, Sparkles } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

interface Flagship {
  slug: string;
  nameEn: string;
  nameAr: string;
  catEn: string;
  catAr: string;
  descEn: string;
  descAr: string;
  icon: React.ReactNode;
  accent: string;
  gradFrom: string;
  gradTo: string;
  image: string;
}

const FLAGSHIPS: Flagship[] = [
  {
    slug: 'madar',
    nameEn: 'Madar',
    nameAr: 'مُدار',
    catEn: 'Business & Agency ERP',
    catAr: 'نظام إدارة الأعمال والوكالات',
    descEn: 'Clients, projects, quotations, contracts, invoices and financial reports — the full agency workflow.',
    descAr: 'العملاء والمشاريع وعروض الأسعار والعقود والفواتير والتقارير المالية — دورة عمل الوكالة كاملة.',
    icon: <Briefcase className="h-6 w-6" />,
    accent: '#a78bfa',
    gradFrom: '#7c6cff',
    gradTo: '#a78bfa',
    image: '/products/madar-hero.webp',
  },
  {
    slug: 'matjary',
    nameEn: 'Matjary',
    nameAr: 'متجري',
    catEn: 'Commerce Platform',
    catAr: 'منصة التجارة',
    descEn: 'Online storefront, POS, inventory, CRM, loyalty and analytics — sell everywhere from one place.',
    descAr: 'متجر إلكتروني ونقطة بيع ومخزون وإدارة عملاء وولاء وتحليلات — بِع في كل مكان من مكان واحد.',
    icon: <ShoppingBag className="h-6 w-6" />,
    accent: '#34d399',
    gradFrom: '#10b981',
    gradTo: '#34d399',
    image: '/products/matjary-hero.webp',
  },
  {
    slug: 'manarah',
    nameEn: 'Manarah',
    nameAr: 'منارة',
    catEn: 'School Management System',
    catAr: 'نظام إدارة المدارس',
    descEn: 'Students, academics, attendance, grades, fees and transport — plus parent & student mobile apps.',
    descAr: 'الطلاب والأكاديمي والحضور والدرجات والرسوم والنقل — بالإضافة إلى تطبيقي ولي الأمر والطالب.',
    icon: <GraduationCap className="h-6 w-6" />,
    accent: '#4ade80',
    gradFrom: '#22c55e',
    gradTo: '#4ade80',
    image: '/products/manarah-hero.webp',
  },
];

export default function FlagshipProducts() {
  const { locale, isRTL } = useTranslation();
  const isAr = locale === 'ar';

  return (
    <div className="mb-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {FLAGSHIPS.map((p, i) => (
        <motion.div
          key={p.slug}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, delay: Math.min(i * 0.1, 0.3) }}
          whileHover={{ y: -6 }}
        >
          <div
            className="group relative flex h-full flex-col overflow-hidden rounded-2xl"
            style={{
              background: 'var(--surface-1)',
              border: '1px solid var(--ov-med)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            {/* Hero image banner */}
            <Link
              href={`/products/${p.slug}`}
              aria-label={`${isAr ? p.nameAr : p.nameEn} — ${isAr ? p.catAr : p.catEn}`}
              className="relative block h-36 overflow-hidden"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.image}
                alt={`${isAr ? p.nameAr : p.nameEn} — ${isAr ? p.catAr : p.catEn}`}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                loading="lazy"
              />
              {/* Brand tint + bottom fade so the badge stays legible */}
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(135deg, ${p.gradFrom}33, transparent 55%), linear-gradient(to top, rgba(0,0,0,0.72), rgba(0,0,0,0.05) 55%)`,
                }}
              />
              {/* Product badge */}
              <div className="absolute bottom-3 flex items-center gap-2 px-4 text-white"
                   style={isRTL ? { right: 0 } : { left: 0 }}>
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ background: `linear-gradient(135deg, ${p.gradFrom}, ${p.gradTo})`, boxShadow: '0 4px 14px rgba(0,0,0,0.35)' }}
                >
                  {p.icon}
                </span>
                <span className="text-lg font-extrabold tracking-tight drop-shadow">
                  {isAr ? p.nameAr : p.nameEn}
                </span>
              </div>
            </Link>

            {/* Body */}
            <div className="flex flex-1 flex-col gap-3 p-6">
              <span
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: p.accent }}
              >
                {isAr ? p.catAr : p.catEn}
              </span>
              <p className="flex-1 text-sm leading-relaxed" style={{ color: 'var(--ink-3)' }}>
                {isAr ? p.descAr : p.descEn}
              </p>

              {/* Actions: explore + call-to-action */}
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <Link
                  href={`/products/${p.slug}`}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold"
                  style={{ color: p.accent }}
                >
                  {isAr ? 'استكشف المنتج' : 'Explore product'}
                  <ArrowUpRight
                    className={`h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5 ${
                      isRTL ? 'group-hover:-translate-x-0.5 rotate-[-90deg]' : 'group-hover:translate-x-0.5'
                    }`}
                  />
                </Link>
                <Link
                  href={`/#contact?product=${p.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-transform duration-200 hover:-translate-y-0.5"
                  style={{ background: `linear-gradient(135deg, ${p.gradFrom}, ${p.gradTo})` }}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {isAr ? 'ابدأ الآن' : 'Get started'}
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
