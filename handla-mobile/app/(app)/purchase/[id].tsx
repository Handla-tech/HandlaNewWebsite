import React from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenBackground } from '@/components/glass';
import { purchasesApi } from '@/lib/endpoints';
import { Loading, Badge, DetailHeader, Row, Button } from '@/components/ui';
import { money, fmtDate, statusMeta } from '@/lib/salesMeta';
import { PURCHASE_STATUS_META, PURCHASE_PAYMENT_META } from '@/lib/financeMeta';
import { spacing, radius, font, useTheme } from '@/theme';
import type { Purchase, LineItem } from '@/types';
import { useT } from '@/i18n';

export default function PurchaseDetailScreen() {
  const { t } = useT();
  const { colors } = useTheme();
  const sectionLabel = {
    color: colors.textDim,
    fontSize: font.xs,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  };
  const cardStyle = {
    backgroundColor: colors.glass,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
  };
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
    Alert.alert(t('purchase.confirmPaidTitle'), t('purchase.confirmPaidMsg'), [
      { text: t('detail.cancel'), style: 'cancel' },
      { text: t('purchase.markPaidAction'), onPress: () => markPaid.mutate() },
    ]);

  const cur = p?.currency;

  return (
    <ScreenBackground>
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <DetailHeader
        title={p ? money(p.total, p.currency) : t('detail.loading')}
        subtitle={p?.purchaseNumber}
        onBack={() => router.back()}
      />

      {detail.isLoading || !p ? (
        <Loading />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
            {(() => {
              const s = statusMeta(PURCHASE_STATUS_META, p.status, t);
              const pay = statusMeta(PURCHASE_PAYMENT_META, p.paymentStatus, t);
              return (
                <>
                  <Badge label={s.label} color={s.color} soft={s.soft} />
                  <Badge label={pay.label} color={pay.color} soft={pay.soft} />
                </>
              );
            })()}
          </View>

          <Text style={sectionLabel}>{t('detail.lineItems')}</Text>
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
              <Text style={{ color: colors.textFaint, fontSize: font.sm }}>{t('detail.noLineItems')}</Text>
            )}
          </View>

          <View style={[cardStyle, { marginTop: spacing.md }]}>
            <Row label={t('detail.subtotal')} value={money(p.subtotal, cur)} />
            <Row label={t('detail.tax', { rate: p.taxRate })} value={money(p.taxAmount, cur)} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: spacing.sm }}>
              <Text style={{ color: colors.text, fontSize: font.md, fontWeight: '800' }}>{t('detail.total')}</Text>
              <Text style={{ color: colors.accent, fontSize: font.lg, fontWeight: '800' }}>
                {money(p.total, cur)}
              </Text>
            </View>
          </View>

          <View style={[cardStyle, { marginTop: spacing.md }]}>
            <Row label={t('detail.supplier')} value={p.supplier?.company || p.supplier?.name || '—'} />
            {p.accountCode ? <Row label={t('detail.account')} value={p.accountCode} /> : null}
            <Row label={t('detail.orderDate')} value={fmtDate(p.orderDate)} />
            <Row label={t('detail.dueDate')} value={fmtDate(p.dueDate)} />
            {p.paidAt ? <Row label={t('detail.paid')} value={fmtDate(p.paidAt)} /> : null}
          </View>

          {p.notes ? (
            <View style={[cardStyle, { marginTop: spacing.md }]}>
              <Text style={sectionLabel}>{t('detail.notes')}</Text>
              <Text style={{ color: colors.textMuted, fontSize: font.sm }}>{p.notes}</Text>
            </View>
          ) : null}

          {p.paymentStatus !== 'PAID' && p.status !== 'CANCELLED' && (
            <View style={{ marginTop: spacing.lg }}>
              <Button title={t('purchase.markPaid')} onPress={confirmPaid} loading={markPaid.isPending} />
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
    </ScreenBackground>
  );
}

