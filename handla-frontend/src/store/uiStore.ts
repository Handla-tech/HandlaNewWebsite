'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { UIState, Theme, Locale } from '@/types';

interface UIStore extends UIState {}

/**
 * Apply the active theme to the <html> element.
 *
 * Both an explicit `light` / `dark` class AND the `dark` toggle are set:
 *   - `dark`  → drives Tailwind's `darkMode: ['class']` variants.
 *   - `light` → drives the light-theme class-remap layer in globals.css that
 *               inverts the codebase's hardcoded dark utilities.
 */
function applyThemeClass(theme: Theme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.classList.toggle('light', theme === 'light');
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      // ── State ────────────────────────────────────────────────────────────────
      theme: 'dark' as Theme,
      locale: 'en' as Locale,
      sidebarOpen: true,
      isMobileMenuOpen: false,

      // ── Actions ──────────────────────────────────────────────────────────────

      toggleTheme: () =>
        set((state) => {
          const next: Theme = state.theme === 'dark' ? 'light' : 'dark';
          applyThemeClass(next);
          return { theme: next };
        }),

      setTheme: (theme: Theme) => {
        applyThemeClass(theme);
        set({ theme });
      },

      setLocale: (locale: Locale) => {
        if (typeof document !== 'undefined') {
          document.documentElement.lang = locale;
          document.documentElement.dir  = locale === 'ar' ? 'rtl' : 'ltr';
        }
        set({ locale });
      },

      toggleSidebar: () =>
        set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      setMobileMenuOpen: (open: boolean) =>
        set({ isMobileMenuOpen: open }),
    }),
    {
      name: 'handla-ui',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined'
          ? localStorage
          : { getItem: () => null, setItem: () => {}, removeItem: () => {} }
      ),
      partialize: (state) => ({
        theme: state.theme,
        locale: state.locale,
      }),
    },
  ),
);
