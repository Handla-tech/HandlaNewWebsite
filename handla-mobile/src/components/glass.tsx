import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
  ScrollView,
  ScrollViewProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing, font, useTheme } from '@/theme';

/**
 * Premium glassmorphism primitives.
 *
 * The look is built in layers:
 *   1. A frosted BlurView (native backdrop blur).
 *   2. A translucent tinted fill on top (palette.glass) so the frost reads as
 *      brand-tinted rather than a muddy grey.
 *   3. A hairline top-edge highlight (specular sheen) + soft border.
 *   4. Cross-platform elevation shadow.
 *
 * All primitives are theme-reactive (light + dark) via useTheme().
 */

// ═══════════════════════════════════════════════════════════════════════════
// ScreenBackground — ambient gradient + colored glow blobs behind content
// ═══════════════════════════════════════════════════════════════════════════
export function ScreenBackground({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <LinearGradient
        colors={colors.bgGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Ambient glow blobs — pure decoration, non-interactive. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -120,
          right: -100,
          width: 320,
          height: 320,
          borderRadius: 320,
          backgroundColor: colors.glowA,
          opacity: 0.9,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          bottom: -140,
          left: -110,
          width: 300,
          height: 300,
          borderRadius: 300,
          backgroundColor: colors.glowB,
          opacity: 0.9,
        }}
      />
      {children}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// GlassScreen — SafeAreaView + ambient background. Drop-in replacement for the
// old bare SafeAreaView used across module screens.
// ═══════════════════════════════════════════════════════════════════════════
export function GlassScreen({
  children,
  edges = ['left', 'right'],
}: {
  children: React.ReactNode;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}) {
  return (
    <ScreenBackground>
      <SafeAreaView style={{ flex: 1 }} edges={edges}>
        {children}
      </SafeAreaView>
    </ScreenBackground>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// GlassCard — the core frosted surface
// ═══════════════════════════════════════════════════════════════════════════
export function GlassCard({
  children,
  style,
  padded = true,
  intensity,
  raised = false,
  onPress,
  highlight = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  intensity?: number;
  /** Raised cards use a stronger fill + heavier shadow (heroes, modals). */
  raised?: boolean;
  onPress?: () => void;
  /** Toggle the top-edge specular highlight. */
  highlight?: boolean;
}) {
  const { colors, isDark, elevation } = useTheme();
  const blurIntensity = intensity ?? (isDark ? 26 : 40);

  const body = (
    <View
      style={[
        {
          borderRadius: radius.lg,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: raised ? colors.glassStrong : colors.glass,
        },
        elevation(raised ? 2 : 1, colors.shadow),
        style,
      ]}
    >
      <BlurView
        intensity={blurIntensity}
        tint={colors.blurTint}
        style={StyleSheet.absoluteFill}
      />
      {/* Subtle vertical sheen so the top edge catches light. */}
      {highlight ? (
        <LinearGradient
          colors={[colors.glassHighlight, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 0.6 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      <View style={padded ? { padding: spacing.lg } : undefined}>{children}</View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => (pressed ? { opacity: 0.9, transform: [{ scale: 0.995 }] } : null)}>
        {body}
      </Pressable>
    );
  }
  return body;
}

// ═══════════════════════════════════════════════════════════════════════════
// GradientHeader — large premium screen title with optional icon + right slot
// ═══════════════════════════════════════════════════════════════════════════
export function GradientHeader({
  title,
  subtitle,
  icon,
  right,
  style,
}: {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.sm,
        },
        style,
      ]}
    >
      {icon ? (
        <LinearGradient
          colors={colors.accentGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.md,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={icon} size={22} color="#0a0a0a" />
        </LinearGradient>
      ) : null}
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
        <Text style={{ color: colors.text, fontSize: font.xxl, fontWeight: '800', letterSpacing: -0.5 }}>
          {title}
        </Text>
      </View>
      {right}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// GradientButton — premium primary CTA
// ═══════════════════════════════════════════════════════════════════════════
export function GradientButton({
  title,
  onPress,
  icon,
  disabled = false,
  style,
}: {
  title: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, elevation } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        { borderRadius: radius.md, overflow: 'hidden' },
        elevation(1, colors.accent),
        disabled && { opacity: 0.5 },
        pressed && !disabled && { opacity: 0.9 },
        style,
      ]}
    >
      <LinearGradient
        colors={colors.accentGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          minHeight: 50,
          flexDirection: 'row',
          gap: spacing.sm,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: spacing.lg,
        }}
      >
        {icon ? <Ionicons name={icon} size={18} color="#0a0a0a" /> : null}
        <Text style={{ color: '#0a0a0a', fontSize: font.md, fontWeight: '800' }}>{title}</Text>
      </LinearGradient>
    </Pressable>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// StatCard — KPI tile with icon chip, big value, optional trend / caption
// ═══════════════════════════════════════════════════════════════════════════
export function StatCard({
  label,
  value,
  icon,
  tint,
  caption,
  trend,
  width,
  onPress,
}: {
  label: string;
  value: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Accent color for the icon chip + value glow. Defaults to brand accent. */
  tint?: string;
  caption?: string;
  trend?: { value: string; up: boolean };
  width?: ViewStyle['width'];
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const accent = tint ?? colors.accent;
  return (
    <GlassCard
      onPress={onPress}
      padded={false}
      style={{ width: width ?? '48%' }}
    >
      <View style={{ padding: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {icon ? (
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: radius.sm,
                backgroundColor: withAlpha(accent, 0.16),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name={icon} size={18} color={accent} />
            </View>
          ) : (
            <View />
          )}
          {trend ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Ionicons
                name={trend.up ? 'trending-up' : 'trending-down'}
                size={14}
                color={trend.up ? colors.success : colors.danger}
              />
              <Text style={{ color: trend.up ? colors.success : colors.danger, fontSize: font.xs, fontWeight: '700' }}>
                {trend.value}
              </Text>
            </View>
          ) : null}
        </View>
        <Text
          style={{ color: colors.text, fontSize: font.xl, fontWeight: '800', marginTop: spacing.sm, letterSpacing: -0.5 }}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {value}
        </Text>
        <Text style={{ color: colors.textFaint, fontSize: font.xs, marginTop: 2 }} numberOfLines={1}>
          {label}
        </Text>
        {caption ? (
          <Text style={{ color: colors.textDim, fontSize: 10, marginTop: 2 }} numberOfLines={1}>
            {caption}
          </Text>
        ) : null}
      </View>
    </GlassCard>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SectionLabel — small uppercase caption above a card / chart
// ═══════════════════════════════════════════════════════════════════════════
export function SectionLabel({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  const { colors } = useTheme();
  return (
    <Text
      style={[
        {
          color: colors.textFaint,
          fontSize: font.xs,
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          marginBottom: spacing.sm,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// GlassListItem — frosted row for list screens (avatar/icon + body + right)
// ═══════════════════════════════════════════════════════════════════════════
export function GlassListItem({
  leading,
  title,
  subtitle,
  meta,
  right,
  onPress,
  style,
}: {
  leading?: React.ReactNode;
  title: string;
  subtitle?: string | null;
  meta?: string | null;
  right?: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <GlassCard onPress={onPress} padded={false} style={[{ marginBottom: spacing.sm }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md }}>
        {leading}
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: font.md, fontWeight: '700' }} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={{ color: colors.textFaint, fontSize: font.sm, marginTop: 1 }} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
          {meta ? (
            <Text style={{ color: colors.textDim, fontSize: font.xs, marginTop: 1 }} numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
        </View>
        {right}
      </View>
    </GlassCard>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Avatar — gradient monogram circle
// ═══════════════════════════════════════════════════════════════════════════
export function Avatar({ name, size = 42, tint }: { name?: string | null; size?: number; tint?: string }) {
  const { colors } = useTheme();
  const letter = (name ?? '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <LinearGradient
      colors={tint ? [withAlpha(tint, 0.9), withAlpha(tint, 0.55)] : colors.accentGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ color: '#0a0a0a', fontWeight: '800', fontSize: size * 0.4 }}>{letter}</Text>
    </LinearGradient>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// GlassScrollView — convenience scroll container with standard padding
// ═══════════════════════════════════════════════════════════════════════════
export function GlassScrollView({ children, contentContainerStyle, ...rest }: ScrollViewProps & { children: React.ReactNode }) {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }, contentContainerStyle]}
      {...rest}
    >
      {children}
    </ScrollView>
  );
}

// ─── helpers ──────────────────────────────────────────────────────────────
/**
 * Apply an alpha to a hex or rgb(a) color string. Handles #rgb, #rrggbb, and
 * rgb()/rgba() inputs so callers can pass palette tokens directly.
 */
export function withAlpha(color: string, alpha: number): string {
  if (color.startsWith('#')) {
    let hex = color.slice(1);
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  const m = color.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const [r, g, b] = m[1].split(',').map((s) => s.trim());
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color;
}
