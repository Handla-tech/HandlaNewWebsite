import React from 'react';
import { View, Text, FlatList, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { suppliersApi } from '@/lib/endpoints';
import { Title, Loading, Badge } from '@/components/ui';
import { spacing, radius, font, useTheme } from '@/theme';
import type { PaginatedSuppliers, Supplier } from '@/types';

export default function SuppliersScreen() {
  const { colors } = useTheme();

  const suppliers = useQuery({
    queryKey: ['suppliers-mobile'],
    queryFn: (): Promise<PaginatedSuppliers> =>
      suppliersApi.list({ limit: 50 }).then((r) => r.data.data),
  });

  const rows = suppliers.data?.suppliers ?? [];

  const renderItem = ({ item }: { item: Supplier }) => (
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
        <Ionicons name="business-outline" size={20} color={colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: font.md, fontWeight: '700' }} numberOfLines={1}>
          {item.name}
        </Text>
        {item.company ? (
          <Text style={{ color: colors.textFaint, fontSize: font.sm }} numberOfLines={1}>
            {item.company}
          </Text>
        ) : null}
        {item.email ? (
          <Text style={{ color: colors.textDim, fontSize: font.xs }} numberOfLines={1}>
            {item.email}
          </Text>
        ) : null}
      </View>
      {item.isActive === false ? (
        <Badge label="Inactive" color="#9ca3af" soft="rgba(156,163,175,0.15)" />
      ) : (
        <Badge label="Active" color="#22c55e" soft="rgba(34,197,94,0.15)" />
      )}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['left', 'right']}>
      <View style={{ padding: spacing.lg, paddingBottom: spacing.sm }}>
        <Title>Suppliers</Title>
      </View>
      {suppliers.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(s) => s.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
          refreshControl={
            <RefreshControl
              refreshing={suppliers.isFetching}
              onRefresh={() => suppliers.refetch()}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: spacing.xxl, gap: spacing.sm }}>
              <Ionicons name="business-outline" size={40} color={colors.textDim} />
              <Text style={{ color: colors.textFaint }}>No suppliers yet.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
