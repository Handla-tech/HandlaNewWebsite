import { create } from 'zustand';
import { authApi } from '@/lib/endpoints';
import { registerAuthFailureCallback } from '@/lib/api';
import { API_URL } from '@/lib/config';
import { tokenStorage } from '@/lib/storage';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
  error: string | null;

  bootstrap: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<User>;
  signOut: () => Promise<void>;
  refreshMe: () => Promise<void>;

  // Role helpers
  isAdmin: () => boolean;
  isEmployee: () => boolean;
  isStaff: () => boolean;
  isClient: () => boolean;
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
    } catch {
      await tokenStorage.clear();
      set({ status: 'unauthenticated', user: null });
    }
  },

  signIn: async (email, password) => {
    set({ status: 'loading', error: null });
    try {
      const res = await authApi.signIn(email, password);
      const { user, accessToken, refreshToken } = res.data.data;
      await tokenStorage.save(accessToken, refreshToken);
      set({ user, status: 'authenticated' });
      connectSocket().catch(() => {/* best-effort */});
      return user;
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { message?: string } };
        request?: unknown;
        code?: string;
      };
      let message: string;
      if (axiosErr?.response?.data?.message) {
        // The server responded (e.g. 401 invalid credentials) — trust its message.
        message = axiosErr.response.data.message;
      } else if (axiosErr?.request || axiosErr?.code === 'ECONNABORTED') {
        // Request was made but no response — network / unreachable backend.
        // (On a phone, this usually means the API URL points at localhost or a
        //  host the device can't reach. Set EXPO_PUBLIC_API_URL to your LAN IP.)
        message = `Cannot reach the server at ${API_URL}. Check your connection and that the backend is running and reachable from this device.`;
      } else {
        message = 'Sign in failed. Please try again.';
      }
      set({ status: 'unauthenticated', error: message });
      throw new Error(message);
    }
  },

  signOut: async () => {
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
