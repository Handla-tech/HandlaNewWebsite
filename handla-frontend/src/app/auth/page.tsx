'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Sun, Moon, Languages } from 'lucide-react';
import SignInForm from '@/components/auth/SignInForm';
import SignUpForm from '@/components/auth/SignUpForm';
import OtpVerification from '@/components/auth/OtpVerification';
import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { useTranslation } from '@/hooks/useTranslation';
import { authApi } from '@/lib/api';
import type { PendingVerification, User } from '@/types';

type AuthView = 'signin' | 'signup' | 'otp' | 'forgot';

export default function AuthPage() {
  return (
    <Suspense fallback={<AuthPageFallback />}>
      <AuthPageInner />
    </Suspense>
  );
}

function AuthPageFallback() {
  return (
    <main className="relative flex min-h-screen items-center justify-center" style={{ background: 'var(--page-bg)' }}>
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-gold-400" style={{ borderColor: 'var(--ov-strong)', borderTopColor: '#fbbf24' }} />
    </main>
  );
}

function AuthPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoggedIn, user } = useAuthStore();
  const { t, isRTL } = useTranslation();

  const [view, setView] = useState<AuthView>('signin');
  const [pending, setPending] = useState<PendingVerification | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Handle the Google OAuth callback redirect (?verify=1&purpose=GOOGLE&email=)
  // and OAuth errors (?error=google).
  useEffect(() => {
    if (searchParams.get('error') === 'google') {
      // surfaced through the SocialButtons banner via state below
      setGoogleError(t('auth.errors.googleFailed'));
    }
    if (searchParams.get('verify') === '1' && searchParams.get('purpose') === 'GOOGLE') {
      const email = searchParams.get('email');
      if (email) {
        setPending({ email, purpose: 'GOOGLE' });
        setView('otp');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const [googleError, setGoogleError] = useState<string | null>(null);

  const redirectAfterAuth = (u: User) => {
    const callbackUrl = searchParams.get('callbackUrl');
    const defaultPath = u.role === 'ADMIN' || u.role === 'EMPLOYEE' ? '/erp' : '/dashboard';
    const safePath = callbackUrl?.startsWith('/') ? callbackUrl : defaultPath;
    router.replace(safePath);
  };

  // Redirect already-authenticated users.
  useEffect(() => {
    if (!mounted || view === 'otp') return;
    if (isLoggedIn && user) redirectAfterAuth(user);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, isLoggedIn, user]);

  const startPending = (p: PendingVerification) => {
    setPending(p);
    setView('otp');
  };

  const titles: Record<AuthView, { title: string; subtitle: string }> = {
    signin:  { title: t('auth.welcomeBack'), subtitle: t('auth.signInSubtitle') },
    signup:  { title: t('auth.createAccount'), subtitle: t('auth.signUpSubtitle') },
    otp:     { title: '', subtitle: '' },
    forgot:  { title: '', subtitle: '' },
  };

  return (
    <main
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12"
      style={{ background: 'var(--page-bg)' }}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Grid + glow background */}
      <div className="pointer-events-none absolute inset-0 bg-site-grid opacity-40" />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-gold-400/5 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 h-80 w-80 rounded-full bg-amber-600/5 blur-[100px]" />
      </div>

      {/* Theme + language controls */}
      <AuthControls />

      {/* Logo */}
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mb-8">
        <Link href="/" className="inline-flex items-center">
          <span className="font-mono text-xl font-bold tracking-tight">
            <span style={{ color: 'var(--ink-1)' }}>&lt;Handla </span>
            <span className="text-gold-400">/</span>
            <span style={{ color: 'var(--ink-1)' }}>&gt;</span>
          </span>
        </Link>
      </motion.div>

      {/* Card */}
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.05 }} className="relative w-full max-w-md">
        <div className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-b from-gold-400/20 via-gold-400/5 to-transparent" />
        <div
          className="relative overflow-hidden rounded-2xl border shadow-h-lg"
          style={{ background: 'var(--surface-1)', borderColor: 'var(--ov-med)' }}
        >
          {/* Tabs (hidden during otp/forgot) */}
          {(view === 'signin' || view === 'signup') && (
            <div className="flex border-b" style={{ borderColor: 'var(--ov-med)' }}>
              {(['signin', 'signup'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setView(m)}
                  className="relative flex-1 py-4 text-sm font-semibold transition-colors"
                  style={{ color: view === m ? 'var(--ink-1)' : 'var(--ink-5)' }}
                >
                  {m === 'signin' ? t('auth.signIn') : t('auth.signUp')}
                  {view === m && (
                    <motion.div layoutId="auth-tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold-400" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />
                  )}
                </button>
              ))}
            </div>
          )}

          <div className="p-7">
            <AnimatePresence mode="wait">
              {view === 'signin' && (
                <motion.div key="signin" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.22 }}>
                  <div className="mb-6">
                    <h1 className="text-2xl font-bold" style={{ color: 'var(--ink-1)' }}>{titles.signin.title}</h1>
                    <p className="mt-1 text-sm" style={{ color: 'var(--ink-4)' }}>{titles.signin.subtitle}</p>
                  </div>
                  <SignInForm onSwitchMode={() => setView('signup')} onPending={startPending} onForgot={() => setView('forgot')} />
                  <SocialDivider />
                  <SocialButtons error={googleError} />
                </motion.div>
              )}

              {view === 'signup' && (
                <motion.div key="signup" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.22 }}>
                  <div className="mb-6">
                    <h1 className="text-2xl font-bold" style={{ color: 'var(--ink-1)' }}>{titles.signup.title}</h1>
                    <p className="mt-1 text-sm" style={{ color: 'var(--ink-4)' }}>{titles.signup.subtitle}</p>
                  </div>
                  <SignUpForm onSwitchMode={() => setView('signin')} onPending={startPending} />
                  <SocialDivider />
                  <SocialButtons error={googleError} />
                </motion.div>
              )}

              {view === 'otp' && pending && (
                <motion.div key="otp" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.22 }}>
                  <OtpVerification
                    email={pending.email}
                    purpose={pending.purpose}
                    onVerified={redirectAfterAuth}
                    onBack={() => { setPending(null); setView('signin'); }}
                  />
                </motion.div>
              )}

              {view === 'forgot' && (
                <motion.div key="forgot" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.22 }}>
                  <ForgotPasswordForm onDone={() => setView('signin')} onBack={() => setView('signin')} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* Footer note */}
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-8 max-w-md text-center text-xs" style={{ color: 'var(--ink-6)' }}>
        {t('auth.agreePrefix')}{' '}
        <span className="cursor-pointer text-gold-400/70 transition-colors hover:text-gold-400">{t('auth.termsOfService')}</span>{' '}
        {t('auth.and')}{' '}
        <span className="cursor-pointer text-gold-400/70 transition-colors hover:text-gold-400">{t('auth.privacyPolicy')}</span>
      </motion.p>
    </main>
  );
}

