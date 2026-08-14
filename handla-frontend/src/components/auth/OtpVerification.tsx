'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Loader2, AlertCircle, CheckCircle2, ArrowLeft, ArrowRight } from 'lucide-react';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useTranslation } from '@/hooks/useTranslation';
import type { User } from '@/types';

type Purpose = 'SIGNUP' | 'LOGIN' | 'GOOGLE';

interface OtpVerificationProps {
  email: string;
  purpose: Purpose;
  /** Called after a fully-verified session is created. */
  onVerified: (user: User) => void;
  /** Called when the user wants to go back (change email / cancel). */
  onBack?: () => void;
}

const CODE_LENGTH = 6;
const RESEND_COOLDOWN = 45; // seconds — matches backend default

/**
 * Reusable 6-digit OTP verification screen shared by signup, login and Google
 * flows (never duplicated per-flow). Handles focus progression, backspace
 * navigation, paste, numeric mobile keyboard, RTL/LTR, light/dark, resend
 * cooldown, and all error/success states. Verification is completed by the
 * backend `/auth/verify-otp`; a session cookie is set there on success.
 */
export default function OtpVerification({ email, purpose, onVerified, onBack }: OtpVerificationProps) {
  const { t, locale, isRTL } = useTranslation();
  const { setUser } = useAuthStore();

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [status, setStatus] = useState<'idle' | 'verifying' | 'error' | 'success'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);

  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  const code = useMemo(() => digits.join(''), [digits]);

  // Auto-focus first field on mount.
  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  // Resend cooldown ticker.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Map a backend error code / message to a localized string.
  const mapError = useCallback(
    (err: unknown): string => {
      const resp = (err as { response?: { data?: { code?: string; message?: string } } })?.response?.data;
      switch (resp?.code) {
        case 'OTP_INVALID':          return t('auth.errors.otpInvalid');
        case 'OTP_EXPIRED':          return t('auth.errors.otpExpired');
        case 'OTP_TOO_MANY_ATTEMPTS':return t('auth.errors.otpTooMany');
        case 'RESEND_COOLDOWN':      return t('auth.errors.resendCooldown');
        default:                     return t('auth.errors.generic');
      }
    },
    [t],
  );

  const submit = useCallback(
    async (fullCode: string) => {
      if (fullCode.length !== CODE_LENGTH) return;
      setStatus('verifying');
      setError(null);
      setInfo(null);
      try {
        const res = await authApi.verifyOtp({ email, code: fullCode, purpose });
        const user: User = res.data?.data?.user ?? res.data?.user;
        setStatus('success');
        setUser(user);
        setTimeout(() => onVerified(user), 400);
      } catch (err) {
        setStatus('error');
        setError(mapError(err));
        setDigits(Array(CODE_LENGTH).fill(''));
        inputsRef.current[0]?.focus();
      }
    },
    [email, purpose, setUser, onVerified, mapError],
  );

  // Auto-submit once all digits are entered.
  useEffect(() => {
    if (code.length === CODE_LENGTH && status !== 'verifying' && status !== 'success') {
      submit(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const handleChange = (index: number, raw: string) => {
    const val = raw.replace(/\D/g, '');
    if (!val) {
      setDigits((prev) => {
        const next = [...prev];
        next[index] = '';
        return next;
      });
      return;
    }
    // Support pasting / typing multiple chars into a single field.
    setDigits((prev) => {
      const next = [...prev];
      const chars = val.split('');
      let i = index;
      for (const c of chars) {
        if (i >= CODE_LENGTH) break;
        next[i] = c;
        i += 1;
      }
      const nextFocus = Math.min(i, CODE_LENGTH - 1);
      requestAnimationFrame(() => inputsRef.current[nextFocus]?.focus());
      return next;
    });
    if (status === 'error') setStatus('idle');
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        setDigits((prev) => {
          const next = [...prev];
          next[index] = '';
          return next;
        });
      } else if (index > 0) {
        inputsRef.current[index - 1]?.focus();
        setDigits((prev) => {
          const next = [...prev];
          next[index - 1] = '';
          return next;
        });
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < CODE_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
    if (!text) return;
    const next = Array(CODE_LENGTH).fill('');
    text.split('').forEach((c, i) => (next[i] = c));
    setDigits(next);
    const focusIdx = Math.min(text.length, CODE_LENGTH - 1);
    requestAnimationFrame(() => inputsRef.current[focusIdx]?.focus());
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setError(null);
    setInfo(null);
    try {
      await authApi.resendOtp({ email, purpose, locale });
      setInfo(t('auth.otp.resent'));
      setCooldown(RESEND_COOLDOWN);
      setDigits(Array(CODE_LENGTH).fill(''));
      inputsRef.current[0]?.focus();
    } catch (err) {
      const resp = (err as { response?: { data?: { retryAfterSeconds?: number } } })?.response?.data;
      if (resp?.retryAfterSeconds) setCooldown(resp.retryAfterSeconds);
      setError(mapError(err));
    }
  };

  const busy = status === 'verifying' || status === 'success';

  return (
    <div>
      {/* Header */}
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--ink-1)' }}>
          {t('auth.otp.title')}
        </h1>
        <p className="mt-1.5 text-sm" style={{ color: 'var(--ink-4)' }}>
          {t('auth.otp.subtitlePrefix')}{' '}
          <span className="font-medium" style={{ color: 'var(--ink-2)' }} dir="ltr">
            {email}
          </span>
          {t('auth.otp.subtitleSuffix')}
        </p>
      </div>

      {/* Error / info banner */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </motion.div>
      )}
      {info && !error && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-500"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{info}</span>
        </motion.div>
      )}

      {/* OTP inputs — always LTR digit order for muscle memory, even in RTL. */}
      <div className="mb-6 flex justify-center gap-2 sm:gap-3" dir="ltr">
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => {
              inputsRef.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            maxLength={CODE_LENGTH}
            value={digit}
            disabled={busy}
            aria-label={`${t('auth.otp.codeLabel')} ${i + 1}`}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            className={`h-12 w-10 sm:h-14 sm:w-12 rounded-xl border text-center text-xl font-bold outline-none transition-all focus:ring-2 ${
              status === 'error'
                ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500/20'
                : status === 'success'
                  ? 'border-emerald-500/60 focus:ring-emerald-500/20'
                  : 'focus:ring-gold-400/20'
            }`}
            style={{
              background: 'var(--surface-3)',
              borderColor:
                status === 'error' ? undefined : status === 'success' ? undefined : 'var(--ov-strong)',
              color: 'var(--ink-1)',
            }}
          />
        ))}
      </div>

      {/* Verify button (manual fallback; auto-submits when full) */}
      <button
        type="button"
        onClick={() => submit(code)}
        disabled={busy || code.length !== CODE_LENGTH}
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gold-400 py-3 text-sm font-semibold text-black transition-all hover:bg-gold-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === 'verifying' ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('auth.otp.verifying')}
          </>
        ) : status === 'success' ? (
          <>
            <CheckCircle2 className="h-4 w-4" />
            {t('auth.otp.verify')}
          </>
        ) : (
          t('auth.otp.verify')
        )}
      </button>

      {/* Resend + change email */}
      <div className="flex flex-col items-center gap-2 text-xs" style={{ color: 'var(--ink-5)' }}>
        <div className="flex items-center gap-1.5">
          <span>{t('auth.otp.didntReceive')}</span>
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0}
            className="font-medium text-gold-400 transition-colors hover:text-gold-500 disabled:cursor-not-allowed disabled:text-[color:var(--ink-6)] disabled:opacity-70"
          >
            {cooldown > 0 ? t('auth.otp.resendIn', { seconds: cooldown }) : t('auth.otp.resend')}
          </button>
        </div>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 transition-colors hover:text-[color:var(--ink-3)]"
          >
            {isRTL ? <ArrowRight className="h-3 w-3" /> : <ArrowLeft className="h-3 w-3" />}
            {t('auth.otp.changeEmail')}
          </button>
        )}
      </div>
    </div>
  );
}
