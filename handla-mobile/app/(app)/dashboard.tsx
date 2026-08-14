import React from 'react';
import { View, Text, RefreshControl, ScrollView } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/authStore';
import { dashboardApi } from '@/lib/endpoints';
import { Card, Title, Subtitle, Loading } from '@/components/ui';
import { colors, spacing, radius, font } from '@/theme';

// Best-effort label formatting for arbitrary stat keys.
function humanize(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ width: '48%', marginBottom: spacing.md }}>
      <Card style={{ padding: spacing.md }}>
        <Text style={{ color: colors.textDim, fontSize: font.xs, textTransform: 'uppercase' }}>
          {label}
        </Text>
        <Text style={{ color: colors.text, fontSize: font.xl, fontWeight: '700', marginTop: 4 }}>
          {value}
        </Text>
      </Card>
    </View>
  );
}

export default function DashboardScreen() {
  const user = useAuthStore((s) => s.user);
  const isStaff = useAuthStore((s) => s.isStaff());

  const stats = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardApi.stats().then((r) => r.data.data as Record<string, unknown>),
    enabled: isStaff,
  });

  // Reduce stats to scalar KPI tiles.
  const tiles = React.useMemo(() => {
    const d = stats.data ?? {};
    return Object.entries(d)
      .filter(([, v]) => typeof v === 'number' || typeof v === 'string')
      .slice(0, 8)
      .map(([k, v]) => ({ label: humanize(k), value: String(v) }));
  }, [stats.data]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
        refreshControl={
          <RefreshControl
            refreshing={isStaff && stats.isFetching}
            onRefresh={() => stats.refetch()}
            tintColor={colors.accent}
          />
        }
      >
        {/* Greeting */}
        <View style={{ marginBottom: spacing.xl }}>
          <Subtitle>Welcome back</Subtitle>
          <Title>{user?.name ?? 'Handla'}</Title>
          <View
            style={{
              alignSelf: 'flex-start',
              marginTop: spacing.sm,
              backgroundColor: colors.accentSoft,
              borderColor: colors.accentBorder,
              borderWidth: 1,
              borderRadius: radius.pill,
              paddingHorizontal: spacing.md,
              paddingVertical: 4,
            }}
          >
            <Text style={{ color: colors.accent, fontSize: font.xs, fontWeight: '700' }}>
              {user?.role}
            </Text>
          </View>
        </View>

        {isStaff ? (
          <>
            <Text style={{ color: colors.textFaint, fontSize: font.sm, marginBottom: spacing.md }}>
              Overview
            </Text>
            {stats.isLoading ? (
              <View style={{ height: 200 }}>
                <Loading />
              </View>
            ) : tiles.length === 0 ? (
              <Card>
                <Text style={{ color: colors.textFaint }}>No stats available.</Text>
              </Card>
            ) : (
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                }}
              >
                {tiles.map((t) => (
                  <StatTile key={t.label} label={t.label} value={t.value} />
                ))}
              </View>
            )}
          </>
        ) : (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Ionicons name="chatbubbles-outline" size={28} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: font.md, fontWeight: '700' }}>
                  Your Handla portal
                </Text>
                <Text style={{ color: colors.textFaint, fontSize: font.sm, marginTop: 2 }}>
                  Chat, support tickets, invoices and quotations are coming to mobile soon.
                </Text>
              </View>
            </View>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
