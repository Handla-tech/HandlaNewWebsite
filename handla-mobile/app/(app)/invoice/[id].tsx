import React, { useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { invoicesApi, type InvoiceInput, type LineItemInput } from '@/lib/endpoints';
import { apiError } from '@/lib/apiError';
import { useAuthStore } from '@/store/authStore';
import { Loading, Badge, DetailHeader, Row, Button, Input } from '@/components/ui';
import { FormModal, Textarea, DateField } from '@/components/forms';
import { LineItemsEditor } from '@/components/LineItemsEditor';
import { INVOICE_STATUS_META, money, fmtDate } from '@/lib/salesMeta';
import { spacing, radius, font, useTheme, colors as staticColors } from '@/theme';
import type { Invoice, LineItem } from '@/types';

export default function InvoiceDetailScreen() {
  const { colors } = useTheme();
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
      Alert.alert('Could not delete', e?.response?.data?.message ?? 'Please try again.'),
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
    onError: (e) => setEditErr(apiError(e, 'Failed to save changes')),
  });

  const submitEdit = () => {
    if (cleanItems().length === 0)
      return setEditErr('Add at least one line item (description + quantity).');
    setEditErr(null);
    edit.mutate();
  };

  const confirmPaid = () =>
    Alert.alert('Mark as paid?', 'Record this invoice as fully paid.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Mark Paid', onPress: () => markPaid.mutate() },
    ]);
  const confirmDelete = () =>
    Alert.alert('Delete invoice?', 'Only unpaid invoices can be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => del.mutate() },
    ]);

  const canDelete = isAdmin && inv?.paymentStatus === 'UNPAID';
  const canEdit = isStaff && inv?.paymentStatus === 'UNPAID';
  const cur = inv?.currency;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <DetailHeader
        title={inv ? money(inv.total, inv.currency) : 'Loading…'}
        subtitle={inv?.invoiceNumber}
        onBack={() => router.back()}
      />

      {detail.isLoading || !inv ? (
        <Loading />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
          <View style={{ flexDirection: 'row', marginBottom: spacing.md }}>
            <Badge
              label={INVOICE_STATUS_META[inv.paymentStatus].label}
              color={INVOICE_STATUS_META[inv.paymentStatus].color}
              soft={INVOICE_STATUS_META[inv.paymentStatus].soft}
            />
          </View>

          <Text style={sectionLabel}>Line Items</Text>
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
              <Text style={{ color: colors.textFaint, fontSize: font.sm }}>No line items.</Text>
            )}
          </View>

          <View style={[cardStyle, { marginTop: spacing.md }]}>
            <Row label="Subtotal" value={money(inv.subtotal, cur)} />
            <Row label={`Tax (${inv.taxRate}%)`} value={money(inv.taxAmount, cur)} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: spacing.sm }}>
              <Text style={{ color: colors.text, fontSize: font.md, fontWeight: '800' }}>Total</Text>
              <Text style={{ color: colors.accent, fontSize: font.lg, fontWeight: '800' }}>
                {money(inv.total, cur)}
              </Text>
            </View>
          </View>

          <View style={[cardStyle, { marginTop: spacing.md }]}>
            {isStaff && inv.client ? (
              <Row label="Client" value={inv.client.company || inv.client.user?.name || '—'} />
            ) : null}
            <Row label="Due date" value={fmtDate(inv.dueDate)} />
            {inv.paidAt ? <Row label="Paid" value={fmtDate(inv.paidAt)} /> : null}
          </View>

          {inv.notes ? (
            <View style={[cardStyle, { marginTop: spacing.md }]}>
              <Text style={sectionLabel}>Notes</Text>
              <Text style={{ color: colors.textMuted, fontSize: font.sm }}>{inv.notes}</Text>
            </View>
          ) : null}

          {/* Staff can edit/record payment/delete on an unpaid/overdue invoice. */}
          {isStaff && (inv.paymentStatus !== 'PAID' || canDelete) && (
            <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
              {canEdit && (
                <Button title="Edit invoice" variant="ghost" onPress={openEdit} />
              )}
              {inv.paymentStatus !== 'PAID' && (
                <Button title="Mark as Paid" onPress={confirmPaid} loading={markPaid.isPending} />
              )}
              {canDelete && (
                <Button
                  title="Delete invoice"
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
        title="Edit Invoice"
        subtitle={inv?.invoiceNumber}
        onSubmit={submitEdit}
        submitting={edit.isPending}
        error={editErr ?? undefined}
      >
        <LineItemsEditor items={eItems} onChange={setEItems} />
        <Input
          label="Tax rate (%)"
          value={eTax}
          onChangeText={setETax}
          placeholder="0"
          keyboardType="decimal-pad"
        />
        <DateField label="Due date" value={eDueDate} onChange={setEDueDate} />
        <Textarea label="Notes" value={eNotes} onChangeText={setENotes} placeholder="Optional" />
      </FormModal>
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
