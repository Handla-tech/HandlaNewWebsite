import React, { useMemo, useState } from 'react';
import { View, Text, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/endpoints';
import type { AnalyticsQuery } from '@/lib/endpoints';
import { Loading, Chip } from '@/components/ui';
import { GlassScreen, GlassScrollView, GradientHeader, GlassCard, StatCard, SectionLabel } from '@/components/glass';
import { AreaChart, BarList } from '@/components/charts';
import { spacing, useTheme } from '@/theme';
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

// ─── Top-N list section — chart-kit BarList wrapped in a glass card ───────────
function TopSection({ title, data, emptyLabel }: { title: string; data?: AnalyticsTopResult; emptyLabel: string }) {
  const rows = (data?.rows ?? []).map((r) => ({ key: r.key || '(none)', count: r.count }));
  return (
    <View style={{ marginTop: spacing.lg }}>
      <SectionLabel style={{ marginBottom: spacing.xs }}>{title}</SectionLabel>
      <GlassCard>
        <BarList rows={rows} emptyLabel={emptyLabel} formatValue={compact} />
      </GlassCard>
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
  const series = timeseries.data?.series ?? [];
  const pvValues = series.map((p) => p.pageviews);
  const pvLabels = series.map((p) => p.bucket);

  return (
    <GlassScreen>
      <GradientHeader title="Analytics" icon="bar-chart-outline" />

      {overview.isLoading ? (
        <Loading />
      ) : (
        <GlassScrollView
          refreshControl={<RefreshControl refreshing={anyFetching} onRefresh={refreshAll} tintColor={colors.accent} />}
        >
          {/* Range presets */}
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
            {RANGE_PRESETS.map((r) => (
              <Chip key={r.key} label={r.label} active={rangeKey === r.key} onPress={() => setRangeKey(r.key)} />
            ))}
          </View>

          {/* KPI grid */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <StatCard label="Pageviews" value={compact(o?.pageviews ?? 0)} icon="eye-outline" width="31%" />
            <StatCard label="Visitors" value={compact(o?.uniqueVisitors ?? 0)} icon="people-outline" width="31%" />
            <StatCard label="Sessions" value={compact(o?.sessions ?? 0)} icon="time-outline" width="31%" />
            <StatCard label="Events" value={compact(o?.events ?? 0)} icon="flash-outline" width="31%" />
            <StatCard label="Bounce" value={pct(o?.bounceRate ?? 0)} icon="exit-outline" width="31%" />
            <StatCard label="Views/Sess" value={(o?.viewsPerSession ?? 0).toFixed(1)} icon="layers-outline" width="31%" />
          </View>

          {/* Pageviews over time */}
          <View style={{ marginTop: spacing.lg }}>
            <SectionLabel style={{ marginBottom: spacing.xs }}>Pageviews over time</SectionLabel>
            <GlassCard>
              {pvValues.length > 0 ? (
                <AreaChart values={pvValues} labels={pvLabels} height={160} />
              ) : (
                <View style={{ height: 140, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: colors.textFaint, fontSize: 13 }}>No traffic in this range.</Text>
                </View>
              )}
            </GlassCard>
          </View>

          <TopSection title="Top Pages" data={topPages.data} emptyLabel="No page data." />
          <TopSection title="Top Referrers" data={topReferrers.data} emptyLabel="No referrer data." />
          <TopSection title="Devices" data={devices.data} emptyLabel="No device data." />
          <TopSection title="Browsers" data={browsers.data} emptyLabel="No browser data." />
          <TopSection title="Countries" data={countries.data} emptyLabel="No country data." />
          <TopSection title="Top Events" data={topEvents.data} emptyLabel="No event data." />
        </GlassScrollView>
      )}
    </GlassScreen>
  );
}
