'use client';

import {
  useRef, useState, useCallback, useEffect, KeyboardEvent, ChangeEvent,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SendHorizontal, Loader2 } from 'lucide-react';
import FileUploadButton from './FileUploadButton';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MessageInputProps {
  conversationId: string;
  /** Called when the user submits a text message */
  onSendMessage: (content: string) => void | Promise<void>;
  /** Called when a file is successfully uploaded and should be sent as a message */
  onSendFile: (fileUrl: string, fileName: string, contentType: string) => void;
  /** Emit typing events to the server */
  onTyping?: (isTyping: boolean) => void;
  /** Disables the input entirely (e.g. while connecting) */
  disabled?: boolean;
  /** True while a text message send is in-flight */
  isSending?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Stop-typing fires this many ms after the last keystroke */
const TYPING_STOP_DELAY = 2500;

// ─── Component ────────────────────────────────────────────────────────────────

export default function MessageInput({
  conversationId,
  onSendMessage,
  onSendFile,
  onTyping,
  disabled = false,
  isSending = false,
}: MessageInputProps) {
  const [value, setValue]             = useState('');
  const [isTyping, setIsTyping]       = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const typingTimer                   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef                   = useRef<HTMLTextAreaElement>(null);

  // ── Auto-resize textarea ──────────────────────────────────────────────────
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;   // max ~5 rows
  }, []);

  useEffect(() => { autoResize(); }, [value, autoResize]);

  // ── Typing indicator management ───────────────────────────────────────────
  const startTyping = useCallback(() => {
    if (!isTyping) {
      setIsTyping(true);
      onTyping?.(true);
    }
    // Reset the stop timer on every keystroke
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      setIsTyping(false);
      onTyping?.(false);
    }, TYPING_STOP_DELAY);
  }, [isTyping, onTyping]);

  const stopTyping = useCallback(() => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (isTyping) {
      setIsTyping(false);
      onTyping?.(false);
    }
  }, [isTyping, onTyping]);

  // Cleanup on unmount
  useEffect(() => () => { if (typingTimer.current) clearTimeout(typingTimer.current); }, []);

  // ── Handle text change ────────────────────────────────────────────────────
  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    if (e.target.value.trim()) {
      startTyping();
    } else {
      stopTyping();
    }
  };

  // ── Send message ──────────────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isSending || disabled) return;
    stopTyping();
    onSendMessage(trimmed);
    setValue('');
    // Reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    // Re-focus for follow-on typing
    textareaRef.current?.focus();
  }, [value, isSending, disabled, stopTyping, onSendMessage]);

  // ── Enter to send (Shift+Enter = newline) ─────────────────────────────────
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── File uploaded callback ────────────────────────────────────────────────
  const handleFileUploaded = useCallback(
    (fileUrl: string, fileName: string, contentType: string) => {
      setIsUploading(false);
      onSendFile(fileUrl, fileName, contentType);
    },
    [onSendFile],
  );

  const canSend    = value.trim().length > 0 && !isSending && !disabled;
  const isDisabled = disabled || isSending;

  return (
    <div
      className="flex items-end gap-2 rounded-2xl border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2.5
                 transition-colors focus-within:border-[#3a3a3a]"
    >
      {/* ── File upload ──────────────────────────────────────────────────── */}
      <FileUploadButton
        conversationId={conversationId}
        onFileUploaded={handleFileUploaded}
        disabled={isDisabled || isUploading}
      />

      {/* ── Text area ────────────────────────────────────────────────────── */}
      <textarea
        ref={textareaRef}
        rows={1}
        placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={isDisabled}
        className="flex-1 resize-none bg-transparent text-sm text-white placeholder-[#444]
                   outline-none leading-6 py-1 max-h-[140px] overflow-y-auto
                   disabled:opacity-50 disabled:cursor-not-allowed scrollbar-thin"
      />

      {/* ── Send button ───────────────────────────────────────────────────── */}
      <motion.button
        type="button"
        onClick={handleSend}
        disabled={!canSend}
        whileTap={canSend ? { scale: 0.9 } : {}}
        aria-label="Send message"
        className={`flex h-9 w-9 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex-shrink-0 items-center justify-center rounded-xl
                    transition-all duration-200 ${
          canSend
            ? 'bg-gold-400 text-black hover:bg-gold-500 hover:shadow-glow-gold cursor-pointer'
            : 'bg-[#1e1e1e] text-[#444] cursor-not-allowed'
        }`}
      >
        <AnimatePresence mode="wait">
          {isSending ? (
            <motion.span
              key="loading"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
            >
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            </motion.span>
          ) : (
            <motion.span
              key="send"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
            >
              <SendHorizontal className="h-4 w-4" aria-hidden="true" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
