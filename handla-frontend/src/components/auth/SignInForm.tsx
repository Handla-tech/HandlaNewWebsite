'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2, Mail, Lock, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useTranslation } from '@/hooks/useTranslation';
import type { PendingVerification, User } from '@/types';

const signInSchema = z.object({
  email: z.string().min(1, 'emailRequired').email('emailInvalid'),
  password: z.string().min(1, 'passwordRequired').min(8, 'passwordMin'),
  rememberMe: z.boolean().optional(),
});

type SignInFormData = z.infer<typeof signInSchema>;

interface SignInFormProps {
  onSwitchMode: () => void;
  onPending: (p: PendingVerification) => void;
  onLoggedIn: (user: User) => void;
  onForgot: () => void;
}

export default function SignInForm({ onSwitchMode, onPending, onLoggedIn, onForgot }: SignInFormProps) {
  const { login, isLoading, error, clearError } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    defaultValues: { rememberMe: false },
  });

  const onSubmit = async (data: SignInFormData) => {
    clearError();
    try {
      const result = await login({ email: data.email, password: data.password });
      if (result.loggedIn) {
        onLoggedIn(result.user);
      } else {
        onPending({ email: result.email, purpose: result.purpose });
      }
    } catch {
      /* error surfaced via store */
    }
  };

  const fieldVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.25 } }),
  };

  const inputStyle = {
    background: 'var(--surface-3)',
    borderColor: 'var(--ov-strong)',
    color: 'var(--ink-1)',
  } as const;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <AnimatedError message={error} />

      {/* Email */}
      <motion.div custom={0} variants={fieldVariants} initial="hidden" animate="visible">
        <label className="block mb-1.5 text-xs font-medium" style={{ color: 'var(--ink-3)' }}>
          {t('auth.email')}
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--ink-6)' }} />
          <input
            type="email"
            dir="ltr"
            autoComplete="email"
            placeholder={t('auth.placeholderEmail')}
            {...register('email')}
            className={`w-full rounded-xl border py-3 pl-10 pr-4 text-sm outline-none transition-all focus:ring-1 ${
              errors.email
                ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500/20'
                : 'focus:border-gold-400/50 focus:ring-gold-400/15'
            }`}
            style={inputStyle}
          />
        </div>
        {errors.email && <FieldError message={t(`auth.validation.${errors.email.message}`)} />}
      </motion.div>

      {/* Password */}
      <motion.div custom={1} variants={fieldVariants} initial="hidden" animate="visible">
        <label className="block mb-1.5 text-xs font-medium" style={{ color: 'var(--ink-3)' }}>
          {t('auth.password')}
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--ink-6)' }} />
          <input
            type={showPassword ? 'text' : 'password'}
            dir="ltr"
            autoComplete="current-password"
            placeholder="••••••••"
            {...register('password')}
            className={`w-full rounded-xl border py-3 pl-10 pr-11 text-sm outline-none transition-all focus:ring-1 ${
              errors.password
                ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500/20'
                : 'focus:border-gold-400/50 focus:ring-gold-400/15'
            }`}
            style={inputStyle}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
            className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
            style={{ color: 'var(--ink-6)' }}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password && <FieldError message={t(`auth.validation.${errors.password.message}`)} />}
      </motion.div>

      {/* Remember me + forgot */}
      <motion.div custom={2} variants={fieldVariants} initial="hidden" animate="visible" className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer group">
          <input
            type="checkbox"
            {...register('rememberMe')}
            className="h-4 w-4 rounded accent-gold-400 cursor-pointer"
            style={{ borderColor: 'var(--ov-strong)', background: 'var(--surface-3)' }}
          />
          <span className="text-xs select-none transition-colors" style={{ color: 'var(--ink-4)' }}>
            {t('auth.rememberMe')}
          </span>
        </label>
        <button type="button" onClick={onForgot} className="text-xs text-gold-400/80 hover:text-gold-400 transition-colors">
          {t('auth.forgotPassword')}
        </button>
      </motion.div>

      {/* Submit */}
      <motion.div custom={3} variants={fieldVariants} initial="hidden" animate="visible">
        <button
          type="submit"
          disabled={isSubmitting || isLoading}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-gold-400 py-3 text-sm font-semibold text-black transition-all hover:bg-gold-500 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {(isSubmitting || isLoading) ? (
            <><Loader2 className="h-4 w-4 animate-spin" />{t('auth.signingIn')}</>
          ) : t('auth.signIn')}
        </button>
      </motion.div>

      {/* Switch */}
      <motion.p custom={4} variants={fieldVariants} initial="hidden" animate="visible" className="text-center text-xs" style={{ color: 'var(--ink-5)' }}>
        {t('auth.noAccount')}{' '}
        <button type="button" onClick={onSwitchMode} className="text-gold-400/90 hover:text-gold-400 font-medium transition-colors">
          {t('auth.signUp')}
        </button>
      </motion.p>
    </form>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 flex items-center gap-1 text-xs text-red-500">
      <AlertCircle className="h-3 w-3 shrink-0" />
      {message}
    </p>
  );
}

function AnimatedError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500"
    >
      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
      <span>{message}</span>
    </motion.div>
  );
}
