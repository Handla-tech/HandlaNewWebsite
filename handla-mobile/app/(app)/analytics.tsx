import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { analyticsApi } from '@/lib/endpoints';
import type { AnalyticsQuery } from '@/lib/endpoints';
import { Title, Loading, Chip } from '@/components/ui';
import { spacing, radius, font, useTheme, colors as staticColors } from '@/theme';
import type {
  AnalyticsOverview,
  AnalyticsTimeseries,
  AnalyticsTopResult,
  AnalyticsInterval,
} from '@/types';

// ─── helpers ─────────────────────────────────────────────────────────────────
function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n ?? 0);
}
function pct(n: number): string {
  return `${(n ?? 0).toFixed(1)}%`;
}

const RANGE_PRESETS = [
  { key: '7', label: '7d', days: 7, interval: 'day' as AnalyticsInterval },
  { key: '30', label: '30d', days: 30, interval: 'day' as AnalyticsInterval },
  { key: '90', label: '90d', days: 90, interval: 'month' as AnalyticsInterval },
];

// ─── KPI card ──────────────────────────────────────────────────────────────────
function Kpi({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: '31%',
        backgroundColor: colors.card,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: radius.md,
        padding: spacing.md,
      }}
    >
      <Text style={{ color: colors.text, fontSize: font.lg, fontWeight: '800' }} numberOfLines={1}>
        {value}
      </Text>
      <Text style={{ color: colors.textFaint, fontSize: font.xs, marginTop: 2 }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

// ─── View-based bar chart (dependency-free) ──────────────────────────────────
function BarChart({ ts }: { ts?: AnalyticsTimeseries }) {
  const { colors } = useTheme();
  const series = ts?.series ?? [];
  const max = Math.max(1, ...series.map((p) => p.pageviews));
  if (series.length === 0) {
    return (
      <View style={{ height: 140, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.textFaint, fontSize: font.sm }}>No traffic in this range.</Text>
      </View>
    );
  }
  // Show at most the last ~30 buckets to keep bars legible.
  const shown = series.slice(-30);
  return (
    <View style={{ height: 150 }}>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
        {shown.map((p, i) => {
          const h = Math.max(2, Math.round((p.pageviews / max) * 120));
          return (
            <View key={`${p.bucket}-${i}`} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
              <View
                style={{
                  width: '78%',
                  height: h,
                  backgroundColor: colors.accent,
                  borderTopLeftRadius: 3,
                  borderTopRightRadius: 3,
                  opacity: 0.85,
                }}
              />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs }}>
        <Text style={{ color: colors.textDim, fontSize: 10 }}>{shown[0]?.bucket}</Text>
        <Text style={{ color: colors.textDim, fontSize: 10 }}>{shown[shown.length - 1]?.bucket}</Text>
      </View>
    </View>
  );
}

// ─── Top-N list with proportional bars ────────────────────────────────────────
function BarList({ title, data, emptyLabel }: { title: string; data?: AnalyticsTopResult; emptyLabel: string }) {
  const { colors } = useTheme();
  const rows = data?.rows ?? [];
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <View style={{ marginTop: spacing.lg }}>
      <Text style={sectionLabel}>{title}</Text>
      <View style={cardStyle}>
        {rows.length === 0 ? (
          <Text style={{ color: colors.textFaint, fontSize: font.sm }}>{emptyLabel}</Text>
        ) : (
          rows.map((r, i) => (
            <View key={`${r.key}-${i}`} style={{ marginBottom: i === rows.length - 1 ? 0 : spacing.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                <Text style={{ color: colors.text, fontSize: font.sm, flex: 1 }} numberOfLines={1}>
                  {r.key || '(none)'}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: font.sm, fontWeight: '700', marginLeft: 8 }}>
                  {compact(r.count)}
                </Text>
              </View>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.cardAlt, overflow: 'hidden' }}>
                <View
                  style={{
                    width: `${Math.round((r.count / max) * 100)}%`,
                    height: '100%',
                    backgroundColor: colors.accent,
                    opacity: 0.8,
                  }}
                />
              </View>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

export default function AnalyticsScreen() {
  const { colors } = useTheme();
  const [rangeKey, setRangeKey] = useState('30');
  const preset = RANGE_PRESETS.find((r) => r.key === rangeKey) ?? RANGE_PRESETS[1];

  const params: AnalyticsQuery = useMemo(
    () => ({ from: isoDaysAgo(preset.days), to: todayIso(), interval: preset.interval, limit: 8 }),
    [preset.days, preset.interval],
  );

  const overview = useQuery({
    queryKey: ['an-overview', rangeKey],
    queryFn: (): Promise<AnalyticsOverview> => analyticsApi.overview(params).then((r) => r.data.data),
  });
  const timeseries = useQuery({
    queryKey: ['an-timeseries', rangeKey],
    queryFn: (): Promise<AnalyticsTimeseries> => analyticsApi.timeseries(params).then((r) => r.data.data),
  });
  const topPages = useQuery({
    queryKey: ['an-pages', rangeKey],
    queryFn: (): Promise<AnalyticsTopResult> => analyticsApi.topPages(params).then((r) => r.data.data),
  });
  const topReferrers = useQuery({
    queryKey: ['an-referrers', rangeKey],
    queryFn: (): Promise<AnalyticsTopResult> => analyticsApi.topReferrers(params).then((r) => r.data.data),
  });
  const devices = useQuery({
    queryKey: ['an-devices', rangeKey],
    queryFn: (): Promise<AnalyticsTopResult> => analyticsApi.devices(params).then((r) => r.data.data),
  });
  const browsers = useQuery({
    queryKey: ['an-browsers', rangeKey],
    queryFn: (): Promise<AnalyticsTopResult> => analyticsApi.browsers(params).then((r) => r.data.data),
  });
  const countries = useQuery({
    queryKey: ['an-countries', rangeKey],
    queryFn: (): Promise<AnalyticsTopResult> => analyticsApi.countries(params).then((r) => r.data.data),
  });
  const topEvents = useQuery({
    queryKey: ['an-events', rangeKey],
    queryFn: (): Promise<AnalyticsTopResult> => analyticsApi.topEvents(params).then((r) => r.data.data),
  });

  const refreshAll = () => {
    [overview, timeseries, topPages, topReferrers, devices, browsers, countries, topEvents].forEach((q) =>
      q.refetch(),
    );
  };

  const o = overview.data;
  const anyFetching = overview.isFetching || timeseries.isFetching;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right']}>
      <View style={{ padding: spacing.lg, paddingBottom: spacing.sm }}>
        <Title>Analytics</Title>
      </View>

      {overview.isLoading ? (
        <Loading />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
          refreshControl={<RefreshControl refreshing={anyFetching} onRefresh={refreshAll} tintColor={colors.accent} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Range presets */}
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
            {RANGE_PRESETS.map((r) => (
              <Chip key={r.key} label={r.label} active={rangeKey === r.key} onPress={() => setRangeKey(r.key)} />
            ))}
          </View>

          {/* KPI grid */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <Kpi label="Pageviews" value={compact(o?.pageviews ?? 0)} />
            <Kpi label="Visitors" value={compact(o?.uniqueVisitors ?? 0)} />
            <Kpi label="Sessions" value={compact(o?.sessions ?? 0)} />
            <Kpi label="Events" value={compact(o?.events ?? 0)} />
            <Kpi label="Bounce" value={pct(o?.bounceRate ?? 0)} />
            <Kpi label="Views/Sess" value={(o?.viewsPerSession ?? 0).toFixed(1)} />
          </View>

          {/* Pageviews over time */}
          <View style={{ marginTop: spacing.lg }}>
            <Text style={sectionLabel}>Pageviews over time</Text>
            <View style={cardStyle}>
              <BarChart ts={timeseries.data} />
            </View>
          </View>

          <BarList title="Top Pages" data={topPages.data} emptyLabel="No page data." />
          <BarList title="Top Referrers" data={topReferrers.data} emptyLabel="No referrer data." />
          <BarList title="Devices" data={devices.data} emptyLabel="No device data." />
          <BarList title="Browsers" data={browsers.data} emptyLabel="No browser data." />
          <BarList title="Countries" data={countries.data} emptyLabel="No country data." />
          <BarList title="Top Events" data={topEvents.data} emptyLabel="No event data." />
        </ScrollView>
      )}
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
