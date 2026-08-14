import React, { useState } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  purchasesApi,
  expensesApi,
  accountingApi,
  suppliersApi,
  type ExpenseInput,
  type PurchaseInput,
  type LineItemInput,
} from '@/lib/endpoints';
import { apiError } from '@/lib/apiError';
import { useAuthStore } from '@/store/authStore';
import { Title, Loading, Badge, Input } from '@/components/ui';
import {
  FormModal,
  Textarea,
  Select,
  DateField,
  ConfirmModal,
  ActionSheet,
  Fab,
  type SelectOption,
} from '@/components/forms';
import { LineItemsEditor } from '@/components/LineItemsEditor';
import { money, fmtDate } from '@/lib/salesMeta';
import {
  PURCHASE_STATUS_META,
  PURCHASE_PAYMENT_META,
  EXPENSE_TYPE_META,
  LEDGER_DIRECTION_META,
  LEDGER_SOURCE_LABEL,
} from '@/lib/financeMeta';
import { spacing, radius, font, useTheme, colors as staticColors } from '@/theme';
import type {
  PaginatedPurchases,
  PaginatedExpenses,
  PaginatedLedger,
  FinancialSummary,
  Purchase,
  Expense,
  LedgerEntry,
} from '@/types';

type Segment = 'purchases' | 'expenses' | 'ledger';

const SEGMENTS: { key: Segment; label: string }[] = [
  { key: 'purchases', label: 'Purchases' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'ledger', label: 'Ledger' },
];

