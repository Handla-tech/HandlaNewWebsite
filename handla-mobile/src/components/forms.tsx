import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  TextInputProps,
  Switch,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, font, useTheme } from '@/theme';
import { Label } from '@/components/ui';
import { useT } from '@/i18n';

/**
 * Reusable write-form primitives for the mobile ERP.
 *
 * FormModal   — slide-up sheet with a sticky header (title + close) and a
 *               sticky footer (Cancel / Save). Handles the busy state + an
 *               optional inline error banner.
 * Textarea    — multiline Input.
 * Select      — tap-to-open option picker (single choice) rendered as a modal.
 * SwitchRow   — labelled boolean toggle.
 * DateField   — ISO (YYYY-MM-DD) text field with light validation.
 * ConfirmModal — small confirm/destroy dialog.
 */

// ─── FormModal ────────────────────────────────────────────────────────────────
export function FormModal({
  visible,
  onClose,
  title,
  subtitle,
  onSubmit,
  submitLabel,
  submitting = false,
  error,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  onSubmit: () => void;
  submitLabel?: string;
  submitting?: boolean;
  error?: string | null;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const { t } = useT();
  const resolvedSubmitLabel = submitLabel ?? t('common.save');
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            borderColor: colors.border,
            borderWidth: 1,
            maxHeight: '90%',
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: spacing.lg,
              borderBottomColor: colors.border,
              borderBottomWidth: 1,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: font.lg, fontWeight: '800' }}>{title}</Text>
              {subtitle ? (
                <Text style={{ color: colors.textFaint, fontSize: font.xs, marginTop: 2 }}>{subtitle}</Text>
              ) : null}
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={{ padding: 4 }}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* Body */}
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: spacing.lg }}
            showsVerticalScrollIndicator={false}
          >
            {error ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  backgroundColor: colors.dangerSoft,
                  borderColor: colors.danger,
                  borderWidth: 1,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  marginBottom: spacing.md,
                }}
              >
                <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
                <Text style={{ color: colors.danger, fontSize: font.sm, flex: 1 }}>{error}</Text>
              </View>
            ) : null}
            {children}
          </ScrollView>

          {/* Footer */}
          <View
            style={{
              flexDirection: 'row',
              gap: spacing.md,
              padding: spacing.lg,
              borderTopColor: colors.border,
              borderTopWidth: 1,
            }}
          >
            <Pressable
              onPress={onClose}
              style={{
                flex: 1,
                minHeight: 48,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.cardAlt,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: font.md }}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={onSubmit}
              disabled={submitting}
              style={{
                flex: 1,
                minHeight: 48,
                borderRadius: radius.md,
                backgroundColor: colors.accent,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? (
                <ActivityIndicator color="#0a0a0a" />
              ) : (
                <Text style={{ color: '#0a0a0a', fontWeight: '800', fontSize: font.md }}>{resolvedSubmitLabel}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Textarea ─────────────────────────────────────────────────────────────────
export function Textarea({
  label,
  error,
  style,
  ...props
}: TextInputProps & { label?: string; error?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: spacing.md }}>
      {label ? <Label style={{ marginBottom: spacing.xs }}>{label}</Label> : null}
      <TextInput
        placeholderTextColor={colors.textDim}
        multiline
        textAlignVertical="top"
        style={[
          {
            minHeight: 96,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: error ? colors.danger : colors.border,
            backgroundColor: colors.inputBg,
            color: colors.text,
            padding: spacing.md,
            fontSize: font.md,
          },
          style,
        ]}
        {...props}
      />
      {error ? (
        <Text style={{ color: colors.danger, fontSize: font.xs, marginTop: spacing.xs }}>{error}</Text>
      ) : null}
    </View>
  );
}

// ─── Select ───────────────────────────────────────────────────────────────────
export interface SelectOption {
  label: string;
  value: string;
}

export function Select({
  label,
  value,
  options,
  onChange,
  placeholder,
  error,
}: {
  label?: string;
  value?: string | null;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
}) {
  const { colors } = useTheme();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const resolvedPlaceholder = placeholder ?? t('common.select');

  return (
    <View style={{ marginBottom: spacing.md }}>
      {label ? <Label style={{ marginBottom: spacing.xs }}>{label}</Label> : null}
      <Pressable
        onPress={() => setOpen(true)}
        style={{
          minHeight: 48,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: error ? colors.danger : colors.border,
          backgroundColor: colors.inputBg,
          paddingHorizontal: spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text style={{ color: selected ? colors.text : colors.textDim, fontSize: font.md }} numberOfLines={1}>
          {selected ? selected.label : resolvedPlaceholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>
      {error ? (
        <Text style={{ color: colors.danger, fontSize: font.xs, marginTop: spacing.xs }}>{error}</Text>
      ) : null}

      <Modal visible={open} animationType="fade" transparent onRequestClose={() => setOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing.lg }}
          onPress={() => setOpen(false)}
        >
          <Pressable
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              borderColor: colors.border,
              borderWidth: 1,
              maxHeight: '70%',
              overflow: 'hidden',
            }}
          >
            {label ? (
              <Text
                style={{
                  color: colors.text,
                  fontWeight: '800',
                  fontSize: font.md,
                  padding: spacing.lg,
                  borderBottomColor: colors.border,
                  borderBottomWidth: 1,
                }}
              >
                {label}
              </Text>
            ) : null}
            <ScrollView>
              {options.length === 0 ? (
                <Text style={{ color: colors.textFaint, padding: spacing.lg }}>No options.</Text>
              ) : (
                options.map((o) => {
                  const active = o.value === value;
                  return (
                    <Pressable
                      key={o.value}
                      onPress={() => {
                        onChange(o.value);
                        setOpen(false);
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingVertical: spacing.md,
                        paddingHorizontal: spacing.lg,
                        backgroundColor: active ? colors.accentSoft : 'transparent',
                      }}
                    >
                      <Text style={{ color: active ? colors.accent : colors.text, fontSize: font.md }}>
                        {o.label}
                      </Text>
                      {active ? <Ionicons name="checkmark" size={18} color={colors.accent} /> : null}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── SwitchRow ──────────────────────────────────────────────────────────────
export function SwitchRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.sm,
        marginBottom: spacing.sm,
      }}
    >
      <Text style={{ color: colors.text, fontSize: font.md, flex: 1 }}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: colors.accent, false: colors.border }}
        thumbColor="#fff"
      />
    </View>
  );
}

// ─── DateField (ISO YYYY-MM-DD) ───────────────────────────────────────────────
export function DateField({
  label,
  value,
  onChange,
  error,
  placeholder = 'YYYY-MM-DD',
}: {
  label?: string;
  value?: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: spacing.md }}>
      {label ? <Label style={{ marginBottom: spacing.xs }}>{label}</Label> : null}
      <View style={{ position: 'relative', justifyContent: 'center' }}>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textDim}
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
          style={{
            minHeight: 48,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: error ? colors.danger : colors.border,
            backgroundColor: colors.inputBg,
            color: colors.text,
            paddingHorizontal: spacing.md,
            paddingRight: 44,
            fontSize: font.md,
          }}
        />
        <Ionicons
          name="calendar-outline"
          size={18}
          color={colors.textMuted}
          style={{ position: 'absolute', right: spacing.md }}
        />
      </View>
      {error ? (
        <Text style={{ color: colors.danger, fontSize: font.xs, marginTop: spacing.xs }}>{error}</Text>
      ) : null}
    </View>
  );
}

