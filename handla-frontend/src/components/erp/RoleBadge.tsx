'use client';

/**
 * RoleBadge — colour-coded user role pill.
 *
 * ADMIN    → gold
 * EMPLOYEE → blue
 * CLIENT   → green
 * LEAD     → gray
 */

import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import type { UserRole } from '@/types';

const ROLE_COLOURS: Record<UserRole, string> = {
  ADMIN:    'border-[#fbbf24]/30 bg-[#fbbf24]/10 text-[#fbbf24]',
  EMPLOYEE: 'border-blue-400/30  bg-blue-400/10  text-blue-400',
  CLIENT:   'border-emerald-400/30 bg-emerald-400/10 text-emerald-400',
  LEAD:     'border-slate-400/30  bg-slate-400/10  text-slate-400',
};

interface RoleBadgeProps {
  role:       UserRole;
  size?:      'sm' | 'md';
  className?: string;
}

export default function RoleBadge({ role, size = 'sm', className }: RoleBadgeProps) {
  const { t } = useTranslation();
  const label = t(`erp.userRole.${role}`);
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        ROLE_COLOURS[role] ?? 'border-[#2a2a2a] bg-[#111] text-[#666]',
        className,
      )}
      aria-label={label}
    >
      {label}
    </span>
  );
}
