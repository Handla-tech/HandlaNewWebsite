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

const SEGMENTS: { key: Segment; label: string }[] = [
  { key: 'quotations', label: 'Quotations' },
  { key: 'contracts', label: 'Contracts' },
  { key: 'invoices', label: 'Invoices' },
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
    onError: (e) => setErr(apiError(e, 'Failed to create')),
  });

  const submitCreate = () => {
    if (!clientId) return setErr('Client is required.');
    if (segment !== 'invoices' && title.trim().length < 2)
      return setErr('Title must be at least 2 characters.');
    if (segment === 'contracts') {
      if (body.trim().length < 1) return setErr('Contract body is required.');
    } else if (cleanItems().length === 0) {
      return setErr('Add at least one line item (description + quantity).');
    }
    setErr(null);
    create.mutate();
  };

  const createTitle =
    segment === 'quotations'
      ? 'New Quotation'
      : segment === 'contracts'
        ? 'New Contract'
        : 'New Invoice';

  return (
    <GlassScreen>
      <GradientHeader title="Sales" icon="cash-outline" />

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
                {s.label}
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
          ListEmptyComponent={<Empty icon="document-text-outline" label="No quotations yet." />}
          renderItem={({ item }: { item: Quotation }) => (
            <DocCard
              number={item.quoteNumber}
              title={item.title}
              subtitle={isStaff ? clientLabel(item.client) : `Valid until ${fmtDate(item.validUntil)}`}
              amount={item.total}
              currency={item.currency}
              badge={statusMeta(QUOTATION_STATUS_META, item.status)}
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
          ListEmptyComponent={<Empty icon="ribbon-outline" label="No contracts yet." />}
          renderItem={({ item }: { item: Contract }) => (
            <DocCard
              number={item.status === 'SIGNED' ? 'Signed' : 'Contract'}
              title={item.title}
              subtitle={isStaff ? clientLabel(item.client) : `Updated ${fmtDate(item.updatedAt)}`}
              badge={statusMeta(CONTRACT_STATUS_META, item.status)}
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
          ListEmptyComponent={<Empty icon="receipt-outline" label="No invoices yet." />}
          renderItem={({ item }: { item: Invoice }) => (
            <DocCard
              number={item.invoiceNumber}
              title={isStaff ? clientLabel(item.client) || 'Invoice' : `Due ${fmtDate(item.dueDate)}`}
              subtitle={`Due ${fmtDate(item.dueDate)}`}
              amount={item.total}
              currency={item.currency}
              badge={statusMeta(INVOICE_STATUS_META, item.paymentStatus)}
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
          label="Client"
          value={clientId}
          options={clientOptions}
          onChange={setClientId}
          placeholder="Select a client"
        />

        {segment !== 'invoices' ? (
          <Input label="Title" value={title} onChangeText={setTitle} placeholder="Document title" />
        ) : null}

        {segment === 'contracts' ? (
          <Textarea
            label="Contract body"
            value={body}
            onChangeText={setBody}
            placeholder="Terms and conditions…"
          />
        ) : (
          <>
            <LineItemsEditor items={lineItems} onChange={setLineItems} />
            <Input
              label="Tax rate (%)"
              value={taxRate}
              onChangeText={setTaxRate}
              placeholder="0"
              keyboardType="decimal-pad"
            />
            {segment === 'quotations' ? (
              <>
                <Input
                  label="Currency"
                  value={currency}
                  onChangeText={setCurrency}
                  placeholder="SEK"
                  autoCapitalize="characters"
                />
                <DateField label="Valid until" value={validUntil} onChange={setValidUntil} />
              </>
            ) : (
              <DateField label="Due date" value={dueDate} onChange={setDueDate} />
            )}
            <Textarea label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional" />
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
