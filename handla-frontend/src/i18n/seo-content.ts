/**
 * Per-page bilingual SEO copy — the single source of truth for the localized
 * <title> and meta description of every public page. Kept separate from the
 * large UI translation bundles so the exact SEO wording is easy to audit.
 *
 * All Arabic strings are hand-written natural Arabic (no machine filler) and
 * mirror the confirmed product spellings used across the site
 * (منارة / مدار / متجري).  No fabricated claims, numbers or credentials.
 */

import type { Locale } from './config';

export interface SeoCopy {
  title: string;
  description: string;
}

type Bilingual = Record<Locale, SeoCopy>;

export const HOME_SEO: Bilingual = {
  en: {
    title: 'Handla | Software Development, ERP & Digital Solutions',
    description:
      'Handla builds custom software, ERP systems, SaaS platforms, websites and mobile applications for businesses, schools and growing organizations.',
  },
  ar: {
    title: 'هاندلا | تطوير البرمجيات وأنظمة ERP والحلول الرقمية',
    description:
      'هاندلا تقدّم حلول تطوير البرمجيات وأنظمة ERP ومنصات SaaS والمواقع والتطبيقات للشركات والمؤسسات والمدارس.',
  },
};

export const PRODUCTS_SEO: Bilingual = {
  en: {
    title: 'Software Products & Business Platforms | Handla',
    description:
      'Explore Handla products including Manarah for schools, Madar for business management and Matjary for commerce, POS, inventory and customer operations.',
  },
  ar: {
    title: 'منتجات هاندلا | أنظمة ومنصات لإدارة الأعمال',
    description:
      'استكشف منتجات هاندلا: منارة لإدارة المدارس، ومدار لإدارة الأعمال، ومتجري للتجارة ونقاط البيع والمخزون وإدارة العملاء.',
  },
};

export const PROJECTS_SEO: Bilingual = {
  en: {
    title: 'Software Projects & Case Studies | Handla',
    description:
      'Explore Handla software projects and case studies across SaaS platforms, ERP systems, websites, mobile applications and custom digital solutions.',
  },
  ar: {
    title: 'مشاريع ودراسات حالة | هاندلا',
    description:
      'استعرض مشاريع هاندلا ودراسات الحالة في منصات SaaS وأنظمة ERP والمواقع والتطبيقات والحلول الرقمية المخصّصة.',
  },
};

export const MANARAH_SEO: Bilingual = {
  en: {
    title: 'Manarah | School Management System & School ERP',
    description:
      'Manarah is an all-in-one school management system for students, teachers, attendance, exams, grades, fees, HR, transportation and parent and student apps.',
  },
  ar: {
    title: 'منارة | نظام متكامل لإدارة المدارس',
    description:
      'منارة نظام متكامل لإدارة المدارس يشمل الطلاب والمعلمين والحضور والاختبارات والدرجات والرسوم والموارد البشرية والنقل وتطبيقات أولياء الأمور والطلاب.',
  },
};

export const MADAR_SEO: Bilingual = {
  en: {
    title: 'Madar | ERP & Business Management System',
    description:
      'Madar is a business management and ERP platform for clients, projects, quotations, contracts, invoices, expenses and operational reporting.',
  },
  ar: {
    title: 'مدار | نظام ERP وإدارة الأعمال',
    description:
      'مدار نظام ERP وإدارة أعمال يجمع العملاء والمشاريع وعروض الأسعار والعقود والفواتير والمصروفات والتقارير التشغيلية في منصة واحدة.',
  },
};

export const MATJARY_SEO: Bilingual = {
  en: {
    title: 'Matjary | Commerce, POS & Inventory Management Platform',
    description:
      'Matjary is a commerce management platform combining online sales, POS, inventory, customers, loyalty and business analytics in one system.',
  },
  ar: {
    title: 'متجري | نظام إدارة المتاجر ونقاط البيع والمخزون',
    description:
      'متجري منصة لإدارة المتاجر تجمع المبيعات الإلكترونية ونقاط البيع والمخزون والعملاء وبرامج الولاء وتحليلات الأعمال في نظام واحد.',
  },
};

export const SERVICES_SEO: Bilingual = {
  en: {
    title: 'Services | Handla',
    description:
      'Handla services: web development, ERP & CRM systems, mobile applications, cloud infrastructure, video editing, podcast editing, design & visual identity, and strategy & marketing.',
  },
  ar: {
    title: 'خدماتنا | هاندلا',
    description:
      'خدمات هاندلا: تطوير الويب، وأنظمة ERP وCRM، وتطبيقات الجوال، والبنية السحابية، ومونتاج الفيديو، ومونتاج البودكاست، والتصميم والهوية البصرية، والاستراتيجية والتسويق.',
  },
};
