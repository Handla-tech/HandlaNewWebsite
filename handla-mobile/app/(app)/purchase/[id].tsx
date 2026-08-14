import React from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { purchasesApi } from '@/lib/endpoints';
import { Loading, Badge, DetailHeader, Row, Button } from '@/components/ui';
import { money, fmtDate } from '@/lib/salesMeta';
import { PURCHASE_STATUS_META, PURCHASE_PAYMENT_META } from '@/lib/financeMeta';
import { spacing, radius, font, useTheme, colors as staticColors } from '@/theme';
import type { Purchase, LineItem } from '@/types';

export default function PurchaseDetailScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const purchaseId = String(id);
  const router = useRouter();
  const qc = useQueryClient();

  const detail = useQuery({
    queryKey: ['purchase', purchaseId],
    queryFn: (): Promise<Purchase> => purchasesApi.get(purchaseId).then((r) => r.data.data),
    enabled: !!purchaseId,
  });
  const p: Purchase | undefined = detail.data;

  const markPaid = useMutation({
    mutationFn: () => purchasesApi.markPaid(purchaseId).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase', purchaseId] });
      qc.invalidateQueries({ queryKey: ['purchases'] });
      qc.invalidateQueries({ queryKey: ['financeSummary'] });
    },
  });

  const confirmPaid = () =>
    Alert.alert('Mark as paid?', 'Record this purchase as fully paid.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Mark Paid', onPress: () => markPaid.mutate() },
    ]);

  const cur = p?.currency;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <DetailHeader
        title={p ? money(p.total, p.currency) : 'Loading…'}
        subtitle={p?.purchaseNumber}
        onBack={() => router.back()}
      />

      {detail.isLoading || !p ? (
        <Loading />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
            <Badge
              label={PURCHASE_STATUS_META[p.status].label}
              color={PURCHASE_STATUS_META[p.status].color}
              soft={PURCHASE_STATUS_META[p.status].soft}
            />
            <Badge
              label={PURCHASE_PAYMENT_META[p.paymentStatus].label}
              color={PURCHASE_PAYMENT_META[p.paymentStatus].color}
              soft={PURCHASE_PAYMENT_META[p.paymentStatus].soft}
            />
          </View>

          <Text style={sectionLabel}>Line Items</Text>
          <View style={cardStyle}>
            {(p.lineItems ?? []).map((li: LineItem) => (
              <View
                key={li.id}
                style={{ paddingVertical: spacing.sm, borderBottomColor: colors.border, borderBottomWidth: 1 }}
              >
                <Text style={{ color: colors.text, fontSize: font.sm }}>{li.description}</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
                  <Text style={{ color: colors.textFaint, fontSize: font.xs }}>
                    {li.quantity} × {money(li.unitPrice, cur)}
                  </Text>
                  <Text style={{ color: colors.text, fontSize: font.sm, fontWeight: '700' }}>
                    {money(li.lineTotal, cur)}
                  </Text>
                </View>
              </View>
            ))}
            {(p.lineItems ?? []).length === 0 && (
              <Text style={{ color: colors.textFaint, fontSize: font.sm }}>No line items.</Text>
            )}
          </View>

          <View style={[cardStyle, { marginTop: spacing.md }]}>
            <Row label="Subtotal" value={money(p.subtotal, cur)} />
            <Row label={`Tax (${p.taxRate}%)`} value={money(p.taxAmount, cur)} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: spacing.sm }}>
              <Text style={{ color: colors.text, fontSize: font.md, fontWeight: '800' }}>Total</Text>
              <Text style={{ color: colors.accent, fontSize: font.lg, fontWeight: '800' }}>
                {money(p.total, cur)}
              </Text>
            </View>
          </View>

          <View style={[cardStyle, { marginTop: spacing.md }]}>
            <Row label="Supplier" value={p.supplier?.company || p.supplier?.name || '—'} />
            {p.accountCode ? <Row label="Account" value={p.accountCode} /> : null}
            <Row label="Order date" value={fmtDate(p.orderDate)} />
            <Row label="Due date" value={fmtDate(p.dueDate)} />
            {p.paidAt ? <Row label="Paid" value={fmtDate(p.paidAt)} /> : null}
          </View>

          {p.notes ? (
            <View style={[cardStyle, { marginTop: spacing.md }]}>
              <Text style={sectionLabel}>Notes</Text>
              <Text style={{ color: colors.textMuted, fontSize: font.sm }}>{p.notes}</Text>
            </View>
          ) : null}

          {p.paymentStatus !== 'PAID' && p.status !== 'CANCELLED' && (
            <View style={{ marginTop: spacing.lg }}>
              <Button title="Mark as Paid" onPress={confirmPaid} loading={markPaid.isPending} />
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const sectionLabel = {
  color: staticColors.textDim,
  fontSize: font.xs,
  fontWeight: '600' as const,
  textTransform: 'uppercase' as const,
  letterSpacing: 0.5,
  marginBottom: spacing.xs,
};

const cardStyle = {
  backgroundColor: staticColors.card,
  borderColor: staticColors.border,
  borderWidth: 1,
  borderRadius: radius.md,
  padding: spacing.md,
};
