import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Routes the app when a push notification is tapped, and refreshes the unread
 * badge when a notification arrives in the foreground.
 *
 * Deep-link rules (based on the payload `data` set by the backend):
 *   - type MESSAGE with relatedEntityId → open that conversation
 *   - anything else → open the notifications list
 */
export function useNotificationObserver() {
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    let mounted = true;

    function routeFromData(data: Record<string, unknown> | undefined) {
      if (!data) {
        router.push('/(app)/notifications');
        return;
      }
      const type = String(data.type ?? '').toUpperCase();
      const conversationId = data.relatedEntityId as string | undefined;
      if (type === 'MESSAGE' && conversationId) {
        router.push(`/(app)/conversation/${conversationId}`);
      } else {
        router.push('/(app)/notifications');
      }
    }

    // Cold start: app opened by tapping a notification.
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!mounted || !response) return;
      routeFromData(response.notification.request.content.data as Record<string, unknown>);
    });

    // Warm: notification tapped while app is running/background.
    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      routeFromData(response.notification.request.content.data as Record<string, unknown>);
    });

    // Foreground receipt: refresh the unread-count badge query.
    const receiveSub = Notifications.addNotificationReceivedListener(() => {
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    });

    return () => {
      mounted = false;
      responseSub.remove();
      receiveSub.remove();
    };
  }, [router, queryClient]);
}
