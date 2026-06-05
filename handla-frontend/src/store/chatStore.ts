'use client';

import { create } from 'zustand';
import type { ChatState, Conversation, ConversationStatus, Message } from '@/types';

interface ChatStore extends ChatState {
  onlineUsers: Set<string>;
  setOnlineUsers: (userId: string, online: boolean) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatStore>()((set) => ({
  // ── State ──────────────────────────────────────────────────────────────────
  conversations: [],
  activeConversation: null,
  messages: [],
  isLoadingConversations: false,
  isLoadingMessages: false,
  isSending: false,
  typingUsers: {},
  onlineUsers: new Set(),

  // ── Actions ────────────────────────────────────────────────────────────────

  setConversations: (conversations: Conversation[]) =>
    set({ conversations }),

  setActiveConversation: (conversation: Conversation | null) =>
    set({ activeConversation: conversation }),

  setMessages: (messages: Message[]) =>
    set({ messages }),

  clearMessages: () =>
    set({ messages: [] }),

  addMessage: (message: Message) =>
    set((state) => {
      // Deduplicate by ID (socket can fire before HTTP response)
      if (state.messages.some((m) => m.id === message.id)) {
        return state;
      }
      return { messages: [...state.messages, message] };
    }),

  setTyping: (userId: string, isTyping: boolean) =>
    set((state) => ({
      typingUsers: { ...state.typingUsers, [userId]: isTyping },
    })),

  updateConversationStatus: (id: string, status: ConversationStatus) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, status } : c,
      ),
      activeConversation:
        state.activeConversation?.id === id
          ? { ...state.activeConversation, status }
          : state.activeConversation,
    })),

  setOnlineUsers: (userId: string, online: boolean) =>
    set((state) => {
      const next = new Set(state.onlineUsers);
      if (online) next.add(userId);
      else        next.delete(userId);
      return { onlineUsers: next };
    }),
}));
