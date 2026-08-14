import axios, {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
} from 'axios';
import { API_URL } from './config';
import { tokenStorage } from './storage';

/**
 * Shared Axios instance for the mobile app.
 *
 * Unlike the web frontend (httpOnly cookies), mobile uses Bearer tokens read
 * from SecureStore. A response interceptor transparently refreshes the access
 * token on 401 using the stored refresh token (sent in the body), then retries
 * the original request once.
 */
const DEFAULT_TIMEOUT_MS = 60_000;

export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: DEFAULT_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Request interceptor — attach Bearer token ────────────────────────────────
api.interceptors.request.use(async (config) => {
  const token = await tokenStorage.getAccess();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Forced-logout callback (registered by the auth store) ─────────────────────
type LogoutCallback = () => void;
let _onAuthFailure: LogoutCallback | null = null;
export function registerAuthFailureCallback(cb: LogoutCallback) {
  _onAuthFailure = cb;
}

// ─── Single-flight refresh guard ──────────────────────────────────────────────
let isRefreshing = false;
let pendingQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function flushQueue(error: unknown, token: string | null) {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (token) resolve(token);
    else reject(error);
  });
  pendingQueue = [];
}

async function performRefresh(): Promise<string> {
  const refreshToken = await tokenStorage.getRefresh();
  if (!refreshToken) throw new Error('No refresh token');

  // Use a bare axios call (no interceptors) to avoid recursion.
  const res = await axios.post(
    `${API_URL}/auth/refresh`,
    { refreshToken },
    { headers: { 'Content-Type': 'application/json' }, timeout: DEFAULT_TIMEOUT_MS },
  );
  const data = res.data?.data ?? {};
  const newAccess: string = data.accessToken;
  const newRefresh: string = data.refreshToken ?? refreshToken;
  if (!newAccess) throw new Error('Refresh did not return an access token');
  await tokenStorage.save(newAccess, newRefresh);
  return newAccess;
}

// ─── Response interceptor — transparent refresh + retry ────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const status = error.response?.status;
    const url = original?.url ?? '';

    // Don't try to refresh the refresh/signin endpoints themselves.
    const isAuthEndpoint =
      url.includes('/auth/refresh') || url.includes('/auth/signin') || url.includes('/auth/signup');

    if (status === 401 && original && !original._retry && !isAuthEndpoint) {
      original._retry = true;

      if (isRefreshing) {
        // Queue until the in-flight refresh resolves.
        return new Promise((resolve, reject) => {
          pendingQueue.push({
            resolve: (token: string) => {
              original.headers.Authorization = `Bearer ${token}`;
              resolve(api(original));
            },
            reject,
          });
        });
      }

      isRefreshing = true;
      try {
        const newToken = await performRefresh();
        flushQueue(null, newToken);
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch (refreshErr) {
        flushQueue(refreshErr, null);
        await tokenStorage.clear();
        _onAuthFailure?.();
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

// ─── Helper to unwrap the { message, data } envelope ───────────────────────────
export function unwrap<T>(p: Promise<{ data: { data: T } }>): Promise<T> {
  return p.then((r) => r.data.data);
}
