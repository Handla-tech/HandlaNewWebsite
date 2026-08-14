import React from 'react';
import { View, Text, FlatList, Pressable, RefreshControl } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { notificationsApi } from '@/lib/endpoints';
import { Title, Loading } from '@/components/ui';
import { colors, spacing, radius, font } from '@/theme';
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right']}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: spacing.lg,
        }}
      >
        <Title>Notifications</Title>
        {hasUnread && (
          <Pressable onPress={() => markAll.mutate()}>
            <Text style={{ color: colors.accent, fontSize: font.sm, fontWeight: '600' }}>
              Mark all read
            </Text>
          </Pressable>
        )}
      </View>

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
            <Pressable
              onPress={() => !item.isRead && markRead.mutate(item.id)}
              style={{
                backgroundColor: item.isRead ? colors.card : colors.accentSoft,
                borderColor: item.isRead ? colors.border : colors.accentBorder,
                borderWidth: 1,
                borderRadius: radius.md,
                padding: spacing.md,
                marginBottom: spacing.sm,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text
                  style={{ color: colors.text, fontSize: font.md, fontWeight: '600', flex: 1 }}
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
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
