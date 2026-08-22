/**
 * Genuine Handla service definitions used to build the localized service
 * landing pages (/[locale]/services and /[locale]/services/[slug]).
 *
 * This is the SINGLE SOURCE OF TRUTH for the Handla service catalog. It
 * contains exactly the 8 real services Handla currently offers, in the same
 * order and with the same names shown in the homepage Services section
 * (components/landing/ServicesBento.tsx) and the localization files
 * (public/locales/{en,ar}/common.json → "services").
 *
 * The canonical 8 services are:
 *   1. Web Development            (web-development)
 *   2. ERP & CRM Systems          (erp-crm)
 *   3. Mobile Applications        (mobile-applications)
 *   4. Cloud Infrastructure       (cloud-infrastructure)
 *   5. Video Editing              (video-editing)
 *   6. Podcast Editing            (podcast-editing)
 *   7. Design & Visual Identity   (design-visual-identity)
 *   8. Strategy & Marketing       (strategy-marketing)
 *
 * No service is invented, and no fabricated client results, statistics,
 * prices, timelines, reviews or certifications appear — only genuine
 * descriptive capability copy that already exists in the site's content.
 *
 * NOTE — catalog scope (do not expand without an explicit request):
 *   • "API Development" and "Consulting" are NOT standalone services. They
 *     survive only as leftover translation keys (services.api / services.
 *     consulting) and are intentionally NOT part of this catalog, so they are
 *     never listed, never get a detail page and never appear in the sitemap.
 *   • "Custom Software" was a slug introduced during the SEO migration. It is
 *     NOT one of the 8 real services; its genuine copy has been folded into
 *     ERP & CRM Systems and Web Development, and /services/custom-software now
 *     permanently redirects to /services/erp-crm (see next.config.js).
 *   • The previous "mobile-app-development" slug is renamed to the canonical
 *     "mobile-applications"; the old slug 308-redirects to the new one.
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
    title: { en: 'Web Development', ar: 'تطوير الويب' },
    summary: {
      en: 'Fast, modern web applications and marketing sites built with React and Next.js.',
      ar: 'تطبيقات ومواقع ويب حديثة وسريعة مبنية بتقنيات React وNext.js.',
    },
    seoTitle: {
      en: 'Web Development Services | Handla',
      ar: 'خدمات تطوير الويب | هاندلا',
    },
    seoDescription: {
      en: 'Custom web development with React, Next.js and TypeScript — responsive marketing sites, dashboards, custom internal tools and full-stack web applications built for performance.',
      ar: 'تطوير مواقع وتطبيقات ويب مخصّصة باستخدام React وNext.js وTypeScript — مواقع تسويقية ولوحات تحكم وأدوات داخلية وتطبيقات متكاملة عالية الأداء.',
    },
    intro: {
      en: 'Handla designs and builds web applications and marketing websites that are fast, responsive and easy to maintain — from a single landing page to a full-stack product with authentication, dashboards, custom internal tools and real-time features.',
      ar: 'تصمّم هاندلا وتبني تطبيقات ومواقع ويب سريعة ومتجاوبة وسهلة الصيانة — من صفحة هبوط واحدة إلى منتج متكامل يشمل تسجيل الدخول ولوحات التحكم والأدوات الداخلية المخصّصة والميزات الفورية.',
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
    slug: 'erp-crm',
    icon: 'BarChart3',
    accent: '#fbbf24',
    title: { en: 'ERP & CRM Systems', ar: 'أنظمة ERP وCRM' },
    summary: {
      en: 'Connected systems for operations, finance and customer relationships.',
      ar: 'أنظمة مترابطة للعمليات والمالية وإدارة علاقات العملاء.',
    },
    seoTitle: {
      en: 'ERP & CRM Systems | Handla',
      ar: 'أنظمة ERP وCRM | هاندلا',
    },
    seoDescription: {
      en: 'ERP and CRM systems for clients, projects, invoicing, inventory and reporting — including the Madar and Manarah platforms and bespoke systems tailored to your exact workflow.',
      ar: 'أنظمة ERP وCRM لإدارة العملاء والمشاريع والفوترة والمخزون والتقارير — بما في ذلك منصتا مدار ومنارة وأنظمة مخصّصة مصمّمة وفق سير عملك بالضبط.',
    },
    intro: {
      en: 'Handla builds Enterprise Resource Planning and CRM systems that connect the moving parts of a business — clients, projects, quotations, contracts, invoices, expenses, inventory and reporting — in one coherent platform. When off-the-shelf tools do not fit, we build the system around your exact process, drawing on our own Madar and Manarah products.',
      ar: 'تبني هاندلا أنظمة تخطيط موارد المؤسسات وإدارة علاقات العملاء التي تربط أجزاء العمل المختلفة — العملاء والمشاريع وعروض الأسعار والعقود والفواتير والمصروفات والمخزون والتقارير — في منصة واحدة متكاملة. وعندما لا تناسبك الأدوات الجاهزة، نبني النظام حول عملياتك بالضبط، مستفيدين من منتجَي مدار ومنارة.',
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
    capabilities: ['ERP', 'CRM', 'Invoicing', 'Inventory', 'Reporting', 'Role-based access', 'Custom workflows'],
    relatedProducts: ['madar', 'manarah', 'matjary'],
  },
  {
    slug: 'mobile-applications',
    icon: 'Smartphone',
    accent: '#34d399',
    title: { en: 'Mobile Applications', ar: 'تطبيقات الجوال' },
    summary: {
      en: 'Cross-platform iOS and Android apps built from a single, maintainable codebase.',
      ar: 'تطبيقات iOS وأندرويد عبر منصة واحدة قابلة للصيانة وبأداء متسق.',
    },
    seoTitle: {
      en: 'Mobile Application Development | Handla',
      ar: 'تطوير تطبيقات الجوال | هاندلا',
    },
    seoDescription: {
      en: 'Cross-platform mobile applications for iOS and Android — native-quality experiences from one codebase, integrated with your web platform and APIs.',
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
    slug: 'cloud-infrastructure',
    icon: 'Cloud',
    accent: '#a78bfa',
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
  {
    slug: 'video-editing',
    icon: 'Video',
    accent: '#f472b6',
    title: { en: 'Video Editing', ar: 'مونتاج الفيديو' },
    summary: {
      en: 'Professional video editing with engaging pacing and polished visual touches for every platform.',
      ar: 'مونتاج احترافي للمحتوى المرئي بإيقاع جذاب ولمسات بصرية تعزز جودة المحتوى وتناسب مختلف المنصات.',
    },
    seoTitle: {
      en: 'Video Editing Services | Handla',
      ar: 'خدمات مونتاج الفيديو | هاندلا',
    },
    seoDescription: {
      en: 'Professional video editing for social reels, long-form videos and motion graphics — engaging pacing and polished visuals tailored to each platform.',
      ar: 'مونتاج احترافي للفيديو للريلز القصيرة والمحتوى الطويل والموشن جرافيك — بإيقاع جذاب ولمسات بصرية متقنة تناسب كل منصة.',
    },
    intro: {
      en: 'Handla edits and finishes video content with engaging pacing, clean cuts and polished visual touches — from short social reels to long-form videos and motion graphics — so your message lands well on every platform.',
      ar: 'تُحرّر هاندلا المحتوى المرئي وتُخرجه بإيقاع جذاب وقطع نظيف ولمسات بصرية متقنة — من الريلز القصيرة إلى المحتوى الطويل والموشن جرافيك — ليصل محتواك بأفضل صورة على كل منصة.',
    },
    audience: {
      en: [
        'Brands producing regular social video content.',
        'Teams that need reels, ads or long-form videos edited.',
        'Creators wanting a consistent, polished visual style.',
      ],
      ar: [
        'العلامات التي تنتج محتوى فيديو اجتماعياً بانتظام.',
        'الفرق التي تحتاج مونتاج ريلز أو إعلانات أو فيديوهات طويلة.',
        'صنّاع المحتوى الراغبون في أسلوب بصري متقن ومتسق.',
      ],
    },
    deliverables: {
      en: [
        'Short-form reels and platform-ready cuts.',
        'Long-form video editing and structure.',
        'Motion graphics and on-screen text.',
      ],
      ar: [
        'ريلز قصيرة ومقاطع جاهزة للنشر على المنصات.',
        'مونتاج وهيكلة للفيديوهات الطويلة.',
        'موشن جرافيك ونصوص على الشاشة.',
      ],
    },
    capabilities: ['Reels', 'Long-form Video', 'Motion Graphics', 'Color', 'Subtitles'],
    relatedProducts: [],
  },
  {
    slug: 'podcast-editing',
    icon: 'Mic',
    accent: '#22d3ee',
    title: { en: 'Podcast Editing', ar: 'مونتاج البودكاست' },
    summary: {
      en: 'Professional podcast editing and production focused on clear content and a consistent viewing experience.',
      ar: 'تحرير وإخراج حلقات البودكاست بصورة احترافية تجمع بين جودة المشاهدة ووضوح المحتوى وتجربة بصرية متسقة.',
    },
    seoTitle: {
      en: 'Podcast Editing & Production | Handla',
      ar: 'مونتاج وإخراج البودكاست | هاندلا',
    },
    seoDescription: {
      en: 'Professional podcast editing and production for video and audio podcasts — clean audio, structured episodes and short social clips that keep your show consistent.',
      ar: 'تحرير وإخراج احترافي للبودكاست المرئي والصوتي — صوت نظيف وحلقات منظمة ومقاطع قصيرة للنشر تحافظ على اتساق برنامجك.',
    },
    intro: {
      en: 'Handla edits and produces podcast episodes — video and audio — with clean sound, clear structure and a consistent look, and cuts short clips from each episode to help your show reach a wider audience.',
      ar: 'تُحرّر هاندلا حلقات البودكاست وتُخرجها — مرئية وصوتية — بصوت نظيف وهيكل واضح ومظهر متسق، وتستخرج مقاطع قصيرة من كل حلقة لمساعدة برنامجك على الوصول إلى جمهور أوسع.',
    },
    audience: {
      en: [
        'Hosts producing a regular video or audio podcast.',
        'Brands running a show as part of their content.',
        'Teams that need episodes and clips edited consistently.',
      ],
      ar: [
        'مقدّمو برامج بودكاست مرئية أو صوتية بشكل منتظم.',
        'العلامات التي تُنتج برنامجاً ضمن محتواها.',
        'الفرق التي تحتاج مونتاجاً متسقاً للحلقات والمقاطع.',
      ],
    },
    deliverables: {
      en: [
        'Full episode editing for video and audio.',
        'Clean audio and consistent visual framing.',
        'Short social clips from each episode.',
      ],
      ar: [
        'مونتاج كامل للحلقات المرئية والصوتية.',
        'صوت نظيف وإطار بصري متسق.',
        'مقاطع قصيرة للنشر من كل حلقة.',
      ],
    },
    capabilities: ['Video Podcast', 'Audio Cleanup', 'Episode Editing', 'Short Clips', 'Subtitles'],
    relatedProducts: [],
  },
  {
    slug: 'design-visual-identity',
    icon: 'Palette',
    accent: '#fb923c',
    title: { en: 'Design & Visual Identity', ar: 'التصميم والهوية البصرية' },
    summary: {
      en: 'Cohesive visual identities that give brands a distinctive, consistent presence across every touchpoint.',
      ar: 'نبني هوية بصرية متكاملة تمنح علامتك حضوراً مميزاً ومتناسقاً عبر مختلف نقاط التواصل.',
    },
    seoTitle: {
      en: 'Design & Visual Identity | Handla',
      ar: 'التصميم والهوية البصرية | هاندلا',
    },
    seoDescription: {
      en: 'Brand and visual identity design — logos, brand systems and social media design that give your brand a distinctive, consistent presence across every touchpoint.',
      ar: 'تصميم الهوية البصرية والعلامة — شعارات وأنظمة هوية وتصاميم للسوشيال ميديا تمنح علامتك حضوراً مميزاً ومتناسقاً عبر كل نقاط التواصل.',
    },
    intro: {
      en: 'Handla builds cohesive visual identities — logos, brand systems and social media design — that give your brand a distinctive, consistent presence across your website, product and channels.',
      ar: 'تبني هاندلا هوية بصرية متكاملة — شعارات وأنظمة هوية وتصاميم للسوشيال ميديا — تمنح علامتك حضوراً مميزاً ومتناسقاً عبر موقعك ومنتجك وقنواتك.',
    },
    audience: {
      en: [
        'New brands defining their look from scratch.',
        'Businesses refreshing an inconsistent visual identity.',
        'Teams that need ongoing social media design.',
      ],
      ar: [
        'العلامات الجديدة التي تحدّد مظهرها من الصفر.',
        'الشركات التي تجدّد هوية بصرية غير متسقة.',
        'الفرق التي تحتاج تصاميم مستمرة للسوشيال ميديا.',
      ],
    },
    deliverables: {
      en: [
        'Logo and core brand identity.',
        'A reusable visual system and guidelines.',
        'Social media and marketing design assets.',
      ],
      ar: [
        'الشعار والهوية الأساسية للعلامة.',
        'نظام بصري قابل لإعادة الاستخدام مع إرشادات.',
        'أصول تصميم للسوشيال ميديا والتسويق.',
      ],
    },
    capabilities: ['Logo', 'Brand Identity', 'Brand Guidelines', 'Social Design'],
    relatedProducts: [],
  },
  {
    slug: 'strategy-marketing',
    icon: 'TrendingUp',
    accent: '#4ade80',
    title: { en: 'Strategy & Marketing', ar: 'الاستراتيجية والتسويق' },
    summary: {
      en: 'Clear strategies that define the right audience, content and channels for sustainable growth.',
      ar: 'نحوّل أهداف علامتك إلى استراتيجية واضحة تحدد الجمهور والمحتوى والقنوات المناسبة للنمو.',
    },
    seoTitle: {
      en: 'Strategy & Marketing | Handla',
      ar: 'الاستراتيجية والتسويق | هاندلا',
    },
    seoDescription: {
      en: 'Brand strategy and marketing planning — audience definition, content direction and channel planning that turn your goals into a clear, sustainable growth plan.',
      ar: 'استراتيجية العلامة والتخطيط التسويقي — تحديد الجمهور واتجاه المحتوى وتخطيط القنوات لتحويل أهدافك إلى خطة نمو واضحة ومستدامة.',
    },
    intro: {
      en: 'Handla turns your brand goals into a clear strategy — defining the right audience, content direction and channels — and a marketing and launch plan you can act on for sustainable growth.',
      ar: 'تحوّل هاندلا أهداف علامتك إلى استراتيجية واضحة — تحدد الجمهور المناسب واتجاه المحتوى والقنوات — وخطة تسويق وإطلاق قابلة للتنفيذ من أجل نمو مستدام.',
    },
    audience: {
      en: [
        'Brands launching a new product or service.',
        'Businesses without a clear marketing direction.',
        'Teams that need an actionable content and channel plan.',
      ],
      ar: [
        'العلامات التي تطلق منتجاً أو خدمة جديدة.',
        'الشركات التي تفتقر إلى اتجاه تسويقي واضح.',
        'الفرق التي تحتاج خطة محتوى وقنوات قابلة للتنفيذ.',
      ],
    },
    deliverables: {
      en: [
        'Brand strategy and audience definition.',
        'Content direction and channel plan.',
        'A marketing and launch plan.',
      ],
      ar: [
        'استراتيجية العلامة وتحديد الجمهور.',
        'اتجاه المحتوى وخطة القنوات.',
        'خطة تسويق وإطلاق.',
      ],
    },
    capabilities: ['Brand Strategy', 'Marketing Plan', 'Content Strategy', 'Launch Plan'],
    relatedProducts: [],
  },
];

export const SERVICE_SLUGS = SERVICES.map((s) => s.slug);

export function getService(slug: string): ServiceContent | undefined {
  return SERVICES.find((s) => s.slug === slug);
}
