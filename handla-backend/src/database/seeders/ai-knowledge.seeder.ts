import { AppDataSource } from '../../config/data-source';
import { KnowledgeEntry } from '../../modules/ai/entities/knowledge-entry.entity';
import { KnowledgeCategory } from '../../common/enums';

/**
 * AiKnowledgeSeeder
 * ─────────────────
 * Idempotent, NON-DESTRUCTIVE seeder for the Handla AI Assistant Knowledge Base
 * (table `ai_knowledge_entries`). The assistant answers ONLY from ACTIVE entries
 * in this table (strict no-hallucination policy — see PromptService), so this is
 * the curated source of truth that lets the bot answer client questions about
 * Handla, its services, products, projects, process, pricing approach and how to
 * get in touch.
 *
 * EVERY fact below is grounded in the real website content:
 *   • Services  → src/i18n/services-data.ts (the canonical 8 services)
 *   • Products  → src/content/products/{madar,matjary,manarah}.tsx
 *   • Projects  → website-projects.seeder.ts (Tameer Home, Homy Perfumes, Emdad)
 *   • Company / process / contact → public/locales/en/common.json
 * No prices, timelines, client results, statistics, certifications or
 * partnerships are invented. Pricing/timeline entries deliberately defer the
 * specifics to a human specialist, matching the assistant's guardrails.
 *
 * Safety guarantees:
 *   • Upsert-by-stable-key (the English `title`) → re-running never duplicates;
 *     it refreshes the existing row in place.
 *   • NEVER truncates or deletes. Any KB rows an admin added by hand in the ERP
 *     (AI Assistant → Knowledge Base) that are NOT in this list are left
 *     completely untouched.
 *   • Emdad confidentiality respected: only the public-safe description is used;
 *     no Brand-Guidelines content, no client identities beyond the public name.
 *
 * Run it with:
 *   npm run seed:ai-knowledge
 * (or, in production, inside the backend container:
 *   node dist/database/seeders/ai-knowledge.seeder.js)
 */

// The `title` is the STABLE UPSERT KEY — changing it creates a new row instead
// of updating the existing one. `tags` drive the lightweight lexical retriever,
// so they include the words a client is likely to type.
type KnowledgeSeed = {
  title: string;
  content: string;
  category: KnowledgeCategory;
  tags: string;
  priority?: number;
  product?: string | null;
};

