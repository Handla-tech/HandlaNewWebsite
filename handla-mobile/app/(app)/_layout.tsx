import React from 'react';
import { Drawer } from 'expo-router/drawer';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { useT } from '@/i18n';
import { useTheme } from '@/theme';
import { DrawerContent } from '@/components/DrawerContent';
import { HeaderMenuButton, HeaderActions } from '@/components/HeaderButtons';

/**
 * Role-aware side-drawer navigator (replaces the old crowded bottom tab bar).
 *
 * - Modules live in the left drawer (hamburger, top-left).
 * - Notifications + Profile live in the top-right header (drawer header kept).
 * - Detail routes ([id], new-ticket, team) are hidden from the drawer list via
 *   `drawerItemStyle: { display: 'none' }` and render their own back header,
 *   but stay navigable via router.push.
 */
export default function AppLayout() {
  const isStaff = useAuthStore((s) => s.isStaff());
  const { t } = useT();
  const { colors } = useTheme();

  const hidden = { drawerItemStyle: { display: 'none' as const } };
  // Detail screens render their own DetailHeader (back button), so suppress the
  // drawer's header for them and keep them out of the drawer list.
  const detail = { ...hidden, headerShown: false };

  return (
    <Drawer
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        // Screens render their own large <Title>; the header bar only carries
        // the hamburger (left) + notifications/profile (right), so keep it blank.
        headerTitle: '',
        headerShadowVisible: false,
        headerLeft: () => <HeaderMenuButton />,
        headerRight: () => <HeaderActions />,
        drawerType: 'front',
        drawerStyle: { backgroundColor: colors.surface, width: 300 },
        drawerActiveTintColor: colors.accent,
        drawerInactiveTintColor: colors.textMuted,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Drawer.Screen
        name="dashboard"
        options={{
          title: t('tabs.dashboard'),
          drawerIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} />,
        }}
      />
      <Drawer.Screen
        name="chat"
        options={{
          title: t('tabs.chat'),
          drawerIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="support"
        options={{
          title: t('tabs.support'),
          drawerIcon: ({ color, size }) => <Ionicons name="ticket-outline" size={size} color={color} />,
        }}
      />
      <Drawer.Screen
        name="sales"
        options={{
          title: t('tabs.sales'),
          drawerIcon: ({ color, size }) => <Ionicons name="briefcase-outline" size={size} color={color} />,
        }}
      />
      <Drawer.Screen
        name="finance"
        options={{
          title: t('tabs.finance'),
          drawerItemStyle: isStaff ? undefined : { display: 'none' },
          drawerIcon: ({ color, size }) => <Ionicons name="wallet-outline" size={size} color={color} />,
        }}
      />
      <Drawer.Screen
        name="clients"
        options={{
          title: t('tabs.clients'),
          drawerItemStyle: isStaff ? undefined : { display: 'none' },
          drawerIcon: ({ color, size }) => <Ionicons name="people-circle-outline" size={size} color={color} />,
        }}
      />
      <Drawer.Screen
        name="projects"
        options={{
          title: t('tabs.projects'),
          // Staff see all; clients see their own via projectsApi.mine.
          drawerIcon: ({ color, size }) => <Ionicons name="folder-open-outline" size={size} color={color} />,
        }}
      />
      <Drawer.Screen
        name="tasks"
        options={{
          title: t('tabs.tasks'),
          drawerItemStyle: isStaff ? undefined : { display: 'none' },
          drawerIcon: ({ color, size }) => <Ionicons name="checkbox-outline" size={size} color={color} />,
        }}
      />
      <Drawer.Screen
        name="suppliers"
        options={{
          title: t('tabs.suppliers'),
          drawerItemStyle: isStaff ? undefined : { display: 'none' },
          drawerIcon: ({ color, size }) => <Ionicons name="business-outline" size={size} color={color} />,
        }}
      />
      <Drawer.Screen
        name="analytics"
        options={{
          title: t('tabs.analytics'),
          drawerItemStyle: isStaff ? undefined : { display: 'none' },
          drawerIcon: ({ color, size }) => (
            <Ionicons name="stats-chart-outline" size={size} color={color} />
          ),
        }}
      />
      {/* Team roster is pushed from Profile (admin) and renders its own back
          header, so it stays out of the drawer list with the drawer header off. */}
      <Drawer.Screen name="team" options={{ ...detail }} />

      {/* Header-only destinations — reachable from the top-right header, not the drawer list. */}
      <Drawer.Screen name="notifications" options={{ title: t('tabs.notifications'), ...hidden }} />
      <Drawer.Screen name="profile" options={{ title: t('tabs.profile'), ...hidden }} />

      {/* Detail routes pushed on top of the drawer — hidden from the list; they
          render their own DetailHeader, so the drawer header is suppressed. */}
      <Drawer.Screen name="conversation/[id]" options={{ ...detail }} />
      <Drawer.Screen name="ticket/[id]" options={{ ...detail }} />
      <Drawer.Screen name="ticket/new" options={{ ...detail }} />
      <Drawer.Screen name="quotation/[id]" options={{ ...detail }} />
      <Drawer.Screen name="contract/[id]" options={{ ...detail }} />
      <Drawer.Screen name="invoice/[id]" options={{ ...detail }} />
      <Drawer.Screen name="purchase/[id]" options={{ ...detail }} />
    </Drawer>
  );
}
