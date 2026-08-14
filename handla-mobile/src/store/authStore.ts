import { create } from 'zustand';
import { authApi } from '@/lib/endpoints';
import { registerAuthFailureCallback } from '@/lib/api';
import { API_URL } from '@/lib/config';
import { tokenStorage } from '@/lib/storage';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import { registerForPushNotifications, unregisterPushNotifications } from '@/lib/push';
import type { User, AuthResult, SignInOutcome, VerificationPurpose } from '@/types';

interface AuthState {
  user: User | null;
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
  error: string | null;

  bootstrap: () => Promise<void>;
  /**
   * Sign in. Returns a discriminated outcome instead of throwing on the
   * "email not verified" path:
   *  - { verified: true, user }               → session established
   *  - { verified: false, email, purpose }    → OTP emailed; go to verify screen
   * Genuine failures (bad credentials, network) still throw.
   */
  signIn: (email: string, password: string) => Promise<SignInOutcome>;
  /** Complete a pending verification by submitting the emailed code. */
  verifyOtp: (email: string, code: string, purpose: VerificationPurpose) => Promise<User>;
  /** Request a fresh verification code (server enforces the cooldown). */
  resendOtp: (email: string, purpose: VerificationPurpose, locale?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshMe: () => Promise<void>;

  // Role helpers
  isAdmin: () => boolean;
  isEmployee: () => boolean;
  isStaff: () => boolean;
  isClient: () => boolean;
}

/**
 * Persist tokens and wire up post-login side effects (socket + push). Shared by
 * both the direct sign-in path and the OTP-verification path so a session is
 * always established identically. Returns the authenticated user.
 */
async function establishSession(data: AuthResult): Promise<User> {
  const { user, accessToken, refreshToken } = data;
  await tokenStorage.save(accessToken, refreshToken);
  connectSocket().catch(() => {/* best-effort; chat screens retry */});
  // Register this device for native push (best-effort, non-blocking).
  void registerForPushNotifications();
  return user;
}

/** Normalize an axios/unknown error into a user-facing message. */
function errorMessage(err: unknown, fallback: string): string {
  const axiosErr = err as {
    response?: { data?: { message?: string | string[] } };
    request?: unknown;
    code?: string;
  };
  const serverMsg = axiosErr?.response?.data?.message;
  if (serverMsg) {
    // The server responded (bad credentials, invalid/expired code, cooldown,
    // email-delivery failure, …) — trust its message. class-validator may send
    // an array of messages; show the first.
    return Array.isArray(serverMsg) ? serverMsg[0] : serverMsg;
  }
  if (axiosErr?.request || axiosErr?.code === 'ECONNABORTED') {
    // Request made but no response — network / unreachable backend. (On a
    // phone this usually means the API URL points at a host the device can't
    // reach. Set EXPO_PUBLIC_API_URL to your LAN IP.)
    return `Cannot reach the server at ${API_URL}. Check your connection and that the backend is running and reachable from this device.`;
  }
  return fallback;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  status: 'idle',
  error: null,

  /** On app launch: if we have a stored token, fetch the current user. */
  bootstrap: async () => {
    set({ status: 'loading', error: null });
    const token = await tokenStorage.getAccess();
    if (!token) {
      set({ status: 'unauthenticated', user: null });
      return;
    }
    try {
      const res = await authApi.me();
      set({ user: res.data.data.user, status: 'authenticated' });
      connectSocket().catch(() => {/* best-effort; chat screens retry */});
      // Register this device for native push (best-effort, non-blocking).
      void registerForPushNotifications();
    } catch {
      await tokenStorage.clear();
      set({ status: 'unauthenticated', user: null });
    }
  },

  signIn: async (email, password) => {
    set({ status: 'loading', error: null });
    try {
      const res = await authApi.signIn(email, password);
      const data = res.data.data as {
        status?: string;
        purpose?: VerificationPurpose;
        user?: User;
        accessToken?: string;
        refreshToken?: string;
      };

      // Unverified account: no tokens, backend emailed a code. Return a pending
      // outcome so the UI can route to the OTP verification screen (rather than
      // throwing — this is an expected branch, not an error).
      if (data?.status === 'verification_required' || !data?.accessToken) {
        set({ status: 'unauthenticated' });
        return {
          verified: false,
          email: email.trim().toLowerCase(),
          purpose: data?.purpose ?? 'SIGNUP',
        };
      }

      // Verified account: establish the session directly.
      const user = await establishSession({
        user: data.user as User,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken as string,
      });
      set({ user, status: 'authenticated' });
      return { verified: true, user };
    } catch (err: unknown) {
      const message = errorMessage(err, 'Sign in failed. Please try again.');
      set({ status: 'unauthenticated', error: message });
      throw new Error(message);
    }
  },

  verifyOtp: async (email, code, purpose) => {
    set({ status: 'loading', error: null });
    try {
      const res = await authApi.verifyOtp({ email: email.trim().toLowerCase(), code, purpose });
      const user = await establishSession(res.data.data);
      set({ user, status: 'authenticated' });
      return user;
    } catch (err: unknown) {
      const message = errorMessage(err, 'Verification failed. Please try again.');
      set({ status: 'unauthenticated', error: message });
      throw new Error(message);
    }
  },

  resendOtp: async (email, purpose, locale) => {
    try {
      await authApi.resendOtp({ email: email.trim().toLowerCase(), purpose, locale });
    } catch (err: unknown) {
      throw new Error(errorMessage(err, 'Could not resend the code. Please try again.'));
    }
  },

  signOut: async () => {
    // Unregister this device's push token first (best-effort) while we still
    // have a valid session.
    await unregisterPushNotifications();
    try {
      await authApi.logout();
    } catch {
      /* best-effort; clear locally regardless */
    }
    disconnectSocket();
    await tokenStorage.clear();
    set({ user: null, status: 'unauthenticated', error: null });
  },

  refreshMe: async () => {
    try {
      const res = await authApi.me();
      set({ user: res.data.data.user });
    } catch {
      /* ignore transient errors */
    }
  },

  isAdmin: () => get().user?.role === 'ADMIN',
  isEmployee: () => get().user?.role === 'EMPLOYEE',
  isStaff: () => {
    const r = get().user?.role;
    return r === 'ADMIN' || r === 'EMPLOYEE';
  },
  isClient: () => get().user?.role === 'CLIENT',
}));

// Wire the interceptor's forced-logout hook into the store once.
registerAuthFailureCallback(() => {
  disconnectSocket();
  useAuthStore.setState({ user: null, status: 'unauthenticated' });
});
