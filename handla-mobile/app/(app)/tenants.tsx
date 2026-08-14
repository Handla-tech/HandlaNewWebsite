import React from 'react';
import { View, Text, FlatList, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { tenantsApi } from '@/lib/endpoints';
import { Loading, Badge } from '@/components/ui';
import { GlassScreen, GradientHeader, GlassListItem } from '@/components/glass';
import { statusColor, prettyStatus } from '@/lib/statusMeta';
import { spacing, radius, useTheme } from '@/theme';
import type { PaginatedTenants, Tenant } from '@/types';

export default function TenantsScreen() {
  const { colors } = useTheme();

  const tenants = useQuery({
    queryKey: ['tenants-mobile'],
    queryFn: (): Promise<PaginatedTenants> =>
      tenantsApi.list({ limit: 50 }).then((r) => r.data.data),
  });

  const rows = tenants.data?.tenants ?? [];

  const renderItem = ({ item }: { item: Tenant }) => {
    const sc = statusColor(item.status);
    return (
      <GlassListItem
        leading={
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: radius.md,
              backgroundColor: colors.accentSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="cube-outline" size={20} color={colors.accent} />
          </View>
        }
        title={item.name}
        subtitle={item.product?.name ?? null}
        meta={`/${item.slug}`}
        right={<Badge label={prettyStatus(item.status)} color={sc.color} soft={sc.soft} />}
      />
    );
  };

  return (
    <GlassScreen>
      <GradientHeader title="Tenants" icon="cube-outline" />
      {tenants.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(t) => t.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
          refreshControl={
            <RefreshControl
              refreshing={tenants.isFetching}
              onRefresh={() => tenants.refetch()}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: spacing.xxl, gap: spacing.sm }}>
              <Ionicons name="cube-outline" size={40} color={colors.textDim} />
              <Text style={{ color: colors.textFaint }}>No tenants yet.</Text>
            </View>
          }
        />
      )}
    </GlassScreen>
  );
}
