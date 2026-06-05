'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, CheckCircle2, XCircle, Info, X,
} from 'lucide-react';
import { useToastStore, type Toast, type ToastType } from '@/store/toastStore';
import { useUIStore } from '@/store/uiStore';
import { cn } from '@/lib/utils';

// ─── Styles per toast type ────────────────────────────────────────────────────

const TOAST_STYLES: Record<ToastType, {
  icon: React.ElementType;
  container: string;
  iconColor: string;
}> = {
  message: {
    icon: MessageSquare,
    container: 'border-gold-400/20 bg-[#0f0f0f]',
    iconColor: 'text-gold-400',
  },
  success: {
    icon: CheckCircle2,
    container: 'border-emerald-500/20 bg-[#0f0f0f]',
    iconColor: 'text-emerald-400',
  },
  error: {
    icon: XCircle,
    container: 'border-red-500/20 bg-[#0f0f0f]',
    iconColor: 'text-red-400',
  },
  info: {
    icon: Info,
    container: 'border-[#2a2a2a] bg-[#0f0f0f]',
    iconColor: 'text-[#888]',
  },
};

// ─── Single toast ─────────────────────────────────────────────────────────────

function ToastItem({ toast, isRTL }: { toast: Toast; isRTL: boolean }) {
  const removeToast = useToastStore((s) => s.removeToast);
  const { icon: Icon, container, iconColor } = TOAST_STYLES[toast.type];

  // Auto-dismiss
  useEffect(() => {
    if (toast.duration <= 0) return;
    const timer = setTimeout(() => removeToast(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, removeToast]);

  const slideX = isRTL ? -64 : 64;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: slideX, scale: 0.95 }}
      animate={{ opacity: 1, x: 0,       scale: 1    }}
      exit={{    opacity: 0, x: slideX,  scale: 0.95, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 350, damping: 32 }}
      className={cn(
        'flex w-80 items-start gap-3 rounded-2xl border p-4 shadow-glass',
        container,
      )}
    >
      {/* Icon */}
      <div className="mt-0.5 flex-shrink-0">
        <Icon className={cn('h-4 w-4', iconColor)} />
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-white">{toast.title}</p>
        {toast.message && (
          <p className="mt-0.5 line-clamp-2 text-[11px] text-[#888]">{toast.message}</p>
        )}
      </div>

      {/* Dismiss */}
      <button
        type="button"
        onClick={() => removeToast(toast.id)}
        aria-label="Dismiss notification"
        className="flex-shrink-0 text-[#555] transition-colors hover:text-white"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </motion.div>
  );
}

// ─── Container (fixed top-right) ──────────────────────────────────────────────

export function ToastContainer() {
  const toasts  = useToastStore((s) => s.toasts);
  const locale  = useUIStore((s) => s.locale);
  const isRTL   = locale === 'ar';

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className={cn(
        'fixed top-4 z-[100] flex flex-col gap-2',
        isRTL
          ? 'left-4 items-start'   // RTL: anchor to left, slides from left
          : 'right-4 items-end',   // LTR: anchor to right, slides from right
      )}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} isRTL={isRTL} />
        ))}
      </AnimatePresence>
    </div>
  );
}
