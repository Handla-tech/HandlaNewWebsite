import React from 'react';
import { View, Text, FlatList, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { clientsApi } from '@/lib/endpoints';
import { Title, Loading, Badge } from '@/components/ui';
import { statusColor, prettyStatus } from '@/lib/statusMeta';
import { spacing, radius, font, useTheme } from '@/theme';
import type { PaginatedClients, Client } from '@/types';

export default function ClientsScreen() {
  const { colors } = useTheme();

  const clients = useQuery({
    queryKey: ['clients-mobile'],
    queryFn: (): Promise<PaginatedClients> =>
      clientsApi.list({ limit: 50 }).then((r) => r.data.data),
  });

  const rows = clients.data?.clients ?? [];

  const renderItem = ({ item }: { item: Client }) => {
    const name = item.user?.name ?? item.company ?? 'Client';
    const email = item.user?.email ?? '';
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
            borderRadius: radius.pill,
            backgroundColor: colors.accentSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: colors.accent, fontWeight: '800' }}>
            {name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: font.md, fontWeight: '700' }} numberOfLines={1}>
            {name}
          </Text>
          {item.company ? (
            <Text style={{ color: colors.textFaint, fontSize: font.sm }} numberOfLines={1}>
              {item.company}
            </Text>
          ) : null}
          {email ? (
            <Text style={{ color: colors.textDim, fontSize: font.xs }} numberOfLines={1}>
              {email}
            </Text>
          ) : null}
        </View>
        {item.status ? (
          <Badge
            label={prettyStatus(item.status)}
            color={statusColor(item.status).color}
            soft={statusColor(item.status).soft}
          />
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['left', 'right']}>
      <View style={{ padding: spacing.lg, paddingBottom: spacing.sm }}>
        <Title>Clients</Title>
      </View>
      {clients.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(c) => c.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
          refreshControl={
            <RefreshControl
              refreshing={clients.isFetching}
              onRefresh={() => clients.refetch()}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: spacing.xxl, gap: spacing.sm }}>
              <Ionicons name="people-outline" size={40} color={colors.textDim} />
              <Text style={{ color: colors.textFaint }}>No clients yet.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
