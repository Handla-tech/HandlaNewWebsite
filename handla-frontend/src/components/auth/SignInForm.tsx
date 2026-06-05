'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2, Mail, Lock, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useTranslation } from '@/hooks/useTranslation';

// ─── Zod schema ───────────────────────────────────────────────────────────────

const signInSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(8, 'Password must be at least 8 characters'),
  rememberMe: z.boolean().optional(),
});

type SignInFormData = z.infer<typeof signInSchema>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface SignInFormProps {
  onSwitchMode: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SignInForm({ onSwitchMode }: SignInFormProps) {
  const router = useRouter();
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
      await login({ email: data.email, password: data.password });
      // Redirect happens in parent (useEffect on isLoggedIn + user.role)
    } catch {
      // error is already set in store
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

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {/* ── API error banner ──────────────────────────────────────────── */}
      <AnimatedError message={error} />

      {/* ── Email ─────────────────────────────────────────────────────── */}
      <motion.div custom={0} variants={fieldVariants} initial="hidden" animate="visible">
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
        {errors.email && (
          <FieldError message={errors.email.message} />
        )}
      </motion.div>

      {/* ── Password ──────────────────────────────────────────────────── */}
      <motion.div custom={1} variants={fieldVariants} initial="hidden" animate="visible">
        <label className="block mb-1.5 text-xs font-medium text-[#aaa]">
          {t('auth.password')}
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#555]" />
          <input
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="••••••••"
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
        {errors.password && (
          <FieldError message={errors.password.message} />
        )}
      </motion.div>

      {/* ── Remember me ───────────────────────────────────────────────── */}
      <motion.div
        custom={2}
        variants={fieldVariants}
        initial="hidden"
        animate="visible"
        className="flex items-center justify-between"
      >
        <label className="flex items-center gap-2 cursor-pointer group">
          <input
            type="checkbox"
            {...register('rememberMe')}
            className="h-4 w-4 rounded border-[#3a3a3a] bg-[#0f0f0f] accent-gold-400 cursor-pointer"
          />
          <span className="text-xs text-[#888] group-hover:text-[#aaa] transition-colors select-none">
            Remember me
          </span>
        </label>
        <button
          type="button"
          className="text-xs text-gold-400/70 hover:text-gold-400 transition-colors"
        >
          {t('auth.forgotPassword')}
        </button>
      </motion.div>

      {/* ── Submit ────────────────────────────────────────────────────── */}
      <motion.div custom={3} variants={fieldVariants} initial="hidden" animate="visible">
        <button
          type="submit"
          disabled={isSubmitting || isLoading}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-gold-400 py-3 text-sm font-semibold text-black transition-all hover:bg-gold-500 hover:shadow-glow-gold active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none"
        >
          {(isSubmitting || isLoading) ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {t('auth.signingIn')}
            </>
          ) : (
            t('auth.signIn')
          )}
        </button>
      </motion.div>

      {/* ── Switch to sign-up ─────────────────────────────────────────── */}
      <motion.p
        custom={4}
        variants={fieldVariants}
        initial="hidden"
        animate="visible"
        className="text-center text-xs text-[#666]"
      >
        {t('auth.noAccount')}{' '}
        <button
          type="button"
          onClick={onSwitchMode}
          className="text-gold-400/80 hover:text-gold-400 font-medium transition-colors"
        >
          {t('auth.signUp')}
        </button>
      </motion.p>
    </form>
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
      exit={{ opacity: 0, y: -6, height: 0 }}
      className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"
    >
      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
      <span>{message}</span>
    </motion.div>
  );
}