// ─── ConfirmModal ─────────────────────────────────────────────────────────────
export function ConfirmModal({
  visible,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  destructive = false,
  submitting = false,
  error,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  submitting?: boolean;
  error?: string | null;
}) {
  const { colors } = useTheme();
  const { t } = useT();
  const accent = destructive ? colors.danger : colors.accent;
  const resolvedConfirmLabel = confirmLabel ?? t('common.confirm');
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing.lg }}
        onPress={onClose}
      >
        <Pressable
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            borderColor: colors.border,
            borderWidth: 1,
            padding: spacing.lg,
            gap: spacing.md,
          }}
        >
          <Text style={{ color: colors.text, fontSize: font.lg, fontWeight: '800' }}>{title}</Text>
          <Text style={{ color: colors.textDim, fontSize: font.sm, lineHeight: 20 }}>{message}</Text>
          {error ? <Text style={{ color: colors.danger, fontSize: font.sm }}>{error}</Text> : null}
          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm }}>
            <Pressable
              onPress={onClose}
              style={{
                flex: 1,
                minHeight: 46,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.cardAlt,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: colors.text, fontWeight: '700' }}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={submitting}
              style={{
                flex: 1,
                minHeight: 46,
                borderRadius: radius.md,
                backgroundColor: destructive ? colors.dangerSoft : accent,
                borderWidth: destructive ? 1 : 0,
                borderColor: colors.danger,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? (
                <ActivityIndicator color={destructive ? colors.danger : '#0a0a0a'} />
              ) : (
                <Text style={{ color: destructive ? colors.danger : '#0a0a0a', fontWeight: '800' }}>
                  {resolvedConfirmLabel}
                </Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── ActionSheet (row actions) ────────────────────────────────────────────────
export interface SheetAction {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  destructive?: boolean;
}

export function ActionSheet({
  visible,
  onClose,
  title,
  actions,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  actions: SheetAction[];
}) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}
        onPress={onClose}
      >
        <Pressable
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            borderColor: colors.border,
            borderWidth: 1,
            paddingBottom: spacing.xl,
          }}
        >
          {title ? (
            <Text
              style={{
                color: colors.textFaint,
                fontSize: font.xs,
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                padding: spacing.lg,
                paddingBottom: spacing.sm,
              }}
              numberOfLines={1}
            >
              {title}
            </Text>
          ) : null}
          {actions.map((a) => (
            <Pressable
              key={a.label}
              onPress={() => {
                onClose();
                a.onPress();
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.lg,
              }}
            >
              {a.icon ? (
                <Ionicons name={a.icon} size={20} color={a.destructive ? colors.danger : colors.textMuted} />
              ) : null}
              <Text
                style={{
                  color: a.destructive ? colors.danger : colors.text,
                  fontSize: font.md,
                  fontWeight: '600',
                }}
              >
                {a.label}
              </Text>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── FAB (floating create button) ─────────────────────────────────────────────
export function Fab({ onPress, icon = 'add' }: { onPress: () => void; icon?: keyof typeof Ionicons.glyphMap }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        position: 'absolute',
        right: spacing.lg,
        bottom: spacing.xl,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Ionicons name={icon} size={28} color="#0a0a0a" />
    </Pressable>
  );
}
