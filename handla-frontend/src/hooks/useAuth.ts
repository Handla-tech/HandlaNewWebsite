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
    error,
    login,
    signup,
    logout,
    refresh,
    getMe,
    setUser,
    clearError,
  } = useAuthStore();

  // On first client render, try to fetch the current user.
  // If the access_token cookie is valid, this succeeds silently.
  // If it returns 401, the Axios interceptor will attempt a token refresh.
  useEffect(() => {
    if (!isLoggedIn) {
      getMe().catch(() => {
        // Ignore — user is simply not logged in yet
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
