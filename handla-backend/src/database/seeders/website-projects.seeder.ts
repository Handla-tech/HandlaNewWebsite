import { AppDataSource } from '../../config/data-source';
import { WebsiteProject } from '../../modules/website/entities/website-project.entity';

/**
 * WebsiteProjectsSeeder
 * ─────────────────────
 * Idempotent, NON-DESTRUCTIVE seeder for the genuine public-portfolio projects
 * shown on /[locale]/projects. It inserts (or updates in place) ONLY the three
 * explicitly-approved genuine Handla projects:
 *
 *   1. Tameer Home   — https://tameerhome.tech
 *   2. Homy Perfumes — https://homyperfumes.com
 *   3. Emdad (إمداد) — Visual Identity (confidential client; logo-only, no site)
 *
 * Safety guarantees:
 *   • Uses upsert-by-stable-key (the English `title`) → running it repeatedly
 *     never creates duplicates; it updates the existing row in place.
 *   • NEVER truncates, deletes, or wipes the table. Rows other than these three
 *     approved projects are left completely untouched.
 *   • Only public-safe fields are written. For Emdad, no Brand-Guidelines PDF,
 *     no confidential content and no external URL is stored — only the approved
 *     logo asset path, name, category, safe description and Handla's role tags.
 *
 * Run it with:
 *   npm run seed:website-projects
 * (or, in production, inside the backend container:
 *   node dist/database/seeders/website-projects.seeder.js)
 */

// ─── Seed definitions (public-safe, verified data only) ─────────────────────────
// The `title` is the STABLE UPSERT KEY — do not change it casually, or a rename
// would create a new row instead of updating the existing one.
type WebsiteProjectSeed = Partial<WebsiteProject> & { title: string };

const SEED_PROJECTS: WebsiteProjectSeed[] = [
  {
    // ─── 1. Tameer Home ──────────────────────────────────────────────────────
    title: 'Tameer Home',
    titleAr: 'تعمير هوم',
    clientName: null,
    summary:
      'A modern web platform built and delivered by Handla for Tameer Home.',
    summaryAr:
      'منصة ويب حديثة قامت هاندلا ببنائها وتسليمها لتعمير هوم.',
    description:
      'Tameer Home is a live web platform designed, developed and deployed by Handla. Handla delivered the front-end experience, the back-end services and the hosting infrastructure behind the project.',
    descriptionAr:
      'تعمير هوم منصة ويب مباشرة صممتها وطوّرتها ونشرتها هاندلا. تولّت هاندلا تجربة الواجهة الأمامية والخدمات الخلفية والبنية التحتية للاستضافة خلف المشروع.',
    category: 'Web Development',
    categoryAr: 'تطوير الويب',
    imageUrl: null,
    projectUrl: 'https://tameerhome.tech',
    tags: ['Web Development', 'Full-Stack', 'Cloud Hosting'],
    featured: true,
    sortOrder: 1,
  },
  {
    // ─── 2. Homy Perfumes ────────────────────────────────────────────────────
    title: 'Homy Perfumes',
    titleAr: 'هومي للعطور',
    clientName: null,
    summary:
      'An online storefront built and delivered by Handla for Homy Perfumes.',
    summaryAr:
      'متجر إلكتروني قامت هاندلا ببنائه وتسليمه لهومي للعطور.',
    description:
      'Homy Perfumes is a live e-commerce storefront designed, developed and deployed by Handla. Handla delivered the customer-facing storefront, the supporting back-end and the hosting infrastructure behind the project.',
    descriptionAr:
      'هومي للعطور متجر إلكتروني مباشر صممته وطوّرته ونشرته هاندلا. تولّت هاندلا واجهة المتجر الموجهة للعملاء والخدمات الخلفية الداعمة والبنية التحتية للاستضافة خلف المشروع.',
    category: 'E-Commerce',
    categoryAr: 'التجارة الإلكترونية',
    imageUrl: null,
    projectUrl: 'https://homyperfumes.com',
    tags: ['E-Commerce', 'Web Development', 'Cloud Hosting'],
    featured: true,
    sortOrder: 2,
  },
  {
    // ─── 3. Emdad (إمداد) — CONFIDENTIAL visual-identity project ───────────────
    // Public-safe fields ONLY. No Brand-Guidelines PDF, no confidential content,
    // and intentionally NO projectUrl ("Visit Website" must not appear).
    title: 'Emdad',
    titleAr: 'إمداد',
    clientName: null,
    summary:
      'A modern, recognizable visual identity designed by Handla for Emdad.',
    summaryAr:
      'هوية بصرية حديثة ومميزة صممتها هاندلا لمنصة إمداد.',
    description:
      'A visual identity created for Emdad, a digital platform connecting energy solution providers with customers through a clear, modern and recognizable brand system.',
    descriptionAr:
      'تصميم هوية بصرية لمنصة إمداد، وهي منصة رقمية تربط مقدمي حلول الطاقة بالعملاء، بهوية حديثة وواضحة تعكس طبيعة المنصة ومجالها.',
    category: 'Visual Identity',
    categoryAr: 'الهوية البصرية',
    // Approved logo asset served from the FRONTEND /public directory. This
    // is the ONLY Emdad asset that is public — never the source PDF.
    imageUrl: 'https://handla.tech/projects/emdad/logo.png',
    projectUrl: null,
    tags: ['Visual Identity', 'Brand Identity', 'Logo Design'],
    featured: true,
    sortOrder: 3,
  },
];

/**
 * Upsert a single seed record by its stable `title` key.
 * - If a row with the same title exists, its public-safe fields are refreshed.
 * - Otherwise a new row is inserted.
 * Returns 'created' | 'updated' for logging.
 */
async function upsertProject(seed: WebsiteProjectSeed): Promise<'created' | 'updated'> {
  const repo = AppDataSource.getRepository(WebsiteProject);
  const existing = await repo.findOne({ where: { title: seed.title } });

  if (existing) {
    // Non-destructive in-place update of public-safe fields only.
    repo.merge(existing, seed);
    await repo.save(existing);
    return 'updated';
  }

  const created = repo.create(seed);
  await repo.save(created);
  return 'created';
}

export async function seedWebsiteProjects(): Promise<void> {
  const openedHere = !AppDataSource.isInitialized;
  if (openedHere) {
    await AppDataSource.initialize();
  }

  console.log('🌱 Seeding genuine website projects (idempotent upsert)…');

  for (const seed of SEED_PROJECTS) {
    const result = await upsertProject(seed);
    const icon = result === 'created' ? '✅' : '♻️ ';
    console.log(`${icon} Website project "${seed.title}" ${result}.`);
  }

  const total = await AppDataSource.getRepository(WebsiteProject).count();
  console.log(`🎉 Website-project seeding complete. Total website_projects rows: ${total}`);

  if (openedHere && AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
}

// Only auto-run when executed directly (npm run seed:website-projects).
if (require.main === module) {
  seedWebsiteProjects().catch((err) => {
    console.error('❌ Website-project seeding failed:', err);
    process.exit(1);
  });
}
