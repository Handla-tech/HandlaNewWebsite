'use client';

/**
 * DateRangePicker — simple from/to date input pair.
 *
 * Used by Expenses and Dashboard pages for period filtering.
 *
 * Usage:
 *   <DateRangePicker
 *     from={dateFrom}
 *     to={dateTo}
 *     onFromChange={setDateFrom}
 *     onToChange={setDateTo}
 *   />
 */

import React from 'react';
import { CalendarRange } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';

interface DateRangePickerProps {
  from?:          string;
  to?:            string;
  onFromChange:   (val: string) => void;
  onToChange:     (val: string) => void;
  className?:     string;
  fromLabel?:     string;
  toLabel?:       string;
}

export default function DateRangePicker({
  from = '',
  to = '',
  onFromChange,
  onToChange,
  className,
  fromLabel,
  toLabel,
}: DateRangePickerProps) {
  const { t } = useTranslation();
  const resolvedFromLabel = fromLabel ?? t('erp.ui.from');
  const resolvedToLabel   = toLabel   ?? t('erp.ui.to');
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2',
        className,
      )}
      role="group"
      aria-label={t('erp.ui.dateRangeFilter')}
    >
      <CalendarRange className="h-4 w-4 text-[#fbbf24] shrink-0" aria-hidden="true" />

      <div className="flex flex-wrap items-center gap-2">
        {/* From */}
        <div className="flex items-center gap-1.5">
          <label
            htmlFor="drp-from"
            className="text-xs text-[#666] whitespace-nowrap"
          >
            {resolvedFromLabel}
          </label>
          <input
            id="drp-from"
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => onFromChange(e.target.value)}
            className={cn(
              'rounded-xl border border-[#1a1a1a] bg-white/[0.03] px-3 py-1.5 text-xs text-white',
              'transition-colors focus:border-[#fbbf24]/50 focus:outline-none focus:ring-1 focus:ring-[#fbbf24]/30',
              'min-h-[44px]',
              // Date input native styling
              '[color-scheme:dark]',
            )}
            aria-label={`${t('erp.ui.dateRangeFilter')}: ${resolvedFromLabel}`}
          />
        </div>

        {/* To */}
        <div className="flex items-center gap-1.5">
          <label
            htmlFor="drp-to"
            className="text-xs text-[#666] whitespace-nowrap"
          >
            {resolvedToLabel}
          </label>
          <input
            id="drp-to"
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => onToChange(e.target.value)}
            className={cn(
              'rounded-xl border border-[#1a1a1a] bg-white/[0.03] px-3 py-1.5 text-xs text-white',
              'transition-colors focus:border-[#fbbf24]/50 focus:outline-none focus:ring-1 focus:ring-[#fbbf24]/30',
              'min-h-[44px]',
              '[color-scheme:dark]',
            )}
            aria-label={`${t('erp.ui.dateRangeFilter')}: ${resolvedToLabel}`}
          />
        </div>

        {/* Clear */}
        {(from || to) && (
          <button
            onClick={() => { onFromChange(''); onToChange(''); }}
            className="text-xs text-[#555] underline hover:text-[#888] min-h-[44px] flex items-center"
            aria-label={t('erp.ui.clearDateRange')}
          >
            {t('erp.ui.clear')}
          </button>
        )}
      </div>
    </div>
  );
}
