import React from 'react';
import { View, Text, FlatList, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tenantsApi } from '@/lib/endpoints';
import { Title, Loading, Badge } from '@/components/ui';
import { statusColor, prettyStatus } from '@/lib/statusMeta';
import { spacing, radius, font, useTheme } from '@/theme';
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
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius.md,
          padding: spacing.md,
          marginBottom: spacing.sm,
        }}
      >
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
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: font.md, fontWeight: '700' }} numberOfLines={1}>
            {item.name}
          </Text>
          {item.product?.name ? (
            <Text style={{ color: colors.textFaint, fontSize: font.sm }} numberOfLines={1}>
              {item.product.name}
            </Text>
          ) : null}
          <Text style={{ color: colors.textDim, fontSize: font.xs }} numberOfLines={1}>
            /{item.slug}
          </Text>
        </View>
        <Badge label={prettyStatus(item.status)} color={sc.color} soft={sc.soft} />
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['left', 'right']}>
      <View style={{ padding: spacing.lg, paddingBottom: spacing.sm }}>
        <Title>Tenants</Title>
      </View>
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
    </SafeAreaView>
  );
}
