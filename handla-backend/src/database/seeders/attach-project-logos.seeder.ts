import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { AppDataSource } from '../../config/data-source';
import { WebsiteProject } from '../../modules/website/entities/website-project.entity';

/**
 * AttachProjectLogosSeeder
 * ────────────────────────
 * One-time, idempotent helper that uploads the genuine project logos to S3
 * (public-read) and sets each project's `imageUrl` to the resulting public URL.
 *
 * Why a dedicated script?  The logos are real brand assets (extracted from the
 * client's approved profile / provided by the client). They must live in S3 —
 * NOT in the app's committed public files — so this script pushes them up and
 * stores only the resulting S3 URL on the DB row.
 *
 * Idempotency: uses a STABLE S3 key per project (no timestamp), so re-running
 * overwrites the same object and re-sets the same URL. Safe to run repeatedly.
 *
 * Assets shipped as UPLOAD SOURCE ONLY (never served by the app):
 *   scripts/seed-assets/tameer-home.png    → Tameer Home  (circular building logo)
 *   scripts/seed-assets/homy-perfumes.png  → Homy Perfumes (peacock logo on white)
 *
 * NOTE: Emdad is intentionally NOT handled here — its approved logo is served
 * from the frontend /public directory and must stay under strict confidentiality
 * rules. This script never touches Emdad.
 *
 * Run inside the API container (env already has AWS_* + DATABASE_*):
 *   node dist/database/seeders/attach-project-logos.seeder.js
 * or in dev:
 *   npm run seed:project-logos
 */

interface LogoSeed {
  /** Stable upsert key — the project's English title. */
  title: string;
  /** File name under scripts/seed-assets/. */
  assetFile: string;
  /** Stable S3 logical key (no timestamp → overwrite-in-place, idempotent). */
  s3Key: string;
  contentType: string;
}

const LOGOS: LogoSeed[] = [
  {
    title: 'Tameer Home',
    assetFile: 'tameer-home.png',
    s3Key: 'website/projects/tameer-home-logo.png',
    contentType: 'image/png',
  },
  {
    title: 'Homy Perfumes',
    assetFile: 'homy-perfumes.png',
    s3Key: 'website/projects/homy-perfumes-logo.png',
    contentType: 'image/png',
  },
];

// ─── Resolve seed-assets dir (works from dist/ or src/ via ts-node) ─────────────
function resolveAssetPath(assetFile: string): string {
  const candidates = [
    // compiled: dist/database/seeders → repo root is ../../../
    join(__dirname, '../../../scripts/seed-assets', assetFile),
    // ts-node: src/database/seeders → repo root is ../../../
    join(process.cwd(), 'scripts/seed-assets', assetFile),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return candidates[candidates.length - 1];
}

function buildS3Client() {
  const region = process.env.AWS_REGION || 'us-east-1';
  return {
    client: new S3Client({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
      requestChecksumCalculation: 'WHEN_REQUIRED',
    }),
    region,
    bucket: process.env.AWS_S3_BUCKET || 'handla-uploads',
    keyPrefix: (process.env.AWS_S3_KEY_PREFIX || '').trim().replace(/^\/+|\/+$/g, ''),
  };
}

function withPrefix(keyPrefix: string, logicalKey: string): string {
  const clean = logicalKey.replace(/^\/+/, '');
  if (!keyPrefix) return clean;
  if (clean === keyPrefix || clean.startsWith(`${keyPrefix}/`)) return clean;
  return `${keyPrefix}/${clean}`;
}

export async function attachProjectLogos(): Promise<void> {
  const openedHere = !AppDataSource.isInitialized;
  if (openedHere) await AppDataSource.initialize();

  const { client, region, bucket, keyPrefix } = buildS3Client();
  const repo = AppDataSource.getRepository(WebsiteProject);

  console.log('🖼️  Attaching genuine project logos (upload to S3 + set imageUrl)…');

  for (const logo of LOGOS) {
    const project = await repo.findOne({ where: { title: logo.title } });
    if (!project) {
      console.warn(`⚠️  Project "${logo.title}" not found — run the projects seeder first. Skipping.`);
      continue;
    }

    const assetPath = resolveAssetPath(logo.assetFile);
    if (!existsSync(assetPath)) {
      console.warn(`⚠️  Asset file missing: ${assetPath} — skipping "${logo.title}".`);
      continue;
    }

    const body = readFileSync(assetPath);
    const physicalKey = withPrefix(keyPrefix, logo.s3Key);

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: physicalKey,
        Body: body,
        ContentType: logo.contentType,
        ACL: 'public-read',
      }),
    );

    const publicUrl = `https://${bucket}.s3.${region}.amazonaws.com/${physicalKey}`;
    project.imageUrl = publicUrl;
    await repo.save(project);
    console.log(`✅ "${logo.title}" → ${publicUrl} (${body.length} bytes)`);
  }

  console.log('🎉 Project-logo attachment complete.');

  if (openedHere && AppDataSource.isInitialized) await AppDataSource.destroy();
}

if (require.main === module) {
  attachProjectLogos().catch((err) => {
    console.error('❌ Project-logo attachment failed:', err);
    process.exit(1);
  });
}
