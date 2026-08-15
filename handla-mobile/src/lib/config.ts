import Constants from 'expo-constants';

/**
 * Resolves the backend base URL + socket URL.
 *
 * Priority:
 *   1. EXPO_PUBLIC_API_URL / EXPO_PUBLIC_SOCKET_URL env vars (set at build time)
 *   2. app.json `expo.extra.apiUrl` / `socketUrl` (explicit override — use in prod)
 *   3. Expo dev-host auto-detection (DEV only): reuse the LAN IP of the machine
 *      running Metro — the phone is already talking to it, so the backend on the
 *      same machine is reachable without hardcoding an IP that breaks whenever
 *      the dev machine's DHCP address changes.
 *   4. localhost fallback (last resort)
 *
 * The API base URL already includes the global `/api` prefix (matching the web
 * frontend's NEXT_PUBLIC_API_URL convention).
 */
const extra = (Constants.expoConfig?.extra ?? {}) as {
  apiUrl?: string;
  socketUrl?: string;
};

/** Port the backend listens on in dev (see handla-backend). */
const DEV_BACKEND_PORT = 3001;

/**
 * In development, derive the dev machine's host (IP or hostname) from the Expo
 * runtime. `hostUri` looks like "192.168.0.7:8081" (Metro bundler). We strip the
 * Metro port and swap in the backend port, so a phone that can load the JS bundle
 * can also reach the API — no manual IP editing required.
 *
 * Returns undefined when the host can't be determined (e.g. production builds,
 * tunnel URLs) so the caller can fall back to explicit config.
 */
function devHostApiUrl(): string | undefined {
  if (!__DEV__) return undefined;

  // expoConfig.hostUri is the modern field; fall back to older locations on
  // legacy Expo runtimes (typed loosely — these fields aren't in current types).
  const c = Constants as unknown as {
    expoConfig?: { hostUri?: string };
    manifest?: { debuggerHost?: string };
    manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } };
  };
  const hostUri =
    c.expoConfig?.hostUri ||
    c.manifest?.debuggerHost ||
    c.manifest2?.extra?.expoGo?.debuggerHost;

  if (!hostUri || typeof hostUri !== 'string') return undefined;

  // hostUri: "host:port" (possibly with a scheme) — take just the host part.
  const host = hostUri.split('://').pop()?.split(':')[0]?.trim();
  if (!host) return undefined;

  // Tunnel/hosted URLs (e.g. *.exp.direct) don't map to a LAN backend — skip.
  if (host.includes('exp.direct') || host.includes('exp.host')) return undefined;

  return `http://${host}:${DEV_BACKEND_PORT}/api`;
}

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  extra.apiUrl ||
  devHostApiUrl() ||
  'http://localhost:3001/api';

export const SOCKET_URL =
  process.env.EXPO_PUBLIC_SOCKET_URL ||
  extra.socketUrl ||
  API_URL.replace(/\/api\/?$/, '');
