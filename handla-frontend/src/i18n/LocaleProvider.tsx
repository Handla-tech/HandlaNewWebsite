'use client';

/**
 * LocaleProvider — makes the URL-derived locale available to client components.
 *
 * The public `/[locale]/…` server layout wraps its subtree in this provider,
 * passing the locale parsed from the route params. Because the value comes
 * from the URL (a server-known value) and is passed as a prop, the FIRST
 * server render already knows the correct locale — Arabic pages server-render
 * Arabic HTML with no dependency on localStorage / Zustand / useEffect.
 *
 * Private application routes (/auth, /dashboard, /erp, /profile) render OUTSIDE
 * this provider. For them `useLocaleContext()` returns null and consumers fall
 * back to the persisted uiStore locale — preserving their existing behaviour
 * with zero component changes.
 */

import { createContext, useContext, type ReactNode } from 'react';
import type { Locale } from './config';

const LocaleContext = createContext<Locale | null>(null);

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  return (
    <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
  );
}

/**
 * Read the URL-driven locale. Returns null when not inside a LocaleProvider
 * (i.e. on non-localized private routes) so callers can fall back to uiStore.
 */
export function useLocaleContext(): Locale | null {
  return useContext(LocaleContext);
}
