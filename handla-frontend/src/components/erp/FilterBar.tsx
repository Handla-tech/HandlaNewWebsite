'use client';

/**
 * FilterBar — search input + pill filter buttons row.
 *
 * Reused across all ERP list pages (Clients, Projects, Tasks, etc.).
 *
 * Usage:
 *   <FilterBar
 *     search={search}
 *     onSearchChange={setSearch}
 *     placeholder="Search clients…"
 *     filters={[
 *       { label: 'All',    value: undefined },
 *       { label: 'Active', value: 'ACTIVE' },
 *     ]}
 *     activeFilter={statusFilter}
 *     onFilterChange={setStatusFilter}
 *   />
 */

import React from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';

export interface FilterOption {
  label: string;
  value: string | undefined;
}

interface FilterBarProps {
  search:         string;
  onSearchChange: (value: string) => void;
  placeholder?:   string;
  filters?:       FilterOption[];
  activeFilter?:  string | undefined;
  onFilterChange?: (value: string | undefined) => void;
  className?:     string;
  children?:      React.ReactNode; // extra right-side controls (e.g. dropdowns)
}

export default function FilterBar({
  search,
  onSearchChange,
  placeholder,
  filters,
  activeFilter,
  onFilterChange,
  className,
  children,
}: FilterBarProps) {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? t('erp.ui.search');
  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap',
        className,
      )}
      role="search"
      aria-label={t('erp.ui.filterRecords')}
    >
      {/* Search input */}
      <div className="relative flex-1 min-w-[180px]">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#666]"
          aria-hidden="true"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={resolvedPlaceholder}
          className={cn(
            'w-full rounded-xl border border-[#1a1a1a] bg-white/[0.03] py-2 pl-9 pr-9 text-sm text-white placeholder-[#555]',
            'transition-colors focus:border-[#fbbf24]/50 focus:outline-none focus:ring-1 focus:ring-[#fbbf24]/30',
            'min-h-[44px]',
          )}
          aria-label={resolvedPlaceholder}
        />
        {search && (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666] hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center"
            onClick={() => onSearchChange('')}
            aria-label={t('erp.ui.clearSearch')}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Pill filters */}
      {filters && filters.length > 0 && (
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label={t('erp.ui.filterOptions')}
        >
          {filters.map((f) => {
            const isActive = activeFilter === f.value;
            return (
              <button
                key={f.label}
                onClick={() => onFilterChange?.(f.value)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors min-h-[44px] flex items-center',
                  isActive
                    ? 'border-[#fbbf24]/50 bg-[#fbbf24]/10 text-[#fbbf24]'
                    : 'border-[#2a2a2a] bg-transparent text-[#888] hover:border-[#3a3a3a] hover:text-white',
                )}
                aria-pressed={isActive}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Extra controls slot */}
      {children}
    </div>
  );
}
