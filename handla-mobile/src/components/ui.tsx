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
import { LinearGradient } from 'expo-linear-gradient';
import { radius, spacing, font, useTheme, type Palette } from '@/theme';



// ─── Style factory ────────────────────────────────────────────────────────────
// Styles depend on the active palette, so they are rebuilt per render from the
// theme. StyleSheet.create is still used for RN's style-id optimisation.
function makeStyles(colors: Palette) {
  return StyleSheet.create({
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
      backgroundColor: colors.glass,
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
      backgroundColor: colors.inputBg,
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
}

// ─── Screen wrapper (safe area + themed bg) ─────────────────────────────────────
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
  const { colors } = useTheme();
  const styles = makeStyles(colors);
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
  const { colors } = useTheme();
  return <Text style={[makeStyles(colors).title, style]}>{children}</Text>;
}
export function Subtitle({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  const { colors } = useTheme();
  return <Text style={[makeStyles(colors).subtitle, style]}>{children}</Text>;
}
export function Label({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  const { colors } = useTheme();
  return <Text style={[makeStyles(colors).label, style]}>{children}</Text>;
}

// ─── Card ──────────────────────────────────────────────────────────────────
export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { colors } = useTheme();
  return <View style={[makeStyles(colors).card, style]}>{children}</View>;
}

// ─── Input ────────────────────────────────────────────────────────────────
export function Input({
  label,
  error,
  style,
  ...props
}: TextInputProps & { label?: string; error?: string }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
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
  const { colors } = useTheme();
  const styles = makeStyles(colors);
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
  const { colors } = useTheme();
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
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderBottomColor: colors.border,
        borderBottomWidth: 1,
      }}
    >
      <Pressable onPress={onBack} hitSlop={10}>
        <LinearGradient
          colors={colors.accentGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="chevron-back" size={22} color="#0a0a0a" />
        </LinearGradient>
      </Pressable>
      <View style={{ flex: 1 }}>
        {subtitle ? (
          <Text
            style={{
              color: colors.textFaint,
              fontSize: font.xs,
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: 0.6,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
        <Text style={{ color: colors.text, fontSize: font.lg, fontWeight: '800' }} numberOfLines={1}>
          {title}
        </Text>
      </View>
      {right}
    </View>
  );
}

// ─── Key/value row ──────────────────────────────────────────────────────────────
export function Row({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
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
  const { colors } = useTheme();
  return <View style={[makeStyles(colors).centered]}>{children}</View>;
}

export function Loading() {
  const { colors } = useTheme();
  return (
    <Centered>
      <ActivityIndicator color={colors.accent} size="large" />
    </Centered>
  );
}
