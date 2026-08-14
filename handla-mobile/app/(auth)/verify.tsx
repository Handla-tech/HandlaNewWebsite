import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Title, Subtitle, Input, Button } from '@/components/ui';
import { ScreenBackground, GlassCard } from '@/components/glass';
import { useAuthStore } from '@/store/authStore';
import { useT } from '@/i18n';
import { spacing, font, useTheme } from '@/theme';
import type { VerificationPurpose } from '@/types';

const RESEND_COOLDOWN_SECONDS = 45;

/**
 * OTP verification screen. Reached after a sign-in (or sign-up) whose account
 * still needs email verification: the backend emailed a 6-digit code, and the
 * user submits it here to complete authentication. On success the session is
 * established and the AuthGate (in the root layout) redirects into the app.
 */
export default function VerifyScreen() {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; purpose?: string }>();

  const email = (params.email ?? '').toString();
  const purpose = ((params.purpose as VerificationPurpose) || 'SIGNUP') as VerificationPurpose;

  const verifyOtp = useAuthStore((s) => s.verifyOtp);
  const resendOtp = useAuthStore((s) => s.resendOtp);

  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  // Countdown for the resend button.
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCooldown((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const canResend = cooldown <= 0 && !resending;

  const onSubmit = async () => {
    setError(null);
    setNotice(null);
    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      setError(t('auth.verify.invalidCode'));
      return;
    }
    setSubmitting(true);
    try {
      await verifyOtp(email, trimmed, purpose);
      // Success → AuthGate redirects to the app. Nothing else to do here.
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('auth.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const onResend = async () => {
    if (!canResend) return;
    setError(null);
    setNotice(null);
    setResending(true);
    try {
      await resendOtp(email, purpose, locale);
      setNotice(t('auth.verify.resent'));
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('auth.failed'));
    } finally {
      setResending(false);
    }
  };

  const resendLabel = useMemo(
    () =>
      canResend
        ? t('auth.verify.resend')
        : t('auth.verify.resendIn', { seconds: cooldown }),
    [canResend, cooldown, t],
  );

  return (
    <ScreenBackground>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, justifyContent: 'center', paddingHorizontal: spacing.lg }}
        >
          {/* Brand */}
          <View style={{ alignItems: 'center', marginBottom: spacing.xxl }}>
            <LinearGradient
              colors={colors.accentGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: 72,
                height: 72,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: spacing.md,
              }}
            >
              <Text style={{ color: '#0a0a0a', fontSize: font.xxl, fontWeight: '800' }}>H</Text>
            </LinearGradient>
            <Title>{t('auth.verify.title')}</Title>
            <Subtitle>{t('auth.verify.subtitle', { email })}</Subtitle>
          </View>

          <GlassCard raised>
            <Input
              label={t('auth.verify.code')}
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
              placeholder={t('auth.verify.codePlaceholder')}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
              editable={!submitting}
              onSubmitEditing={onSubmit}
              returnKeyType="go"
              style={{
                textAlign: 'center',
                letterSpacing: 8,
                fontSize: font.xl,
                fontWeight: '700',
              }}
            />

            {error && (
              <Text style={{ color: colors.danger, fontSize: font.sm, marginBottom: spacing.sm }}>
                {error}
              </Text>
            )}
            {notice && !error && (
              <Text style={{ color: colors.accent, fontSize: font.sm, marginBottom: spacing.sm }}>
                {notice}
              </Text>
            )}

            <Button
              title={submitting ? t('auth.verify.verifying') : t('auth.verify.submit')}
              onPress={onSubmit}
              loading={submitting}
            />

            {/* Resend */}
            <Pressable
              onPress={onResend}
              disabled={!canResend}
              style={{ marginTop: spacing.md, alignItems: 'center' }}
            >
              <Text
                style={{
                  color: canResend ? colors.accent : colors.textDim,
                  fontSize: font.sm,
                  fontWeight: '600',
                }}
              >
                {resendLabel}
              </Text>
            </Pressable>
          </GlassCard>

          <Text
            style={{
              color: colors.textDim,
              fontSize: font.xs,
              textAlign: 'center',
              marginTop: spacing.lg,
            }}
          >
            {t('auth.verify.checkSpam')}
          </Text>

          {/* Back to sign in */}
          <Pressable
            onPress={() => router.replace('/(auth)/login')}
            style={{ marginTop: spacing.lg, alignItems: 'center' }}
          >
            <Text style={{ color: colors.text, fontSize: font.sm }}>{t('auth.verify.back')}</Text>
          </Pressable>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ScreenBackground>
  );
}
