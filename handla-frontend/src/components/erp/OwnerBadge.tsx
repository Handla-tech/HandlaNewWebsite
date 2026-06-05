'use client';

/**
 * OwnerBadge — shows the assigned employee's name with avatar initials.
 * Falls back to "Unassigned" when owner is null/undefined.
 */

import { cn, getInitials, getAvatarColor } from '@/lib/utils';
import type { User } from '@/types';

interface OwnerBadgeProps {
  owner?: User | null;
  className?: string;
}

export default function OwnerBadge({ owner, className }: OwnerBadgeProps) {
  if (!owner) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border border-[#2a2a2a] bg-[#111] px-2 py-0.5 text-xs text-[#666]',
          className,
        )}
        aria-label="Unassigned"
      >
        <span className="h-4 w-4 rounded-full bg-[#2a2a2a] flex items-center justify-center text-[8px] text-[#666]">
          ?
        </span>
        Unassigned
      </span>
    );
  }

  const initials = getInitials(owner.name);
  const avatarBg = getAvatarColor(owner.name);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-blue-400/20 bg-blue-400/10 px-2 py-0.5 text-xs text-blue-300',
        className,
      )}
      aria-label={`Assigned to ${owner.name}`}
      title={owner.name}
    >
      <span
        className={cn(
          'h-4 w-4 rounded-full flex items-center justify-center text-[8px] font-semibold text-white',
          avatarBg,
        )}
        aria-hidden="true"
      >
        {initials.slice(0, 2)}
      </span>
      <span className="max-w-[100px] truncate">{owner.name}</span>
    </span>
  );
}
