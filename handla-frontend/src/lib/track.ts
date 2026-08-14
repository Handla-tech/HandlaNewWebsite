/**
 * Thin client-side wrapper around the self-hosted analytics tracker
 * (public/analytics.js, which exposes `window.handla`).
 *
 * Safe to call anywhere: if the tracker hasn't loaded (or the visitor has
 * Do-Not-Track on), calls are silently no-ops. Import and call `track('cta_...')`
 * from marketing CTAs to record custom conversion events.
 */
type HandlaFn = (cmd: 'event' | 'pageview', name?: string, meta?: Record<string, any>) => void;

declare global {
  interface Window {
    handla?: HandlaFn & { q?: any[] };
  }
}

/** Fire a custom analytics event (e.g. track('cta_start_chat', { location: 'hero' })). */
export function track(name: string, meta?: Record<string, any>): void {
  if (typeof window === 'undefined') return;
  try {
    if (typeof window.handla === 'function') {
      window.handla('event', name, meta);
    } else {
      // Queue until analytics.js loads and flushes window.handla.q.
      const w = window as any;
      w.handla = w.handla || function (...args: any[]) { (w.handla.q = w.handla.q || []).push(args); };
      w.handla.q = w.handla.q || [];
      w.handla.q.push(['event', name, meta]);
    }
  } catch {
    /* never let analytics break UX */
  }
}
