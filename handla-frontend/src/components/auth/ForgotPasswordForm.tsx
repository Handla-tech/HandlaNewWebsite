'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Mail, Lock, AlertCircle, CheckCircle2, ArrowLeft, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { authApi } from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';

interface ForgotPasswordFormProps {
  onDone: () => void;   // back to sign-in after success
  onBack: () => void;   // cancel → back to sign-in
}

type Stage = 'request' | 'reset' | 'success';

const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

/**
 * Two-step forgot-password flow reusing the backend email-code infrastructure:
 *   1) request → POST /auth/forgot-password (anti-enumeration generic response)
 *   2) reset   → POST /auth/reset-password  (email + 6-digit code + new password)
 * Fully localized (EN/AR) and theme-aware (light/dark) via CSS tokens.
 */
export default function ForgotPasswordForm({ onDone, onBack }: ForgotPasswordFormProps) {
  const { t, locale, isRTL } = useTranslation();

  const [stage, setStage] = useState<Stage>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const Back = isRTL ? ArrowRight : ArrowLeft;

  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(t('auth.validation.emailInvalid'));
      return;
    }
    setLoading(true);
    try {
      await authApi.forgotPassword({ email, locale });
      setInfo(t('auth.forgot.sentGeneric'));
      setStage('reset');
    } catch {
      // Even on error we advance (anti-enumeration parity) but show generic info.
      setInfo(t('auth.forgot.sentGeneric'));
      setStage('reset');
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (code.replace(/\D/g, '').length !== 6) {
      setError(t('auth.validation.codeLength'));
      return;
    }
    if (!PASSWORD_RE.test(password)) {
      setError(t('auth.validation.passwordStrength'));
      return;
    }
    if (password !== confirm) {
      setError(t('auth.validation.passwordsMismatch'));
      return;
    }
    setLoading(true);
    try {
      await authApi.resetPassword({ email, code, password });
      setStage('success');
    } catch (err) {
      const resp = (err as { response?: { data?: { code?: string } } })?.response?.data;
      if (resp?.code === 'OTP_INVALID') setError(t('auth.errors.otpInvalid'));
      else if (resp?.code === 'OTP_EXPIRED') setError(t('auth.errors.otpExpired'));
      else if (resp?.code === 'OTP_TOO_MANY_ATTEMPTS') setError(t('auth.errors.otpTooMany'));
      else setError(t('auth.errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full rounded-xl border py-3 pl-10 pr-11 text-sm outline-none transition-all focus:ring-1 focus:ring-gold-400/15 focus:border-gold-400/50';
  const inputStyle = {
    background: 'var(--surface-3)',
    borderColor: 'var(--ov-strong)',
    color: 'var(--ink-1)',
  } as const;

  if (stage === 'success') {
    return (
      <div className="text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500"
        >
          <CheckCircle2 className="h-6 w-6" />
        </motion.div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--ink-1)' }}>
          {t('auth.forgot.successTitle')}
        </h1>
        <p className="mt-1.5 text-sm" style={{ color: 'var(--ink-4)' }}>
          {t('auth.forgot.success')}
        </p>
        <button
          onClick={onDone}
          className="mt-6 w-full rounded-xl bg-gold-400 py-3 text-sm font-semibold text-black transition-all hover:bg-gold-500 active:scale-[0.98]"
        >
          {t('auth.signIn')}
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--ink-1)' }}>
          {stage === 'request' ? t('auth.forgot.title') : t('auth.forgot.resetTitle')}
        </h1>
        <p className="mt-1.5 text-sm" style={{ color: 'var(--ink-4)' }}>
          {stage === 'request' ? (
            t('auth.forgot.subtitle')
          ) : (
            <>
              {t('auth.forgot.resetSubtitlePrefix')}{' '}
              <span className="font-medium" style={{ color: 'var(--ink-2)' }} dir="ltr">
                {email}
              </span>{' '}
              {t('auth.forgot.resetSubtitleSuffix')}
            </>
          )}
        </p>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {info && !error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-500">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{info}</span>
        </div>
      )}

      {stage === 'request' ? (
        <form onSubmit={requestCode} noValidate className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--ink-3)' }}>
              {t('auth.email')}
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--ink-6)' }} />
              <input
                type="email"
                dir="ltr"
                autoComplete="email"
                placeholder={t('auth.placeholderEmail')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                style={inputStyle}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold-400 py-3 text-sm font-semibold text-black transition-all hover:bg-gold-500 active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" />{t('auth.forgot.sending')}</> : t('auth.forgot.sendCode')}
          </button>
        </form>
      ) : (
        <form onSubmit={resetPassword} noValidate className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--ink-3)' }}>
              {t('auth.otp.codeLabel')}
            </label>
            <input
              type="text"
              inputMode="numeric"
              dir="ltr"
              maxLength={6}
              placeholder="------"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full rounded-xl border py-3 px-4 text-center text-lg font-bold tracking-[0.4em] outline-none transition-all focus:ring-1 focus:ring-gold-400/15 focus:border-gold-400/50"
              style={inputStyle}
            />
          </div>
          <PasswordField
            label={t('auth.forgot.newPassword')}
            value={password}
            onChange={setPassword}
            show={showPw}
            toggle={() => setShowPw((v) => !v)}
            inputClass={inputClass}
            inputStyle={inputStyle}
          />
          <PasswordField
            label={t('auth.forgot.confirmNewPassword')}
            value={confirm}
            onChange={setConfirm}
            show={showPw}
            toggle={() => setShowPw((v) => !v)}
            inputClass={inputClass}
            inputStyle={inputStyle}
          />
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold-400 py-3 text-sm font-semibold text-black transition-all hover:bg-gold-500 active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" />{t('auth.forgot.resetting')}</> : t('auth.forgot.resetButton')}
          </button>
        </form>
      )}

      <button
        type="button"
        onClick={onBack}
        className="mt-5 flex w-full items-center justify-center gap-1 text-xs transition-colors hover:text-[color:var(--ink-3)]"
        style={{ color: 'var(--ink-5)' }}
      >
        <Back className="h-3 w-3" />
        {t('auth.backToSignIn')}
      </button>
    </div>
  );
}

function PasswordField({
  label, value, onChange, show, toggle, inputClass, inputStyle,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  toggle: () => void;
  inputClass: string;
  inputStyle: React.CSSProperties;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--ink-3)' }}>
        {label}
      </label>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--ink-6)' }} />
        <input
          type={show ? 'text' : 'password'}
          dir="ltr"
          autoComplete="new-password"
          placeholder="••••••••"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
          style={inputStyle}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={toggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
          style={{ color: 'var(--ink-6)' }}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
