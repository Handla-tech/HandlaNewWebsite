'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2, Mail, Lock, User, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useTranslation } from '@/hooks/useTranslation';
import type { PendingVerification } from '@/types';

const signUpSchema = z
  .object({
    name: z.string().min(1, 'nameRequired').min(2, 'nameMin').max(80, 'nameMin'),
    email: z.string().min(1, 'emailRequired').email('emailInvalid'),
    password: z
      .string()
      .min(8, 'passwordMin')
      .regex(/[A-Z]/, 'passwordStrength')
      .regex(/[a-z]/, 'passwordStrength')
      .regex(/[0-9]/, 'passwordStrength'),
    confirmPassword: z.string().min(1, 'confirmRequired'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'passwordsMismatch',
    path: ['confirmPassword'],
  });

type SignUpFormData = z.infer<typeof signUpSchema>;

function getPasswordScore(pwd: string): { score: number; color: string } {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[a-z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return { score: 1, color: '#ef4444' };
  if (score === 2) return { score: 2, color: '#f59e0b' };
  if (score === 3) return { score: 3, color: '#22c55e' };
  return { score: 4, color: '#10b981' };
}

interface SignUpFormProps {
  onSwitchMode: () => void;
  onPending: (p: PendingVerification) => void;
}

export default function SignUpForm({ onSwitchMode, onPending }: SignUpFormProps) {
  const { signup, isLoading, error, clearError } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignUpFormData>({ resolver: zodResolver(signUpSchema), mode: 'onChange' });

  const passwordValue = watch('password', '');
  const strength = useMemo(() => (passwordValue ? getPasswordScore(passwordValue) : null), [passwordValue]);

  const onSubmit = async (data: SignUpFormData) => {
    clearError();
    try {
      const pending = await signup({ name: data.name, email: data.email, password: data.password });
      onPending(pending);
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

  const baseInput = (hasErr: boolean, extraPr = 'pr-4') =>
    `w-full rounded-xl border py-3 pl-10 ${extraPr} text-sm outline-none transition-all focus:ring-1 ${
      hasErr
        ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500/20'
        : 'focus:border-gold-400/50 focus:ring-gold-400/15'
    }`;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <AnimatedError message={error} />

      {/* Name */}
      <motion.div custom={0} variants={fieldVariants} initial="hidden" animate="visible">
        <label className="block mb-1.5 text-xs font-medium" style={{ color: 'var(--ink-3)' }}>{t('auth.name')}</label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--ink-6)' }} />
          <input
            type="text"
            autoComplete="name"
            placeholder={t('auth.placeholderName')}
            {...register('name')}
            className={baseInput(!!errors.name)}
            style={inputStyle}
          />
        </div>
        {errors.name && <FieldError message={t(`auth.validation.${errors.name.message}`)} />}
      </motion.div>

      {/* Email */}
      <motion.div custom={1} variants={fieldVariants} initial="hidden" animate="visible">
        <label className="block mb-1.5 text-xs font-medium" style={{ color: 'var(--ink-3)' }}>{t('auth.email')}</label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--ink-6)' }} />
          <input
            type="email"
            dir="ltr"
            autoComplete="email"
            placeholder={t('auth.placeholderEmail')}
            {...register('email')}
            className={baseInput(!!errors.email)}
            style={inputStyle}
          />
        </div>
        {errors.email && <FieldError message={t(`auth.validation.${errors.email.message}`)} />}
      </motion.div>

      {/* Password */}
      <motion.div custom={2} variants={fieldVariants} initial="hidden" animate="visible">
        <label className="block mb-1.5 text-xs font-medium" style={{ color: 'var(--ink-3)' }}>{t('auth.password')}</label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--ink-6)' }} />
          <input
            type={showPassword ? 'text' : 'password'}
            dir="ltr"
            autoComplete="new-password"
            placeholder="••••••••"
            {...register('password')}
            className={baseInput(!!errors.password, 'pr-11')}
            style={inputStyle}
          />
          <button
            type="button" tabIndex={-1}
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
            className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
            style={{ color: 'var(--ink-6)' }}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password && <FieldError message={t(`auth.validation.${errors.password.message}`)} />}
        {passwordValue && strength && (
          <div className="mt-2 flex gap-1">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={idx}
                className="h-1 flex-1 rounded-full transition-all duration-300"
                style={{ backgroundColor: idx < strength.score ? strength.color : 'var(--surface-8)' }}
              />
            ))}
          </div>
        )}
      </motion.div>

      {/* Confirm password */}
      <motion.div custom={3} variants={fieldVariants} initial="hidden" animate="visible">
        <label className="block mb-1.5 text-xs font-medium" style={{ color: 'var(--ink-3)' }}>{t('auth.confirmPassword')}</label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--ink-6)' }} />
          <input
            type={showConfirm ? 'text' : 'password'}
            dir="ltr"
            autoComplete="new-password"
            placeholder="••••••••"
            {...register('confirmPassword')}
            className={baseInput(!!errors.confirmPassword, 'pr-11')}
            style={inputStyle}
          />
          <button
            type="button" tabIndex={-1}
            onClick={() => setShowConfirm((v) => !v)}
            aria-label={showConfirm ? t('auth.hidePassword') : t('auth.showPassword')}
            className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
            style={{ color: 'var(--ink-6)' }}
          >
            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.confirmPassword && <FieldError message={t(`auth.validation.${errors.confirmPassword.message}`)} />}
      </motion.div>

      {/* Submit */}
      <motion.div custom={4} variants={fieldVariants} initial="hidden" animate="visible">
        <button
          type="submit"
          disabled={isSubmitting || isLoading}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-gold-400 py-3 text-sm font-semibold text-black transition-all hover:bg-gold-500 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {(isSubmitting || isLoading) ? (
            <><Loader2 className="h-4 w-4 animate-spin" />{t('auth.creatingAccount')}</>
          ) : t('auth.createAccount')}
        </button>
      </motion.div>

      {/* Switch */}
      <motion.p custom={5} variants={fieldVariants} initial="hidden" animate="visible" className="text-center text-xs" style={{ color: 'var(--ink-5)' }}>
        {t('auth.hasAccount')}{' '}
        <button type="button" onClick={onSwitchMode} className="text-gold-400/90 hover:text-gold-400 font-medium transition-colors">
          {t('auth.signIn')}
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
