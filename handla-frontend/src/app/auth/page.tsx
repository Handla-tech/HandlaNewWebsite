'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import SignInForm from '@/components/auth/SignInForm';
import SignUpForm from '@/components/auth/SignUpForm';
import { useAuthStore } from '@/store/authStore';

type AuthMode = 'signin' | 'signup';

// ── Page wrapper ───────────────────────────────────────────────────────────────
//
// Next.js 14 requires any client component that calls `useSearchParams()` to be
// wrapped in <Suspense>, otherwise the prerender bails out and the build fails
// with "useSearchParams() should be wrapped in a suspense boundary at page
// '/auth'". We split the component so the search-params-reading body lives in
// AuthPageInner and the exported page just renders it inside <Suspense>.
export default function AuthPage() {
  return (
    <Suspense fallback={<AuthPageFallback />}>
      <AuthPageInner />
    </Suspense>
  );
}

// ── Lightweight skeleton shown during the Suspense boundary ──────────────────
function AuthPageFallback() {
  return (
    <main className="relative min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#2a2a2a] border-t-gold-400" />
    </main>
  );
}

function AuthPageInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  // Use the raw store — NOT useAuth() — so we never trigger getMe() here.
  // getMe() on the auth page would fire the Axios interceptor → refresh →
  // on failure → auth-failure callback → router.push('/auth') → loop.
  const { isLoggedIn, user } = useAuthStore();
  const [mode,    setMode]    = useState<AuthMode>('signin');
  const [mounted, setMounted] = useState(false);

  // Wait for client hydration before reading sessionStorage-persisted state.
  // This prevents a flash where isLoggedIn is briefly false before Zustand
  // reads sessionStorage, which would show the form to a logged-in user.
  useEffect(() => { setMounted(true); }, []);

  // Redirect already-authenticated users once we know the state is real.
  useEffect(() => {
    if (!mounted) return;
    if (isLoggedIn && user) {
      const callbackUrl = searchParams.get('callbackUrl');
      const defaultPath = user.role === 'ADMIN' ? '/erp' : '/dashboard';
      const safePath    = callbackUrl?.startsWith('/') ? callbackUrl : defaultPath;
      router.replace(safePath);
    }
  }, [mounted, isLoggedIn, user, router, searchParams]);

  return (
    <main className="relative min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center overflow-hidden px-4 py-12">
      {/* ── Grid background ────────────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 bg-site-grid opacity-40" />

      {/* ── Glow orbs ──────────────────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-gold-400/5 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 h-80 w-80 rounded-full bg-amber-600/5 blur-[100px]" />
      </div>

      {/* ── Logo ───────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-8"
      >
        <Link href="/" className="inline-flex items-center group">
          <span className="font-mono font-bold text-xl tracking-tight">
            <span className="text-white">&lt;Handla </span><span className="text-gold-400">/</span><span className="text-white">&gt;</span>
          </span>
        </Link>
      </motion.div>

      {/* ── Card ───────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.05 }}
        className="relative w-full max-w-md"
      >
        {/* Card glow ring */}
        <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-gold-400/20 via-gold-400/5 to-transparent pointer-events-none" />

        <div className="relative rounded-2xl bg-[#111] border border-[#2a2a2a] shadow-glass-lg overflow-hidden">
          {/* ── Mode toggle ──────────────────────────────────────────── */}
          <div className="flex border-b border-[#2a2a2a]">
            {(['signin', 'signup'] as AuthMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`relative flex-1 py-4 text-sm font-semibold transition-colors ${
                  mode === m
                    ? 'text-white'
                    : 'text-[#666] hover:text-[#aaa]'
                }`}
              >
                {m === 'signin' ? 'Sign In' : 'Sign Up'}
                {mode === m && (
                  <motion.div
                    layoutId="auth-tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold-400"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* ── Form area ────────────────────────────────────────────── */}
          <div className="p-7">
            <AnimatePresence mode="wait">
              {mode === 'signin' ? (
                <motion.div
                  key="signin"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.22 }}
                >
                  <div className="mb-6">
                    <h1 className="text-2xl font-bold text-white">Welcome back</h1>
                    <p className="mt-1 text-sm text-[#888]">
                      Sign in to your Handla account
                    </p>
                  </div>
                  <SignInForm onSwitchMode={() => setMode('signup')} />
                </motion.div>
              ) : (
                <motion.div
                  key="signup"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.22 }}
                >
                  <div className="mb-6">
                    <h1 className="text-2xl font-bold text-white">Create account</h1>
                    <p className="mt-1 text-sm text-[#888]">
                      Join Handla and start building today
                    </p>
                  </div>
                  <SignUpForm onSwitchMode={() => setMode('signin')} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Social divider ───────────────────────────────────── */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#2a2a2a]" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-[#111] px-3 text-xs text-[#555]">
                  or continue with
                </span>
              </div>
            </div>

            {/* ── Social login buttons (UI only) ───────────────────── */}
            <SocialButtons />
          </div>
        </div>
      </motion.div>

      {/* ── Footer note ────────────────────────────────────────────────── */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-8 text-xs text-[#555] text-center"
      >
        By continuing, you agree to our{' '}
        <span className="text-gold-400/70 cursor-pointer hover:text-gold-400 transition-colors">
          Terms of Service
        </span>{' '}
        and{' '}
        <span className="text-gold-400/70 cursor-pointer hover:text-gold-400 transition-colors">
          Privacy Policy
        </span>
      </motion.p>
    </main>
  );
}

// ── Social Buttons (UI only) ──────────────────────────────────────────────────

function SocialButtons() {
  const socials = [
    {
      name: 'Google',
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
      ),
    },
    {
      name: 'GitHub',
      icon: (
        <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
        </svg>
      ),
    },
    {
      name: 'LinkedIn',
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="#0A66C2">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
        </svg>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {socials.map((s) => (
        <button
          key={s.name}
          disabled
          title={`${s.name} (coming soon)`}
          className="flex items-center justify-center gap-2 rounded-xl border border-[#2a2a2a] bg-[#161616] py-2.5 text-xs font-medium text-[#666] transition-all hover:border-[#3a3a3a] hover:text-[#999] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {s.icon}
          <span className="hidden sm:inline">{s.name}</span>
        </button>
      ))}
    </div>
  );
}