const SEED_ENTRIES: KnowledgeSeed[] = [
  // ─── COMPANY ────────────────────────────────────────────────────────────────
  {
    title: 'What is Handla?',
    content:
      'Handla is a modern software company that designs, develops and deploys digital systems for businesses, schools and growing organizations. We build custom software, ERP and CRM systems, SaaS platforms, websites and mobile applications, and we also offer video editing, podcast editing, design & visual identity, and strategy & marketing. We partner with clients from the first idea through design, development, launch and ongoing support.',
    category: KnowledgeCategory.COMPANY,
    tags: 'handla, هاندلا, about, who are you, company, what do you do, software house, overview, services, من انتم, ما هي هاندلا, من هي هاندلا, عن الشركة, ماذا تفعلون, شركة برمجيات',
    priority: 100,
  },
  {
    title: 'What does Handla offer? (services and products)',
    content:
      'Handla offers eight services: Web Development, ERP & CRM Systems, Mobile Applications, Cloud Infrastructure, Video Editing, Podcast Editing, Design & Visual Identity, and Strategy & Marketing. Handla also has three of its own SaaS products: Madar (business & agency management ERP), Matjary (commerce platform with online store and POS), and Manarah (school management system for K–12). We can build a fully custom system or adapt one of these products to your needs.',
    category: KnowledgeCategory.COMPANY,
    tags: 'services, products, offerings, capabilities, what can you build, list, madar, matjary, manarah, الخدمات, المنتجات, ماذا تقدمون, ما هي خدماتكم, ماذا تبنون, قائمة الخدمات',
    priority: 95,
  },
  {
    title: 'Handla mission and approach',
    content:
      'Handla’s mission is to make world-class software development accessible to businesses of all sizes. We focus on quality, transparency and long-term partnership: real-time progress updates, open communication, and solutions designed to deliver measurable business impact. We build software we are proud of and support it after launch.',
    category: KnowledgeCategory.COMPANY,
    tags: 'mission, values, approach, why handla, quality, transparency, partnership, الرؤية, الرسالة, القيم, لماذا هاندلا, الجودة, الشفافية, الشراكة',
    priority: 60,
  },
  {
    title: 'What languages does Handla work in?',
    content:
      'Handla works in both Arabic and English. Our website, products (Madar, Matjary, Manarah) and the systems we build are bilingual (Arabic / English), and our team — and this assistant — can communicate with you in either language. If you write in Arabic, we reply in Arabic; if you write in English, we reply in English.',
    category: KnowledgeCategory.COMPANY,
    tags: 'language, arabic, english, bilingual, عربي, انجليزي, ثنائي اللغة, هل تتحدثون العربية, بالعربي, باللغة العربية, لغة',
    priority: 50,
  },

  // ─── SERVICES (8 canonical) ───────────────────────────────────────────────────
  {
    title: 'Service: Web Development',
    content:
      'Handla designs and builds fast, responsive, easy-to-maintain web applications and marketing websites — from a single landing page to a full-stack product with authentication, dashboards, custom internal tools and real-time features. Deliverables include responsive accessible UI that matches your brand, full-stack features (auth, APIs, dashboards, integrations) and SEO-ready, server-rendered pages. Typical tech: React, Next.js, TypeScript, Node.js, PostgreSQL and REST APIs.',
    category: KnowledgeCategory.OTHER,
    tags: 'web development, website, web app, react, nextjs, next.js, frontend, backend, full-stack, landing page, dashboard, تطوير المواقع, تطوير الويب, موقع الكتروني, تصميم موقع, تطبيق ويب, صفحة هبوط, لوحة تحكم',
    priority: 80,
  },
  {
    title: 'Service: ERP & CRM Systems',
    content:
      'Handla builds ERP and CRM systems that connect the moving parts of a business — clients, projects, quotations, contracts, invoices, expenses, inventory and reporting — in one coherent platform. When off-the-shelf tools do not fit, we build the system around your exact process, drawing on our own Madar and Manarah products. Deliverables include a unified data model across departments, clients/projects/quotations/contracts/invoicing, and inventory, expenses and operational reporting with role-based access and custom workflows.',
    category: KnowledgeCategory.OTHER,
    tags: 'erp, crm, business system, invoicing, inventory, reporting, custom software, operations, finance, workflows, نظام erp, نظام تخطيط موارد, ادارة علاقات العملاء, نظام محاسبة, فواتير, مخزون, تقارير, برمجيات مخصصة, ادارة الاعمال',
    priority: 80,
  },
  {
    title: 'Service: Mobile Applications',
    content:
      'Handla builds cross-platform iOS and Android apps from a single, maintainable codebase (React Native), sharing logic with your web platform so features and data stay consistent across devices — including dedicated companion apps like the Manarah parent and student apps. Deliverables include iOS and Android apps from one shared codebase, integration with your existing APIs and accounts, and app store preparation and release support.',
    category: KnowledgeCategory.OTHER,
    tags: 'mobile, app, ios, android, react native, cross-platform, application, mobile app, تطبيق جوال, تطبيق موبايل, تطبيقات الهاتف, ايفون, اندرويد, تطبيق ايفون, تطبيق اندرويد',
    priority: 80,
  },
  {
    title: 'Service: Cloud Infrastructure',
    content:
      'Handla sets up and maintains the infrastructure your applications run on — containerized deployments (Docker), continuous delivery (CI/CD), environment setup, domains and TLS, plus monitoring — so your product stays fast, secure and reliably online. Suited to teams deploying web or mobile back-ends and products that need dependable, scalable hosting.',
    category: KnowledgeCategory.OTHER,
    tags: 'cloud, hosting, infrastructure, devops, deployment, docker, ci/cd, aws, monitoring, servers, tls, domains, استضافة, البنية التحتية, السحابة, الحوسبة السحابية, خوادم, نشر, دومين, نطاق',
    priority: 70,
  },
  {
    title: 'Service: Video Editing',
    content:
      'Handla edits and finishes video content with engaging pacing, clean cuts and polished visual touches — from short social reels to long-form videos and motion graphics, with on-screen text and subtitles — so your message lands well on every platform. Ideal for brands producing regular social video, and teams needing reels, ads or long-form videos edited.',
    category: KnowledgeCategory.OTHER,
    tags: 'video, video editing, reels, montage, motion graphics, subtitles, social media video, ads, editing, مونتاج, تحرير فيديو, تعديل فيديو, ريلز, موشن جرافيك, ترجمة فيديو, اعلانات, فيديو سوشيال ميديا',
    priority: 60,
  },
  {
    title: 'Service: Podcast Editing',
    content:
      'Handla edits and produces podcast episodes — video and audio — with clean sound, clear structure and a consistent look, and cuts short clips from each episode to help your show reach a wider audience. Deliverables include full episode editing for video and audio, clean audio and consistent visual framing, and short social clips from each episode.',
    category: KnowledgeCategory.OTHER,
    tags: 'podcast, podcast editing, audio, episodes, audio cleanup, clips, show, video podcast, بودكاست, تحرير بودكاست, مونتاج بودكاست, صوت, حلقات, مقاطع, تنظيف الصوت',
    priority: 55,
  },
  {
    title: 'Service: Design & Visual Identity',
    content:
      'Handla builds cohesive visual identities — logos, brand systems and social media design — that give your brand a distinctive, consistent presence across your website, product and channels. Deliverables include a logo and core brand identity, a reusable visual system with guidelines, and social media and marketing design assets. Good for new brands defining their look and businesses refreshing an inconsistent identity.',
    category: KnowledgeCategory.OTHER,
    tags: 'design, branding, visual identity, logo, brand, guidelines, social media design, graphics, تصميم, هوية بصرية, شعار, لوجو, علامة تجارية, دليل الهوية, تصميم سوشيال ميديا, جرافيك',
    priority: 60,
  },
  {
    title: 'Service: Strategy & Marketing',
    content:
      'Handla turns your brand goals into a clear strategy — defining the right audience, content direction and channels — and a marketing and launch plan you can act on for sustainable growth. Deliverables include brand strategy and audience definition, content direction and channel plan, and a marketing and launch plan.',
    category: KnowledgeCategory.OTHER,
    tags: 'strategy, marketing, brand strategy, content, launch plan, growth, audience, channels, marketing plan, استراتيجية, تسويق, خطة تسويقية, محتوى, خطة اطلاق, نمو, جمهور, قنوات, تسويق رقمي',
    priority: 55,
  },

  // ─── PRODUCTS ───────────────────────────────────────────────────────────────
  {
    title: 'Product: Madar (business & agency management ERP)',
    content:
      'Madar (مُدار) is Handla’s all-in-one ERP for agencies and service businesses — run your whole agency from one place. It covers clients and client projects, projects with scope and tasks, quotations and proposals, contracts, invoices, orders and purchases, expenses, and financial reports (balance, ledger, profit, revenue, client, expense and Tax/VAT). It has 15+ modules, users & roles, a product catalog and a public website, is fully web-based and bilingual (Arabic / English). A view-only demo is available at /products/madar/demo.',
    category: KnowledgeCategory.PRODUCT,
    tags: 'madar, مدار, مُدار, erp, agency, business management, clients, projects, invoices, contracts, quotations, expenses, reports, demo, نظام مدار, ادارة الوكالات, ادارة الاعمال, عملاء, مشاريع, فواتير, عقود, عروض اسعار, مصروفات, تقارير, تجربة',
    priority: 85,
    product: 'madar',
  },
  {
    title: 'Product: Matjary (commerce platform + POS)',
    content:
      'Matjary (متجري) is Handla’s complete commerce platform — sell everywhere, manage from one place. It includes an online storefront, in-store POS, inventory across branches and warehouses, purchasing and shipping, customers & CRM, loyalty, coupons and marketing, product reviews, accounting, tax/VAT and rich analytics, plus CMS/blog/SEO, roles and webhooks. It is multi-tenant, Arabic-first and bilingual (Arabic / English), with 20+ modules. A view-only demo is available at /products/matjary/demo (including a store and a POS view).',
    category: KnowledgeCategory.PRODUCT,
    tags: 'matjary, متجري, ecommerce, e-commerce, store, online store, pos, point of sale, inventory, retail, shop, commerce, demo, متجر الكتروني, تجارة الكترونية, نقطة بيع, كاشير, مخزون, متجر, تسوق, تجربة',
    priority: 85,
    product: 'matjary',
  },
  {
    title: 'Product: Manarah (school management system, K–12)',
    content:
      'Manarah (منارة) is Handla’s all-in-one school management platform for K–12 — the whole school in sync. It covers students and enrollment, teachers and HR, classes/timetable/attendance, exams/grades/report cards, fees and finance, admissions, transportation, library and communication, analytics and a public school website — plus dedicated parent and student mobile apps. It has 15+ modules and is bilingual (Arabic / English). A view-only demo is available at /products/manarah/demo (with a mobile app view).',
    category: KnowledgeCategory.PRODUCT,
    tags: 'manarah, منارة, school, education, students, teachers, k-12, attendance, grades, report cards, parent app, student app, sms, school management, demo, نظام مدرسي, ادارة المدارس, تعليم, طلاب, معلمين, حضور, درجات, شهادات, تطبيق ولي الامر, تطبيق الطالب, تجربة',
    priority: 85,
    product: 'manarah',
  },
  {
    title: 'Can I try a demo of Handla’s products?',
    content:
      'Yes. Handla provides view-only demos of its products: Madar at /products/madar/demo, Matjary at /products/matjary/demo, and Manarah at /products/manarah/demo. These let you explore the modules and interface. To set up a live account or a tailored version for your organization, request a free consultation and a Handla specialist will help.',
    category: KnowledgeCategory.PRODUCT,
    tags: 'demo, trial, try, test, preview, madar, matjary, manarah, see it, sample, تجربة, نسخة تجريبية, جرب, معاينة, ديمو, عرض توضيحي',
    priority: 70,
  },

  // ─── PROJECTS (genuine portfolio) ─────────────────────────────────────────────
  {
    title: 'Project: Tameer Home',
    content:
      'Tameer Home is a live web platform that Handla designed, developed and deployed. Handla delivered the front-end experience, the back-end services and the hosting infrastructure behind the project. It is live at https://tameerhome.tech.',
    category: KnowledgeCategory.COMPANY,
    tags: 'tameer home, تعمير هوم, تعمير, project, portfolio, web platform, case study, example, work, client, مشروع, اعمال سابقة, نموذج عمل, معرض الاعمال',
    priority: 65,
  },
  {
    title: 'Project: Homy Perfumes',
    content:
      'Homy Perfumes is a live e-commerce storefront that Handla designed, developed and deployed. Handla delivered the customer-facing storefront, the supporting back-end and the hosting infrastructure behind the project. It is live at https://homyperfumes.com.',
    category: KnowledgeCategory.COMPANY,
    tags: 'homy perfumes, هومي للعطور, هومي, project, portfolio, ecommerce, e-commerce, store, case study, example, work, client, مشروع, متجر عطور, اعمال سابقة, معرض الاعمال',
    priority: 65,
  },
  {
    title: 'Project: Emdad (visual identity)',
    content:
      'Handla created the visual identity for Emdad (إمداد), a digital platform connecting energy solution providers with customers, through a clear, modern and recognizable brand system. This was a design & visual identity project.',
    category: KnowledgeCategory.COMPANY,
    tags: 'emdad, إمداد, امداد, project, portfolio, visual identity, branding, logo, energy, case study, example, work, مشروع, هوية بصرية, علامة تجارية, طاقة, اعمال سابقة',
    priority: 60,
  },
  {
    title: 'Does Handla have examples of past work?',
    content:
      'Yes. Handla’s public portfolio includes Tameer Home (a web platform, live at tameerhome.tech), Homy Perfumes (an e-commerce storefront, live at homyperfumes.com), and Emdad (a visual identity / branding project). You can see them on the Projects page of the website.',
    category: KnowledgeCategory.FAQ,
    tags: 'portfolio, examples, past work, projects, references, clients, case studies, who have you worked with, اعمال سابقة, معرض الاعمال, امثلة, مشاريع, نماذج, عملاء سابقين, مع من عملتم',
    priority: 60,
  },

  // ─── PROCESS ──────────────────────────────────────────────────────────────────
  {
    title: 'How does Handla work? (process)',
    content:
      'Handla follows a four-step process. 1) Discover — we dive into your business needs, goals and challenges to map the right solution. 2) Design — user-centered design with wireframes, prototypes and a clear product roadmap. 3) Build — agile development with regular demos, clean code and rigorous testing. 4) Launch — smooth deployment, training and ongoing support for long-term success.',
    category: KnowledgeCategory.PROCESS,
    tags: 'process, how it works, steps, discover, design, build, launch, methodology, workflow, phases, كيف تعملون, خطوات العمل, مراحل, منهجية, اكتشاف, تصميم, بناء, اطلاق, الية العمل',
    priority: 75,
  },
  {
    title: 'How do I get started with Handla?',
    content:
      'Getting started is easy: request a free consultation through the Contact section, or start a chat here. We discuss your requirements, propose a solution and timeline, then design, develop and deploy — with support afterward. Share what you are trying to build and a Handla specialist will guide you on the next steps.',
    category: KnowledgeCategory.PROCESS,
    tags: 'get started, start, begin, how do i, first step, consultation, kick off, onboarding, request, كيف ابدأ, البدء, ابدأ, اول خطوة, استشارة, استشارة مجانية, طلب, كيف اتواصل للبدء',
    priority: 80,
  },

  // ─── SUPPORT ────────────────────────────────────────────────────────────────
  {
    title: 'Does Handla provide support after launch?',
    content:
      'Yes — Handla offers ongoing support and maintenance after deployment. Support is part of how we work: we deploy, train your team and stay available to keep your product running well after launch.',
    category: KnowledgeCategory.FAQ,
    tags: 'support, maintenance, after launch, ongoing, help, sla, warranty, post-launch, updates, دعم فني, صيانة, بعد الاطلاق, دعم مستمر, مساعدة, ضمان, تحديثات',
    priority: 70,
  },

  // ─── PRICING (guidance only — NEVER final quotes) ─────────────────────────────
  {
    title: 'How much does a project cost? (pricing)',
    content:
      'Every project is scoped to your specific needs, so Handla provides a custom quote rather than fixed prices. Share your requirements through a free consultation and a Handla specialist will prepare a tailored proposal. The assistant cannot give a final price — a specialist will confirm pricing after understanding your scope.',
    category: KnowledgeCategory.PRICING,
    tags: 'price, pricing, cost, how much, quote, budget, fees, estimate, rates, expensive, cheap, سعر, اسعار, التكلفة, كم يكلف, كم السعر, عرض سعر, ميزانية, رسوم, تقدير, تكلفة المشروع',
    priority: 85,
  },
  {
    title: 'How long does a project take? (timeline)',
    content:
      'Timelines depend on the scope and complexity of your project, so Handla confirms a timeline as part of the proposal after the discovery step. The assistant cannot promise a specific delivery date — request a free consultation and a specialist will give you a realistic timeline for your scope.',
    category: KnowledgeCategory.PRICING,
    tags: 'timeline, how long, duration, delivery, time, deadline, when, schedule, eta, المدة, كم يستغرق, كم من الوقت, مدة التنفيذ, موعد التسليم, متى, الجدول الزمني',
    priority: 70,
  },

  // ─── CONTACT ──────────────────────────────────────────────────────────────────
  {
    title: 'How can I contact Handla / a human?',
    content:
      'You can reach the Handla team anytime through the Contact section on the website, or ask here in the chat to be connected with a team member. Handla typically responds within a couple of hours during business hours. If you would like, say “I’d like to talk to someone” and your request will be passed to the team.',
    category: KnowledgeCategory.FAQ,
    tags: 'contact, human, talk to someone, reach, get in touch, support, sales, phone, email, speak to a person, agent, تواصل, التواصل, كيف اتواصل, اريد التحدث مع شخص, موظف, مندوب, خدمة العملاء, رقم الهاتف, بريد الكتروني, تحدث مع انسان',
    priority: 90,
  },
  {
    title: 'Where is Handla / who does Handla serve?',
    content:
      'Handla builds software for businesses, schools and growing organizations, and works with clients in both Arabic and English. Projects are delivered remotely and hosted in the cloud, so Handla can work with clients regardless of location. For anything specific about availability in your region, a Handla specialist can confirm.',
    category: KnowledgeCategory.COMPANY,
    tags: 'location, where, country, region, remote, area served, serve, based, worldwide, الموقع, اين, اين تقع, الدولة, المنطقة, عن بعد, من تخدمون, نطاق الخدمة, عالمي',
    priority: 45,
  },

  // ─── POLICY / SAFETY ──────────────────────────────────────────────────────────
  {
    title: 'What the assistant should not promise',
    content:
      'The Handla assistant helps with information and connecting you to the team. It does not issue binding quotes, contracts, discounts or guaranteed delivery dates — those are always confirmed by a Handla specialist. For confidential client details beyond what is public on the website, the assistant will connect you with a person instead of sharing them.',
    category: KnowledgeCategory.POLICY,
    tags: 'policy, cannot, disclaimer, binding, quote, contract, discount, guarantee, confidential, limits, سياسة, لا يمكن, عرض ملزم, عقد, خصم, ضمان, سري, حدود',
    priority: 30,
  },
];

