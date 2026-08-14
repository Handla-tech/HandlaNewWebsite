import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { chatApi } from '@/lib/endpoints';
import { useAuthStore } from '@/store/authStore';
import { useChatSocket } from '@/hooks/useChatSocket';
import {
  emitSendMessage,
  emitJoinConversation,
  emitLeaveConversation,
  emitMarkRead,
  emitTyping,
} from '@/lib/socket';
import { Loading } from '@/components/ui';
import { colors, spacing, radius, font } from '@/theme';
import type { ConversationDetail, Message } from '@/types';

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversationId = String(id);
  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherTyping, setOtherTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const detail = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: (): Promise<ConversationDetail> =>
      chatApi.getConversation(conversationId).then((r) => r.data.data),
    enabled: !!conversationId,
  });

  // Seed local message state from the fetched detail.
  useEffect(() => {
    if (detail.data?.messages) setMessages(detail.data.messages);
  }, [detail.data]);

  const otherParty = useMemo(() => {
    const conv = detail.data?.conversation;
    if (!conv || !user) return undefined;
    return user.id === conv.clientId ? conv.admin : conv.client;
  }, [detail.data, user]);

  const appendMessage = useCallback((m: Message) => {
    setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
  }, []);

  // ─── Socket wiring ────────────────────────────────────────────────────────
  const { connected } = useChatSocket({
    onMessage: (p) => {
      if (p.conversationId !== conversationId) {
        // Message for another conversation → refresh the list badge.
        qc.invalidateQueries({ queryKey: ['conversations'] });
        return;
      }
      appendMessage(p.message);
      // Mark read if it wasn't ours.
      if (p.message.senderId !== user?.id) emitMarkRead(conversationId);
    },
    onUserTyping: (p) => {
      if (p.conversationId === conversationId && p.userId !== user?.id) {
        setOtherTyping(p.isTyping);
      }
    },
  });

  // Join room on mount, leave on unmount; mark read on entry.
  useEffect(() => {
    if (!conversationId) return;
    emitJoinConversation(conversationId);
    emitMarkRead(conversationId);
    return () => {
      emitLeaveConversation(conversationId);
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
    };
  }, [conversationId]);

  // Auto-scroll to bottom when messages change.
  useEffect(() => {
    if (messages.length) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }, [messages.length, otherTyping]);

  const handleChange = (text: string) => {
    setInput(text);
    emitTyping(conversationId, true);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => emitTyping(conversationId, false), 1500);
  };

  const send = async () => {
    const content = input.trim();
    if (!content || sending) return;
    setInput('');
    emitTyping(conversationId, false);
    setSending(true);
    try {
      if (connected) {
        // Real-time path — the gateway persists + broadcasts back to us.
        emitSendMessage(conversationId, content);
      } else {
        // Fallback to REST when the socket is down; broadcast still fires.
        const res = await chatApi.sendMessage(conversationId, content);
        appendMessage(res.data.data.message);
      }
      qc.invalidateQueries({ queryKey: ['conversations'] });
    } catch {
      setInput(content); // restore on failure
    } finally {
      setSending(false);
    }
  };

  const renderItem = ({ item }: { item: Message }) => {
    const mine = item.senderId === user?.id;
    return (
      <View
        style={{
          alignSelf: mine ? 'flex-end' : 'flex-start',
          maxWidth: '80%',
          marginVertical: 3,
        }}
      >
        <View
          style={{
            backgroundColor: mine ? colors.accent : colors.cardAlt,
            borderColor: mine ? colors.accent : colors.border,
            borderWidth: 1,
            borderRadius: radius.lg,
            borderBottomRightRadius: mine ? 4 : radius.lg,
            borderBottomLeftRadius: mine ? radius.lg : 4,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
          }}
        >
          {item.fileUrl ? (
            <Text style={{ color: mine ? '#0a0a0a' : colors.info, fontSize: font.sm }}>
              📎 Attachment
            </Text>
          ) : null}
          {item.content ? (
            <Text style={{ color: mine ? '#0a0a0a' : colors.text, fontSize: font.md }}>
              {item.content}
            </Text>
          ) : null}
        </View>
        <Text
          style={{
            color: colors.textDim,
            fontSize: 10,
            marginTop: 2,
            textAlign: mine ? 'right' : 'left',
          }}
        >
          {fmtTime(item.createdAt)}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
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
          <Text style={{ color: colors.text, fontSize: font.md, fontWeight: '700' }} numberOfLines={1}>
            {otherParty?.name ?? 'Conversation'}
          </Text>
          <Text style={{ color: otherTyping ? colors.accent : colors.textDim, fontSize: font.xs }}>
            {otherTyping ? 'typing…' : connected ? 'online' : 'offline'}
          </Text>
        </View>
      </View>

      {detail.isLoading ? (
        <Loading />
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.lg }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingTop: spacing.xxl }}>
                <Text style={{ color: colors.textFaint }}>No messages yet. Say hello 👋</Text>
              </View>
            }
          />

          {/* Composer */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              gap: spacing.sm,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderTopColor: colors.border,
              borderTopWidth: 1,
              backgroundColor: colors.surface,
            }}
          >
            <TextInput
              value={input}
              onChangeText={handleChange}
              placeholder="Type a message…"
              placeholderTextColor={colors.textDim}
              multiline
              style={{
                flex: 1,
                maxHeight: 120,
                minHeight: 44,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: 'rgba(0,0,0,0.4)',
                color: colors.text,
                paddingHorizontal: spacing.md,
                paddingTop: 10,
                fontSize: font.md,
              }}
            />
            <Pressable
              onPress={send}
              disabled={!input.trim() || sending}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: input.trim() ? colors.accent : colors.cardAlt,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {sending ? (
                <ActivityIndicator color="#0a0a0a" />
              ) : (
                <Ionicons name="send" size={18} color={input.trim() ? '#0a0a0a' : colors.textDim} />
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}
