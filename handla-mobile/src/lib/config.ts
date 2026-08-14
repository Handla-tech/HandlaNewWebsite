import Constants from 'expo-constants';

/**
 * Resolves the backend base URL + socket URL.
 *
 * Priority:
 *   1. EXPO_PUBLIC_API_URL / EXPO_PUBLIC_SOCKET_URL env vars (set at build time)
 *   2. app.json `expo.extra.apiUrl` / `socketUrl`
 *   3. localhost fallback (dev)
 *
 * The API base URL already includes the global `/api` prefix (matching the web
 * frontend's NEXT_PUBLIC_API_URL convention).
 */
const extra = (Constants.expoConfig?.extra ?? {}) as {
  apiUrl?: string;
  socketUrl?: string;
};

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL || extra.apiUrl || 'http://localhost:3001/api';

export const SOCKET_URL =
  process.env.EXPO_PUBLIC_SOCKET_URL ||
  extra.socketUrl ||
  API_URL.replace(/\/api\/?$/, '');
