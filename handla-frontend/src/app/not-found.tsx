/**
 * 404 Not Found page — rendered by Next.js App Router when no route matches.
 * Matches the dark theme of the rest of the application.
 */

import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '404 — Page Not Found',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0a] px-4">
      {/* Grid background */}
      <div className="pointer-events-none fixed inset-0 bg-site-grid opacity-30" />

      {/* Glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-[#fbbf24]/5 blur-[120px]" />
      </div>

      <div className="relative flex flex-col items-center gap-6 text-center">
        {/* Giant 404 */}
        <div className="font-mono text-[96px] font-bold leading-none tracking-tight">
          <span className="text-[#1e1e1e]">4</span>
          <span className="text-[#fbbf24]">0</span>
          <span className="text-[#1e1e1e]">4</span>
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold text-white">Page not found</h1>
          <p className="max-w-sm text-sm text-[#666]">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href="/"
            className="rounded-xl px-5 py-2.5 text-sm font-semibold transition-all"
            style={{ background: '#fbbf24', color: '#000' }}
          >
            Go home
          </Link>
          <Link
            href="/auth"
            className="rounded-xl border border-[#2a2a2a] bg-[#141414] px-5 py-2.5 text-sm font-medium text-[#aaa] transition-all hover:text-white"
          >
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
