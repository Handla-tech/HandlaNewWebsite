import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View } from 'react-native';
import { useAuthStore } from '@/store/authStore';
import { useI18nStore } from '@/i18n';
import { Loading } from '@/components/ui';
import { useTheme, useThemeStore } from '@/theme';
import { useNotificationObserver } from '@/lib/useNotificationObserver';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 15_000, refetchOnWindowFocus: false },
  },
});

/**
 * Auth gate: redirects between the (auth) and (app) route groups based on the
 * authentication status. Runs after bootstrap so we don't flash the login
 * screen for an already-signed-in user.
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const hydrateI18n = useI18nStore((s) => s.hydrate);
  const i18nHydrated = useI18nStore((s) => s.hydrated);
  const hydrateTheme = useThemeStore((s) => s.hydrate);
  const themeHydrated = useThemeStore((s) => s.hydrated);
  const { colors } = useTheme();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Restore persisted theme + language (and layout direction) before render.
    hydrateTheme();
    hydrateI18n();
    bootstrap();
  }, [bootstrap, hydrateI18n, hydrateTheme]);

  useEffect(() => {
    if (status === 'idle' || status === 'loading') return;
    const inAuthGroup = segments[0] === '(auth)';
    if (status === 'authenticated' && inAuthGroup) {
      router.replace('/(app)/dashboard');
    } else if (status === 'unauthenticated' && !inAuthGroup) {
      router.replace('/(auth)/login');
    }
  }, [status, segments, router]);

  if (status === 'idle' || status === 'loading' || !i18nHydrated || !themeHydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Loading />
      </View>
    );
  }
  return <>{children}</>;
}

/** Themed navigator — reads the active palette so bg + status bar follow the theme. */
function ThemedStack() {
  const { colors, isDark } = useTheme();
  // Deep-link on notification tap + refresh unread badge on foreground receipt.
  useNotificationObserver();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AuthGate>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
            animation: 'fade',
          }}
        >
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
        </Stack>
      </AuthGate>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemedStack />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
