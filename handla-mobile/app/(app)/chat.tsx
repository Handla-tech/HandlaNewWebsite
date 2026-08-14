import React from 'react';
import { View, Text, FlatList, Pressable, RefreshControl } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { chatApi } from '@/lib/endpoints';
import { useAuthStore } from '@/store/authStore';
import { useChatSocket } from '@/hooks/useChatSocket';
import { Title, Loading, Button } from '@/components/ui';
import { spacing, radius, font, useTheme } from '@/theme';
import type { Conversation, PaginatedConversations } from '@/types';

function timeAgo(iso?: string) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function Avatar({ name, uri }: { name?: string; uri?: string | null }) {
  const { colors } = useTheme();
  const initials = (name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  if (uri) {
    return <Image source={{ uri }} style={{ width: 46, height: 46, borderRadius: 23 }} contentFit="cover" />;
  }
  return (
    <View
      style={{
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: colors.accentSoft,
        borderWidth: 1,
        borderColor: colors.accentBorder,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: colors.accent, fontWeight: '800' }}>{initials}</Text>
    </View>
  );
}

export default function ChatListScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isStaff = useAuthStore((s) => s.isStaff());

  const list = useQuery({
    queryKey: ['conversations'],
    queryFn: (): Promise<PaginatedConversations> =>
      chatApi.listConversations({ limit: 50 }).then((r) => r.data.data),
  });

  // Live-refresh the list when a message lands anywhere.
  const { connected } = useChatSocket({
    onMessage: () => qc.invalidateQueries({ queryKey: ['conversations'] }),
    onMessagesRead: () => qc.invalidateQueries({ queryKey: ['conversations'] }),
  });

  const startConversation = useMutation({
    mutationFn: () => chatApi.createConversation().then((r) => r.data.data.conversation),
    onSuccess: (conv) => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      router.push(`/(app)/conversation/${conv.id}`);
    },
  });

  const conversations = list.data?.conversations ?? [];

  // For a CLIENT: the "other party" is the admin/staff; for STAFF: the client.
  const otherParty = (c: Conversation) => (isStaff ? c.client : c.admin);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['left', 'right']}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: spacing.lg,
        }}
      >
        <Title>Messages</Title>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: connected ? colors.success : colors.textDim,
            }}
          />
          <Text style={{ color: colors.textDim, fontSize: font.xs }}>
            {connected ? 'Live' : 'Offline'}
          </Text>
        </View>
      </View>

      {list.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(c) => c.id}
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
              <Ionicons name="chatbubbles-outline" size={40} color={colors.textDim} />
              <Text style={{ color: colors.textFaint, marginTop: spacing.md, marginBottom: spacing.lg }}>
                {isStaff ? 'No conversations yet.' : 'Start a conversation with the Handla team.'}
              </Text>
              {!isStaff && (
                <Button
                  title="Start Chat"
                  onPress={() => startConversation.mutate()}
                  loading={startConversation.isPending}
                  style={{ paddingHorizontal: spacing.xl }}
                />
              )}
            </View>
          }
          renderItem={({ item }) => {
            const other = otherParty(item);
            const preview = item.lastMessage?.content
              ? item.lastMessage.content
              : item.lastMessage?.fileUrl
              ? '📎 Attachment'
              : 'No messages yet';
            const unread = item.unreadCount ?? 0;
            return (
              <Pressable
                onPress={() => router.push(`/(app)/conversation/${item.id}`)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  paddingVertical: spacing.md,
                  borderBottomColor: colors.border,
                  borderBottomWidth: 1,
                }}
              >
                <Avatar name={other?.name} uri={other?.avatarUrl} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text
                      style={{ color: colors.text, fontSize: font.md, fontWeight: '700', flex: 1 }}
                      numberOfLines={1}
                    >
                      {other?.name ?? 'Conversation'}
                    </Text>
                    <Text style={{ color: colors.textDim, fontSize: font.xs, marginLeft: 8 }}>
                      {timeAgo(item.lastMessageAt)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                    <Text
                      style={{ color: colors.textFaint, fontSize: font.sm, flex: 1 }}
                      numberOfLines={1}
                    >
                      {preview}
                    </Text>
                    {unread > 0 && (
                      <View
                        style={{
                          minWidth: 20,
                          height: 20,
                          borderRadius: 10,
                          backgroundColor: colors.accent,
                          alignItems: 'center',
                          justifyContent: 'center',
                          paddingHorizontal: 6,
                          marginLeft: 8,
                        }}
                      >
                        <Text style={{ color: '#0a0a0a', fontSize: 11, fontWeight: '800' }}>
                          {unread}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