// ── Theme + language controls (match the main site toggles) ──────────────────
function AuthControls() {
  const { theme, toggleTheme, locale, setLocale } = useUIStore();
  const { isRTL } = useTranslation();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <div className={`absolute top-5 ${isRTL ? 'left-5' : 'right-5'} z-20 flex items-center gap-2`}>
      <button
        onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
        aria-label="Switch language"
        className="flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors"
        style={{ background: 'var(--surface-3)', borderColor: 'var(--ov-strong)', color: 'var(--ink-3)' }}
      >
        <Languages className="h-4 w-4" />
        {locale === 'ar' ? 'EN' : 'ع'}
      </button>
      <button
        onClick={toggleTheme}
        aria-label="Toggle theme"
        className="flex h-9 w-9 items-center justify-center rounded-lg border transition-colors"
        style={{ background: 'var(--surface-3)', borderColor: 'var(--ov-strong)', color: 'var(--ink-3)' }}
      >
        {mounted && theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
    </div>
  );
}

function SocialDivider() {
  const { t } = useTranslation();
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t" style={{ borderColor: 'var(--ov-med)' }} />
      </div>
      <div className="relative flex justify-center">
        <span className="px-3 text-xs" style={{ background: 'var(--surface-1)', color: 'var(--ink-6)' }}>
          {t('auth.orContinueWith')}
        </span>
      </div>
    </div>
  );
}

// ── Google-only social auth (real server-side OAuth). No fake buttons. ────────
function SocialButtons({ error }: { error: string | null }) {
  const { t } = useTranslation();

  const startGoogle = () => {
    // Full-page navigation to the backend OAuth start endpoint so it can set
    // the httpOnly anti-CSRF state cookie and redirect to Google.
    window.location.href = authApi.googleUrl();
  };

  return (
    <div>
      {error && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-500">
          <span>{error}</span>
        </div>
      )}
      <button
        type="button"
        onClick={startGoogle}
        className="flex w-full items-center justify-center gap-2.5 rounded-xl border py-3 text-sm font-medium transition-all hover:border-[color:var(--ov-strong)]"
        style={{ background: 'var(--surface-3)', borderColor: 'var(--ov-med)', color: 'var(--ink-2)' }}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        {t('auth.continueWithGoogle')}
      </button>
    </div>
  );
}
