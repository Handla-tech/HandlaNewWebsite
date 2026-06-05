'use client';

/**
 * EmptyState — generic zero-data placeholder.
 *
 * Props:
 *  icon     — Lucide icon component
 *  title    — primary heading
 *  message  — supporting copy
 *  action   — optional { label, onClick } CTA button
 */

import { type LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  message?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon: Icon, title, message, action }: EmptyStateProps) {
  return (
    <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-4 p-8 text-center">
      {/* Icon ring */}
      <div
        className="flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.12)' }}
      >
        <Icon className="h-7 w-7" style={{ color: '#fbbf24' }} aria-hidden="true" />
      </div>

      {/* Text */}
      <div className="space-y-1">
        <p className="text-sm font-semibold text-white">{title}</p>
        {message && <p className="max-w-xs text-xs text-[#666]">{message}</p>}
      </div>

      {/* Optional CTA */}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-1 rounded-xl border px-4 py-2 text-xs font-medium transition-all"
          style={{
            borderColor: 'rgba(251,191,36,0.2)',
            background:  'rgba(251,191,36,0.06)',
            color:       '#fbbf24',
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
