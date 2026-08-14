import React, { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Title, Subtitle, Input, Button } from '@/components/ui';
import { ScreenBackground, GlassCard } from '@/components/glass';
import { useAuthStore } from '@/store/authStore';
import { useT } from '@/i18n';
import { spacing, font, useTheme } from '@/theme';

export default function LoginScreen() {
  const { t } = useT();
  const { colors } = useTheme();
  const signIn = useAuthStore((s) => s.signIn);
  const storeError = useAuthStore((s) => s.error);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const onSubmit = async () => {
    setLocalError(null);
    if (!email.trim() || !password) {
      setLocalError(t('auth.failed'));
      return;
    }
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      // Redirect handled by the AuthGate in _layout.
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : t('auth.failed'));
    } finally {
      setSubmitting(false);
    }
  };

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
          <Title>Handla</Title>
          <Subtitle>{t('auth.subtitle')}</Subtitle>
        </View>

        <GlassCard raised>
          <Input
            label={t('auth.email')}
            value={email}
            onChangeText={setEmail}
            placeholder="you@company.com"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            editable={!submitting}
          />
          <Input
            label={t('auth.password')}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoComplete="password"
            editable={!submitting}
            onSubmitEditing={onSubmit}
            returnKeyType="go"
          />

          {(localError || storeError) && (
            <Text style={{ color: colors.danger, fontSize: font.sm, marginBottom: spacing.md }}>
              {localError || storeError}
            </Text>
          )}

          <Button title={submitting ? t('auth.signingIn') : t('auth.signIn')} onPress={onSubmit} loading={submitting} />
        </GlassCard>

        <Text
          style={{
            color: colors.textDim,
            fontSize: font.xs,
            textAlign: 'center',
            marginTop: spacing.xl,
          }}
        >
          Handla staff & client portal
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </ScreenBackground>
  );
}
