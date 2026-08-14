'use client';

/**
 * ThemeSwitcher — compact light ⇄ dark toggle button.
 *
 * Matches the ERP top-bar action button sizing (h-9 rounded-xl border) so it
 * sits cleanly next to LanguageSwitcher / NotificationBell / ProfileMenu.
 * Toggling flips the persisted theme in uiStore, which toggles the
 * `light` / `dark` class on <html> (driving the light-theme class-remap layer
 * and Tailwind's dark: variants).
 *
 * Two variants:
 *   • "icon" (default) — sun/moon glyph only, for tight top-bars.
 *   • "full"           — glyph + the *target* mode's label, for menus.
 */

import { useCallback } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

export default function ThemeSwitcher({
  variant = 'icon',
  className,
}: {
  variant?: 'icon' | 'full';
  className?: string;
}) {
  const { t } = useTranslation();
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);

  const isDark = theme === 'dark';
  const toggle = useCallback(() => toggleTheme(), [toggleTheme]);

  // Advertise the mode you'll switch TO.
  const nextLabel = isDark ? t('common.theme.light') : t('common.theme.dark');
  const Icon = isDark ? Sun : Moon;

  if (variant === 'full') {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label={t('common.theme.toggle')}
        title={t('common.theme.toggle')}
        className={cn(
          'flex items-center gap-2 rounded-xl border border-white/[0.08] px-3 py-2 text-sm font-medium text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white',
          className,
        )}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
        <span>{nextLabel}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t('common.theme.toggle')}
      title={`${t('common.theme.toggle')} — ${nextLabel}`}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white',
        className,
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
