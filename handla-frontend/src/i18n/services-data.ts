/**
 * Genuine Handla service definitions used to build the localized service
 * landing pages (/[locale]/services and /[locale]/services/[slug]).
 *
 * Every service here corresponds to a service ALREADY present in the site's
 * translation data / Services section (see the per-locale common.json
 * "services" keys and components/landing/ServicesBento.tsx). No service is
 * invented, and no fabricated client results, statistics, prices or timelines
 * appear - only descriptive capability copy.
 *
 * Media/creative services that exist in the Services grid (video editing,
 * podcast editing, design, marketing) are intentionally NOT given standalone
 * detail pages here: they do not yet have enough genuine standalone content to
 * justify a dedicated SEO page (reported in the task report rather than padded
 * with filler).
 */

import type { Locale } from './config';

export interface ServiceContent {
  slug: string;
  /** lucide-react icon name, resolved in the page component. */
  icon: string;
  accent: string;
  title: Record<Locale, string>;
  /** Short one-line summary (cards + meta fallback). */
  summary: Record<Locale, string>;
  /** SEO meta title/description. */
  seoTitle: Record<Locale, string>;
  seoDescription: Record<Locale, string>;
  /** Intro paragraph (H1 support copy). */
  intro: Record<Locale, string>;
  /** "Who it's for" bullets. */
  audience: Record<Locale, string[]>;
  /** "What we deliver" bullets. */
  deliverables: Record<Locale, string[]>;
  /** Genuine, non-fabricated technologies/capabilities. */
  capabilities: string[];
  /** Related product slugs (internal linking). */
  relatedProducts: string[];
}

