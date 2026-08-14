import React, { useState } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { purchasesApi, expensesApi, accountingApi } from '@/lib/endpoints';
import { Title, Loading, Badge } from '@/components/ui';
import { money, fmtDate } from '@/lib/salesMeta';
import {
  PURCHASE_STATUS_META,
  PURCHASE_PAYMENT_META,
  EXPENSE_TYPE_META,
  LEDGER_DIRECTION_META,
  LEDGER_SOURCE_LABEL,
} from '@/lib/financeMeta';
import { colors, spacing, radius, font } from '@/theme';
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

export default function FinanceScreen() {
  const router = useRouter();
  const [segment, setSegment] = useState<Segment>('purchases');

  const summary = useQuery({
    queryKey: ['financeSummary'],
    queryFn: (): Promise<FinancialSummary> => expensesApi.summary().then((r) => r.data.data),
  });

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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right']}>
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
              <View style={rowCard}>
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
              </View>
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
    </SafeAreaView>
  );
}

function Empty({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={{ alignItems: 'center', paddingTop: spacing.xxl }}>
      <Ionicons name={icon} size={40} color={colors.textDim} />
      <Text style={{ color: colors.textFaint, marginTop: spacing.md }}>{label}</Text>
    </View>
  );
}

const rowCard = {
  backgroundColor: colors.card,
  borderColor: colors.border,
  borderWidth: 1,
  borderRadius: radius.md,
  padding: spacing.md,
  marginBottom: spacing.sm,
};
