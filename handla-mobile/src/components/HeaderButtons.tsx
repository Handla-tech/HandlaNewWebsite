import React from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { notificationsApi } from '@/lib/endpoints';
import { spacing, radius, font, useTheme } from '@/theme';

/**
 * Header left: hamburger that opens the drawer.
 */
export function HeaderMenuButton() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
      hitSlop={10}
      style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}
    >
      <Ionicons name="menu" size={26} color={colors.text} />
    </Pressable>
  );
}

/**
 * Header right: notifications bell (with unread badge) + profile avatar.
 */
export function HeaderActions() {
  const router = useRouter();
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const authed = useAuthStore((s) => s.status === 'authenticated');

  const unread = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: () =>
      notificationsApi.unreadCount().then((r) => {
        const d = r.data?.data as { count?: number } | number | undefined;
        if (typeof d === 'number') return d;
        return d?.count ?? 0;
      }),
    enabled: authed,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const count = unread.data ?? 0;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingRight: spacing.md }}>
      {/* Notifications */}
      <Pressable
        onPress={() => router.push('/(app)/notifications')}
        hitSlop={8}
        style={{ padding: spacing.sm }}
      >
        <View>
          <Ionicons name="notifications-outline" size={23} color={colors.text} />
          {count > 0 && (
            <View
              style={{
                position: 'absolute',
                top: -4,
                right: -5,
                minWidth: 16,
                height: 16,
                borderRadius: radius.pill,
                backgroundColor: '#ef4444',
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 3,
                borderWidth: 1.5,
                borderColor: colors.surface,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>
                {count > 99 ? '99+' : count}
              </Text>
            </View>
          )}
        </View>
      </Pressable>

      {/* Profile */}
      <Pressable onPress={() => router.push('/(app)/profile')} hitSlop={8} style={{ padding: spacing.xs }}>
        {user?.avatarUrl ? (
          <Image
            source={{ uri: user.avatarUrl }}
            style={{
              width: 30,
              height: 30,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          />
        ) : (
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: radius.pill,
              backgroundColor: colors.accentSoft,
              borderColor: colors.accentBorder,
              borderWidth: 1,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: colors.accent, fontSize: font.sm, fontWeight: '800' }}>
              {(user?.name ?? '?').charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}
