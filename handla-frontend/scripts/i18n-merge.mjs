#!/usr/bin/env node
/**
 * i18n-merge.mjs — deep-merge additional keys into the en/ar common.json bundles.
 *
 * Usage: node scripts/i18n-merge.mjs <patchFile.json>
 * The patch file has shape { "en": {...}, "ar": {...} } and is deep-merged
 * (existing keys are NOT overwritten unless the patch value is a string/number
 *  and the flag OVERWRITE=1 is set).
 *
 * Deep-merges without clobbering unrelated existing keys.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OVERWRITE = process.env.OVERWRITE === '1';

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function deepMerge(target, patch) {
  for (const [k, v] of Object.entries(patch)) {
    if (isPlainObject(v)) {
      if (!isPlainObject(target[k])) target[k] = {};
      deepMerge(target[k], v);
    } else {
      if (OVERWRITE || !(k in target)) target[k] = v;
    }
  }
  return target;
}

const patchPath = process.argv[2];
if (!patchPath) {
  console.error('Usage: node scripts/i18n-merge.mjs <patchFile.json>');
  process.exit(1);
}
const patch = JSON.parse(readFileSync(patchPath, 'utf8'));

for (const locale of ['en', 'ar']) {
  const file = join(ROOT, 'public', 'locales', locale, 'common.json');
  const bundle = JSON.parse(readFileSync(file, 'utf8'));
  if (patch[locale]) deepMerge(bundle, patch[locale]);
  writeFileSync(file, JSON.stringify(bundle, null, 2) + '\n', 'utf8');
  console.log(`merged into ${locale}/common.json`);
}