export const SERVICES: ServiceContent[] = [
  {
    slug: 'web-development',
    icon: 'Globe',
    accent: '#60a5fa',
    title: { en: 'Web Development', ar: 'تطوير المواقع والويب' },
    summary: {
      en: 'Fast, modern web applications and marketing sites built with React and Next.js.',
      ar: 'تطبيقات ومواقع ويب حديثة وسريعة مبنية بتقنيات React وNext.js.',
    },
    seoTitle: {
      en: 'Web Development Services | Handla',
      ar: 'خدمات تطوير المواقع والويب | هاندلا',
    },
    seoDescription: {
      en: 'Custom web development with React, Next.js and TypeScript — responsive marketing sites, dashboards and full-stack web applications built for performance.',
      ar: 'تطوير مواقع وتطبيقات ويب مخصّصة باستخدام React وNext.js وTypeScript — مواقع تسويقية ولوحات تحكم وتطبيقات متكاملة عالية الأداء.',
    },
    intro: {
      en: 'Handla designs and builds web applications and marketing websites that are fast, responsive and easy to maintain — from a single landing page to a full-stack product with authentication, dashboards and real-time features.',
      ar: 'تصمّم هاندلا وتبني تطبيقات ومواقع ويب سريعة ومتجاوبة وسهلة الصيانة — من صفحة هبوط واحدة إلى منتج متكامل يشمل تسجيل الدخول ولوحات التحكم والميزات الفورية.',
    },
    audience: {
      en: [
        'Businesses that need a professional, high-performance website.',
        'Teams launching a web-based product or internal dashboard.',
        'Organizations replacing a slow or outdated site.',
      ],
      ar: [
        'الشركات التي تحتاج موقعاً احترافياً عالي الأداء.',
        'الفرق التي تطلق منتجاً على الويب أو لوحة تحكم داخلية.',
        'المؤسسات التي تستبدل موقعاً بطيئاً أو قديماً.',
      ],
    },
    deliverables: {
      en: [
        'Responsive, accessible UI that matches your brand.',
        'Full-stack features: auth, APIs, dashboards, integrations.',
        'SEO-ready, server-rendered pages and clean performance.',
      ],
      ar: [
        'واجهة متجاوبة وسهلة الوصول تعكس هوية علامتك.',
        'ميزات متكاملة: تسجيل الدخول وواجهات برمجية ولوحات تحكم وتكاملات.',
        'صفحات مهيأة لمحركات البحث ومُخدّمة من الخادم بأداء نظيف.',
      ],
    },
    capabilities: ['React', 'Next.js', 'TypeScript', 'Node.js', 'PostgreSQL', 'REST APIs'],
    relatedProducts: ['madar', 'matjary'],
  },
  {
    slug: 'mobile-app-development',
    icon: 'Smartphone',
    accent: '#34d399',
    title: { en: 'Mobile App Development', ar: 'تطوير تطبيقات الجوال' },
    summary: {
      en: 'Cross-platform iOS and Android apps built from a single, maintainable codebase.',
      ar: 'تطبيقات iOS وأندرويد عبر منصة واحدة قابلة للصيانة وبأداء متسق.',
    },
    seoTitle: {
      en: 'Mobile App Development Services | Handla',
      ar: 'خدمات تطوير تطبيقات الجوال | هاندلا',
    },
    seoDescription: {
      en: 'Cross-platform mobile app development for iOS and Android — native-quality experiences from one codebase, integrated with your web platform and APIs.',
      ar: 'تطوير تطبيقات جوال لنظامي iOS وأندرويد — تجربة بجودة أصلية من قاعدة كود واحدة، متكاملة مع منصتك على الويب وواجهاتك البرمجية.',
    },
    intro: {
      en: 'Handla builds mobile applications that share logic with your web platform, so features and data stay consistent across every device — including dedicated companion apps like the Manarah parent and student apps.',
      ar: 'تبني هاندلا تطبيقات جوال تشارك المنطق مع منصتك على الويب، لتبقى الميزات والبيانات متسقة عبر كل جهاز — بما في ذلك تطبيقات مرافقة مثل تطبيقَي ولي الأمر والطالب في منارة.',
    },
    audience: {
      en: [
        'Products that need a companion mobile experience.',
        'Businesses reaching customers primarily on mobile.',
        'Teams that want one codebase for iOS and Android.',
      ],
      ar: [
        'المنتجات التي تحتاج تجربة جوال مرافقة.',
        'الشركات التي تصل إلى عملائها عبر الجوال بشكل أساسي.',
        'الفرق التي تريد قاعدة كود واحدة لنظامي iOS وأندرويد.',
      ],
    },
    deliverables: {
      en: [
        'iOS and Android apps from one shared codebase.',
        'Integration with your existing APIs and accounts.',
        'App store preparation and release support.',
      ],
      ar: [
        'تطبيقات iOS وأندرويد من قاعدة كود واحدة مشتركة.',
        'التكامل مع واجهاتك البرمجية وحساباتك الحالية.',
        'تجهيز متاجر التطبيقات ودعم الإصدار.',
      ],
    },
    capabilities: ['React Native', 'iOS', 'Android', 'Push Notifications', 'REST APIs'],
    relatedProducts: ['manarah'],
  },
  {
    slug: 'erp-crm',
    icon: 'BarChart3',
    accent: '#fbbf24',
    title: { en: 'ERP & CRM Systems', ar: 'أنظمة ERP وإدارة العملاء' },
    summary: {
      en: 'Connected systems for operations, finance and customer relationships.',
      ar: 'أنظمة مترابطة للعمليات والمالية وإدارة علاقات العملاء.',
    },
    seoTitle: {
      en: 'ERP & CRM Systems | Handla',
      ar: 'أنظمة ERP وإدارة علاقات العملاء | هاندلا',
    },
    seoDescription: {
      en: 'ERP and CRM systems for clients, projects, invoicing, inventory and reporting - including the Madar and Manarah platforms, tailored to your workflow.',
      ar: 'أنظمة ERP وCRM لإدارة العملاء والمشاريع والفوترة والمخزون والتقارير — بما في ذلك منصتا مدار ومنارة من هاندلا، مصمّمة وفق سير عملك.',
    },
    intro: {
      en: 'Handla builds Enterprise Resource Planning and CRM systems that connect the moving parts of a business — clients, projects, quotations, contracts, invoices, expenses, inventory and reporting — in one coherent platform, drawing on our own Madar and Manarah products.',
      ar: 'تبني هاندلا أنظمة تخطيط موارد المؤسسات وإدارة علاقات العملاء التي تربط أجزاء العمل المختلفة — العملاء والمشاريع وعروض الأسعار والعقود والفواتير والمصروفات والمخزون والتقارير — في منصة واحدة متكاملة، مستفيدةً من منتجَي مدار ومنارة.',
    },
    audience: {
      en: [
        'Companies outgrowing spreadsheets and disconnected tools.',
        'Service businesses managing clients, projects and invoicing.',
        'Schools and organizations needing sector-specific ERP.',
      ],
      ar: [
        'الشركات التي تجاوزت جداول البيانات والأدوات المتفرقة.',
        'الشركات الخدمية التي تدير العملاء والمشاريع والفوترة.',
        'المدارس والمؤسسات التي تحتاج نظام ERP متخصصاً.',
      ],
    },
    deliverables: {
      en: [
        'A unified data model across departments.',
        'Clients, projects, quotations, contracts and invoicing.',
        'Inventory, expenses and operational reporting.',
      ],
      ar: [
        'نموذج بيانات موحّد عبر الأقسام.',
        'العملاء والمشاريع وعروض الأسعار والعقود والفوترة.',
        'المخزون والمصروفات والتقارير التشغيلية.',
      ],
    },
    capabilities: ['ERP', 'CRM', 'Invoicing', 'Inventory', 'Reporting', 'Role-based access'],
    relatedProducts: ['madar', 'manarah', 'matjary'],
  },
  {
    slug: 'custom-software',
    icon: 'Code2',
    accent: '#a78bfa',
    title: { en: 'Custom Software Development', ar: 'تطوير البرمجيات المخصّصة' },
    summary: {
      en: 'Bespoke software built around your exact process, not the other way around.',
      ar: 'برمجيات مصمّمة حول عملياتك بالضبط، لا العكس.',
    },
    seoTitle: {
      en: 'Custom Software Development | Handla',
      ar: 'تطوير البرمجيات المخصّصة | هاندلا',
    },
    seoDescription: {
      en: 'Custom software development for unique workflows — from internal tools and automations to full SaaS products, designed, built and integrated by Handla.',
      ar: 'تطوير برمجيات مخصّصة لسير العمل الفريد — من الأدوات الداخلية والأتمتة إلى منتجات SaaS كاملة، تصمّمها وتبنيها وتدمجها هاندلا.',
    },
    intro: {
      en: 'When off-the-shelf tools do not fit, Handla designs and builds custom software around your exact process — internal tools, automations, portals and full SaaS products — integrated cleanly with the systems you already use.',
      ar: 'عندما لا تناسبك الأدوات الجاهزة، تصمّم هاندلا وتبني برمجيات مخصّصة حول عملياتك بالضبط — أدوات داخلية وأتمتة وبوابات ومنتجات SaaS كاملة — مدمجة بسلاسة مع الأنظمة التي تستخدمها.',
    },
    audience: {
      en: [
        'Teams with a workflow no existing product supports.',
        'Businesses automating manual, repetitive processes.',
        'Founders building a new SaaS product.',
      ],
      ar: [
        'الفرق التي لديها سير عمل لا يدعمه أي منتج قائم.',
        'الشركات التي تُؤتمت العمليات اليدوية المتكرّرة.',
        'المؤسّسون الذين يبنون منتج SaaS جديداً.',
      ],
    },
    deliverables: {
      en: [
        'Discovery and technical design for your process.',
        'A tailored application built and integrated end-to-end.',
        'Documentation and support for your team.',
      ],
      ar: [
        'دراسة وتصميم تقني يناسب عمليتك.',
        'تطبيق مخصّص مبني ومدمج من البداية إلى النهاية.',
        'توثيق ودعم لفريقك.',
      ],
    },
    capabilities: ['Custom SaaS', 'Automation', 'Integrations', 'APIs', 'Cloud'],
    relatedProducts: ['madar', 'manarah', 'matjary'],
  },
  {
    slug: 'cloud-infrastructure',
    icon: 'Cloud',
    accent: '#22d3ee',
    title: { en: 'Cloud Infrastructure', ar: 'البنية السحابية' },
    summary: {
      en: 'Reliable hosting, deployment and infrastructure for your applications.',
      ar: 'استضافة ونشر وبنية تحتية موثوقة لتطبيقاتك.',
    },
    seoTitle: {
      en: 'Cloud Infrastructure & Hosting | Handla',
      ar: 'البنية السحابية والاستضافة | هاندلا',
    },
    seoDescription: {
      en: 'Cloud infrastructure, hosting and deployment for web and mobile apps — containerized deployments, CI/CD and monitoring to keep your product running reliably.',
      ar: 'بنية سحابية واستضافة ونشر لتطبيقات الويب والجوال — نشر بالحاويات وCI/CD ومراقبة للحفاظ على تشغيل منتجك بموثوقية.',
    },
    intro: {
      en: 'Handla sets up and maintains the infrastructure your applications run on — containerized deployments, continuous delivery and monitoring — so your product stays fast, secure and reliably online.',
      ar: 'تُعِدّ هاندلا وتُدير البنية التي تعمل عليها تطبيقاتك — نشر بالحاويات وتسليم مستمر ومراقبة — ليبقى منتجك سريعاً وآمناً ومتاحاً بموثوقية.',
    },
    audience: {
      en: [
        'Teams deploying web or mobile back-ends.',
        'Products that need dependable, scalable hosting.',
        'Businesses wanting automated, repeatable deployments.',
      ],
      ar: [
        'الفرق التي تنشر خدمات خلفية للويب أو الجوال.',
        'المنتجات التي تحتاج استضافة موثوقة وقابلة للتوسّع.',
        'الشركات التي تريد نشراً آلياً قابلاً للتكرار.',
      ],
    },
    deliverables: {
      en: [
        'Containerized deployment with CI/CD pipelines.',
        'Environment setup, domains and TLS.',
        'Monitoring and reliability improvements.',
      ],
      ar: [
        'نشر بالحاويات مع مسارات CI/CD.',
        'إعداد البيئات والنطاقات وشهادات TLS.',
        'مراقبة وتحسينات للموثوقية.',
      ],
    },
    capabilities: ['Docker', 'CI/CD', 'AWS', 'Traefik', 'Monitoring'],
    relatedProducts: [],
  },
];

export const SERVICE_SLUGS = SERVICES.map((s) => s.slug);

export function getService(slug: string): ServiceContent | undefined {
  return SERVICES.find((s) => s.slug === slug);
}
