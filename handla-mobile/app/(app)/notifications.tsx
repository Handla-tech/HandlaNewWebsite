import React from 'react';
import { View, Text, FlatList, Pressable, RefreshControl } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { notificationsApi } from '@/lib/endpoints';
import { Loading } from '@/components/ui';
import { GlassScreen, GradientHeader, GlassCard, withAlpha } from '@/components/glass';
import { spacing, font, useTheme } from '@/theme';
import type { Notification } from '@/types';

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ['notifications'],
    queryFn: (): Promise<Notification[]> =>
      notificationsApi.list({ limit: 50 }).then((r) => {
        const d = r.data.data as { notifications?: Notification[] } | Notification[];
        return Array.isArray(d) ? d : d.notifications ?? [];
      }),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const markAll = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const data: Notification[] = list.data ?? [];
  const hasUnread = data.some((n) => !n.isRead);

  return (
    <GlassScreen>
      <GradientHeader
        title="Notifications"
        icon="notifications-outline"
        right={
          hasUnread ? (
            <Pressable onPress={() => markAll.mutate()} hitSlop={8}>
              <Text style={{ color: colors.accent, fontSize: font.sm, fontWeight: '700' }}>
                Mark all read
              </Text>
            </Pressable>
          ) : undefined
        }
      />

      {list.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
          refreshControl={
            <RefreshControl
              refreshing={list.isFetching}
              onRefresh={() => list.refetch()}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: spacing.xxl }}>
              <Ionicons name="notifications-off-outline" size={36} color={colors.textDim} />
              <Text style={{ color: colors.textFaint, marginTop: spacing.md }}>
                No notifications yet.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <GlassCard
              onPress={() => (!item.isRead ? markRead.mutate(item.id) : undefined)}
              padded={false}
              style={{ marginBottom: spacing.sm }}
            >
              <View style={{ flexDirection: 'row', gap: spacing.md, padding: spacing.md }}>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    marginTop: 6,
                    backgroundColor: item.isRead ? withAlpha(colors.textDim, 0.4) : colors.accent,
                  }}
                />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text
                      style={{
                        color: colors.text,
                        fontSize: font.md,
                        fontWeight: item.isRead ? '600' : '800',
                        flex: 1,
                      }}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                    <Text style={{ color: colors.textDim, fontSize: font.xs, marginLeft: spacing.sm }}>
                      {timeAgo(item.createdAt)}
                    </Text>
                  </View>
                  {item.body ? (
                    <Text
                      style={{ color: colors.textFaint, fontSize: font.sm, marginTop: 4 }}
                      numberOfLines={2}
                    >
                      {item.body}
                    </Text>
                  ) : null}
                </View>
              </View>
            </GlassCard>
          )}
        />
      )}
    </GlassScreen>
  );
}
