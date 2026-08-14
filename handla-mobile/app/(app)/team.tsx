import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl, ScrollView } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usersApi } from '@/lib/endpoints';
import type { UsersQuery } from '@/lib/endpoints';
import { Loading, Badge, Chip } from '@/components/ui';
import { colors, spacing, radius, font } from '@/theme';
import type { PaginatedUsers, TeamMember, UserRole } from '@/types';

const ROLE_META: Record<UserRole, { label: string; color: string; soft: string }> = {
  ADMIN: { label: 'Admin', color: colors.accent, soft: colors.accentSoft },
  EMPLOYEE: { label: 'Employee', color: colors.info, soft: 'rgba(96,165,250,0.15)' },
  CLIENT: { label: 'Client', color: colors.success, soft: colors.successSoft },
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

export default function TeamScreen() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole | null>(null);

  const params: UsersQuery = useMemo(
    () => ({ limit: 100, ...(role ? { role } : {}) }),
    [role],
  );

  const users = useQuery({
    queryKey: ['team', role],
    queryFn: (): Promise<PaginatedUsers> => usersApi.list(params).then((r) => r.data.data),
  });

  const rows = users.data?.users ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderBottomColor: colors.border,
          borderBottomWidth: 1,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ padding: 4 }}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: font.lg, fontWeight: '700' }}>Team</Text>
          <Text style={{ color: colors.textDim, fontSize: font.xs }}>
            {users.data ? `${users.data.total} members` : 'Loading…'}
          </Text>
        </View>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(u: TeamMember) => u.id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
        refreshControl={
          <RefreshControl refreshing={users.isFetching} onRefresh={() => users.refetch()} tintColor={colors.accent} />
        }
        ListHeaderComponent={
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}
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
          users.isLoading ? (
            <View style={{ paddingTop: spacing.xxl }}>
              <Loading />
            </View>
          ) : (
            <View style={{ alignItems: 'center', paddingTop: spacing.xxl }}>
              <Ionicons name="people-outline" size={40} color={colors.textDim} />
              <Text style={{ color: colors.textFaint, marginTop: spacing.md }}>No members found.</Text>
            </View>
          )
        }
        renderItem={({ item }: { item: TeamMember }) => {
          const m = ROLE_META[item.role];
          const inactive = item.isArchived || item.isDisabled;
          return (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingVertical: spacing.md,
                borderBottomColor: colors.border,
                borderBottomWidth: 1,
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
        }}
      />
    </SafeAreaView>
  );
}