/**
 * Upsert a single KB entry by its stable `title` key.
 * - If a row with the same title exists, its content/category/tags/priority/
 *   product are refreshed and it is (re)activated.
 * - Otherwise a new active row is inserted.
 */
async function upsertEntry(seed: KnowledgeSeed): Promise<'created' | 'updated'> {
  const repo = AppDataSource.getRepository(KnowledgeEntry);
  const existing = await repo.findOne({ where: { title: seed.title } });

  const fields = {
    title: seed.title,
    content: seed.content,
    category: seed.category,
    tags: seed.tags,
    priority: seed.priority ?? 0,
    product: seed.product ?? null,
    isActive: true,
  };

  if (existing) {
    repo.merge(existing, fields);
    await repo.save(existing);
    return 'updated';
  }

  const created = repo.create(fields);
  await repo.save(created);
  return 'created';
}

export async function seedAiKnowledge(): Promise<void> {
  const openedHere = !AppDataSource.isInitialized;
  if (openedHere) {
    await AppDataSource.initialize();
  }

  console.log('🌱 Seeding AI Knowledge Base (idempotent upsert)…');

  let created = 0;
  let updated = 0;
  for (const seed of SEED_ENTRIES) {
    const result = await upsertEntry(seed);
    if (result === 'created') created += 1;
    else updated += 1;
    const icon = result === 'created' ? '✅' : '♻️ ';
    console.log(`${icon} KB entry "${seed.title}" ${result}.`);
  }

  const total = await AppDataSource.getRepository(KnowledgeEntry).count();
  console.log(
    `🎉 AI Knowledge seeding complete. Seeded: ${created} created, ${updated} updated. Total ai_knowledge_entries rows: ${total}`,
  );

  if (openedHere && AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
}

// Only auto-run when executed directly (npm run seed:ai-knowledge).
if (require.main === module) {
  seedAiKnowledge().catch((err) => {
    console.error('❌ AI Knowledge seeding failed:', err);
    process.exit(1);
  });
}
