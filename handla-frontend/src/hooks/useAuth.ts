'use client';

import { useCallback, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import type { SignInPayload, SignUpPayload } from '@/types';

/**
 * useAuth — convenience wrapper around authStore.
 * Hydrates the user from the server on first mount.
 */
export function useAuth() {
  const {
    user,
    isLoggedIn,
    isLoading,
    authResolved,
    error,
    login,
    signup,
    logout,
    refresh,
    getMe,
    setUser,
    clearError,
  } = useAuthStore();

  // On first client render, always validate the session against the server.
  // `getMe()` flips `authResolved=true` in its finally block regardless of
  // outcome, which the route guards wait on. We must run it even when the
  // persisted store already says `isLoggedIn` (e.g. after a hard refresh):
  // `authResolved` is intentionally NOT persisted, so skipping getMe there
  // would leave guards stuck on the loading spinner forever.
  useEffect(() => {
    getMe().catch(() => {
      // Ignore — user is simply not logged in yet (getMe still sets authResolved)
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = useCallback(
    async (payload: SignInPayload) => {
      await login(payload);
    },
    [login],
  );

  const handleSignup = useCallback(
    async (payload: SignUpPayload) => {
      await signup(payload);
    },
    [signup],
  );

  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  return {
    user,
    isLoggedIn,
    isLoading,
    authResolved,
    error,
    isAdmin:    user?.role === 'ADMIN',
    isEmployee: user?.role === 'EMPLOYEE',
    isClient:   user?.role === 'CLIENT',
    isLead:     user?.role === 'LEAD',
    login:      handleLogin,
    signup:     handleSignup,
    logout:     handleLogout,
    refresh,
    getMe,
    setUser,
    clearError,
  };
}
