'use client';

/**
 * ConfirmDialog — reusable glassmorphism confirmation modal.
 *
 * Features:
 *  - Accessible: role="dialog", aria-modal, aria-labelledby, Escape to close
 *  - Spring scale-in animation via framer-motion
 *  - Variant: "danger" (red confirm button) | "default" (gold confirm button)
 *
 * Usage:
 *   <ConfirmDialog
 *     open={open}
 *     title="Delete Record"
 *     message="This action cannot be undone."
 *     confirmLabel="Delete"
 *     variant="danger"
 *     loading={isDeleting}
 *     onConfirm={handleDelete}
 *     onCancel={() => setOpen(false)}
 *   />
 */

import React, { useEffect, useCallback, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConfirmDialogProps {
  open:          boolean;
  title:         string;
  message:       React.ReactNode;
  confirmLabel?: string;
  cancelLabel?:  string;
  variant?:      'default' | 'danger';
  loading?:      boolean;
  onConfirm:     () => void;
  onCancel:      () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel  = 'Cancel',
  variant      = 'default',
  loading      = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();

  // Escape key closes the dialog
  const handleKey = useCallback(
    (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); },
    [onCancel],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKey);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, handleKey]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            className="relative w-full max-w-md rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] p-6 shadow-2xl"
            initial={{ opacity: 0, scale: 0.9, y: 16 }}
            animate={{ opacity: 1, scale: 1,   y: 0 }}
            exit={{ opacity:  0, scale: 0.9, y: 16 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          >
            {/* Close button */}
            <button
              className="absolute right-4 top-4 rounded-lg p-1 text-[#666] transition-colors hover:bg-white/5 hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center"
              onClick={onCancel}
              aria-label="Close dialog"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Icon */}
            <div className={cn(
              'mb-4 flex h-12 w-12 items-center justify-center rounded-full',
              variant === 'danger' ? 'bg-red-400/10' : 'bg-[#fbbf24]/10',
            )}>
              {variant === 'danger' ? (
                <AlertTriangle className="h-6 w-6 text-red-400" aria-hidden="true" />
              ) : (
                <HelpCircle className="h-6 w-6 text-[#fbbf24]" aria-hidden="true" />
              )}
            </div>

            {/* Title */}
            <h2 id={titleId} className="mb-2 text-lg font-semibold text-white">
              {title}
            </h2>

            {/* Message */}
            <div className="mb-6 text-sm text-[#888] leading-relaxed">
              {message}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <button
                className="min-h-[44px] rounded-xl border border-[#2a2a2a] bg-transparent px-5 py-2 text-sm font-medium text-[#888] transition-colors hover:border-[#3a3a3a] hover:text-white"
                onClick={onCancel}
                disabled={loading}
              >
                {cancelLabel}
              </button>
              <button
                className={cn(
                  'min-h-[44px] rounded-xl px-5 py-2 text-sm font-semibold transition-opacity disabled:opacity-60',
                  variant === 'danger'
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-[#fbbf24] text-black hover:bg-[#f59e0b]',
                )}
                onClick={onConfirm}
                disabled={loading}
                aria-busy={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Processing…
                  </span>
                ) : confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
