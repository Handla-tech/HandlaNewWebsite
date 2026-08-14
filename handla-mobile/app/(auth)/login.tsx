import React, { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform } from 'react-native';
import { Screen, Title, Subtitle, Input, Button, Card } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { colors, spacing, font } from '@/theme';

export default function LoginScreen() {
  const signIn = useAuthStore((s) => s.signIn);
  const storeError = useAuthStore((s) => s.error);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const onSubmit = async () => {
    setLocalError(null);
    if (!email.trim() || !password) {
      setLocalError('Enter your email and password.');
      return;
    }
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      // Redirect handled by the AuthGate in _layout.
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'center' }}
      >
        {/* Brand */}
        <View style={{ alignItems: 'center', marginBottom: spacing.xxl }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              backgroundColor: colors.accentSoft,
              borderWidth: 1,
              borderColor: colors.accentBorder,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: spacing.md,
            }}
          >
            <Text style={{ color: colors.accent, fontSize: font.xxl, fontWeight: '800' }}>H</Text>
          </View>
          <Title>Handla</Title>
          <Subtitle>Sign in to your workspace</Subtitle>
        </View>

        <Card>
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@company.com"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            editable={!submitting}
          />
          <Input
            label="Password"
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

          <Button title="Sign In" onPress={onSubmit} loading={submitting} />
        </Card>

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
    </Screen>
  );
}
