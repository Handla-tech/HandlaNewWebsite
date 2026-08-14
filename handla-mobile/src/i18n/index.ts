import { create } from 'zustand';
import { I18nManager, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import en from './locales/en.json';
import ar from './locales/ar.json';

/**
 * Self-contained i18n for the mobile app.
 *
 * Deliberately dependency-free (no i18next / expo-localization): a small
 * zustand store holds the active locale, bundled JSON dictionaries provide the
 * strings, and layout direction is driven by React Native's `I18nManager`.
 *
 * Persistence mirrors `src/lib/storage.ts`:
 *   native → expo-secure-store, web → localStorage.
 *
 * RTL note: `I18nManager.forceRTL()` only fully re-lays-out the native tree on
 * the next app start, so switching to/from Arabic prompts the user to restart.
 */
export type Locale = 'en' | 'ar';

const LOCALE_KEY = 'handla_locale';
const isWeb = Platform.OS === 'web';

const dictionaries: Record<Locale, Record<string, unknown>> = { en, ar };

// ---------------------------------------------------------------------------
// Persistence helpers (mirror lib/storage.ts pattern)
// ---------------------------------------------------------------------------
async function persistLocale(locale: Locale): Promise<void> {
  if (isWeb) {
    try {
      globalThis.localStorage?.setItem(LOCALE_KEY, locale);
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    await SecureStore.setItemAsync(LOCALE_KEY, locale);
  } catch {
    /* ignore */
  }
}

async function readPersistedLocale(): Promise<Locale | null> {
  if (isWeb) {
    try {
      const v = globalThis.localStorage?.getItem(LOCALE_KEY) ?? null;
      return v === 'ar' || v === 'en' ? v : null;
    } catch {
      return null;
    }
  }
  try {
    const v = await SecureStore.getItemAsync(LOCALE_KEY);
    return v === 'ar' || v === 'en' ? v : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Translation resolution
// ---------------------------------------------------------------------------
function resolveKey(dict: Record<string, unknown>, key: string): string | undefined {
  const parts = key.split('.');
  let node: unknown = dict;
  for (const part of parts) {
    if (node && typeof node === 'object' && part in (node as Record<string, unknown>)) {
      node = (node as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof node === 'string' ? node : undefined;
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name: string) =>
    name in params ? String(params[name]) : `{{${name}}}`,
  );
}

/** Locale-agnostic translate. Falls back EN → raw key. */
export function translate(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>,
): string {
  const primary = resolveKey(dictionaries[locale], key);
  if (primary !== undefined) return interpolate(primary, params);
  const fallback = resolveKey(dictionaries.en, key);
  if (fallback !== undefined) return interpolate(fallback, params);
  return key;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------
interface I18nState {
  locale: Locale;
  isRTL: boolean;
  hydrated: boolean;
  /** Load persisted locale on boot and align I18nManager with it. */
  hydrate: () => Promise<void>;
  /**
   * Change the active locale. Returns `true` when the layout direction flipped
   * (i.e. the caller should prompt the user to restart the app).
   */
  setLocale: (locale: Locale) => Promise<boolean>;
  /** Translate a key using the current locale. */
  t: (key: string, params?: Record<string, string | number>) => string;
}

export const useI18nStore = create<I18nState>((set, get) => ({
  locale: 'en',
  isRTL: false,
  hydrated: false,

  hydrate: async () => {
    const stored = (await readPersistedLocale()) ?? 'en';
    const shouldBeRTL = stored === 'ar';
    // Align the native layout manager with the stored preference. Any change
    // only takes visual effect on the next app start.
    try {
      I18nManager.allowRTL(true);
      if (I18nManager.isRTL !== shouldBeRTL) {
        I18nManager.forceRTL(shouldBeRTL);
      }
    } catch {
      /* forceRTL can be unavailable on web; ignore */
    }
    set({ locale: stored, isRTL: shouldBeRTL, hydrated: true });
  },

  setLocale: async (locale) => {
    const prev = get().locale;
    if (locale === prev) return false;
    await persistLocale(locale);
    const shouldBeRTL = locale === 'ar';
    const directionChanged = I18nManager.isRTL !== shouldBeRTL;
    try {
      I18nManager.allowRTL(true);
      if (directionChanged) {
        I18nManager.forceRTL(shouldBeRTL);
      }
    } catch {
      /* ignore */
    }
    set({ locale, isRTL: shouldBeRTL });
    return directionChanged;
  },

  t: (key, params) => translate(get().locale, key, params),
}));

// ---------------------------------------------------------------------------
// Hook: ergonomic `{ t, locale, isRTL, setLocale }`
// ---------------------------------------------------------------------------
export function useT() {
  const locale = useI18nStore((s) => s.locale);
  const isRTL = useI18nStore((s) => s.isRTL);
  const setLocale = useI18nStore((s) => s.setLocale);
  // Re-render on locale change by reading it above; bind t to current locale.
  const t = (key: string, params?: Record<string, string | number>) =>
    translate(locale, key, params);
  return { t, locale, isRTL, setLocale };
}
