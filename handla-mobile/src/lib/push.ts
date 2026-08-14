import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { notificationsApi } from './endpoints';

/**
 * Native push-notification helpers (Expo).
 *
 * Flow:
 *   1. registerForPushNotifications() — asks permission, gets the Expo push
 *      token, and POSTs it to the backend so the server can push to this device.
 *   2. The backend sends via the Expo Push API whenever a notification is
 *      created (new chat message, ERP event, etc.).
 *
 * Notes / limitations:
 *   - Physical device required for real remote push (simulators/emulators can't
 *     receive APNs/FCM). We no-op gracefully on non-devices.
 *   - Expo Go on iOS (SDK 53+) cannot receive remote push — a development build
 *     (npx expo run:ios) or EAS build is required. The token fetch still works;
 *     delivery just won't fire until a proper build.
 */

// Foreground behaviour: show a banner + play sound + set the badge even while
// the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/** Resolve the EAS projectId if configured (needed for token fetch on builds). */
function getProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId
  );
}

/**
 * Ask for permission, get the Expo push token, and register it with the backend.
 * Returns the token on success, or null if unavailable/denied.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Remote push only works on real hardware.
  if (!Device.isDevice) {
    return null;
  }

  // Android requires a notification channel for heads-up notifications.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FBBF24',
    });
  }

  // Permission handshake.
  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== 'granted') {
    return null;
  }

  // Fetch the Expo push token.
  let token: string;
  try {
    const projectId = getProjectId();
    const res = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    token = res.data;
  } catch {
    return null;
  }

  // Register with the backend (best-effort — don't crash the app on failure).
  try {
    await notificationsApi.registerPushToken({
      token,
      platform: Platform.OS,
      deviceName: Device.deviceName ?? undefined,
    });
  } catch {
    // Backend unreachable / not signed in yet — token will re-register on next
    // successful launch.
    return token;
  }

  return token;
}

/** Unregister this device's token (call on sign-out). */
export async function unregisterPushNotifications(): Promise<void> {
  if (!Device.isDevice) return;
  try {
    const projectId = getProjectId();
    const res = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    await notificationsApi.unregisterPushToken(res.data);
  } catch {
    // Ignore — best-effort cleanup.
  }
}

/** Clear the app icon badge (e.g. when the user opens the notifications list). */
export async function clearBadge(): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(0);
  } catch {
    // no-op
  }
}
