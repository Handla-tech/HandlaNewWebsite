import React from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, font } from '@/theme';

// ─── Screen wrapper (safe area + dark bg) ──────────────────────────────────────
export function Screen({
  children,
  scroll = false,
  style,
  padded = true,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  padded?: boolean;
}) {
  const inner = (
    <View style={[padded && { padding: spacing.lg }, { flex: scroll ? undefined : 1 }, style]}>
      {children}
    </View>
  );
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: spacing.xxl }}
          showsVerticalScrollIndicator={false}
        >
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

// ─── Text helpers ───────────────────────────────────────────────────────────
export function Title({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}
export function Subtitle({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[styles.subtitle, style]}>{children}</Text>;
}
export function Label({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[styles.label, style]}>{children}</Text>;
}

// ─── Card ──────────────────────────────────────────────────────────────────
export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

// ─── Input ────────────────────────────────────────────────────────────────
export function Input({
  label,
  error,
  style,
  ...props
}: TextInputProps & { label?: string; error?: string }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      {label ? <Label style={{ marginBottom: spacing.xs }}>{label}</Label> : null}
      <TextInput
        placeholderTextColor={colors.textDim}
        style={[styles.input, !!error && { borderColor: colors.danger }, style]}
        {...props}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

// ─── Button ─────────────────────────────────────────────────────────────────
export function Button({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  style,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'ghost' | 'danger';
  style?: ViewStyle;
}) {
  const isDisabled = disabled || loading;
  const base =
    variant === 'primary'
      ? styles.btnPrimary
      : variant === 'danger'
      ? styles.btnDanger
      : styles.btnGhost;
  const textColor =
    variant === 'primary' ? '#0a0a0a' : variant === 'danger' ? colors.danger : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.btn,
        base,
        isDisabled && { opacity: 0.5 },
        pressed && !isDisabled && { opacity: 0.85 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.btnText, { color: textColor }]}>{title}</Text>
      )}
    </Pressable>
  );
}

// ─── Badge (colored status/priority pill) ──────────────────────────────────────
export function Badge({
  label,
  color,
  soft,
  style,
}: {
  label: string;
  color: string;
  soft: string;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        {
          alignSelf: 'flex-start',
          backgroundColor: soft,
          borderColor: color,
          borderWidth: 1,
          borderRadius: radius.pill,
          paddingHorizontal: spacing.sm,
          paddingVertical: 3,
        },
        style,
      ]}
    >
      <Text style={{ color, fontSize: font.xs, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

// ─── Chip (toggleable filter pill) ──────────────────────────────────────────────
export function Chip({
  label,
  active = false,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          borderRadius: radius.pill,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm - 2,
          borderWidth: 1,
          borderColor: active ? colors.accent : colors.border,
          backgroundColor: active ? colors.accentSoft : colors.cardAlt,
        },
        pressed && { opacity: 0.8 },
      ]}
    >
      <Text
        style={{
          color: active ? colors.accent : colors.textMuted,
          fontSize: font.sm,
          fontWeight: active ? '700' : '500',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ─── Detail screen header (back button + title/subtitle) ────────────────────────
export function DetailHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  right?: React.ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderBottomColor: colors.border,
        borderBottomWidth: 1,
      }}
    >
      <Pressable onPress={onBack} hitSlop={10} style={{ padding: 4 }}>
        <Ionicons name="chevron-back" size={24} color={colors.text} />
      </Pressable>
      <View style={{ flex: 1 }}>
        {subtitle ? (
          <Text style={{ color: colors.accent, fontSize: font.xs, fontWeight: '700' }}>
            {subtitle}
          </Text>
        ) : null}
        <Text style={{ color: colors.text, fontSize: font.md, fontWeight: '700' }} numberOfLines={1}>
          {title}
        </Text>
      </View>
      {right}
    </View>
  );
}

// ─── Key/value row ──────────────────────────────────────────────────────────────
export function Row({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: spacing.sm,
        borderBottomColor: colors.border,
        borderBottomWidth: 1,
      }}
    >
      <Text style={{ color: colors.textFaint, fontSize: font.sm }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: font.sm, fontWeight: '600', maxWidth: '60%', textAlign: 'right' }}>
        {value}
      </Text>
    </View>
  );
}

// ─── Empty / error states ─────────────────────────────────────────────────────
export function Centered({ children }: { children: React.ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

export function Loading() {
  return (
    <Centered>
      <ActivityIndicator color={colors.accent} size="large" />
    </Centered>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  title: { color: colors.text, fontSize: font.xl, fontWeight: '700' },
  subtitle: { color: colors.textFaint, fontSize: font.sm, marginTop: 2 },
  label: {
    color: colors.textDim,
    fontSize: font.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(0,0,0,0.4)',
    color: colors.text,
    paddingHorizontal: spacing.md,
    fontSize: font.md,
  },
  errorText: { color: colors.danger, fontSize: font.xs, marginTop: spacing.xs },
  btn: {
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  btnPrimary: { backgroundColor: colors.accent },
  btnGhost: { backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
  btnDanger: { backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: colors.danger },
  btnText: { fontSize: font.md, fontWeight: '700' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
});
