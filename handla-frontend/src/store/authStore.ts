'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { authApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import type { AuthState, User, SignInPayload, SignUpPayload } from '@/types';

const LOG = '[authStore]';

interface AuthStore extends AuthState {
  error: string | null;
  clearError: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // ── State ──────────────────────────────────────────────────────────────
      user: null,
      isLoggedIn: false,
      isLoading: false,
      error: null,

      // ── Actions ────────────────────────────────────────────────────────────

      setUser: (user: User | null) => {
        console.debug(`${LOG} setUser  userId=${user?.id ?? 'null'}  role=${user?.role ?? 'none'}`);
        set({ user, isLoggedIn: user !== null });
      },

      clearError: () => set({ error: null }),

      /**
       * Start signup (step 1 of 2). The backend validates + emails a 6-digit
       * OTP and returns { status: 'verification_required', email, purpose }.
       * NO session is created here — that only happens after verifyOtp().
       * Returns the email to verify so the caller can show the OTP screen.
       */
      signup: async (payload: SignUpPayload) => {
        console.debug(`${LOG} signup()  email=${payload.email}`);
        set({ isLoading: true, error: null });
        try {
          const res = await authApi.signUp(payload);
          const data = res.data?.data ?? {};
          console.debug(`${LOG} signup() ✅ pending verification  email=${data.email}`);
          return { email: data.email as string, purpose: 'SIGNUP' as const };
        } catch (err) {
          const status = (err as { response?: { status?: number } })?.response?.status;
          console.error(`${LOG} signup() ❌  status=${status}  email=${payload.email}`, err);
          set({ error: getErrorMessage(err) });
          throw err;
        } finally {
          set({ isLoading: false });
        }
      },

      /**
       * Start sign in (step 1 of 2). Validates credentials + emails an OTP.
       * NO session yet — verifyOtp() completes it. Returns the pending email.
       */
      login: async (payload: SignInPayload) => {
        console.debug(`${LOG} login()  email=${payload.email}`);
        set({ isLoading: true, error: null });
        try {
          const res = await authApi.signIn(payload);
          const data = res.data?.data ?? {};
          console.debug(`${LOG} login() ✅ pending verification  email=${data.email}`);
          return { email: data.email as string, purpose: 'LOGIN' as const };
        } catch (err) {
          const status = (err as { response?: { status?: number } })?.response?.status;
          console.error(`${LOG} login() ❌  status=${status}  email=${payload.email}`, err);
          set({ error: getErrorMessage(err) });
          throw err;
        } finally {
          set({ isLoading: false });
        }
      },

      /** Sign out and clear all state */
      logout: async () => {
        console.debug(`${LOG} logout()  userId=${get().user?.id ?? 'null'}`);
        set({ isLoading: true });
        try {
          await authApi.signOut();
          console.debug(`${LOG} logout() ✅  server signOut succeeded`);
        } catch (err) {
          const status = (err as { response?: { status?: number } })?.response?.status;
          console.warn(`${LOG} logout() ⚠️  server signOut failed (status=${status}) — clearing local state anyway`, err);
        } finally {
          set({ user: null, isLoggedIn: false, isLoading: false, error: null });
          console.debug(`${LOG} logout() — local state cleared`);
        }
      },

      /** Attempt to refresh the access token using the httpOnly refresh cookie */
      refresh: async () => {
        console.debug(`${LOG} refresh() → calling /auth/refresh`);
        try {
          await authApi.refresh();
          console.debug(`${LOG} refresh() ✅  token refreshed — re-fetching user`);
          // Refresh call succeeded; re-fetch user profile to sync state
          await get().getMe();
        } catch (err) {
          const status = (err as { response?: { status?: number } })?.response?.status;
          console.warn(`${LOG} refresh() ❌  status=${status} — clearing session`, err);
          set({ user: null, isLoggedIn: false });
        }
      },

      /** Fetch current user from /auth/me */
      getMe: async () => {
        console.debug(`${LOG} getMe() → calling /auth/me`);
        set({ isLoading: true });
        try {
          const res = await authApi.getMe();
          // Backend returns { message, data: { user: User } }
          // res.data (Axios) = { message, data: { user: User } }
          // so res.data?.data = { user: User } — must unwrap one more level
          const inner = res.data?.data;
          const user: User =
            (inner && typeof inner === 'object' && 'user' in inner)
              ? (inner as { user: User }).user
              : inner as User;
          console.debug(`${LOG} getMe() ✅  userId=${user?.id}  role=${user?.role}  isLoggedIn → true`);
          set({ user, isLoggedIn: true });
        } catch (err) {
          const status = (err as { response?: { status?: number } })?.response?.status;
          console.warn(`${LOG} getMe() ❌  status=${status} — not authenticated (cookie missing or expired)  → isLoggedIn=false`, err);
          set({ user: null, isLoggedIn: false });
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: 'handla-auth',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? sessionStorage : { getItem: () => null, setItem: () => {}, removeItem: () => {} }
      ),
      // Only persist user identity — never persist tokens (those are httpOnly cookies)
      partialize: (state) => ({
        user: state.user,
        isLoggedIn: state.isLoggedIn,
      }),
    },
  ),
);