function SummaryHeader({ s }: { s?: FinancialSummary }) {
  const { colors } = useTheme();
  if (!s) return null;
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
      <SummaryTile label="Income" value={money(s.totalIncome)} tone={colors.success} />
      <SummaryTile label="Expenses" value={money(s.totalExpenses)} tone={colors.danger} />
      <SummaryTile
        label="Net"
        value={money(s.netBalance)}
        tone={s.netBalance >= 0 ? colors.success : colors.danger}
      />
    </View>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: string; tone: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.card,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: radius.md,
        padding: spacing.md,
      }}
    >
      <Text style={{ color: tone, fontSize: font.md, fontWeight: '800' }} numberOfLines={1}>
        {value}
      </Text>
      <Text style={{ color: colors.textFaint, fontSize: font.xs, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

const PURCHASE_STATUS_OPTIONS: SelectOption[] = [
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Ordered', value: 'ORDERED' },
  { label: 'Received', value: 'RECEIVED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

const EMPTY_EXPENSE: ExpenseInput = { type: 'EXPENSE', category: '', amount: 0, description: '', expenseDate: '' };
const EMPTY_PURCHASE: PurchaseInput = {
  supplierId: '',
  lineItems: [{ description: '', quantity: 1, unitPrice: 0 }],
  taxRate: 0,
  status: 'DRAFT',
  notes: '',
};

export default function FinanceScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const isStaff = useAuthStore((s) => s.isStaff());
  const isAdmin = useAuthStore((s) => s.isAdmin());
  const [segment, setSegment] = useState<Segment>('purchases');

  const summary = useQuery({
    queryKey: ['financeSummary'],
    queryFn: (): Promise<FinancialSummary> => expensesApi.summary().then((r) => r.data.data),
  });

  // Suppliers for the purchase picker.
  const supplierList = useQuery({
    queryKey: ['suppliers-for-purchase'],
    enabled: segment === 'purchases' && isStaff,
    queryFn: () => suppliersApi.list({ limit: 100 }).then((r) => r.data.data.suppliers),
  });
  const supplierOptions: SelectOption[] = (supplierList.data ?? []).map((s) => ({
    label: s.company || s.name,
    value: s.id,
  }));

  const purchases = useQuery({
    queryKey: ['purchases'],
    enabled: segment === 'purchases',
    queryFn: (): Promise<PaginatedPurchases> =>
      purchasesApi.list({ limit: 50 }).then((r) => r.data.data),
  });
  const expenses = useQuery({
    queryKey: ['expenses'],
    enabled: segment === 'expenses',
    queryFn: (): Promise<PaginatedExpenses> =>
      expensesApi.list({ limit: 50 }).then((r) => r.data.data),
  });
  const ledger = useQuery({
    queryKey: ['ledger'],
    enabled: segment === 'ledger',
    queryFn: (): Promise<PaginatedLedger> =>
      accountingApi.ledger({ limit: 50 }).then((r) => r.data.data),
  });

  const active =
    segment === 'purchases' ? purchases : segment === 'expenses' ? expenses : ledger;

  const refreshAll = () => {
    summary.refetch();
    active.refetch();
  };

  // ─── Expense create/edit/delete ─────────────────────────────────────────────
  const [expOpen, setExpOpen] = useState(false);
  const [expEditing, setExpEditing] = useState<Expense | null>(null);
  const [expForm, setExpForm] = useState<ExpenseInput>(EMPTY_EXPENSE);
  const [expErr, setExpErr] = useState<string | null>(null);

  const openExpenseCreate = () => {
    setExpEditing(null);
    setExpForm(EMPTY_EXPENSE);
    setExpErr(null);
    setExpOpen(true);
  };
  const openExpenseEdit = (e: Expense) => {
    setExpEditing(e);
    setExpForm({
      type: e.type,
      category: e.category,
      amount: e.amount,
      description: e.description ?? '',
      expenseDate: e.expenseDate ? e.expenseDate.slice(0, 10) : '',
    });
    setExpErr(null);
    setExpOpen(true);
  };
  const saveExpense = useMutation({
    mutationFn: () => {
      const payload: ExpenseInput = {
        type: expForm.type,
        category: expForm.category?.trim(),
        amount: Number(expForm.amount),
        description: expForm.description?.trim() || undefined,
        expenseDate: expForm.expenseDate?.trim() || undefined,
      };
      return expEditing ? expensesApi.update(expEditing.id, payload) : expensesApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['financeSummary'] });
      setExpOpen(false);
    },
    onError: (e) => setExpErr(apiError(e, 'Failed to save expense')),
  });
  const submitExpense = () => {
    if (!expForm.category?.trim()) return setExpErr('Category is required.');
    if (!expForm.amount || Number(expForm.amount) <= 0) return setExpErr('Amount must be greater than 0.');
    setExpErr(null);
    saveExpense.mutate();
  };

  // ─── Purchase create + actions ──────────────────────────────────────────────
  const [purOpen, setPurOpen] = useState(false);
  const [purForm, setPurForm] = useState<PurchaseInput>(EMPTY_PURCHASE);
  const [purErr, setPurErr] = useState<string | null>(null);

  const openPurchaseCreate = () => {
    setPurForm(EMPTY_PURCHASE);
    setPurErr(null);
    setPurOpen(true);
  };
  const savePurchase = useMutation({
    mutationFn: () =>
      purchasesApi.create({
        supplierId: purForm.supplierId,
        lineItems: purForm.lineItems,
        taxRate: Number(purForm.taxRate) || 0,
        status: purForm.status,
        orderDate: purForm.orderDate?.trim() || undefined,
        dueDate: purForm.dueDate?.trim() || undefined,
        notes: purForm.notes?.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchases'] });
      qc.invalidateQueries({ queryKey: ['financeSummary'] });
      setPurOpen(false);
    },
    onError: (e) => setPurErr(apiError(e, 'Failed to create purchase')),
  });
  const submitPurchase = () => {
    if (!purForm.supplierId) return setPurErr('Supplier is required.');
    const items = (purForm.lineItems ?? []).filter((li) => li.description.trim());
    if (items.length === 0) return setPurErr('At least one line item is required.');
    setPurForm((f) => ({ ...f, lineItems: items }));
    setPurErr(null);
    savePurchase.mutate();
  };

  // Row action sheets (expense + purchase).
  const [expSheet, setExpSheet] = useState<Expense | null>(null);
  const [expDelete, setExpDelete] = useState<Expense | null>(null);
  const [expDeleteErr, setExpDeleteErr] = useState<string | null>(null);
  const delExpense = useMutation({
    mutationFn: (id: string) => expensesApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['financeSummary'] });
      setExpDelete(null);
    },
    onError: (e) => setExpDeleteErr(apiError(e, 'Failed to delete expense')),
  });

  const [purSheet, setPurSheet] = useState<Purchase | null>(null);
  const [purDelete, setPurDelete] = useState<Purchase | null>(null);
  const [purActionErr, setPurActionErr] = useState<string | null>(null);
  const markPurchasePaid = useMutation({
    mutationFn: (id: string) => purchasesApi.markPaid(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchases'] });
      qc.invalidateQueries({ queryKey: ['financeSummary'] });
      setPurSheet(null);
    },
  });
  const delPurchase = useMutation({
    mutationFn: (id: string) => purchasesApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchases'] });
      qc.invalidateQueries({ queryKey: ['financeSummary'] });
      setPurDelete(null);
    },
    onError: (e) => setPurActionErr(apiError(e, 'Failed to delete purchase')),
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['left', 'right']}>
      <View style={{ padding: spacing.lg, paddingBottom: spacing.sm }}>
        <Title>Finance</Title>
      </View>

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
      ) : segment === 'purchases' ? (
        <FlatList
          data={purchases.data?.purchases ?? []}
          keyExtractor={(p: Purchase) => p.id}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
          ListHeaderComponent={<SummaryHeader s={summary.data} />}
          refreshControl={<RefreshControl refreshing={purchases.isFetching} onRefresh={refreshAll} tintColor={colors.accent} />}
          ListEmptyComponent={<Empty icon="cart-outline" label="No purchases yet." />}
          renderItem={({ item }: { item: Purchase }) => (
            <Pressable
              onPress={() => router.push(`/(app)/purchase/${item.id}`)}
              onLongPress={() => isStaff && setPurSheet(item)}
              style={({ pressed }) => [rowCard, pressed && { opacity: 0.85 }]}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: colors.accent, fontSize: font.xs, fontWeight: '700' }}>
                  {item.purchaseNumber}
                </Text>
                <Text style={{ color: colors.text, fontSize: font.md, fontWeight: '800' }}>
                  {money(item.total, item.currency)}
                </Text>
              </View>
              <Text style={{ color: colors.text, fontSize: font.sm, marginTop: 2 }} numberOfLines={1}>
                {item.supplier?.company || item.supplier?.name || 'Supplier'}
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
                <Badge
                  label={PURCHASE_STATUS_META[item.status].label}
                  color={PURCHASE_STATUS_META[item.status].color}
                  soft={PURCHASE_STATUS_META[item.status].soft}
                />
                <Badge
                  label={PURCHASE_PAYMENT_META[item.paymentStatus].label}
                  color={PURCHASE_PAYMENT_META[item.paymentStatus].color}
                  soft={PURCHASE_PAYMENT_META[item.paymentStatus].soft}
                />
              </View>
            </Pressable>
          )}
        />
      ) : segment === 'expenses' ? (
        <FlatList
          data={expenses.data?.expenses ?? []}
          keyExtractor={(e: Expense) => e.id}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
          ListHeaderComponent={<SummaryHeader s={summary.data} />}
          refreshControl={<RefreshControl refreshing={expenses.isFetching} onRefresh={refreshAll} tintColor={colors.accent} />}
          ListEmptyComponent={<Empty icon="cash-outline" label="No expense entries yet." />}
          renderItem={({ item }: { item: Expense }) => {
            const m = EXPENSE_TYPE_META[item.type];
            return (
              <Pressable
                onPress={() => isStaff && setExpSheet(item)}
                style={({ pressed }) => [rowCard, pressed && { opacity: 0.85 }]}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: colors.text, fontSize: font.md, fontWeight: '700' }} numberOfLines={1}>
                    {item.category}
                  </Text>
                  <Text style={{ color: m.color, fontSize: font.md, fontWeight: '800' }}>
                    {item.type === 'EXPENSE' ? '-' : '+'}
                    {money(item.amount, item.currency)}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm }}>
                  <Badge label={m.label} color={m.color} soft={m.soft} />
                  <Text style={{ color: colors.textFaint, fontSize: font.xs }}>
                    {fmtDate(item.expenseDate)}
                  </Text>
                </View>
                {item.description ? (
                  <Text style={{ color: colors.textFaint, fontSize: font.sm, marginTop: spacing.xs }} numberOfLines={1}>
                    {item.description}
                  </Text>
                ) : null}
              </Pressable>
            );
          }}
        />
      ) : (
        <FlatList
          data={ledger.data?.entries ?? []}
          keyExtractor={(l: LedgerEntry) => l.id}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
          ListHeaderComponent={<SummaryHeader s={summary.data} />}
          refreshControl={<RefreshControl refreshing={ledger.isFetching} onRefresh={refreshAll} tintColor={colors.accent} />}
          ListEmptyComponent={<Empty icon="book-outline" label="No ledger entries yet." />}
          renderItem={({ item }: { item: LedgerEntry }) => {
            const m = LEDGER_DIRECTION_META[item.direction];
            return (
              <View style={rowCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: colors.text, fontSize: font.sm, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                    {item.account?.name || item.account?.code || LEDGER_SOURCE_LABEL[item.sourceType]}
                  </Text>
                  <Text style={{ color: m.color, fontSize: font.md, fontWeight: '800', marginLeft: 8 }}>
                    {item.direction === 'OUT' ? '-' : '+'}
                    {money(item.amount, item.currency)}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm }}>
                  <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                    <Badge label={m.label} color={m.color} soft={m.soft} />
                    <Text style={{ color: colors.textDim, fontSize: font.xs }}>
                      {LEDGER_SOURCE_LABEL[item.sourceType]}
                    </Text>
                  </View>
                  <Text style={{ color: colors.textFaint, fontSize: font.xs }}>
                    {fmtDate(item.entryDate)}
                  </Text>
                </View>
                {item.description ? (
                  <Text style={{ color: colors.textFaint, fontSize: font.sm, marginTop: spacing.xs }} numberOfLines={1}>
                    {item.description}
                  </Text>
                ) : null}
              </View>
            );
          }}
        />
      )}

      {/* FAB — create for the active segment (ledger is read-only). */}
      {isStaff && segment === 'expenses' ? <Fab onPress={openExpenseCreate} /> : null}
      {isStaff && segment === 'purchases' ? <Fab onPress={openPurchaseCreate} /> : null}

      {/* Expense create/edit */}
      <FormModal
        visible={expOpen}
        onClose={() => setExpOpen(false)}
        title={expEditing ? 'Edit Entry' : 'New Entry'}
        onSubmit={submitExpense}
        submitting={saveExpense.isPending}
        error={expErr}
      >
        <Select
          label="Type"
          value={expForm.type}
          options={[
            { label: 'Expense', value: 'EXPENSE' },
            { label: 'Income', value: 'INCOME' },
          ]}
          onChange={(v) => setExpForm((f) => ({ ...f, type: v as ExpenseInput['type'] }))}
        />
        <Input
          label="Category *"
          value={expForm.category ?? ''}
          onChangeText={(v) => setExpForm((f) => ({ ...f, category: v }))}
          placeholder="e.g. Marketing, Salaries"
        />
        <Input
          label="Amount *"
          value={expForm.amount ? String(expForm.amount) : ''}
          onChangeText={(v) => setExpForm((f) => ({ ...f, amount: Number(v.replace(/[^0-9.]/g, '')) || 0 }))}
          placeholder="0.00"
          keyboardType="decimal-pad"
        />
        <DateField
          label="Date"
          value={expForm.expenseDate}
          onChange={(v) => setExpForm((f) => ({ ...f, expenseDate: v }))}
        />
        <Textarea
          label="Description"
          value={expForm.description ?? ''}
          onChangeText={(v) => setExpForm((f) => ({ ...f, description: v }))}
          placeholder="Optional notes"
        />
      </FormModal>

      {/* Purchase create */}
      <FormModal
        visible={purOpen}
        onClose={() => setPurOpen(false)}
        title="New Purchase"
        onSubmit={submitPurchase}
        submitting={savePurchase.isPending}
        error={purErr}
      >
        <Select
          label="Supplier *"
          value={purForm.supplierId}
          options={supplierOptions}
          onChange={(v) => setPurForm((f) => ({ ...f, supplierId: v }))}
          placeholder={supplierList.isLoading ? 'Loading…' : 'Select a supplier'}
        />
        <LineItemsEditor
          items={purForm.lineItems ?? []}
          onChange={(items: LineItemInput[]) => setPurForm((f) => ({ ...f, lineItems: items }))}
        />
        <Input
          label="Tax Rate (%)"
          value={purForm.taxRate ? String(purForm.taxRate) : ''}
          onChangeText={(v) => setPurForm((f) => ({ ...f, taxRate: Number(v.replace(/[^0-9.]/g, '')) || 0 }))}
          placeholder="0"
          keyboardType="decimal-pad"
        />
        <Select
          label="Status"
          value={purForm.status}
          options={PURCHASE_STATUS_OPTIONS}
          onChange={(v) => setPurForm((f) => ({ ...f, status: v as PurchaseInput['status'] }))}
        />
        <DateField
          label="Order Date"
          value={purForm.orderDate ?? ''}
          onChange={(v) => setPurForm((f) => ({ ...f, orderDate: v }))}
        />
        <DateField
          label="Due Date"
          value={purForm.dueDate ?? ''}
          onChange={(v) => setPurForm((f) => ({ ...f, dueDate: v }))}
        />
        <Textarea
          label="Notes"
          value={purForm.notes ?? ''}
          onChangeText={(v) => setPurForm((f) => ({ ...f, notes: v }))}
          placeholder="Optional notes"
        />
      </FormModal>

      {/* Expense actions */}
      <ActionSheet
        visible={!!expSheet}
        onClose={() => setExpSheet(null)}
        title={expSheet?.category}
        actions={[
          { label: 'Edit', icon: 'create-outline', onPress: () => expSheet && openExpenseEdit(expSheet) },
          ...(isAdmin
            ? [
                {
                  label: 'Delete',
                  icon: 'trash-outline' as const,
                  destructive: true,
                  onPress: () => {
                    setExpDeleteErr(null);
                    setExpDelete(expSheet);
                  },
                },
              ]
            : []),
        ]}
      />
      <ConfirmModal
        visible={!!expDelete}
        onClose={() => setExpDelete(null)}
        onConfirm={() => expDelete && delExpense.mutate(expDelete.id)}
        title="Delete Entry"
        message={`Delete "${expDelete?.category}"? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        submitting={delExpense.isPending}
        error={expDeleteErr}
      />

      {/* Purchase actions */}
      <ActionSheet
        visible={!!purSheet}
        onClose={() => setPurSheet(null)}
        title={purSheet?.purchaseNumber}
        actions={[
          {
            label: 'Open',
            icon: 'open-outline',
            onPress: () => purSheet && router.push(`/(app)/purchase/${purSheet.id}`),
          },
          ...(purSheet && purSheet.paymentStatus !== 'PAID'
            ? [
                {
                  label: 'Mark as Paid',
                  icon: 'checkmark-circle-outline' as const,
                  onPress: () => purSheet && markPurchasePaid.mutate(purSheet.id),
                },
              ]
            : []),
          ...(isAdmin
            ? [
                {
                  label: 'Delete',
                  icon: 'trash-outline' as const,
                  destructive: true,
                  onPress: () => {
                    setPurActionErr(null);
                    setPurDelete(purSheet);
                  },
                },
              ]
            : []),
        ]}
      />
      <ConfirmModal
        visible={!!purDelete}
        onClose={() => setPurDelete(null)}
        onConfirm={() => purDelete && delPurchase.mutate(purDelete.id)}
        title="Delete Purchase"
        message={`Delete "${purDelete?.purchaseNumber}"? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        submitting={delPurchase.isPending}
        error={purActionErr}
      />
    </SafeAreaView>
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

const rowCard = {
  backgroundColor: staticColors.card,
  borderColor: staticColors.border,
  borderWidth: 1,
  borderRadius: radius.md,
  padding: spacing.md,
  marginBottom: spacing.sm,
};
