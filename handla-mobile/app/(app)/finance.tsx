import React, { useState } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
import { Loading, Badge, Input } from '@/components/ui';
import { GlassScreen, GradientHeader, GlassCard, StatCard, SectionLabel } from '@/components/glass';
import { DonutChart } from '@/components/charts';
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
import { money, fmtDate, statusMeta } from '@/lib/salesMeta';
import {
  PURCHASE_STATUS_META,
  PURCHASE_PAYMENT_META,
  EXPENSE_TYPE_META,
  LEDGER_DIRECTION_META,
} from '@/lib/financeMeta';
import { useT } from '@/i18n';
import { spacing, radius, font, useTheme } from '@/theme';
import type {
  PaginatedPurchases,
  PaginatedExpenses,
  PaginatedLedger,
  FinancialSummary,
  Purchase,
  Expense,
  LedgerEntry,
  PurchaseStatus,
} from '@/types';

type Segment = 'purchases' | 'expenses' | 'ledger';

const SEGMENTS: { key: Segment }[] = [
  { key: 'purchases' },
  { key: 'expenses' },
  { key: 'ledger' },
];

function SummaryHeader({ s }: { s?: FinancialSummary }) {
  const { colors } = useTheme();
  const { t } = useT();
  if (!s) return null;
  const hasFlow = s.totalIncome > 0 || s.totalExpenses > 0;
  return (
    <View style={{ marginBottom: spacing.md, gap: spacing.md }}>
      {hasFlow ? (
        <GlassCard raised>
          <SectionLabel style={{ marginBottom: spacing.md }}>{t('finance.incomeVsExpenses')}</SectionLabel>
          <DonutChart
            data={[
              { label: t('finance.income'), value: s.totalIncome, color: colors.success },
              { label: t('finance.expenses'), value: s.totalExpenses, color: colors.danger },
            ]}
            size={140}
            thickness={22}
            centerLabel={t('finance.net')}
            centerValue={money(s.netBalance)}
          />
        </GlassCard>
      ) : null}
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <StatCard label={t('finance.income')} value={money(s.totalIncome)} icon="arrow-down-outline" tint={colors.success} width="31%" />
        <StatCard label={t('finance.expenses')} value={money(s.totalExpenses)} icon="arrow-up-outline" tint={colors.danger} width="31%" />
        <StatCard
          label={t('finance.net')}
          value={money(s.netBalance)}
          icon="wallet-outline"
          tint={s.netBalance >= 0 ? colors.success : colors.danger}
          width="31%"
        />
      </View>
    </View>
  );
}

