'use client';

/**
 * LanguageSwitcher — compact EN ⇄ AR toggle button.
 *
 * Matches the ERP top-bar action button sizing (h-9 rounded-xl border), sits
 * next to NotificationBell / ProfileMenu. Toggling flips the persisted locale
 * in uiStore, which also flips <html dir> (rtl/ltr) and lang for full RTL.
 *
 * Two variants:
 *   • "icon"  (default) — Globe + short code (EN / ع), for tight top-bars.
 *   • "full"            — Globe + the *other* language's native name, for menus.
 */

import { useCallback } from 'react';
import { Globe } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

export default function LanguageSwitcher({
  variant = 'icon',
  className,
}: {
  variant?: 'icon' | 'full';
  className?: string;
}) {
  const { t, locale } = useTranslation();
  const setLocale = useUIStore((s) => s.setLocale);

  const toggle = useCallback(() => {
    setLocale(locale === 'en' ? 'ar' : 'en');
  }, [locale, setLocale]);

  // Label always advertises the language you'll switch TO.
  const nextLabel =
    locale === 'en' ? t('common.language.ar') : t('common.language.en');
  const shortCode = locale === 'en' ? 'ع' : 'EN';

  if (variant === 'full') {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label={t('common.language.toggle')}
        title={t('common.language.toggle')}
        className={cn(
          'flex items-center gap-2 rounded-xl border border-white/[0.08] px-3 py-2 text-sm font-medium text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white',
          className,
        )}
      >
        <Globe className="h-4 w-4" aria-hidden="true" />
        <span>{nextLabel}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t('common.language.toggle')}
      title={`${t('common.language.toggle')} — ${nextLabel}`}
      className={cn(
        'flex h-9 items-center gap-1.5 rounded-xl border border-white/[0.08] px-2.5 text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white',
        className,
      )}
    >
      <Globe className="h-4 w-4" aria-hidden="true" />
      <span className="text-xs font-semibold">{shortCode}</span>
    </button>
  );
}
