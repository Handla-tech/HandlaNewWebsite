import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, RefreshControl, ScrollView } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usersApi } from '@/lib/endpoints';
import type { UsersQuery } from '@/lib/endpoints';
import { Title, Loading, Badge, Chip } from '@/components/ui';
import { spacing, radius, font, useTheme, colors as staticColors } from '@/theme';
import type { PaginatedUsers, TeamMember, UserRole } from '@/types';

const ROLE_META: Record<UserRole, { label: string; color: string; soft: string }> = {
  ADMIN: { label: 'Admin', color: staticColors.accent, soft: staticColors.accentSoft },
  EMPLOYEE: { label: 'Employee', color: staticColors.info, soft: 'rgba(96,165,250,0.15)' },
  CLIENT: { label: 'Client', color: staticColors.success, soft: staticColors.successSoft },
  LEAD: { label: 'Lead', color: '#c084fc', soft: 'rgba(192,132,252,0.15)' },
};

const ROLE_FILTERS: (UserRole | null)[] = [null, 'ADMIN', 'EMPLOYEE', 'CLIENT', 'LEAD'];

function initials(name: string) {
  return (name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function UsersScreen() {
  const { colors } = useTheme();
  const [role, setRole] = useState<UserRole | null>(null);

  const params: UsersQuery = useMemo(
    () => ({ limit: 100, ...(role ? { role } : {}) }),
    [role],
  );

  const users = useQuery({
    queryKey: ['users-mobile', role],
    queryFn: (): Promise<PaginatedUsers> => usersApi.list(params).then((r) => r.data.data),
  });

  const rows = users.data?.users ?? [];

  const renderItem = ({ item }: { item: TeamMember }) => {
    const m = ROLE_META[item.role];
    const inactive = item.isArchived || item.isDisabled;
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
          opacity: inactive ? 0.5 : 1,
        }}
      >
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: m.soft,
            borderWidth: 1,
            borderColor: m.color,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: m.color, fontWeight: '800', fontSize: font.sm }}>
            {initials(item.name)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: font.md, fontWeight: '700' }} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={{ color: colors.textFaint, fontSize: font.sm }} numberOfLines={1}>
            {item.email}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Badge label={m.label} color={m.color} soft={m.soft} />
          {item.isDisabled ? (
            <Text style={{ color: colors.danger, fontSize: 10, fontWeight: '700' }}>DISABLED</Text>
          ) : item.isArchived ? (
            <Text style={{ color: colors.textDim, fontSize: 10, fontWeight: '700' }}>ARCHIVED</Text>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['left', 'right']}>
      <View style={{ padding: spacing.lg, paddingBottom: spacing.sm }}>
        <Title>Users</Title>
        <Text style={{ color: colors.textDim, fontSize: font.xs, marginTop: 2 }}>
          {users.data ? `${users.data.total} members` : 'Loading…'}
        </Text>
      </View>
      {users.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(u) => u.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
          refreshControl={
            <RefreshControl
              refreshing={users.isFetching}
              onRefresh={() => users.refetch()}
              tintColor={colors.accent}
            />
          }
          ListHeaderComponent={
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.md }}
            >
              {ROLE_FILTERS.map((r) => (
                <Chip
                  key={r ?? 'all'}
                  label={r ? ROLE_META[r].label : 'All'}
                  active={role === r}
                  onPress={() => setRole(r)}
                />
              ))}
            </ScrollView>
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: spacing.xxl, gap: spacing.sm }}>
              <Ionicons name="people-outline" size={40} color={colors.textDim} />
              <Text style={{ color: colors.textFaint }}>No users found.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
