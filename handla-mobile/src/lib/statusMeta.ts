/**
 * Status → color mapping for ERP list badges (projects, tasks, clients,
 * suppliers). Returns { color, soft } matching the <Badge> component's props.
 */
export interface StatusColor {
  color: string;
  soft: string;
}

const GREEN: StatusColor = { color: '#22c55e', soft: 'rgba(34,197,94,0.15)' };
const BLUE: StatusColor = { color: '#3b82f6', soft: 'rgba(59,130,246,0.15)' };
const AMBER: StatusColor = { color: '#f59e0b', soft: 'rgba(245,158,11,0.15)' };
const RED: StatusColor = { color: '#ef4444', soft: 'rgba(239,68,68,0.15)' };
const GRAY: StatusColor = { color: '#9ca3af', soft: 'rgba(156,163,175,0.15)' };
const PURPLE: StatusColor = { color: '#a855f7', soft: 'rgba(168,85,247,0.15)' };

const MAP: Record<string, StatusColor> = {
  // Projects
  PLANNING: BLUE,
  ACTIVE: GREEN,
  ON_HOLD: AMBER,
  COMPLETED: GRAY,
  CANCELLED: RED,
  // Tasks
  PENDING: AMBER,
  IN_PROGRESS: BLUE,
  DELAYED: RED,
  // Clients / generic
  ACTIVE_CLIENT: GREEN,
  INACTIVE: GRAY,
  LEAD: PURPLE,
  // SaaS Tenants
  PROVISIONING: BLUE,
  SUSPENDED: AMBER,
  FAILED: RED,
  ARCHIVED: GRAY,
};

export function statusColor(status?: string | null): StatusColor {
  if (!status) return GRAY;
  return MAP[status.toUpperCase()] ?? GRAY;
}

/** Prettify an UPPER_SNAKE status for display, e.g. IN_PROGRESS → In Progress. */
export function prettyStatus(status?: string | null): string {
  if (!status) return '';
  return status
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

type TFn = (key: string, params?: Record<string, string | number>) => string;

/**
 * Localized status label. Resolves `status.<ENUM>` via the shared status
 * dictionary; falls back to the English prettified form when the key is
 * missing (unknown/legacy statuses) so nothing ever renders blank.
 */
export function prettyStatusT(status: string | null | undefined, t: TFn): string {
  if (!status) return '';
  const key = `status.${status.toUpperCase()}`;
  const translated = t(key);
  return translated && translated !== key ? translated : prettyStatus(status);
}
