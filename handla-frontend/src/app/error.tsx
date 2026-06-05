'use client';

/**
 * Global error boundary — rendered by Next.js App Router when an unhandled
 * error propagates from the root layout or any non-segmented page.
 *
 * Per Next.js docs, this file must be a Client Component ('use client')
 * and must export default a component that receives { error, reset }.
 */

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[global] unhandled error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-[#0a0a0a] font-sans">
        <div className="flex max-w-sm flex-col items-center gap-5 p-8 text-center">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            <AlertTriangle className="h-7 w-7 text-red-400" />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-sm font-semibold text-white">Something went wrong</h1>
            <p className="text-xs text-[#666]">
              {error.message || 'An unexpected application error occurred.'}
            </p>
            {error.digest && (
              <p className="font-mono text-[10px] text-[#444]">Error ID: {error.digest}</p>
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
              href="/"
              className="flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-medium transition-all"
              style={{
                borderColor: 'rgba(251,191,36,0.2)',
                background:  'rgba(251,191,36,0.05)',
                color:       '#fbbf24',
              }}
            >
              <Home className="h-3.5 w-3.5" />
              Go home
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
