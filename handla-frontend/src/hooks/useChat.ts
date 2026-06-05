'use client';

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatApi } from '@/lib/api';
import { useChatStore } from '@/store/chatStore';
import { sendSocketMessage, joinConversation, emitTyping } from '@/lib/socket';
import { safeUploadChatFile } from '@/lib/s3-uploader';
import { getErrorMessage } from '@/lib/utils';
import type { Conversation, Message } from '@/types';

const CONVERSATIONS_KEY = 'conversations';
const MESSAGES_KEY      = 'messages';

/**
 * useChat — data fetching + real-time messaging for a given conversation.
 *
 * @param conversationId  The active conversation ID, or undefined if none.
 */
export function useChat(conversationId?: string) {
  const queryClient = useQueryClient();

  const {
    activeConversation,
    setActiveConversation,
    setConversations,
    setMessages,
    addMessage,
  } = useChatStore();

  // ── Fetch all conversations ──────────────────────────────────────────────

  const conversationsQuery = useQuery({
    queryKey: [CONVERSATIONS_KEY],
    queryFn: async () => {
      const res = await chatApi.getConversations();
      // Backend returns: { message, data: { conversations: [...], total, page, pages } }
      // Axios: res.data = { message, data: { conversations: [...], ... } }
      const inner = (res.data as { data?: { conversations?: Conversation[] } | Conversation[] })?.data;
      const raw: Conversation[] =
        (inner && !Array.isArray(inner) && 'conversations' in inner)
          ? (inner as { conversations?: Conversation[] }).conversations ?? []
          : Array.isArray(inner) ? inner : [];

      // Deduplicate by clientId — keeps the most-recent conversation for each
      // client in case the DB has legacy duplicate rows (same client_id + admin_id).
      // The migration removes existing duplicates and adds a UNIQUE constraint,
      // but this guard ensures zero visual duplicates even before migration runs.
      const seenClients = new Set<string>();
      const data = raw.filter((c) => {
        const key = c.clientId ?? c.client?.id ?? c.id;
        if (seenClients.has(key)) return false;
        seenClients.add(key);
        return true;
      });

      setConversations(data);
      return data;
    },
    staleTime: 30_000,
  });

  // ── Fetch messages for active conversation ────────────────────────────────

  const messagesQuery = useQuery({
    queryKey: [MESSAGES_KEY, conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      const res = await chatApi.getMessages(conversationId);
      const data: Message[] = res.data?.data ?? res.data;
      setMessages(data);
      joinConversation(conversationId);   // also join the socket room
      return data;
    },
    enabled: !!conversationId,
    staleTime: 5_000,
  });

  // ── Open a conversation ───────────────────────────────────────────────────

  const openConversation = useCallback(
    async (conversation: Conversation) => {
      setActiveConversation(conversation);
      await queryClient.prefetchQuery({
        queryKey: [MESSAGES_KEY, conversation.id],
        queryFn: async () => {
          const res = await chatApi.getMessages(conversation.id);
          const data: Message[] = res.data?.data ?? res.data;
          setMessages(data);
          joinConversation(conversation.id);
          return data;
        },
      });
    },
    [queryClient, setActiveConversation, setMessages],
  );

  // ── Send text message — REST only (backend broadcasts via socket) ────────
  //
  // We do NOT call sendSocketMessage here.  The REST endpoint
  // (POST /chat/conversations/:id/messages) saves the message to the DB
  // and then broadcasts it via ChatGateway to the conversation room.
  // That broadcast triggers the 'messageReceived' handler in useSocket.ts
  // which invalidates the messages query and updates the UI for everyone —
  // including the sender — without double-saving.

  const sendMessage = useCallback(
    async (content: string) => {
      if (!conversationId || !content.trim()) return;
      await chatApi.sendMessage(conversationId, { content: content.trim() });
      // Invalidate so the message list re-fetches and shows the new message
      // (also covered by the socket broadcast but this is the fallback)
      queryClient.invalidateQueries({ queryKey: [MESSAGES_KEY, conversationId] });
    },
    [conversationId, queryClient],
  );

  // ── Send file message ─────────────────────────────────────────────────────

  const sendFileMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!conversationId) throw new Error('No active conversation');

      const { result, error } = await safeUploadChatFile({
        conversationId,
        file,
        onProgress: (p) => {
          // Could emit to a progress store here if needed
          console.debug(`Upload: ${p.percentage}%`);
        },
      });

      if (error || !result) throw new Error(error ?? 'Upload failed');

      // Send socket message with the S3 URL
      sendSocketMessage({ conversationId, fileUrl: result.fileUrl });
      return result;
    },
  });

  // ── Emit typing indicator (debounced by the backend auto-clear) ───────────

  const emitTypingIndicator = useCallback(
    (isTyping: boolean) => {
      if (!conversationId) return;
      emitTyping(conversationId, isTyping);
    },
    [conversationId],
  );

  return {
    // State
    conversations:     conversationsQuery.data ?? [],
    messages:          messagesQuery.data ?? [],
    activeConversation,

    // Loading states
    isLoadingConversations: conversationsQuery.isLoading,
    isLoadingMessages:      messagesQuery.isLoading,
    isUploadingFile:        sendFileMutation.isPending,
    uploadError:            sendFileMutation.error
                              ? getErrorMessage(sendFileMutation.error)
                              : null,

    // Actions
    openConversation,
    sendMessage,
    sendFile:             sendFileMutation.mutate,
    emitTyping:           emitTypingIndicator,
    addMessage,           // for optimistic socket updates

    // Refetch
    refetchConversations: conversationsQuery.refetch,
    refetchMessages:      messagesQuery.refetch,
  };
}
