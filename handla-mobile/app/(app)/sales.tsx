import React, { useState } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  quotationsApi,
  contractsApi,
  invoicesApi,
  clientsApi,
  type QuotationInput,
  type ContractInput,
  type InvoiceInput,
  type LineItemInput,
} from '@/lib/endpoints';
import { apiError } from '@/lib/apiError';
import { useAuthStore } from '@/store/authStore';
import { Loading, Badge, Input } from '@/components/ui';
import { GlassScreen, GradientHeader, GlassCard } from '@/components/glass';
import {
  FormModal,
  Textarea,
  Select,
  DateField,
  Fab,
  type SelectOption,
} from '@/components/forms';
import { LineItemsEditor } from '@/components/LineItemsEditor';
import {
  QUOTATION_STATUS_META,
  CONTRACT_STATUS_META,
  INVOICE_STATUS_META,
  statusMeta,
  money,
  fmtDate,
} from '@/lib/salesMeta';
import { useT } from '@/i18n';
import { spacing, radius, font, useTheme } from '@/theme';
import type {
  PaginatedQuotations,
  PaginatedContracts,
  PaginatedInvoices,
  Quotation,
  Contract,
  Invoice,
} from '@/types';

type Segment = 'quotations' | 'contracts' | 'invoices';

const SEGMENTS: { key: Segment }[] = [
  { key: 'quotations' },
  { key: 'contracts' },
  { key: 'invoices' },
];

function DocCard({
  number,
  title,
  subtitle,
  amount,
  currency,
  badge,
  onPress,
}: {
  number: string;
  title: string;
  subtitle?: string | null;
  amount?: number | string | null;
  currency?: string | null;
  badge: { label: string; color: string; soft: string };
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <GlassCard onPress={onPress} padded={false} style={{ marginBottom: spacing.sm }}>
      <View style={{ padding: spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: colors.accent, fontSize: font.xs, fontWeight: '700' }}>{number}</Text>
          <Badge label={badge.label} color={badge.color} soft={badge.soft} />
        </View>
        <Text
          style={{ color: colors.text, fontSize: font.md, fontWeight: '700', marginTop: 4 }}
          numberOfLines={1}
        >
          {title}
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 4 }}>
          {subtitle ? (
            <Text style={{ color: colors.textFaint, fontSize: font.sm, flex: 1 }} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          {amount != null && (
            <Text style={{ color: colors.text, fontSize: font.md, fontWeight: '800', marginLeft: 8 }}>
              {money(amount, currency)}
            </Text>
          )}
        </View>
      </View>
    </GlassCard>
  );
}

