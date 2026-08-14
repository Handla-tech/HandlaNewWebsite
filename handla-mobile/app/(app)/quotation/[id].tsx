import React from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { quotationsApi } from '@/lib/endpoints';
import { useAuthStore } from '@/store/authStore';
import { Loading, Badge, DetailHeader, Row, Button } from '@/components/ui';
import { QUOTATION_STATUS_META, money, fmtDate } from '@/lib/salesMeta';
import { colors, spacing, radius, font } from '@/theme';
import type { Quotation, LineItem } from '@/types';

export default function QuotationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const quotationId = String(id);
  const router = useRouter();
  const qc = useQueryClient();
  const isStaff = useAuthStore((s) => s.isStaff());

  const detail = useQuery({
    queryKey: ['quotation', quotationId],
    queryFn: (): Promise<Quotation> => quotationsApi.get(quotationId).then((r) => r.data.data),
    enabled: !!quotationId,
  });
  const q: Quotation | undefined = detail.data;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['quotation', quotationId] });
    qc.invalidateQueries({ queryKey: ['quotations'] });
  };

  const accept = useMutation({
    mutationFn: () => quotationsApi.accept(quotationId).then((r) => r.data.data),
    onSuccess: invalidate,
  });
  const reject = useMutation({
    mutationFn: () => quotationsApi.reject(quotationId).then((r) => r.data.data),
    onSuccess: invalidate,
  });

  const confirmReject = () =>
    Alert.alert('Reject quotation?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: () => reject.mutate() },
    ]);

  const canRespond = q?.status === 'SENT';
  const cur = q?.currency;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <DetailHeader
        title={q?.title ?? 'Loading…'}
        subtitle={q?.quoteNumber}
        onBack={() => router.back()}
      />

      {detail.isLoading || !q ? (
        <Loading />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
          <View style={{ flexDirection: 'row', marginBottom: spacing.md }}>
            <Badge
              label={QUOTATION_STATUS_META[q.status].label}
              color={QUOTATION_STATUS_META[q.status].color}
              soft={QUOTATION_STATUS_META[q.status].soft}
            />
          </View>

          {/* Line items */}
          <Text style={sectionLabel}>Line Items</Text>
          <View style={cardStyle}>
            {(q.lineItems ?? []).map((li: LineItem) => (
              <View
                key={li.id}
                style={{
                  paddingVertical: spacing.sm,
                  borderBottomColor: colors.border,
                  borderBottomWidth: 1,
                }}
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
            {(q.lineItems ?? []).length === 0 && (
              <Text style={{ color: colors.textFaint, fontSize: font.sm }}>No line items.</Text>
            )}
          </View>

          {/* Totals */}
          <View style={[cardStyle, { marginTop: spacing.md }]}>
            <Row label="Subtotal" value={money(q.subtotal, cur)} />
            <Row label={`Tax (${q.taxRate}%)`} value={money(q.taxAmount, cur)} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: spacing.sm }}>
              <Text style={{ color: colors.text, fontSize: font.md, fontWeight: '800' }}>Total</Text>
              <Text style={{ color: colors.accent, fontSize: font.lg, fontWeight: '800' }}>
                {money(q.total, cur)}
              </Text>
            </View>
          </View>

          {/* Meta */}
          <View style={[cardStyle, { marginTop: spacing.md }]}>
            {isStaff && q.client ? (
              <Row label="Client" value={q.client.company || q.client.user?.name || '—'} />
            ) : null}
            <Row label="Valid until" value={fmtDate(q.validUntil)} />
            {q.sentAt ? <Row label="Sent" value={fmtDate(q.sentAt)} /> : null}
            {q.acceptedAt ? <Row label="Accepted" value={fmtDate(q.acceptedAt)} /> : null}
            {q.rejectedAt ? <Row label="Rejected" value={fmtDate(q.rejectedAt)} /> : null}
          </View>

          {q.notes ? (
            <View style={[cardStyle, { marginTop: spacing.md }]}>
              <Text style={sectionLabel}>Notes</Text>
              <Text style={{ color: colors.textMuted, fontSize: font.sm }}>{q.notes}</Text>
            </View>
          ) : null}

          {/* Actions — a client can accept/reject a SENT quotation. */}
          {canRespond && (
            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
              <View style={{ flex: 1 }}>
                <Button title="Accept" onPress={() => accept.mutate()} loading={accept.isPending} />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title="Reject"
                  variant="danger"
                  onPress={confirmReject}
                  loading={reject.isPending}
                />
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const sectionLabel = {
  color: colors.textDim,
  fontSize: font.xs,
  fontWeight: '600' as const,
  textTransform: 'uppercase' as const,
  letterSpacing: 0.5,
  marginBottom: spacing.xs,
};

const cardStyle = {
  backgroundColor: colors.card,
  borderColor: colors.border,
  borderWidth: 1,
  borderRadius: radius.md,
  padding: spacing.md,
};
