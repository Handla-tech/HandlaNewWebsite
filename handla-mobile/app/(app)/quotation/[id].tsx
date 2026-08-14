import React, { useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenBackground } from '@/components/glass';
import { quotationsApi, type QuotationInput, type LineItemInput } from '@/lib/endpoints';
import { apiError } from '@/lib/apiError';
import { useAuthStore } from '@/store/authStore';
import { Loading, Badge, DetailHeader, Row, Button, Input } from '@/components/ui';
import { FormModal, Textarea, DateField } from '@/components/forms';
import { LineItemsEditor } from '@/components/LineItemsEditor';
import { QUOTATION_STATUS_META, statusMeta, money, fmtDate } from '@/lib/salesMeta';
import { spacing, radius, font, useTheme } from '@/theme';
import type { Quotation, LineItem } from '@/types';
import { useT } from '@/i18n';

export default function QuotationDetailScreen() {
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
  const send = useMutation({
    mutationFn: () => quotationsApi.send(quotationId).then((r) => r.data.data),
    onSuccess: invalidate,
    onError: (e: any) =>
      Alert.alert(t('quotation.sendError'), e?.response?.data?.message ?? t('common.tryAgain')),
  });
  const convert = useMutation({
    mutationFn: () => quotationsApi.convert(quotationId).then((r) => r.data.data),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ['invoices'] });
      Alert.alert(t('quotation.convertedTitle'), t('quotation.convertedMsg'));
    },
    onError: (e: any) =>
      Alert.alert(t('quotation.convertError'), e?.response?.data?.message ?? t('common.tryAgain')),
  });
  const del = useMutation({
    mutationFn: () => quotationsApi.remove(quotationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotations'] });
      router.back();
    },
    onError: (e: any) =>
      Alert.alert(t('quotation.deleteError'), e?.response?.data?.message ?? t('common.tryAgain')),
  });

  // ─── Edit (DRAFT only) ──────────────────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);
  const [eTitle, setETitle] = useState('');
  const [eItems, setEItems] = useState<LineItemInput[]>([]);
  const [eTax, setETax] = useState('0');
  const [eCurrency, setECurrency] = useState('SEK');
  const [eValidUntil, setEValidUntil] = useState('');
  const [eNotes, setENotes] = useState('');

  const openEdit = () => {
    if (!q) return;
    setETitle(q.title);
    setEItems(
      (q.lineItems ?? []).map((li) => ({
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
      })),
    );
    setETax(String(q.taxRate ?? 0));
    setECurrency(q.currency ?? 'SEK');
    setEValidUntil(q.validUntil ? q.validUntil.slice(0, 10) : '');
    setENotes(q.notes ?? '');
    setEditErr(null);
    setEditOpen(true);
  };

  const cleanItems = () =>
    eItems
      .map((li) => ({
        description: li.description.trim(),
        quantity: Number(li.quantity) || 0,
        unitPrice: Number(li.unitPrice) || 0,
      }))
      .filter((li) => li.description && li.quantity > 0);

  const edit = useMutation({
    mutationFn: () => {
      const payload: QuotationInput = {
        title: eTitle.trim(),
        lineItems: cleanItems(),
        taxRate: Number(eTax) || 0,
        currency: eCurrency.trim() || undefined,
        validUntil: eValidUntil.trim() || undefined,
        notes: eNotes.trim() || undefined,
      };
      return quotationsApi.update(quotationId, payload);
    },
    onSuccess: () => {
      invalidate();
      setEditOpen(false);
    },
    onError: (e) => setEditErr(apiError(e, t('detail.editSaveError'))),
  });

  const submitEdit = () => {
    if (eTitle.trim().length < 2) return setEditErr(t('detail.titleError'));
    if (cleanItems().length === 0)
      return setEditErr(t('detail.lineItemError'));
    setEditErr(null);
    edit.mutate();
  };

  const confirmReject = () =>
    Alert.alert(t('quotation.confirmRejectTitle'), t('quotation.confirmRejectMsg'), [
      { text: t('detail.cancel'), style: 'cancel' },
      { text: t('detail.reject'), style: 'destructive', onPress: () => reject.mutate() },
    ]);
  const confirmSend = () =>
    Alert.alert(t('quotation.confirmSendTitle'), t('quotation.confirmSendMsg'), [
      { text: t('detail.cancel'), style: 'cancel' },
      { text: t('detail.send'), onPress: () => send.mutate() },
    ]);
  const confirmConvert = () =>
    Alert.alert(t('quotation.confirmConvertTitle'), t('quotation.confirmConvertMsg'), [
      { text: t('detail.cancel'), style: 'cancel' },
      { text: t('detail.convert'), onPress: () => convert.mutate() },
    ]);
  const confirmDelete = () =>
    Alert.alert(t('quotation.confirmDeleteTitle'), t('quotation.confirmDeleteMsg'), [
      { text: t('detail.cancel'), style: 'cancel' },
      { text: t('detail.delete'), style: 'destructive', onPress: () => del.mutate() },
    ]);

  const canRespond = q?.status === 'SENT';
  const isAdmin = useAuthStore.getState().isAdmin();
  const canSend = isStaff && q?.status === 'DRAFT';
  const canEdit = isStaff && q?.status === 'DRAFT';
  const canConvert = isStaff && q?.status === 'ACCEPTED' && !q?.convertedInvoiceId;
  const canDelete = isAdmin && q?.status !== 'CONVERTED';
  const cur = q?.currency;

  return (
    <ScreenBackground>
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <DetailHeader
        title={q?.title ?? t('detail.loading')}
        subtitle={q?.quoteNumber}
        onBack={() => router.back()}
      />

      {detail.isLoading || !q ? (
        <Loading />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
          <View style={{ flexDirection: 'row', marginBottom: spacing.md }}>
            {(() => {
              const m = statusMeta(QUOTATION_STATUS_META, q.status, t);
              return <Badge label={m.label} color={m.color} soft={m.soft} />;
            })()}
          </View>

          {/* Line items */}
          <Text style={sectionLabel}>{t('detail.lineItems')}</Text>
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
              <Text style={{ color: colors.textFaint, fontSize: font.sm }}>{t('detail.noLineItems')}</Text>
            )}
          </View>

          {/* Totals */}
          <View style={[cardStyle, { marginTop: spacing.md }]}>
            <Row label={t('detail.subtotal')} value={money(q.subtotal, cur)} />
            <Row label={t('detail.tax', { rate: q.taxRate })} value={money(q.taxAmount, cur)} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: spacing.sm }}>
              <Text style={{ color: colors.text, fontSize: font.md, fontWeight: '800' }}>{t('detail.total')}</Text>
              <Text style={{ color: colors.accent, fontSize: font.lg, fontWeight: '800' }}>
                {money(q.total, cur)}
              </Text>
            </View>
          </View>

          {/* Meta */}
          <View style={[cardStyle, { marginTop: spacing.md }]}>
            {isStaff && q.client ? (
              <Row label={t('detail.client')} value={q.client.company || q.client.user?.name || '—'} />
            ) : null}
            <Row label={t('detail.validUntil')} value={fmtDate(q.validUntil)} />
            {q.sentAt ? <Row label={t('detail.sent')} value={fmtDate(q.sentAt)} /> : null}
            {q.acceptedAt ? <Row label={t('detail.accepted')} value={fmtDate(q.acceptedAt)} /> : null}
            {q.rejectedAt ? <Row label={t('detail.rejected')} value={fmtDate(q.rejectedAt)} /> : null}
          </View>

          {q.notes ? (
            <View style={[cardStyle, { marginTop: spacing.md }]}>
              <Text style={sectionLabel}>{t('detail.notes')}</Text>
              <Text style={{ color: colors.textMuted, fontSize: font.sm }}>{q.notes}</Text>
            </View>
          ) : null}

          {/* Actions — a client can accept/reject a SENT quotation. */}
          {canRespond && (
            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
              <View style={{ flex: 1 }}>
                <Button title={t('quotation.accept')} onPress={() => accept.mutate()} loading={accept.isPending} />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title={t('detail.reject')}
                  variant="danger"
                  onPress={confirmReject}
                  loading={reject.isPending}
                />
              </View>
            </View>
          )}

          {/* Staff workflow actions */}
          {isStaff && (
            <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
              {canEdit && (
                <Button title={t('quotation.editAction')} variant="ghost" onPress={openEdit} />
              )}
              {canSend && (
                <Button title={t('quotation.sendToClient')} onPress={confirmSend} loading={send.isPending} />
              )}
              {canConvert && (
                <Button
                  title={t('quotation.convertToInvoice')}
                  onPress={confirmConvert}
                  loading={convert.isPending}
                />
              )}
              {canDelete && (
                <Button
                  title={t('quotation.delete')}
                  variant="danger"
                  onPress={confirmDelete}
                  loading={del.isPending}
                />
              )}
            </View>
          )}
        </ScrollView>
      )}

      <FormModal
        visible={editOpen}
        onClose={() => setEditOpen(false)}
        title={t('quotation.editModal')}
        subtitle={q?.quoteNumber}
        onSubmit={submitEdit}
        submitting={edit.isPending}
        error={editErr ?? undefined}
      >
        <Input label={t('detail.titleLabel')} value={eTitle} onChangeText={setETitle} placeholder={t('detail.docTitlePlaceholder')} />
        <LineItemsEditor items={eItems} onChange={setEItems} />
        <Input
          label={t('detail.taxRate')}
          value={eTax}
          onChangeText={setETax}
          placeholder="0"
          keyboardType="decimal-pad"
        />
        <Input
          label={t('detail.currency')}
          value={eCurrency}
          onChangeText={setECurrency}
          placeholder="SEK"
          autoCapitalize="characters"
        />
        <DateField label={t('detail.validUntil')} value={eValidUntil} onChange={setEValidUntil} />
        <Textarea label={t('detail.notes')} value={eNotes} onChangeText={setENotes} placeholder={t('common.optional')} />
      </FormModal>
    </SafeAreaView>
    </ScreenBackground>
  );
}

