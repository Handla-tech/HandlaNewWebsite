'use client';

/**
 * StatCard — glassmorphism KPI card.
 *
 * Props:
 *   - icon:      Lucide icon component
 *   - title:     Card label
 *   - value:     Main metric (string or number)
 *   - delta:     Optional "+12 this month" sub-badge
 *   - subValue:  Optional secondary line below value
 *   - accent:    Override border/glow colour class (default: gold)
 *   - loading:   Render skeleton if true
 */

import React from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  icon:      React.ComponentType<{ className?: string }>;
  title:     string;
  value:     string | number;
  delta?:    string | number;
  deltaPositive?: boolean;   // green delta vs red delta
  subValue?: string;
  accent?:   string;         // tailwind border + text classes
  loading?:  boolean;
  className?: string;
}

export default function StatCard({
  icon: Icon,
  title,
  value,
  delta,
  deltaPositive = true,
  subValue,
  accent = 'border-[#fbbf24]/20 text-[#fbbf24]',
  loading = false,
  className,
}: StatCardProps) {
  if (loading) {
    return (
      <div
        className={cn(
          'rounded-xl border border-[#1a1a1a] bg-white/[0.02] p-5 animate-pulse',
          className,
        )}
        aria-busy="true"
        aria-label={`Loading ${title}`}
      >
        <div className="mb-3 h-5 w-5 rounded bg-[#2a2a2a]" />
        <div className="mb-2 h-3 w-24 rounded bg-[#2a2a2a]" />
        <div className="h-7 w-16 rounded bg-[#2a2a2a]" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-xl border bg-white/[0.02] backdrop-blur-sm p-5 transition-shadow hover:shadow-lg',
        accent.includes('border') ? '' : 'border-[#1a1a1a]',
        className,
      )}
      role="region"
      aria-label={title}
    >
      {/* Icon */}
      <Icon
        className={cn(
          'mb-3 h-5 w-5',
          accent.includes('text-') ? accent.split(' ').find(c => c.startsWith('text-')) : 'text-[#fbbf24]',
        )}
        aria-hidden="true"
      />

      {/* Title */}
      <p className="mb-1 text-xs font-medium uppercase tracking-wider text-[#666]">
        {title}
      </p>

      {/* Value row */}
      <div className="flex items-end gap-2">
        <span
          className="text-2xl font-bold text-white"
          aria-live="polite"
        >
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>

        {delta !== undefined && (
          <span
            className={cn(
              'mb-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold border',
              deltaPositive
                ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-400'
                : 'border-red-400/30 bg-red-400/10 text-red-400',
            )}
            aria-label={`${deltaPositive ? 'Increase' : 'Decrease'}: ${delta}`}
          >
            {deltaPositive ? '+' : ''}{typeof delta === 'number' ? delta.toLocaleString() : delta}
          </span>
        )}
      </div>

      {/* Sub-value */}
      {subValue && (
        <p className="mt-1 text-xs text-[#555]">{subValue}</p>
      )}
    </div>
  );
}
