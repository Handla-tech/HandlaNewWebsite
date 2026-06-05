'use client';

import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { useSocket } from '@/hooks/useSocket';
import { useNotifications } from '@/hooks/useNotifications';
import { ToastContainer } from '@/components/ui/ToastContainer';
import { OfflineBanner }  from '@/components/ui/OfflineBanner';
import { registerAuthFailureCallback } from '@/lib/api';

// ─── QueryClient singleton ────────────────────────────────────────────────────
//
// Lives OUTSIDE the component so the same instance is reused across renders.

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:            30_000,
      retry:                1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

// ─── AppInitializer — client-only side-effects ────────────────────────────────

function AppInitializer() {
  const router    = useRouter();
  const theme     = useUIStore((s) => s.theme);
  const locale    = useUIStore((s) => s.locale);
  const setTheme  = useUIStore((s) => s.setTheme);
  const setLocale = useUIStore((s) => s.setLocale);
  const getMe     = useAuthStore((s) => s.getMe);
  const setUser   = useAuthStore((s) => s.setUser);

  // ── Register auth-failure callback (runs once) ──────────────────────────
  //
  // The Axios interceptor calls this when a token refresh fails, instead of
  // window.location.href = '/auth'.  That hard reload kept the httpOnly
  // access_token cookie intact → middleware saw the cookie → redirected to
  // /dashboard → getMe() 401 → refresh fails → /auth → repeat (infinite loop).
  //
  // This callback instead:
  //   1. Clears Zustand state + sessionStorage so isLoggedIn becomes false
  //   2. Uses Next.js router.push() (soft navigation) so middleware is NOT
  //      re-run for the transition and the cookie check is skipped.
  const handleAuthFailure = useCallback(() => {
    setUser(null);          // clears Zustand + sessionStorage persist
    router.push('/auth');   // soft nav — no cookie re-check by middleware
  }, [setUser, router]);

  useEffect(() => {
    registerAuthFailureCallback(handleAuthFailure);
  }, [handleAuthFailure]);

  // ── Re-validate session on mount (skip on /auth to avoid the loop) ──────
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.pathname !== '/auth') {
      getMe().catch(() => {
        // Silently ignore — user is simply not authenticated
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Apply stored theme + locale ──────────────────────────────────────────
  useEffect(() => {
    setTheme(theme);
    setLocale(locale);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── WebSocket connection for authenticated users ─────────────────────────
  useSocket();

  // ── Register notification query observers at root level ─────────────────
  //
  // Registering useNotifications() here (outside any mounted-guard) ensures
  // the ['notifications-unread'] React Query observer ALWAYS exists once the
  // user is authenticated.  Without this, the observer only lives inside
  // <BellInner> which is behind a `mounted` guard — meaning
  // queryClient.invalidateQueries(['notifications-unread']) fired by the
  // socket handler would be a no-op until the user opens the bell panel.
  //
  // With the observer here, any invalidation immediately triggers a refetch
  // that calls setUnreadCount() in the store, which in turn re-renders the
  // bell badge via its direct Zustand subscription.
  useNotifications();

  return null;
}

// ─── ClientOnlyShell ──────────────────────────────────────────────────────────
//
// Gates AppInitializer behind a mount check to avoid SSR reading
// localStorage/sessionStorage (Zustand persist).

function ClientOnlyShell() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? <AppInitializer /> : null;
}

// ─── Root Providers ───────────────────────────────────────────────────────────

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ClientOnlyShell />
      <OfflineBanner />
      {children}
      <ToastContainer />
    </QueryClientProvider>
  );
}
