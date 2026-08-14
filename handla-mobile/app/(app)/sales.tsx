import React, { useState } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { quotationsApi, contractsApi, invoicesApi } from '@/lib/endpoints';
import { useAuthStore } from '@/store/authStore';
import { Title, Loading, Badge } from '@/components/ui';
import {
  QUOTATION_STATUS_META,
  CONTRACT_STATUS_META,
  INVOICE_STATUS_META,
  money,
  fmtDate,
} from '@/lib/salesMeta';
import { colors, spacing, radius, font } from '@/theme';
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
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius.md,
          padding: spacing.md,
          marginBottom: spacing.sm,
        },
        pressed && { opacity: 0.85 },
      ]}
    >
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
    </Pressable>
  );
}

export default function SalesScreen() {
  const router = useRouter();
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right']}>
      <View style={{ padding: spacing.lg, paddingBottom: spacing.sm }}>
        <Title>Sales</Title>
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
              badge={QUOTATION_STATUS_META[item.status]}
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
              badge={CONTRACT_STATUS_META[item.status]}
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
              badge={INVOICE_STATUS_META[item.paymentStatus]}
              onPress={() => router.push(`/(app)/invoice/${item.id}`)}
            />
          )}
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
