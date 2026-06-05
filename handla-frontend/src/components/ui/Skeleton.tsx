/**
 * Reusable skeleton primitives.
 * Usage: <Skeleton className="h-4 w-32" /> or <SkeletonCard /> etc.
 */
import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn('animate-pulse rounded-lg bg-[#1a1a1a]', className)}
      aria-hidden="true"
    />
  );
}

/** Full-page loading spinner (used by layouts during auth check) */
export function PageSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex h-screen items-center justify-center bg-[#0a0a0a]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#2a2a2a] border-t-[#fbbf24]" />
        <p className="text-xs text-[#555]">{label}</p>
      </div>
    </div>
  );
}

/** Inline spinner (e.g. inside a button) */
export function InlineSpinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent',
        className,
      )}
      aria-hidden="true"
    />
  );
}
