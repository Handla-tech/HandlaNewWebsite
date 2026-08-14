import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl, ScrollView } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supportApi } from '@/lib/endpoints';
import type { TicketsQuery } from '@/lib/endpoints';
import { useAuthStore } from '@/store/authStore';
import { Loading, Badge, Chip } from '@/components/ui';
import { GlassScreen, GradientHeader, GlassCard, StatCard } from '@/components/glass';
import { STATUS_META, PRIORITY_META, STATUS_ORDER } from '@/lib/ticketMeta';
import { statusMeta } from '@/lib/salesMeta';
import { spacing, radius, font, useTheme } from '@/theme';
import { useT } from '@/i18n';
import type { PaginatedTickets, SupportStats, TicketStatus, Ticket } from '@/types';

type TFn = (key: string, params?: Record<string, string | number>) => string;

function timeAgo(iso: string | undefined, t: TFn) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return t('support.time.now');
  if (m < 60) return t('support.time.minutes', { n: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t('support.time.hours', { n: h });
  const d = Math.floor(h / 24);
  if (d < 30) return t('support.time.days', { n: d });
  return new Date(iso).toLocaleDateString();
}

export default function SupportListScreen() {
  const { t } = useT();
  const { colors } = useTheme();
  const router = useRouter();
  const isStaff = useAuthStore((s) => s.isStaff());
  const [status, setStatus] = useState<TicketStatus | null>(null);

  const query: TicketsQuery = useMemo(
    () => ({ limit: 50, ...(status ? { status } : {}) }),
    [status],
  );

  const tickets = useQuery({
    queryKey: ['tickets', status],
    queryFn: (): Promise<PaginatedTickets> =>
      supportApi.getTickets(query).then((r) => r.data.data),
  });

  const stats = useQuery({
    queryKey: ['supportStats'],
    enabled: isStaff,
    queryFn: (): Promise<SupportStats> => supportApi.getStats().then((r) => r.data.data),
  });

  const rows = tickets.data?.tickets ?? [];

  return (
    <GlassScreen>
      <GradientHeader
        title={t('support.title')}
        icon="headset-outline"
        right={
          <Pressable
            onPress={() => router.push('/(app)/ticket/new')}
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: colors.accent,
                borderRadius: radius.pill,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm - 2,
              },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Ionicons name="add" size={16} color="#0a0a0a" />
            <Text style={{ color: '#0a0a0a', fontWeight: '800', fontSize: font.sm }}>{t('support.new')}</Text>
          </Pressable>
        }
      />

      <FlatList
        data={rows}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
        refreshControl={
          <RefreshControl
            refreshing={tickets.isFetching}
            onRefresh={() => {
              tickets.refetch();
              if (isStaff) stats.refetch();
            }}
            tintColor={colors.accent}
          />
        }
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.md }}>
            {isStaff && stats.data && (
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
                <StatCard label={t('support.stats.total')} value={String(stats.data.total)} icon="albums-outline" width="31%" />
                <StatCard label={t('support.stats.open')} value={String(stats.data.open)} icon="radio-outline" tint={colors.info} width="31%" />
                <StatCard
                  label={t('support.stats.slaBreach')}
                  value={String(stats.data.slaBreached)}
                  icon="alert-circle-outline"
                  tint={stats.data.slaBreached > 0 ? colors.danger : colors.text}
                  width="31%"
                />
              </View>
            )}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.sm, paddingVertical: 2 }}
            >
              <Chip label={t('support.all')} active={status === null} onPress={() => setStatus(null)} />
              {STATUS_ORDER.map((s) => (
                <Chip
                  key={s}
                  label={t(`status.${s}`)}
                  active={status === s}
                  onPress={() => setStatus(status === s ? null : s)}
                />
              ))}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          tickets.isLoading ? (
            <View style={{ paddingTop: spacing.xxl }}>
              <Loading />
            </View>
          ) : (
            <View style={{ alignItems: 'center', paddingTop: spacing.xxl }}>
              <Ionicons name="ticket-outline" size={40} color={colors.textDim} />
              <Text style={{ color: colors.textFaint, marginTop: spacing.md }}>
                {status ? t('support.emptyFiltered') : t('support.empty')}
              </Text>
            </View>
          )
        }
        renderItem={({ item }: { item: Ticket }) => {
          const st = statusMeta(STATUS_META, item.status, t);
          const pr = statusMeta(PRIORITY_META, item.priority, t);
          const clientName = item.client?.company || item.client?.user?.name;
          return (
            <GlassCard
              onPress={() => router.push(`/(app)/ticket/${item.id}`)}
              padded={false}
              style={{
                marginBottom: spacing.sm,
                borderColor: item.slaBreached ? colors.danger : undefined,
              }}
            >
              <View style={{ padding: spacing.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: colors.accent, fontSize: font.xs, fontWeight: '700' }}>
                  {item.ticketNumber}
                </Text>
                <Text style={{ color: colors.textDim, fontSize: font.xs }}>
                  {timeAgo(item.updatedAt || item.createdAt, t)}
                </Text>
              </View>
              <Text
                style={{ color: colors.text, fontSize: font.md, fontWeight: '700', marginTop: 4 }}
                numberOfLines={2}
              >
                {item.subject}
              </Text>
              {isStaff && clientName ? (
                <Text style={{ color: colors.textFaint, fontSize: font.sm, marginTop: 2 }} numberOfLines={1}>
                  {clientName}
                </Text>
              ) : null}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  marginTop: spacing.sm,
                  flexWrap: 'wrap',
                }}
              >
                <Badge label={st.label} color={st.color} soft={st.soft} />
                <Badge label={pr.label} color={pr.color} soft={pr.soft} />
                {item.slaBreached && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <Ionicons name="alert-circle" size={13} color={colors.danger} />
                    <Text style={{ color: colors.danger, fontSize: font.xs, fontWeight: '700' }}>
                      {t('support.sla')}
                    </Text>
                  </View>
                )}
              </View>
              </View>
            </GlassCard>
          );
        }}
      />
    </GlassScreen>
  );
}
