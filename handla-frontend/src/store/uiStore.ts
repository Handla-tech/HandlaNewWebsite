'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { UIState, Theme, Locale } from '@/types';

interface UIStore extends UIState {}

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
          // Apply to <html> element for Tailwind dark-mode class strategy
          if (typeof document !== 'undefined') {
            document.documentElement.classList.toggle('dark', next === 'dark');
          }
          return { theme: next };
        }),

      setTheme: (theme: Theme) => {
        if (typeof document !== 'undefined') {
          document.documentElement.classList.toggle('dark', theme === 'dark');
        }
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
