'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import {
  Eye, EyeOff, Loader2, Mail, Lock, User, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useTranslation } from '@/hooks/useTranslation';

// ─── Zod schema ───────────────────────────────────────────────────────────────

const signUpSchema = z
  .object({
    name: z
      .string()
      .min(1, 'Name is required')
      .min(2, 'Name must be at least 2 characters')
      .max(80, 'Name must be 80 characters or fewer'),
    email: z
      .string()
      .min(1, 'Email is required')
      .email('Please enter a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Must contain at least one number'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type SignUpFormData = z.infer<typeof signUpSchema>;

// ─── Password strength ────────────────────────────────────────────────────────

interface StrengthLevel {
  label: string;
  score: number;   // 0-4
  color: string;
}

function getPasswordStrength(pwd: string): StrengthLevel {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[a-z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;   // bonus for symbols

  if (score <= 1) return { label: 'Weak',   score: 1, color: '#ef4444' };
  if (score === 2) return { label: 'Fair',   score: 2, color: '#f59e0b' };
  if (score === 3) return { label: 'Good',   score: 3, color: '#22c55e' };
  return                  { label: 'Strong', score: 4, color: '#10b981' };
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface SignUpFormProps {
  onSwitchMode: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SignUpForm({ onSwitchMode }: SignUpFormProps) {
  const { signup, isLoading, error, clearError } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    mode: 'onChange',
  });

  const passwordValue = watch('password', '');
  const strength = useMemo(
    () => (passwordValue ? getPasswordStrength(passwordValue) : null),
    [passwordValue],
  );

  const onSubmit = async (data: SignUpFormData) => {
    clearError();
    try {
      await signup({ name: data.name, email: data.email, password: data.password });
    } catch {
      // error set in store
    }
  };

  const fieldVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.06, duration: 0.25 },
    }),
  };

  const strengthSegments = 4;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {/* ── API error banner ──────────────────────────────────────────── */}
      <AnimatedError message={error} />

      {/* ── Full name ─────────────────────────────────────────────────── */}
      <motion.div custom={0} variants={fieldVariants} initial="hidden" animate="visible">
        <label className="block mb-1.5 text-xs font-medium text-[#aaa]">
          {t('auth.name')}
        </label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#555]" />
          <input
            type="text"
            autoComplete="name"
            placeholder="Jane Smith"
            {...register('name')}
            className={`w-full rounded-xl bg-[#0f0f0f] border py-3 pl-10 pr-4 text-sm text-white placeholder-[#444] outline-none transition-all focus:ring-1 ${
              errors.name
                ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500/20'
                : 'border-[#2a2a2a] focus:border-gold-400/50 focus:ring-gold-400/15'
            }`}
          />
        </div>
        {errors.name && <FieldError message={errors.name.message} />}
      </motion.div>

      {/* ── Email ─────────────────────────────────────────────────────── */}
      <motion.div custom={1} variants={fieldVariants} initial="hidden" animate="visible">
        <label className="block mb-1.5 text-xs font-medium text-[#aaa]">
          {t('auth.email')}
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#555]" />
          <input
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            {...register('email')}
            className={`w-full rounded-xl bg-[#0f0f0f] border py-3 pl-10 pr-4 text-sm text-white placeholder-[#444] outline-none transition-all focus:ring-1 ${
              errors.email
                ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500/20'
                : 'border-[#2a2a2a] focus:border-gold-400/50 focus:ring-gold-400/15'
            }`}
          />
        </div>
        {errors.email && <FieldError message={errors.email.message} />}
      </motion.div>

      {/* ── Password ──────────────────────────────────────────────────── */}
      <motion.div custom={2} variants={fieldVariants} initial="hidden" animate="visible">
        <label className="block mb-1.5 text-xs font-medium text-[#aaa]">
          {t('auth.password')}
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#555]" />
          <input
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Min. 8 chars with A-Z, a-z, 0-9"
            {...register('password')}
            className={`w-full rounded-xl bg-[#0f0f0f] border py-3 pl-10 pr-11 text-sm text-white placeholder-[#444] outline-none transition-all focus:ring-1 ${
              errors.password
                ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500/20'
                : 'border-[#2a2a2a] focus:border-gold-400/50 focus:ring-gold-400/15'
            }`}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] hover:text-[#999] transition-colors"
          >
            {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
        {errors.password && <FieldError message={errors.password.message} />}

        {/* ── Strength meter ─────────────────────────────────────── */}
        {passwordValue && strength && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-2 space-y-1.5"
          >
            <div className="flex gap-1">
              {Array.from({ length: strengthSegments }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-1 flex-1 rounded-full transition-all duration-300"
                  style={{
                    backgroundColor:
                      idx < strength.score ? strength.color : '#2a2a2a',
                  }}
                />
              ))}
            </div>
            <div className="flex justify-between items-center">
              <p className="text-xs font-medium" style={{ color: strength.color }}>
                {strength.label}
              </p>
              <PasswordRules password={passwordValue} />
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* ── Confirm password ──────────────────────────────────────────── */}
      <motion.div custom={3} variants={fieldVariants} initial="hidden" animate="visible">
        <label className="block mb-1.5 text-xs font-medium text-[#aaa]">
          Confirm password
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#555]" />
          <input
            type={showConfirm ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Repeat your password"
            {...register('confirmPassword')}
            className={`w-full rounded-xl bg-[#0f0f0f] border py-3 pl-10 pr-11 text-sm text-white placeholder-[#444] outline-none transition-all focus:ring-1 ${
              errors.confirmPassword
                ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500/20'
                : 'border-[#2a2a2a] focus:border-gold-400/50 focus:ring-gold-400/15'
            }`}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowConfirm((v) => !v)}
            aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] hover:text-[#999] transition-colors"
          >
            {showConfirm ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
        {errors.confirmPassword && (
          <FieldError message={errors.confirmPassword.message} />
        )}
      </motion.div>

      {/* ── Submit ────────────────────────────────────────────────────── */}
      <motion.div custom={4} variants={fieldVariants} initial="hidden" animate="visible">
        <button
          type="submit"
          disabled={isSubmitting || isLoading}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-gold-400 py-3 text-sm font-semibold text-black transition-all hover:bg-gold-500 hover:shadow-glow-gold active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none"
        >
          {(isSubmitting || isLoading) ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {t('auth.creatingAccount')}
            </>
          ) : (
            t('auth.signUp')
          )}
        </button>
      </motion.div>

      {/* ── Switch to sign-in ─────────────────────────────────────────── */}
      <motion.p
        custom={5}
        variants={fieldVariants}
        initial="hidden"
        animate="visible"
        className="text-center text-xs text-[#666]"
      >
        {t('auth.hasAccount')}{' '}
        <button
          type="button"
          onClick={onSwitchMode}
          className="text-gold-400/80 hover:text-gold-400 font-medium transition-colors"
        >
          {t('auth.signIn')}
        </button>
      </motion.p>
    </form>
  );
}

// ─── Password rules checklist ─────────────────────────────────────────────────

function PasswordRules({ password }: { password: string }) {
  const rules = [
    { label: '8+ chars',   met: password.length >= 8 },
    { label: 'Uppercase',  met: /[A-Z]/.test(password) },
    { label: 'Lowercase',  met: /[a-z]/.test(password) },
    { label: 'Number',     met: /[0-9]/.test(password) },
  ];
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5">
      {rules.map((r) => (
        <span
          key={r.label}
          className={`flex items-center gap-1 text-[10px] transition-colors ${
            r.met ? 'text-emerald-400' : 'text-[#555]'
          }`}
        >
          <CheckCircle2 className="h-2.5 w-2.5" />
          {r.label}
        </span>
      ))}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 flex items-center gap-1 text-xs text-red-400">
      <AlertCircle className="h-3 w-3 shrink-0" />
      {message}
    </p>
  );
}

function AnimatedError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -6, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"
    >
      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
      <span>{message}</span>
    </motion.div>
  );
}
