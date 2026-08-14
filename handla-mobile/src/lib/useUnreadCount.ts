import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { notificationsApi } from './endpoints';

/**
 * Shared unread-notification count query. Used by the header bell badge and the
 * drawer's Chat item badge so both stay in sync from a single source.
 */
export function useUnreadCount() {
  const authed = useAuthStore((s) => s.status === 'authenticated');
  const q = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: () =>
      notificationsApi.unreadCount().then((r) => {
        const d = r.data?.data as { unreadCount?: number; count?: number } | number | undefined;
        if (typeof d === 'number') return d;
        return d?.unreadCount ?? d?.count ?? 0;
      }),
    enabled: authed,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
  return q.data ?? 0;
}
