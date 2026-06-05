import { io, Socket } from 'socket.io-client';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from '@/types';

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

const LOG = '[socket]';

// ─── Typed Socket ─────────────────────────────────────────────────────────────

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// ─── Singleton socket instance ────────────────────────────────────────────────

let socketInstance: TypedSocket | null = null;

/**
 * Returns the singleton Socket.io client, creating it if necessary.
 *
 * AUTH STRATEGY — withCredentials only (no JS token injection):
 *   The access_token is httpOnly — unreadable by JS (document.cookie = '').
 *   withCredentials: true tells the browser to include all cookies, including
 *   httpOnly ones, in the WebSocket upgrade request headers.
 *   The NestJS gateway reads the token from handshake.headers.cookie.
 */
export function getSocket(): TypedSocket {
  if (!socketInstance) {
    console.debug(`${LOG} creating new socket instance → ${SOCKET_URL}`);

    socketInstance = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 10_000,
      randomizationFactor: 0.5,
      autoConnect: false,
      timeout: 10_000,
    }) as TypedSocket;

    // ── Lifecycle logging ──────────────────────────────────────────────────
    socketInstance.on('connect', () =>
      console.debug(`${LOG} ✅ connected  id=${socketInstance?.id}`),
    );
    socketInstance.on('disconnect', (reason) =>
      console.warn(`${LOG} ⚠️  disconnected  reason="${reason}"`),
    );
    socketInstance.on('connect_error', (err) =>
      console.error(`${LOG} ❌ connect_error  msg="${err.message}"  (auth cookie may be missing or expired)`),
    );
    socketInstance.io.on('reconnect', (n: number) =>
      console.debug(`${LOG} 🔄 reconnected after ${n} attempt(s)`),
    );
    socketInstance.io.on('reconnect_attempt', (n: number) =>
      console.debug(`${LOG} 🔄 reconnect attempt #${n}`),
    );
    socketInstance.io.on('reconnect_failed', () =>
      console.error(`${LOG} ❌ reconnect_failed — giving up after max attempts`),
    );
  }

  return socketInstance;
}

/** Connect the socket (idempotent — safe to call multiple times). */
export function connectSocket(): TypedSocket {
  const socket = getSocket();
  if (!socket.connected) {
    console.debug(`${LOG} connectSocket() → calling socket.connect()`);
    socket.connect();
  } else {
    console.debug(`${LOG} connectSocket() → already connected, no-op`);
  }
  return socket;
}

/** Disconnect and destroy the socket instance. */
export function disconnectSocket(): void {
  if (socketInstance) {
    console.debug(`${LOG} disconnectSocket() → destroying singleton`);
    socketInstance.disconnect();
    socketInstance = null;
  }
}

/** Join a conversation room. */
export function joinConversation(conversationId: string): void {
  console.debug(`${LOG} joinConversation  convId=${conversationId}`);
  getSocket().emit('joinConversation', { conversationId });
}

/** Leave a conversation room. */
export function leaveConversation(conversationId: string): void {
  console.debug(`${LOG} leaveConversation  convId=${conversationId}`);
  getSocket().emit('leaveConversation', { conversationId });
}

/** Send a chat message. */
export function sendSocketMessage(payload: {
  conversationId: string;
  content?: string;
  fileUrl?: string;
}): void {
  console.debug(`${LOG} sendMessage  convId=${payload.conversationId}`);
  getSocket().emit('sendMessage', payload);
}

/** Emit a typing indicator. */
export function emitTyping(conversationId: string, isTyping: boolean): void {
  getSocket().emit('typing', { conversationId, isTyping });
}

/** Mark a specific message or entire conversation as read. */
export function markRead(payload: {
  messageId?: string;
  conversationId?: string;
}): void {
  getSocket().emit('markAsRead', payload);
}

export default getSocket;
