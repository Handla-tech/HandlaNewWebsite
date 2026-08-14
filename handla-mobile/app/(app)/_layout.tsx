import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { useT } from '@/i18n';
import { colors } from '@/theme';

/**
 * Role-aware bottom tab navigator.
 *
 * Staff (ADMIN/EMPLOYEE) see the full back-office set as slices land.
 * Clients see a reduced set (their chat / support / documents).
 * Tabs are hidden via `href: null` when not permitted for the role.
 */
export default function AppLayout() {
  const isStaff = useAuthStore((s) => s.isStaff());
  const { t } = useT();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textDim,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: t('tabs.dashboard'),
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: t('tabs.chat'),
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles-outline" size={size} color={color} />,
        }}
      />
      {/* Conversation detail is pushed on top of the tabs, not itself a tab. */}
      <Tabs.Screen name="conversation/[id]" options={{ href: null }} />
      <Tabs.Screen
        name="support"
        options={{
          title: t('tabs.support'),
          tabBarIcon: ({ color, size }) => <Ionicons name="ticket-outline" size={size} color={color} />,
        }}
      />
      {/* Ticket detail + new-ticket are pushed on top of the tabs, not tabs. */}
      <Tabs.Screen name="ticket/[id]" options={{ href: null }} />
      <Tabs.Screen name="ticket/new" options={{ href: null }} />
      <Tabs.Screen
        name="sales"
        options={{
          title: t('tabs.sales'),
          tabBarIcon: ({ color, size }) => <Ionicons name="briefcase-outline" size={size} color={color} />,
        }}
      />
      {/* Sales document details are pushed on top of the tabs, not tabs. */}
      <Tabs.Screen name="quotation/[id]" options={{ href: null }} />
      <Tabs.Screen name="contract/[id]" options={{ href: null }} />
      <Tabs.Screen name="invoice/[id]" options={{ href: null }} />
      <Tabs.Screen
        name="finance"
        options={{
          title: t('tabs.finance'),
          // Staff-only back-office area; hidden from the client tab bar.
          href: isStaff ? '/(app)/finance' : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="wallet-outline" size={size} color={color} />,
        }}
      />
      {/* Finance detail (purchase) pushed on top of the tabs, not a tab. */}
      <Tabs.Screen name="purchase/[id]" options={{ href: null }} />
      <Tabs.Screen
        name="analytics"
        options={{
          title: t('tabs.analytics'),
          // Staff-only web-traffic analytics; hidden from the client tab bar.
          href: isStaff ? '/(app)/analytics' : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart-outline" size={size} color={color} />,
        }}
      />
      {/* Admin Team roster is pushed from Profile (ADMIN only), not a tab. */}
      <Tabs.Screen name="team" options={{ href: null }} />
      <Tabs.Screen
        name="notifications"
        options={{
          title: t('tabs.notifications'),
          tabBarIcon: ({ color, size }) => <Ionicons name="notifications-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
