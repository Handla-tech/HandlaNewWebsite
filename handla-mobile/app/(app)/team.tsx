import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl, ScrollView } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usersApi } from '@/lib/endpoints';
import type { UsersQuery } from '@/lib/endpoints';
import { Loading, Badge, Chip } from '@/components/ui';
import { GlassScreen, GlassListItem } from '@/components/glass';
import { spacing, font, useTheme, colors as staticColors } from '@/theme';
import { useT } from '@/i18n';
import type { PaginatedUsers, TeamMember, UserRole } from '@/types';

const ROLE_META: Record<UserRole, { color: string; soft: string }> = {
  ADMIN: { color: staticColors.accent, soft: staticColors.accentSoft },
  EMPLOYEE: { color: staticColors.info, soft: 'rgba(96,165,250,0.15)' },
  CLIENT: { color: staticColors.success, soft: staticColors.successSoft },
  LEAD: { color: '#c084fc', soft: 'rgba(192,132,252,0.15)' },
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
  const { t } = useT();
  const { colors } = useTheme();
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
    <GlassScreen edges={['top', 'left', 'right']}>
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
          <Text style={{ color: colors.text, fontSize: font.lg, fontWeight: '700' }}>{t('team.title')}</Text>
          <Text style={{ color: colors.textDim, fontSize: font.xs }}>
            {users.data ? t('users.membersCount', { count: users.data.total }) : t('users.loading')}
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
                label={r ? t(`role.${r}`) : t('users.all')}
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
              <Text style={{ color: colors.textFaint, marginTop: spacing.md }}>{t('team.empty')}</Text>
            </View>
          )
        }
        renderItem={({ item }: { item: TeamMember }) => {
          const m = ROLE_META[item.role];
          const inactive = item.isArchived || item.isDisabled;
          return (
            <GlassListItem
              style={{ opacity: inactive ? 0.55 : 1 }}
              leading={
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
              }
              title={item.name}
              subtitle={item.email}
              right={
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Badge label={t(`role.${item.role}`)} color={m.color} soft={m.soft} />
                  {item.isDisabled ? (
                    <Text style={{ color: colors.danger, fontSize: 10, fontWeight: '700' }}>{t('users.disabled')}</Text>
                  ) : item.isArchived ? (
                    <Text style={{ color: colors.textDim, fontSize: 10, fontWeight: '700' }}>{t('users.archived')}</Text>
                  ) : null}
                </View>
              }
            />
          );
        }}
      />
    </GlassScreen>
  );
}
