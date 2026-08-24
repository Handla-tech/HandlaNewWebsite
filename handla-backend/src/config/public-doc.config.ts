import { registerAs } from '@nestjs/config';

/**
 * INFO-01 — Public-document capability-link configuration.
 *
 * `legacyIdLinks` controls the transitional backward-compatibility window for
 * invoice/contract public links that use the raw entity UUID (`/public/:id`).
 * These links predate the secure token model and may already be in circulation
 * (emails, WhatsApp, PDFs, bookmarks).
 *
 * SECURE DEFAULT (INFO-01 hardening): this flag now defaults to FALSE — the
 * legacy raw-id public routes return 404 and only the opaque capability-token
 * routes (`/public/token/:token`) are served. This closes the enumerable
 * raw-UUID public-access surface. The default was flipped after confirming there
 * were no active legacy documents/links in production (zero invoices/contracts/
 * quotations at cutover), so no circulating link is affected.
 *
 * Operators who still need the transitional raw-id behaviour (e.g. restoring an
 * older dataset whose links were shared before tokens existed) may explicitly
 * set PUBLIC_DOC_LEGACY_ID_LINKS=true to re-open the legacy routes. Quotations
 * never had a raw-id public route, so this flag does not affect them.
 *
 * `defaultExpiryDays` (0 = permanent) is the default expiry applied when an
 * admin generates a link without specifying one. Default 0 preserves the
 * current "permanent unless chosen" product behavior; operators may set e.g.
 * 30 to make new links expire by default.
 */
export default registerAs('publicDoc', () => ({
  // Secure-by-default: only 'true' (explicit opt-in) re-enables legacy raw-id links.
  legacyIdLinks: (process.env.PUBLIC_DOC_LEGACY_ID_LINKS ?? 'false') === 'true',
  defaultExpiryDays: parseInt(process.env.PUBLIC_DOC_DEFAULT_EXPIRY_DAYS ?? '0', 10) || 0,
}));
