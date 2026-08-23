import { registerAs } from '@nestjs/config';

/**
 * INFO-01 — Public-document capability-link configuration.
 *
 * `legacyIdLinks` controls the transitional backward-compatibility window for
 * invoice/contract public links that use the raw entity UUID (`/public/:id`).
 * These links predate the secure token model and may already be in circulation
 * (emails, WhatsApp, PDFs, bookmarks). While this flag is TRUE (default), those
 * legacy `/public/:id` routes keep working for existing records; the secure
 * `/public/token/:token` routes are always available and are the preferred path
 * for newly shared links.
 *
 * Set PUBLIC_DOC_LEGACY_ID_LINKS=false once all active legacy links have been
 * rotated to secure tokens — the legacy raw-id routes then return 404 and only
 * the token routes remain. Quotations never had a raw-id public route, so this
 * flag does not affect them.
 *
 * `defaultExpiryDays` (0 = permanent) is the default expiry applied when an
 * admin generates a link without specifying one. Default 0 preserves the
 * current "permanent unless chosen" product behavior; operators may set e.g.
 * 30 to make new links expire by default.
 */
export default registerAs('publicDoc', () => ({
  legacyIdLinks: (process.env.PUBLIC_DOC_LEGACY_ID_LINKS ?? 'true') !== 'false',
  defaultExpiryDays: parseInt(process.env.PUBLIC_DOC_DEFAULT_EXPIRY_DAYS ?? '0', 10) || 0,
}));
