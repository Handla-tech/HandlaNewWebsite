'use client';

// Route-level error boundary for /erp
// Next.js App Router calls this when an unhandled error propagates from
// any page or server component inside the /erp segment.

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCw, LayoutDashboard } from 'lucide-react';
import Link from 'next/link';

export default function ErpError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[erp] unhandled error:', error);
  }, [error]);

  return (
    <div className="flex h-full items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex max-w-sm flex-col items-center gap-5 text-center"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10">
          <AlertTriangle className="h-7 w-7 text-red-400" />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-sm font-semibold text-white">Something went wrong</h2>
          <p className="text-xs text-[#666]">
            {error.message || 'An unexpected error occurred in the ERP portal.'}
          </p>
          {error.digest && (
            <p className="font-mono text-[10px] text-[#444]">
              Error ID: {error.digest}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-2 rounded-xl border border-[#2a2a2a] bg-[#141414] px-4 py-2 text-xs font-medium text-[#aaa] transition-all hover:text-white"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </button>
          <Link
            href="/erp"
            className="flex items-center gap-2 rounded-xl border border-[#fbbf24]/20 bg-[#fbbf24]/5 px-4 py-2 text-xs font-medium text-[#fbbf24] transition-all hover:bg-[#fbbf24]/10"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            ERP home
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
