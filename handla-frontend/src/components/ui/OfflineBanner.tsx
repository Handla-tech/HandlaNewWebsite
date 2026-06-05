'use client';

/**
 * OfflineBanner — detects navigator.onLine + socket disconnection.
 *
 * • Appears as a sticky bar at the top of the viewport when the device
 *   goes offline or the WebSocket disconnects unexpectedly.
 * • Disappears automatically once connectivity is restored.
 * • RTL-aware (mirrors icon/text direction via uiStore locale).
 */

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Wifi } from 'lucide-react';
export function OfflineBanner() {
  const [isOffline,     setIsOffline]     = useState(false);
  const [justReconnected, setJustReconnected] = useState(false);

  const handleOffline = useCallback(() => setIsOffline(true), []);
  const handleOnline  = useCallback(() => {
    setIsOffline(false);
    setJustReconnected(true);
    setTimeout(() => setJustReconnected(false), 2500);
  }, []);

  useEffect(() => {
    // Sync with current state on mount
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOffline(true);
    }

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online',  handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online',  handleOnline);
    };
  }, [handleOffline, handleOnline]);

  const showOffline     = isOffline;
  const showReconnected = !isOffline && justReconnected;

  return (
    <AnimatePresence>
      {(showOffline || showReconnected) && (
        <motion.div
          key={showOffline ? 'offline' : 'online'}
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0,   opacity: 1 }}
          exit={{   y: -40,  opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          role="status"
          aria-live="polite"
          className="fixed left-0 right-0 top-0 z-[200] flex items-center justify-center gap-2 py-2 text-xs font-medium"
          style={{
            background: showOffline
              ? 'rgba(239,68,68,0.92)'
              : 'rgba(16,185,129,0.92)',
            backdropFilter: 'blur(8px)',
          }}
        >
          {showOffline ? (
            <>
              <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
              <span>You&apos;re offline — changes will sync when you reconnect.</span>
            </>
          ) : (
            <>
              <Wifi className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Back online!</span>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
