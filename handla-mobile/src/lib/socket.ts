import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from './config';
import { tokenStorage } from './storage';

/**
 * Singleton Socket.IO client for real-time chat.
 *
 * Reuses the backend ChatGateway contract (namespace '/'): the access token is
 * passed via `handshake.auth.token` (the gateway also accepts a Bearer header /
 * cookie). Events mirror the gateway:
 *
 *   emit  → sendMessage | markAsRead | typing | joinConversation | leaveConversation
 *   on    → messageReceived | messagesRead | messageRead | userTyping | userOnline
 */

let socket: Socket | null = null;

export async function connectSocket(): Promise<Socket> {
  if (socket?.connected) return socket;

  const token = await tokenStorage.getAccess();

  // Reuse an existing (disconnected) instance if present, else create one.
  if (socket) {
    socket.auth = { token };
    socket.connect();
    return socket;
  }

  socket = io(SOCKET_URL, {
    transports: ['websocket'],
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 8,
    reconnectionDelay: 1000,
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

// ─── Typed emit helpers ─────────────────────────────────────────────────────
export function emitSendMessage(conversationId: string, content?: string, fileUrl?: string) {
  socket?.emit('sendMessage', { conversationId, content, fileUrl });
}
export function emitJoinConversation(conversationId: string) {
  socket?.emit('joinConversation', { conversationId });
}
export function emitLeaveConversation(conversationId: string) {
  socket?.emit('leaveConversation', { conversationId });
}
export function emitMarkRead(conversationId: string) {
  socket?.emit('markAsRead', { conversationId });
}
export function emitTyping(conversationId: string, isTyping: boolean) {
  socket?.emit('typing', { conversationId, isTyping });
}
