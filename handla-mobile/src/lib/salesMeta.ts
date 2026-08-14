/**
 * Display metadata for Sales (quotation / contract / invoice) statuses, plus a
 * shared money formatter. Currency is optional/per-record across the ERP.
 */
import { colors } from '@/theme';
import type { QuotationStatus, ContractStatus, InvoicePaymentStatus } from '@/types';

export type Meta = { label: string; color: string; soft: string };

/** Optional translate function; when supplied, status labels are localized via
 *  the shared `status.<ENUM>` keys instead of the baked-in English `label`. */
type TFn = (key: string, params?: Record<string, string | number>) => string;

/** Neutral fallback used when a status value isn't in a meta map (e.g. a
 *  legacy/unknown status from the API) — prevents "Cannot read property
 *  'label' of undefined" crashes. */
const FALLBACK_META: Meta = {
  label: '—',
  color: colors.textFaint,
  soft: 'rgba(255,255,255,0.06)',
};

/** Safe lookup: returns the meta for `status`, or a neutral fallback that
 *  shows the raw status text instead of crashing when it's missing/unknown.
 *  When a `t` function is passed, the label is localized via `status.<ENUM>`. */
export function statusMeta(
  map: Record<string, Meta>,
  status: string | null | undefined,
  t?: TFn,
): Meta {
  const localize = (base: Meta, key?: string | null): Meta => {
    if (!t || !key) return base;
    const translated = t(`status.${key}`);
    // translate() falls back to the raw key when missing — keep English label then.
    return translated && translated !== `status.${key}` ? { ...base, label: translated } : base;
  };
  if (status && map[status]) return localize(map[status], status);
  return status ? localize({ ...FALLBACK_META, label: String(status) }, status) : FALLBACK_META;
}

export const QUOTATION_STATUS_META: Record<QuotationStatus, Meta> = {
  DRAFT: { label: 'Draft', color: colors.textFaint, soft: 'rgba(255,255,255,0.06)' },
  SENT: { label: 'Sent', color: colors.info, soft: 'rgba(96,165,250,0.15)' },
  ACCEPTED: { label: 'Accepted', color: colors.success, soft: colors.successSoft },
  REJECTED: { label: 'Rejected', color: colors.danger, soft: colors.dangerSoft },
  EXPIRED: { label: 'Expired', color: '#fb923c', soft: 'rgba(251,146,60,0.15)' },
  CONVERTED: { label: 'Converted', color: colors.accent, soft: colors.accentSoft },
};

export const CONTRACT_STATUS_META: Record<ContractStatus, Meta> = {
  DRAFT: { label: 'Draft', color: colors.textFaint, soft: 'rgba(255,255,255,0.06)' },
  SENT: { label: 'Sent', color: colors.info, soft: 'rgba(96,165,250,0.15)' },
  SIGNED: { label: 'Signed', color: colors.success, soft: colors.successSoft },
  REJECTED: { label: 'Rejected', color: colors.danger, soft: colors.dangerSoft },
};

export const INVOICE_STATUS_META: Record<InvoicePaymentStatus, Meta> = {
  UNPAID: { label: 'Unpaid', color: '#fb923c', soft: 'rgba(251,146,60,0.15)' },
  PAID: { label: 'Paid', color: colors.success, soft: colors.successSoft },
  OVERDUE: { label: 'Overdue', color: colors.danger, soft: colors.dangerSoft },
};

/** Formats an amount with an optional currency code (per-record, may be null). */
export function money(amount: number | string | null | undefined, currency?: string | null): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount ?? 0;
  const safe = Number.isFinite(n) ? (n as number) : 0;
  const formatted = safe.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? `${currency} ${formatted}` : formatted;
}

export function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
