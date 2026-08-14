import React, { useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenBackground } from '@/components/glass';
import { invoicesApi, type InvoiceInput, type LineItemInput } from '@/lib/endpoints';
import { apiError } from '@/lib/apiError';
import { useAuthStore } from '@/store/authStore';
import { Loading, Badge, DetailHeader, Row, Button, Input } from '@/components/ui';
import { FormModal, Textarea, DateField } from '@/components/forms';
import { LineItemsEditor } from '@/components/LineItemsEditor';
import { INVOICE_STATUS_META, statusMeta, money, fmtDate } from '@/lib/salesMeta';
import { spacing, radius, font, useTheme } from '@/theme';
import type { Invoice, LineItem } from '@/types';
import { useT } from '@/i18n';

export default function InvoiceDetailScreen() {
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
  const invoiceId = String(id);
  const router = useRouter();
  const qc = useQueryClient();
  const isStaff = useAuthStore((s) => s.isStaff());

  const detail = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: (): Promise<Invoice> => invoicesApi.get(invoiceId).then((r) => r.data.data),
    enabled: !!invoiceId,
  });
  const inv: Invoice | undefined = detail.data;

  const isAdmin = useAuthStore((s) => s.isAdmin());

  const markPaid = useMutation({
    mutationFn: () => invoicesApi.markPaid(invoiceId).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
  const del = useMutation({
    mutationFn: () => invoicesApi.remove(invoiceId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      router.back();
    },
    onError: (e: any) =>
      Alert.alert(t('invoice.deleteError'), e?.response?.data?.message ?? t('common.tryAgain')),
  });

  // ─── Edit (UNPAID only) ─────────────────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);
  const [eItems, setEItems] = useState<LineItemInput[]>([]);
  const [eTax, setETax] = useState('0');
  const [eDueDate, setEDueDate] = useState('');
  const [eNotes, setENotes] = useState('');

  const openEdit = () => {
    if (!inv) return;
    setEItems(
      (inv.lineItems ?? []).map((li) => ({
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
      })),
    );
    setETax(String(inv.taxRate ?? 0));
    setEDueDate(inv.dueDate ? inv.dueDate.slice(0, 10) : '');
    setENotes(inv.notes ?? '');
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
      const payload: InvoiceInput = {
        lineItems: cleanItems(),
        taxRate: Number(eTax) || 0,
        dueDate: eDueDate.trim() || undefined,
        notes: eNotes.trim() || undefined,
      };
      return invoicesApi.update(invoiceId, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      setEditOpen(false);
    },
    onError: (e) => setEditErr(apiError(e, t('detail.editSaveError'))),
  });

  const submitEdit = () => {
    if (cleanItems().length === 0)
      return setEditErr(t('detail.lineItemError'));
    setEditErr(null);
    edit.mutate();
  };

  const confirmPaid = () =>
    Alert.alert(t('invoice.confirmPaidTitle'), t('invoice.confirmPaidMsg'), [
      { text: t('detail.cancel'), style: 'cancel' },
      { text: t('invoice.markPaidAction'), onPress: () => markPaid.mutate() },
    ]);
  const confirmDelete = () =>
    Alert.alert(t('invoice.confirmDeleteTitle'), t('invoice.confirmDeleteMsg'), [
      { text: t('detail.cancel'), style: 'cancel' },
      { text: t('detail.delete'), style: 'destructive', onPress: () => del.mutate() },
    ]);

  const canDelete = isAdmin && inv?.paymentStatus === 'UNPAID';
  const canEdit = isStaff && inv?.paymentStatus === 'UNPAID';
  const cur = inv?.currency;

  return (
    <ScreenBackground>
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <DetailHeader
        title={inv ? money(inv.total, inv.currency) : t('detail.loading')}
        subtitle={inv?.invoiceNumber}
        onBack={() => router.back()}
      />

      {detail.isLoading || !inv ? (
        <Loading />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
          <View style={{ flexDirection: 'row', marginBottom: spacing.md }}>
            {(() => {
              const m = statusMeta(INVOICE_STATUS_META, inv.paymentStatus, t);
              return <Badge label={m.label} color={m.color} soft={m.soft} />;
            })()}
          </View>

          <Text style={sectionLabel}>{t('detail.lineItems')}</Text>
          <View style={cardStyle}>
            {(inv.lineItems ?? []).map((li: LineItem) => (
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
            {(inv.lineItems ?? []).length === 0 && (
              <Text style={{ color: colors.textFaint, fontSize: font.sm }}>{t('detail.noLineItems')}</Text>
            )}
          </View>

          <View style={[cardStyle, { marginTop: spacing.md }]}>
            <Row label={t('detail.subtotal')} value={money(inv.subtotal, cur)} />
            <Row label={t('detail.tax', { rate: inv.taxRate })} value={money(inv.taxAmount, cur)} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: spacing.sm }}>
              <Text style={{ color: colors.text, fontSize: font.md, fontWeight: '800' }}>{t('detail.total')}</Text>
              <Text style={{ color: colors.accent, fontSize: font.lg, fontWeight: '800' }}>
                {money(inv.total, cur)}
              </Text>
            </View>
          </View>

          <View style={[cardStyle, { marginTop: spacing.md }]}>
            {isStaff && inv.client ? (
              <Row label={t('detail.client')} value={inv.client.company || inv.client.user?.name || '—'} />
            ) : null}
            <Row label={t('detail.dueDate')} value={fmtDate(inv.dueDate)} />
            {inv.paidAt ? <Row label={t('detail.paid')} value={fmtDate(inv.paidAt)} /> : null}
          </View>

          {inv.notes ? (
            <View style={[cardStyle, { marginTop: spacing.md }]}>
              <Text style={sectionLabel}>{t('detail.notes')}</Text>
              <Text style={{ color: colors.textMuted, fontSize: font.sm }}>{inv.notes}</Text>
            </View>
          ) : null}

          {/* Staff can edit/record payment/delete on an unpaid/overdue invoice. */}
          {isStaff && (inv.paymentStatus !== 'PAID' || canDelete) && (
            <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
              {canEdit && (
                <Button title={t('invoice.edit')} variant="ghost" onPress={openEdit} />
              )}
              {inv.paymentStatus !== 'PAID' && (
                <Button title={t('invoice.markPaid')} onPress={confirmPaid} loading={markPaid.isPending} />
              )}
              {canDelete && (
                <Button
                  title={t('invoice.delete')}
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
        title={t('invoice.editModal')}
        subtitle={inv?.invoiceNumber}
        onSubmit={submitEdit}
        submitting={edit.isPending}
        error={editErr ?? undefined}
      >
        <LineItemsEditor items={eItems} onChange={setEItems} />
        <Input
          label={t('detail.taxRate')}
          value={eTax}
          onChangeText={setETax}
          placeholder="0"
          keyboardType="decimal-pad"
        />
        <DateField label={t('detail.dueDate')} value={eDueDate} onChange={setEDueDate} />
        <Textarea label={t('detail.notes')} value={eNotes} onChangeText={setENotes} placeholder={t('common.optional')} />
      </FormModal>
    </SafeAreaView>
    </ScreenBackground>
  );
}

