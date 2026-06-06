'use client';

/**
 * Shared <Avatar /> component.
 *
 * Renders, in priority order:
 *   1. <img src={user.avatarUrl}> when the user has uploaded an avatar
 *   2. Coloured initials disc (the legacy fallback) when no avatar is set
 *      OR when the avatar URL fails to load (broken image, S3 404, etc.)
 *   3. A neutral "?" disc when no user is provided at all
 *
 * One reusable component replaces the ad-hoc avatar JSX that was duplicated
 * in MessageList / ChatWindow / dashboard layout / ERP layout / etc., so the
 * chat avatar fix in this PR automatically rolls out everywhere it's used.
 */

import { useState } from 'react';
import { getAvatarColor, getInitials, cn } from '@/lib/utils';
import type { User } from '@/types';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: 'h-6 w-6 text-[9px]',
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-10 w-10 text-sm',
  xl: 'h-16 w-16 text-lg',
};

export interface AvatarProps {
  /**
   * The user to render. May be undefined while data loads — the component
   * gracefully renders a neutral "?" disc in that case (no layout shift).
   */
  user?: Pick<User, 'id' | 'name' | 'avatarUrl'> | null;
  /** Visual size — defaults to `sm` (28px). */
  size?: AvatarSize;
  /** Optional extra Tailwind classes (border, ring, etc.) */
  className?: string;
  /** Optional tooltip override (defaults to user.name). */
  title?: string;
}

export default function Avatar({
  user,
  size = 'sm',
  className,
  title,
}: AvatarProps) {
  // When the <img> fails to load we flip to the initials fallback instead of
  // showing the browser's broken-image icon. One-shot — does not reset on
  // re-render because we key the <img> by its src.
  const [imgFailed, setImgFailed] = useState(false);

  const sizeClass = SIZE_CLASSES[size];
  const tooltip   = title ?? user?.name ?? '';

  // No user → neutral "?" disc, but at least no broken layout.
  if (!user) {
    return (
      <div
        className={cn(
          'flex flex-shrink-0 items-center justify-center rounded-full font-bold text-white bg-[#2a2a2a]',
          sizeClass,
          className,
        )}
        aria-label="Unknown user"
      >
        ?
      </div>
    );
  }

  const showImage = !!user.avatarUrl && !imgFailed;

  if (showImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={user.avatarUrl!}
        src={user.avatarUrl!}
        alt={user.name || 'User avatar'}
        title={tooltip}
        onError={() => setImgFailed(true)}
        className={cn(
          'flex-shrink-0 rounded-full object-cover bg-[#1a1a1a]',
          sizeClass,
          className,
        )}
      />
    );
  }

  // Initials fallback
  return (
    <div
      className={cn(
        'flex flex-shrink-0 items-center justify-center rounded-full font-bold text-white',
        sizeClass,
        getAvatarColor(user.id),
        className,
      )}
      title={tooltip}
      aria-label={user.name}
    >
      {getInitials(user.name)}
    </div>
  );
}
