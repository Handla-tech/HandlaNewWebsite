import React from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, font, useTheme } from '@/theme';
import { Label } from '@/components/ui';
import { useT } from '@/i18n';
import type { LineItemInput } from '@/lib/endpoints';

/**
 * Editable list of {description, quantity, unitPrice} line items shared by
 * quotations, invoices and purchases. Computes and shows a running subtotal.
 */
export function LineItemsEditor({
  items,
  onChange,
}: {
  items: LineItemInput[];
  onChange: (items: LineItemInput[]) => void;
}) {
  const { colors } = useTheme();
  const { t } = useT();

  const update = (i: number, patch: Partial<LineItemInput>) => {
    const next = items.map((it, idx) => (idx === i ? { ...it, ...patch } : it));
    onChange(next);
  };
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => onChange([...items, { description: '', quantity: 1, unitPrice: 0 }]);

  const subtotal = items.reduce((s, it) => s + (it.quantity || 0) * (it.unitPrice || 0), 0);

  const cell = {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
    color: colors.text,
    paddingHorizontal: spacing.sm,
    minHeight: 40,
    fontSize: font.sm,
  } as const;

  return (
    <View style={{ marginBottom: spacing.md }}>
      <Label style={{ marginBottom: spacing.xs }}>{t('lineItems.title')}</Label>
      {items.map((it, i) => (
        <View
          key={i}
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.md,
            padding: spacing.sm,
            marginBottom: spacing.sm,
            backgroundColor: colors.cardAlt,
            gap: spacing.sm,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <TextInput
              value={it.description}
              onChangeText={(v) => update(i, { description: v })}
              placeholder={t('lineItems.description')}
              placeholderTextColor={colors.textDim}
              style={[cell, { flex: 1 }]}
            />
            <Pressable onPress={() => remove(i)} hitSlop={8} style={{ padding: 4 }}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textFaint, fontSize: 10, marginBottom: 2 }}>{t('lineItems.qty')}</Text>
              <TextInput
                value={String(it.quantity ?? '')}
                onChangeText={(v) => update(i, { quantity: Number(v.replace(/[^0-9.]/g, '')) || 0 })}
                keyboardType="decimal-pad"
                placeholder="1"
                placeholderTextColor={colors.textDim}
                style={cell}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textFaint, fontSize: 10, marginBottom: 2 }}>{t('lineItems.unitPrice')}</Text>
              <TextInput
                value={String(it.unitPrice ?? '')}
                onChangeText={(v) => update(i, { unitPrice: Number(v.replace(/[^0-9.]/g, '')) || 0 })}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.textDim}
                style={cell}
              />
            </View>
            <View style={{ flex: 1, justifyContent: 'flex-end' }}>
              <Text style={{ color: colors.textFaint, fontSize: 10, marginBottom: 2 }}>{t('lineItems.total')}</Text>
              <Text
                style={{
                  color: colors.text,
                  fontSize: font.sm,
                  fontWeight: '700',
                  minHeight: 40,
                  paddingTop: 10,
                }}
              >
                {((it.quantity || 0) * (it.unitPrice || 0)).toFixed(2)}
              </Text>
            </View>
          </View>
        </View>
      ))}

      <Pressable
        onPress={add}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          borderWidth: 1,
          borderColor: colors.accentBorder,
          borderStyle: 'dashed',
          borderRadius: radius.md,
          paddingVertical: spacing.md,
        }}
      >
        <Ionicons name="add" size={18} color={colors.accent} />
        <Text style={{ color: colors.accent, fontWeight: '700', fontSize: font.sm }}>{t('lineItems.add')}</Text>
      </Pressable>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm }}>
        <Text style={{ color: colors.textFaint, fontSize: font.sm }}>{t('lineItems.subtotal')}</Text>
        <Text style={{ color: colors.text, fontSize: font.md, fontWeight: '800' }}>
          {subtotal.toFixed(2)}
        </Text>
      </View>
    </View>
  );
}
