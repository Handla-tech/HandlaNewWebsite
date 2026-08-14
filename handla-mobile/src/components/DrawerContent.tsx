import React from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { DrawerContentScrollView, DrawerContentComponentProps } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { useUnreadCount } from '@/lib/useUnreadCount';
import { useT } from '@/i18n';
import { spacing, radius, font, useTheme } from '@/theme';

/**
 * Custom drawer content: branded header + role-aware module list + footer.
 *
 * The module list is driven by the router's actual drawer routes (so active
 * highlighting stays in sync), while the branded header and sign-out footer
 * are rendered around it.
 */
export function DrawerContent(props: DrawerContentComponentProps) {
  const { state, navigation } = props;
  const { colors } = useTheme();
  const { t } = useT();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const unreadCount = useUnreadCount();

  // The route currently focused in the drawer navigator.
  const activeRouteName = state.routeNames[state.index];

  // Icon per module route. Falls back to a generic dot.
  const iconFor: Record<string, keyof typeof Ionicons.glyphMap> = {
    dashboard: 'grid-outline',
    chat: 'chatbubbles-outline',
    support: 'ticket-outline',
    sales: 'briefcase-outline',
    finance: 'wallet-outline',
    clients: 'people-circle-outline',
    projects: 'folder-open-outline',
    tasks: 'checkbox-outline',
    suppliers: 'business-outline',
    analytics: 'stats-chart-outline',
    users: 'people-outline',
    testimonials: 'chatbox-ellipses-outline',
    tenants: 'cube-outline',
    team: 'people-outline',
  };

  // Only the routes that expo-router marks as visible drawer items.
  const items = state.routes.filter((r) => {
    const opts = props.descriptors[r.key]?.options as { drawerItemStyle?: { display?: string } };
    // Hidden routes set drawerItemStyle: { display: 'none' }.
    return opts?.drawerItemStyle?.display !== 'none' && iconFor[r.name];
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={{ paddingTop: 0 }}
        style={{ backgroundColor: colors.surface }}
      >
        {/* Branded header */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: spacing.lg,
            borderBottomColor: colors.border,
            borderBottomWidth: 1,
            marginBottom: spacing.sm,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: radius.md,
                backgroundColor: colors.accentSoft,
                borderColor: colors.accentBorder,
                borderWidth: 1,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: colors.accent, fontSize: font.lg, fontWeight: '800' }}>H</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: font.lg, fontWeight: '800' }}>Handla</Text>
              <Text style={{ color: colors.textFaint, fontSize: font.xs }} numberOfLines={1}>
                {user?.email ?? ''}
              </Text>
            </View>
          </View>
        </View>

        {/* Module list */}
        <View style={{ paddingHorizontal: spacing.sm }}>
          {items.map((route) => {
            const focused = route.name === activeRouteName;
            const label = t(`tabs.${route.name}`);
            return (
              <Pressable
                key={route.key}
                onPress={() => navigation.navigate(route.name as never)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  paddingVertical: spacing.md,
                  paddingHorizontal: spacing.md,
                  borderRadius: radius.md,
                  marginBottom: 2,
                  backgroundColor: focused ? colors.accentSoft : 'transparent',
                  borderWidth: 1,
                  borderColor: focused ? colors.accentBorder : 'transparent',
                }}
              >
                <Ionicons
                  name={iconFor[route.name] ?? 'ellipse-outline'}
                  size={20}
                  color={focused ? colors.accent : colors.textMuted}
                />
                <Text
                  style={{
                    flex: 1,
                    color: focused ? colors.accent : colors.text,
                    fontSize: font.md,
                    fontWeight: focused ? '700' : '500',
                  }}
                >
                  {label}
                </Text>
                {route.name === 'chat' && unreadCount > 0 && (
                  <View
                    style={{
                      minWidth: 20,
                      height: 20,
                      borderRadius: radius.pill,
                      backgroundColor: '#ef4444',
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingHorizontal: 6,
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </DrawerContentScrollView>

      {/* Footer: profile row + sign out */}
      <View
        style={{
          borderTopColor: colors.border,
          borderTopWidth: 1,
          padding: spacing.md,
          gap: spacing.xs,
        }}
      >
        <Pressable
          onPress={() => navigation.navigate('profile' as never)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            borderRadius: radius.md,
          }}
        >
          {user?.avatarUrl ? (
            <Image
              source={{ uri: user.avatarUrl }}
              style={{ width: 34, height: 34, borderRadius: radius.pill }}
            />
          ) : (
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: radius.pill,
                backgroundColor: colors.accentSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: colors.accent, fontWeight: '700' }}>
                {(user?.name ?? '?').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: font.sm, fontWeight: '600' }} numberOfLines={1}>
              {user?.name ?? '—'}
            </Text>
            <Text style={{ color: colors.textFaint, fontSize: font.xs }}>{user?.role}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
        </Pressable>

        <Pressable
          onPress={() => signOut()}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            borderRadius: radius.md,
          }}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.textMuted} />
          <Text style={{ color: colors.textMuted, fontSize: font.sm, fontWeight: '600' }}>
            {t('common.signOut')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
