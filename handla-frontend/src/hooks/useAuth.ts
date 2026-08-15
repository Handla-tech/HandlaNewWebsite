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

  // Session validation is owned by Providers.AppInitializer (the single root
  // that always mounts), which calls getMe() once on load. `getMe()` flips
  // `authResolved=true` in its finally block regardless of outcome, which the
  // route guards wait on.
  //
  // We DO NOT call getMe() here as well: doing so previously double-fired the
  // /auth/me probe from every component that used this hook, which — combined
  // with re-renders on a 401 — produced the runaway "request count climbing"
  // loop. As a belt-and-braces safeguard, getMe() is also in-flight-deduped in
  // the store. If auth has not been resolved yet by the time a guarded layout
  // mounts, kick off exactly one resolution pass (dedup makes this a no-op if
  // Providers already started it).
  useEffect(() => {
    if (!authResolved) {
      getMe().catch(() => {
        // Ignore — user is simply not logged in yet (getMe still sets authResolved)
      });
    }
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