const PURCHASE_STATUS_VALUES: PurchaseStatus[] = ['DRAFT', 'ORDERED', 'RECEIVED', 'CANCELLED'];

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
  const { t } = useT();
  const router = useRouter();
  const qc = useQueryClient();
  const isStaff = useAuthStore((s) => s.isStaff());
  const isAdmin = useAuthStore((s) => s.isAdmin());
  const [segment, setSegment] = useState<Segment>('purchases');

  const purchaseStatusOptions: SelectOption[] = PURCHASE_STATUS_VALUES.map((v) => ({
    label: t(`status.${v}`),
    value: v,
  }));

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
    onError: (e) => setExpErr(apiError(e, t('finance.errors.saveExpense'))),
  });
  const submitExpense = () => {
    if (!expForm.category?.trim()) return setExpErr(t('finance.errors.categoryRequired'));
    if (!expForm.amount || Number(expForm.amount) <= 0) return setExpErr(t('finance.errors.amountPositive'));
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
    onError: (e) => setPurErr(apiError(e, t('finance.errors.createPurchase'))),
  });
  const submitPurchase = () => {
    if (!purForm.supplierId) return setPurErr(t('finance.errors.supplierRequired'));
    const items = (purForm.lineItems ?? []).filter((li) => li.description.trim());
    if (items.length === 0) return setPurErr(t('finance.errors.lineItemRequired'));
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
    onError: (e) => setExpDeleteErr(apiError(e, t('finance.errors.deleteExpense'))),
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
    onError: (e) => setPurActionErr(apiError(e, t('finance.errors.deletePurchase'))),
  });

  return (
    <GlassScreen>
      <GradientHeader title={t('finance.header')} icon="wallet-outline" />

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
                {t(`finance.segments.${s.key}`)}
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
          ListEmptyComponent={<Empty icon="cart-outline" label={t('finance.empty.purchases')} />}
          renderItem={({ item }: { item: Purchase }) => (
            <FinanceRow
              onPress={() => router.push(`/(app)/purchase/${item.id}`)}
              onLongPress={() => isStaff && setPurSheet(item)}
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
                {item.supplier?.company || item.supplier?.name || t('finance.supplier')}
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
                {(() => {
                  const s = statusMeta(PURCHASE_STATUS_META, item.status, t);
                  const pay = statusMeta(PURCHASE_PAYMENT_META, item.paymentStatus, t);
                  return (
                    <>
                      <Badge label={s.label} color={s.color} soft={s.soft} />
                      <Badge label={pay.label} color={pay.color} soft={pay.soft} />
                    </>
                  );
                })()}
              </View>
            </FinanceRow>
          )}
        />
      ) : segment === 'expenses' ? (
        <FlatList
          data={expenses.data?.expenses ?? []}
          keyExtractor={(e: Expense) => e.id}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
          ListHeaderComponent={<SummaryHeader s={summary.data} />}
          refreshControl={<RefreshControl refreshing={expenses.isFetching} onRefresh={refreshAll} tintColor={colors.accent} />}
          ListEmptyComponent={<Empty icon="cash-outline" label={t('finance.empty.expenses')} />}
          renderItem={({ item }: { item: Expense }) => {
            const m = EXPENSE_TYPE_META[item.type];
            return (
              <FinanceRow onPress={() => isStaff && setExpSheet(item)}>
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
                  <Badge label={t(`status.${item.type}`)} color={m.color} soft={m.soft} />
                  <Text style={{ color: colors.textFaint, fontSize: font.xs }}>
                    {fmtDate(item.expenseDate)}
                  </Text>
                </View>
                {item.description ? (
                  <Text style={{ color: colors.textFaint, fontSize: font.sm, marginTop: spacing.xs }} numberOfLines={1}>
                    {item.description}
                  </Text>
                ) : null}
              </FinanceRow>
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
          ListEmptyComponent={<Empty icon="book-outline" label={t('finance.empty.ledger')} />}
          renderItem={({ item }: { item: LedgerEntry }) => {
            const m = LEDGER_DIRECTION_META[item.direction];
            return (
              <FinanceRow>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: colors.text, fontSize: font.sm, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                    {item.account?.name || item.account?.code || t(`source.${item.sourceType}`)}
                  </Text>
                  <Text style={{ color: m.color, fontSize: font.md, fontWeight: '800', marginLeft: 8 }}>
                    {item.direction === 'OUT' ? '-' : '+'}
                    {money(item.amount, item.currency)}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm }}>
                  <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                    <Badge label={t(`status.${item.direction}`)} color={m.color} soft={m.soft} />
                    <Text style={{ color: colors.textDim, fontSize: font.xs }}>
                      {t(`source.${item.sourceType}`)}
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
              </FinanceRow>
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
        title={expEditing ? t('finance.expenseForm.titleEdit') : t('finance.expenseForm.titleNew')}
        onSubmit={submitExpense}
        submitting={saveExpense.isPending}
        error={expErr}
      >
        <Select
          label={t('finance.expenseForm.type')}
          value={expForm.type}
          options={[
            { label: t('status.EXPENSE'), value: 'EXPENSE' },
            { label: t('status.INCOME'), value: 'INCOME' },
          ]}
          onChange={(v) => setExpForm((f) => ({ ...f, type: v as ExpenseInput['type'] }))}
        />
        <Input
          label={t('finance.expenseForm.category')}
          value={expForm.category ?? ''}
          onChangeText={(v) => setExpForm((f) => ({ ...f, category: v }))}
          placeholder={t('finance.expenseForm.categoryPlaceholder')}
        />
        <Input
          label={t('finance.expenseForm.amount')}
          value={expForm.amount ? String(expForm.amount) : ''}
          onChangeText={(v) => setExpForm((f) => ({ ...f, amount: Number(v.replace(/[^0-9.]/g, '')) || 0 }))}
          placeholder="0.00"
          keyboardType="decimal-pad"
        />
        <DateField
          label={t('finance.expenseForm.date')}
          value={expForm.expenseDate}
          onChange={(v) => setExpForm((f) => ({ ...f, expenseDate: v }))}
        />
        <Textarea
          label={t('finance.expenseForm.description')}
          value={expForm.description ?? ''}
          onChangeText={(v) => setExpForm((f) => ({ ...f, description: v }))}
          placeholder={t('finance.expenseForm.descriptionPlaceholder')}
        />
      </FormModal>

      {/* Purchase create */}
      <FormModal
        visible={purOpen}
        onClose={() => setPurOpen(false)}
        title={t('finance.purchaseForm.title')}
        onSubmit={submitPurchase}
        submitting={savePurchase.isPending}
        error={purErr}
      >
        <Select
          label={t('finance.purchaseForm.supplier')}
          value={purForm.supplierId}
          options={supplierOptions}
          onChange={(v) => setPurForm((f) => ({ ...f, supplierId: v }))}
          placeholder={supplierList.isLoading ? t('finance.purchaseForm.loading') : t('finance.purchaseForm.selectSupplier')}
        />
        <LineItemsEditor
          items={purForm.lineItems ?? []}
          onChange={(items: LineItemInput[]) => setPurForm((f) => ({ ...f, lineItems: items }))}
        />
        <Input
          label={t('finance.purchaseForm.taxRate')}
          value={purForm.taxRate ? String(purForm.taxRate) : ''}
          onChangeText={(v) => setPurForm((f) => ({ ...f, taxRate: Number(v.replace(/[^0-9.]/g, '')) || 0 }))}
          placeholder="0"
          keyboardType="decimal-pad"
        />
        <Select
          label={t('finance.purchaseForm.status')}
          value={purForm.status}
          options={purchaseStatusOptions}
          onChange={(v) => setPurForm((f) => ({ ...f, status: v as PurchaseInput['status'] }))}
        />
        <DateField
          label={t('finance.purchaseForm.orderDate')}
          value={purForm.orderDate ?? ''}
          onChange={(v) => setPurForm((f) => ({ ...f, orderDate: v }))}
        />
        <DateField
          label={t('finance.purchaseForm.dueDate')}
          value={purForm.dueDate ?? ''}
          onChange={(v) => setPurForm((f) => ({ ...f, dueDate: v }))}
        />
        <Textarea
          label={t('finance.purchaseForm.notes')}
          value={purForm.notes ?? ''}
          onChangeText={(v) => setPurForm((f) => ({ ...f, notes: v }))}
          placeholder={t('finance.purchaseForm.notesPlaceholder')}
        />
      </FormModal>

      {/* Expense actions */}
      <ActionSheet
        visible={!!expSheet}
        onClose={() => setExpSheet(null)}
        title={expSheet?.category}
        actions={[
          { label: t('finance.actions.edit'), icon: 'create-outline', onPress: () => expSheet && openExpenseEdit(expSheet) },
          ...(isAdmin
            ? [
                {
                  label: t('finance.actions.delete'),
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
        title={t('finance.deleteEntry.title')}
        message={t('finance.deleteEntry.message', { name: expDelete?.category ?? '' })}
        confirmLabel={t('finance.actions.delete')}
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
            label: t('finance.actions.open'),
            icon: 'open-outline',
            onPress: () => purSheet && router.push(`/(app)/purchase/${purSheet.id}`),
          },
          ...(purSheet && purSheet.paymentStatus !== 'PAID'
            ? [
                {
                  label: t('finance.actions.markPaid'),
                  icon: 'checkmark-circle-outline' as const,
                  onPress: () => purSheet && markPurchasePaid.mutate(purSheet.id),
                },
              ]
            : []),
          ...(isAdmin
            ? [
                {
                  label: t('finance.actions.delete'),
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
        title={t('finance.deletePurchase.title')}
        message={t('finance.deletePurchase.message', { name: purDelete?.purchaseNumber ?? '' })}
        confirmLabel={t('finance.actions.delete')}
        destructive
        submitting={delPurchase.isPending}
        error={purActionErr}
      />
    </GlassScreen>
  );
}

function FinanceRow({
  children,
  onPress,
  onLongPress,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  return (
    <GlassCard onPress={onPress} padded={false} style={{ marginBottom: spacing.sm }}>
      <Pressable onLongPress={onLongPress} style={{ padding: spacing.md }}>
        {children}
      </Pressable>
    </GlassCard>
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
