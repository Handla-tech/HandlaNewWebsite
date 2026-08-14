import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { connectSocket, getSocket } from '@/lib/socket';
import type { Message } from '@/types';

interface UseChatSocketHandlers {
  onMessage?: (payload: { message: Message; conversationId: string }) => void;
  onMessagesRead?: (payload: { conversationId: string; userId: string }) => void;
  onUserTyping?: (payload: {
    userId: string;
    userName: string;
    conversationId: string;
    isTyping: boolean;
  }) => void;
  onUserOnline?: (payload: { userId: string; online: boolean }) => void;
}

/**
 * Manages the chat socket connection + event listeners for the lifetime of a
 * component. Handlers are kept in a ref so re-renders don't re-bind listeners.
 */
export function useChatSocket(handlers: UseChatSocketHandlers) {
  const [connected, setConnected] = useState(false);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    let mounted = true;
    let socket: Socket | null = null;

    const bind = (s: Socket) => {
      const onConnect = () => mounted && setConnected(true);
      const onDisconnect = () => mounted && setConnected(false);
      const onMessage = (p: { message: Message; conversationId: string }) =>
        handlersRef.current.onMessage?.(p);
      const onMessagesRead = (p: { conversationId: string; userId: string }) =>
        handlersRef.current.onMessagesRead?.(p);
      const onUserTyping = (p: {
        userId: string;
        userName: string;
        conversationId: string;
        isTyping: boolean;
      }) => handlersRef.current.onUserTyping?.(p);
      const onUserOnline = (p: { userId: string; online: boolean }) =>
        handlersRef.current.onUserOnline?.(p);

      s.on('connect', onConnect);
      s.on('disconnect', onDisconnect);
      s.on('messageReceived', onMessage);
      s.on('messagesRead', onMessagesRead);
      s.on('userTyping', onUserTyping);
      s.on('userOnline', onUserOnline);
      if (s.connected) setConnected(true);

      return () => {
        s.off('connect', onConnect);
        s.off('disconnect', onDisconnect);
        s.off('messageReceived', onMessage);
        s.off('messagesRead', onMessagesRead);
        s.off('userTyping', onUserTyping);
        s.off('userOnline', onUserOnline);
      };
    };

    let cleanupListeners: (() => void) | undefined;

    connectSocket().then((s) => {
      if (!mounted) return;
      socket = s;
      cleanupListeners = bind(s);
    });

    return () => {
      mounted = false;
      cleanupListeners?.();
      // Keep the socket alive across screens; only detach listeners here.
    };
  }, []);

  return { connected, socket: getSocket() };
}