export default function SalesScreen() {
  const { colors } = useTheme();
  const { t } = useT();
  const router = useRouter();
  const qc = useQueryClient();
  const isStaff = useAuthStore((s) => s.isStaff());
  const [segment, setSegment] = useState<Segment>('quotations');

  const quotations = useQuery({
    queryKey: ['quotations'],
    enabled: segment === 'quotations',
    queryFn: (): Promise<PaginatedQuotations> =>
      quotationsApi.list({ limit: 50 }).then((r) => r.data.data),
  });
  const contracts = useQuery({
    queryKey: ['contracts'],
    enabled: segment === 'contracts',
    queryFn: (): Promise<PaginatedContracts> =>
      contractsApi.list({ limit: 50 }).then((r) => r.data.data),
  });
  const invoices = useQuery({
    queryKey: ['invoices'],
    enabled: segment === 'invoices',
    queryFn: (): Promise<PaginatedInvoices> =>
      invoicesApi.list({ limit: 50 }).then((r) => r.data.data),
  });

  const active =
    segment === 'quotations' ? quotations : segment === 'contracts' ? contracts : invoices;

  const clientLabel = (c?: { company?: string | null; user?: { name: string } | null }) =>
    c?.company || c?.user?.name;

  // ─── Create flow (staff) ───────────────────────────────────────────────────
  const clientList = useQuery({
    queryKey: ['clients-for-sales'],
    enabled: isStaff,
    queryFn: () => clientsApi.list({ limit: 100 }).then((r) => r.data.data.clients),
  });
  const clientOptions: SelectOption[] = (clientList.data ?? []).map((c) => ({
    label: c.user?.name || c.company || c.user?.email || c.id.slice(0, 8),
    value: c.id,
  }));

  const [createOpen, setCreateOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // shared create form fields (used per-segment)
  const [clientId, setClientId] = useState('');
  const [title, setTitle] = useState('');
  const [lineItems, setLineItems] = useState<LineItemInput[]>([
    { description: '', quantity: 1, unitPrice: 0 },
  ]);
  const [taxRate, setTaxRate] = useState('0');
  const [currency, setCurrency] = useState('SEK');
  const [validUntil, setValidUntil] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [body, setBody] = useState('');

  const openCreate = () => {
    setErr(null);
    setClientId('');
    setTitle('');
    setLineItems([{ description: '', quantity: 1, unitPrice: 0 }]);
    setTaxRate('0');
    setCurrency('SEK');
    setValidUntil('');
    setDueDate('');
    setNotes('');
    setBody('');
    setCreateOpen(true);
  };

  const invalidateList = () => {
    qc.invalidateQueries({ queryKey: [segment] });
  };

  const cleanItems = () =>
    lineItems
      .map((li) => ({
        description: li.description.trim(),
        quantity: Number(li.quantity) || 0,
        unitPrice: Number(li.unitPrice) || 0,
      }))
      .filter((li) => li.description && li.quantity > 0);

  const create = useMutation({
    mutationFn: async (): Promise<void> => {
      if (segment === 'quotations') {
        const payload: QuotationInput = {
          title: title.trim(),
          clientId,
          lineItems: cleanItems(),
          taxRate: Number(taxRate) || 0,
          currency: currency.trim() || undefined,
          validUntil: validUntil.trim() || undefined,
          notes: notes.trim() || undefined,
        };
        await quotationsApi.create(payload);
        return;
      }
      if (segment === 'contracts') {
        const payload: ContractInput = {
          title: title.trim(),
          clientId,
          body: body.trim(),
        };
        await contractsApi.create(payload);
        return;
      }
      const payload: InvoiceInput = {
        clientId,
        lineItems: cleanItems(),
        taxRate: Number(taxRate) || 0,
        dueDate: dueDate.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      await invoicesApi.create(payload);
    },
    onSuccess: () => {
      invalidateList();
      setCreateOpen(false);
    },
    onError: (e) => setErr(apiError(e, t('sales.errors.createFailed'))),
  });

  const submitCreate = () => {
    if (!clientId) return setErr(t('sales.errors.clientRequired'));
    if (segment !== 'invoices' && title.trim().length < 2)
      return setErr(t('sales.errors.titleMin'));
    if (segment === 'contracts') {
      if (body.trim().length < 1) return setErr(t('sales.errors.bodyRequired'));
    } else if (cleanItems().length === 0) {
      return setErr(t('sales.errors.lineItemRequired'));
    }
    setErr(null);
    create.mutate();
  };

  const createTitle =
    segment === 'quotations'
      ? t('sales.create.quotation')
      : segment === 'contracts'
        ? t('sales.create.contract')
        : t('sales.create.invoice');

  return (
    <GlassScreen>
      <GradientHeader title={t('sales.header')} icon="cash-outline" />

      {/* Segmented control */}
      <View
        style={{
          flexDirection: 'row',
          marginHorizontal: spacing.lg,
          backgroundColor: colors.cardAlt,
          borderRadius: radius.md,
          padding: 3,
          marginBottom: spacing.md,
        }}
      >
        {SEGMENTS.map((s) => {
          const on = segment === s.key;
          return (
            <Pressable
              key={s.key}
              onPress={() => setSegment(s.key)}
              style={{
                flex: 1,
                paddingVertical: spacing.sm,
                borderRadius: radius.sm,
                backgroundColor: on ? colors.accent : 'transparent',
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  color: on ? '#0a0a0a' : colors.textMuted,
                  fontSize: font.sm,
                  fontWeight: on ? '800' : '600',
                }}
              >
                {t(`sales.segments.${s.key}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {active.isLoading ? (
        <Loading />
      ) : segment === 'quotations' ? (
        <FlatList
          data={quotations.data?.quotations ?? []}
          keyExtractor={(q: Quotation) => q.id}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
          refreshControl={
            <RefreshControl refreshing={quotations.isFetching} onRefresh={() => quotations.refetch()} tintColor={colors.accent} />
          }
          ListEmptyComponent={<Empty icon="document-text-outline" label={t('sales.empty.quotations')} />}
          renderItem={({ item }: { item: Quotation }) => (
            <DocCard
              number={item.quoteNumber}
              title={item.title}
              subtitle={isStaff ? clientLabel(item.client) : t('sales.validUntil', { date: fmtDate(item.validUntil) })}
              amount={item.total}
              currency={item.currency}
              badge={statusMeta(QUOTATION_STATUS_META, item.status, t)}
              onPress={() => router.push(`/(app)/quotation/${item.id}`)}
            />
          )}
        />
      ) : segment === 'contracts' ? (
        <FlatList
          data={contracts.data?.contracts ?? []}
          keyExtractor={(c: Contract) => c.id}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
          refreshControl={
            <RefreshControl refreshing={contracts.isFetching} onRefresh={() => contracts.refetch()} tintColor={colors.accent} />
          }
          ListEmptyComponent={<Empty icon="ribbon-outline" label={t('sales.empty.contracts')} />}
          renderItem={({ item }: { item: Contract }) => (
            <DocCard
              number={item.status === 'SIGNED' ? t('sales.signed') : t('sales.contract')}
              title={item.title}
              subtitle={isStaff ? clientLabel(item.client) : t('sales.updated', { date: fmtDate(item.updatedAt) })}
              badge={statusMeta(CONTRACT_STATUS_META, item.status, t)}
              onPress={() => router.push(`/(app)/contract/${item.id}`)}
            />
          )}
        />
      ) : (
        <FlatList
          data={invoices.data?.invoices ?? []}
          keyExtractor={(i: Invoice) => i.id}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
          refreshControl={
            <RefreshControl refreshing={invoices.isFetching} onRefresh={() => invoices.refetch()} tintColor={colors.accent} />
          }
          ListEmptyComponent={<Empty icon="receipt-outline" label={t('sales.empty.invoices')} />}
          renderItem={({ item }: { item: Invoice }) => (
            <DocCard
              number={item.invoiceNumber}
              title={isStaff ? clientLabel(item.client) || t('sales.invoice') : t('sales.due', { date: fmtDate(item.dueDate) })}
              subtitle={t('sales.due', { date: fmtDate(item.dueDate) })}
              amount={item.total}
              currency={item.currency}
              badge={statusMeta(INVOICE_STATUS_META, item.paymentStatus, t)}
              onPress={() => router.push(`/(app)/invoice/${item.id}`)}
            />
          )}
        />
      )}

      {isStaff ? <Fab onPress={openCreate} /> : null}

      <FormModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        title={createTitle}
        onSubmit={submitCreate}
        submitting={create.isPending}
        error={err ?? undefined}
      >
        <Select
          label={t('sales.form.client')}
          value={clientId}
          options={clientOptions}
          onChange={setClientId}
          placeholder={t('sales.form.selectClient')}
        />

        {segment !== 'invoices' ? (
          <Input label={t('sales.form.title')} value={title} onChangeText={setTitle} placeholder={t('sales.form.titlePlaceholder')} />
        ) : null}

        {segment === 'contracts' ? (
          <Textarea
            label={t('sales.form.contractBody')}
            value={body}
            onChangeText={setBody}
            placeholder={t('sales.form.contractBodyPlaceholder')}
          />
        ) : (
          <>
            <LineItemsEditor items={lineItems} onChange={setLineItems} />
            <Input
              label={t('sales.form.taxRate')}
              value={taxRate}
              onChangeText={setTaxRate}
              placeholder="0"
              keyboardType="decimal-pad"
            />
            {segment === 'quotations' ? (
              <>
                <Input
                  label={t('sales.form.currency')}
                  value={currency}
                  onChangeText={setCurrency}
                  placeholder="SEK"
                  autoCapitalize="characters"
                />
                <DateField label={t('sales.form.validUntil')} value={validUntil} onChange={setValidUntil} />
              </>
            ) : (
              <DateField label={t('sales.form.dueDate')} value={dueDate} onChange={setDueDate} />
            )}
            <Textarea label={t('sales.form.notes')} value={notes} onChangeText={setNotes} placeholder={t('sales.form.notesPlaceholder')} />
          </>
        )}
      </FormModal>
    </GlassScreen>
  );
}

function Empty({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingTop: spacing.xxl }}>
      <Ionicons name={icon} size={40} color={colors.textDim} />
      <Text style={{ color: colors.textFaint, marginTop: spacing.md }}>{label}</Text>
    </View>
  );
}
