import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// ─── Tailwind class merger ────────────────────────────────────────────────────

/**
 * Merges Tailwind CSS class names intelligently, resolving conflicts.
 * Usage: cn('px-4 py-2', condition && 'bg-blue-500', 'px-6') → 'py-2 bg-blue-500 px-6'
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// ─── Date & time formatters ───────────────────────────────────────────────────

/**
 * Format a date string for display in the chat message list.
 * Returns "just now", "5m ago", "2h ago", "Yesterday", or "DD/MM/YYYY".
 */
export function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now  = new Date();
  const diff = now.getTime() - date.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(diff / 60_000);
  const hours   = Math.floor(diff / 3_600_000);
  const days    = Math.floor(diff / 86_400_000);

  if (seconds < 30)  return 'just now';
  if (minutes < 60)  return `${minutes}m ago`;
  if (hours < 24)    return `${hours}h ago`;
  if (days === 1)    return 'Yesterday';
  if (days < 7)      return `${days}d ago`;

  return date.toLocaleDateString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

/**
 * Format a date for a full readable timestamp in tooltips / email.
 * E.g. "27 May 2026, 14:30"
 */
export function formatFullDateTime(dateStr: string, locale: string = 'en-GB'): string {
  return new Date(dateStr).toLocaleString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Return a short time string (HH:MM) for inline chat timestamps.
 */
export function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Group messages by date (for chat history separators).
 * Returns a date label: "Today", "Yesterday", or "DD MMM YYYY".
 */
export function getDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const today     = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (isSameDay(date, today))     return 'Today';
  if (isSameDay(date, yesterday)) return 'Yesterday';

  return date.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth()    &&
    a.getDate()     === b.getDate()
  );
}

// ─── String helpers ───────────────────────────────────────────────────────────

/** Truncate a string to `maxLength` characters and add ellipsis. */
export function truncate(str: string | null | undefined, maxLength: number): string {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '…';
}

/** Get the initials from a display name (up to 2 chars). */
export function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

/** Capitalise the first letter of a string. */
export function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/** Convert a string to title case. */
export function toTitleCase(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Number helpers ───────────────────────────────────────────────────────────

/** Format a number with K/M suffixes (e.g. 1500 → "1.5K"). */
export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ─── DOM helpers ─────────────────────────────────────────────────────────────

/**
 * Scroll a container element to its bottom (for chat windows).
 * Optionally smooth-scrolls if `behavior === 'smooth'`.
 */
export function scrollToBottom(
  element: HTMLElement | null,
  behavior: ScrollBehavior = 'smooth',
): void {
  if (!element) return;
  element.scrollTo({ top: element.scrollHeight, behavior });
}

// ─── Async helpers ────────────────────────────────────────────────────────────

/** Simple promise-based sleep. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Colour helpers (for dynamic avatar backgrounds) ─────────────────────────

const AVATAR_COLORS = [
  'bg-electric-500',
  'bg-violet-500',
  'bg-cyan-500',
  'bg-pink-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-teal-500',
];

/** Deterministically pick a Tailwind colour class from a user ID. */
export function getAvatarColor(userId: string | null | undefined): string {
  // Guard: return a stable fallback when called before user data loads.
  if (!userId) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ─── Error helpers ────────────────────────────────────────────────────────────

/** Extract a user-readable error message from an axios or generic error. */
export function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;

  if (error && typeof error === 'object') {
    // Axios error
    const axiosError = error as {
      response?: { data?: { message?: string | string[] } };
      message?: string;
    };

    const msg = axiosError.response?.data?.message;
    if (Array.isArray(msg)) return msg[0];
    if (typeof msg === 'string') return msg;
    if (axiosError.message) return axiosError.message;
  }

  return 'An unexpected error occurred.';
}
