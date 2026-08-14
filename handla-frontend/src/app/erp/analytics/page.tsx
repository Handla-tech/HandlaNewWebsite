'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart as LineChartIcon, Eye, MousePointerClick, Users, Layers,
  TrendingDown, Repeat, Globe, Monitor, Smartphone, Tablet, Chrome,
  FileText, ExternalLink, Loader2, RefreshCw, BarChart3,
} from 'lucide-react';
import { analyticsApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtNum(n: number | null | undefined) {
  return Number(n ?? 0).toLocaleString('en-US');
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

const inputCls =
  'w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-white/25 outline-none transition focus:border-amber-500/40 focus:bg-black/60';

const RANGE_PRESETS: { label: string; days: number }[] = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
];

// ─── Small pieces ─────────────────────────────────────────────────────────────

function KpiCard({ label, value, icon: Icon, suffix = '' }: {
  label: string; value: string; icon: any; suffix?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-semibold text-white/25 uppercase tracking-wide">{label}</p>
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <p className="text-xl font-bold text-white">{value}<span className="text-sm text-white/40">{suffix}</span></p>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children }: { title: string; icon?: any; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
        {Icon && <Icon className="w-4 h-4 text-amber-400/70" />}
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function EmptyRow({ text }: { text?: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <BarChart3 className="w-7 h-7 text-white/15 mb-2" />
      <p className="text-sm text-white/40">{text ?? t('erp.analytics.noData')}</p>
    </div>
  );
}

/** A minimal, dependency-free horizontal bar list. */
function BarList({ rows, labelFmt }: {
  rows: { key: string; count: number; visitors: number }[];
  labelFmt?: (k: string) => string;
}) {
  const { t } = useTranslation();
  if (!rows?.length) return <EmptyRow />;
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div className="p-3 space-y-1.5">
      {rows.map((r) => (
        <div key={r.key} className="relative">
          <div
            className="absolute inset-y-0 left-0 rounded-lg bg-amber-500/10"
            style={{ width: `${(r.count / max) * 100}%` }}
          />
          <div className="relative flex items-center justify-between px-2.5 py-1.5 text-sm">
            <span className="truncate text-white/70 max-w-[70%]" title={r.key}>
              {labelFmt ? labelFmt(r.key) : (r.key || '—')}
            </span>
            <span className="text-white/50 tabular-nums">
              {fmtNum(r.count)}
              <span className="text-white/25 text-xs"> · {fmtNum(r.visitors)}{t('erp.analytics.unitSuffix')}</span>
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Tiny inline SVG sparkline for the pageviews time-series. */
function Sparkline({ series }: { series: { bucket: string; pageviews: number; visitors: number }[] }) {
  if (!series?.length) return <EmptyRow />;
  const W = 640, H = 140, P = 8;
  const max = Math.max(...series.map((s) => s.pageviews), 1);
  const n = series.length;
  const x = (i: number) => (n <= 1 ? P : P + (i * (W - 2 * P)) / (n - 1));
  const y = (v: number) => H - P - (v / max) * (H - 2 * P);
  const line = series.map((s, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(s.pageviews).toFixed(1)}`).join(' ');
  const area = `${line} L ${x(n - 1).toFixed(1)} ${H - P} L ${x(0).toFixed(1)} ${H - P} Z`;
  return (
    <div className="p-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-36" preserveAspectRatio="none">
        <defs>
          <linearGradient id="anlGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#anlGrad)" />
        <path d={line} fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="flex justify-between text-[10px] text-white/30 mt-1">
        <span>{series[0]?.bucket}</span>
        <span>{series[series.length - 1]?.bucket}</span>
      </div>
    </div>
  );
}

const DEVICE_ICON: Record<string, any> = {
  desktop: Monitor, mobile: Smartphone, tablet: Tablet,
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(today());
  const [interval, setInterval] = useState<'hour' | 'day' | 'month'>('day');

  const params = useMemo(() => ({ from, to }), [from, to]);
  const tsParams = useMemo(() => ({ from, to, interval }), [from, to, interval]);

  const overview = useQuery({
    queryKey: ['erp-anl-overview', params],
    queryFn: () => analyticsApi.overview(params).then((r) => r.data.data),
    enabled: mounted, placeholderData: (p) => p, staleTime: 15_000,
  });
  const timeseries = useQuery({
    queryKey: ['erp-anl-timeseries', tsParams],
    queryFn: () => analyticsApi.timeseries(tsParams).then((r) => r.data.data),
    enabled: mounted, placeholderData: (p) => p, staleTime: 15_000,
  });
  const topPages = useQuery({
    queryKey: ['erp-anl-pages', params],
    queryFn: () => analyticsApi.topPages(params).then((r) => r.data.data),
    enabled: mounted, placeholderData: (p) => p, staleTime: 15_000,
  });
  const topReferrers = useQuery({
    queryKey: ['erp-anl-referrers', params],
    queryFn: () => analyticsApi.topReferrers(params).then((r) => r.data.data),
    enabled: mounted, placeholderData: (p) => p, staleTime: 15_000,
  });
  const devices = useQuery({
    queryKey: ['erp-anl-devices', params],
    queryFn: () => analyticsApi.devices(params).then((r) => r.data.data),
    enabled: mounted, placeholderData: (p) => p, staleTime: 15_000,
  });
  const browsers = useQuery({
    queryKey: ['erp-anl-browsers', params],
    queryFn: () => analyticsApi.browsers(params).then((r) => r.data.data),
    enabled: mounted, placeholderData: (p) => p, staleTime: 15_000,
  });
  const countries = useQuery({
    queryKey: ['erp-anl-countries', params],
    queryFn: () => analyticsApi.countries(params).then((r) => r.data.data),
    enabled: mounted, placeholderData: (p) => p, staleTime: 15_000,
  });
  const topEvents = useQuery({
    queryKey: ['erp-anl-events', params],
    queryFn: () => analyticsApi.topEvents(params).then((r) => r.data.data),
    enabled: mounted, placeholderData: (p) => p, staleTime: 15_000,
  });

  const anyFetching =
    overview.isFetching || timeseries.isFetching || topPages.isFetching;

  const refetchAll = () => {
    overview.refetch(); timeseries.refetch(); topPages.refetch();
    topReferrers.refetch(); devices.refetch(); browsers.refetch();
    countries.refetch(); topEvents.refetch();
  };

  const applyPreset = (days: number) => { setFrom(daysAgo(days)); setTo(today()); };

  if (!mounted) return null;

  const ov = overview.data;
  const dv = devices.data?.rows ?? [];
  const dvMax = Math.max(...dv.map((r: any) => r.count), 1);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20">
            <LineChartIcon className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">{t('erp.analytics.title')}</h1>
            <p className="text-xs text-white/40">{t('erp.analytics.subtitle')}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
            {RANGE_PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => applyPreset(p.days)}
                className="rounded-lg px-2.5 py-1.5 text-xs text-white/50 hover:text-white/80 hover:bg-white/[0.06] transition min-h-[32px]"
              >
                {p.label}
              </button>
            ))}
          </div>
          <div>
            <label className="block text-[10px] uppercase text-white/30 mb-1">{t('erp.analytics.from')}</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={cn(inputCls, 'w-auto')} />
          </div>
          <div>
            <label className="block text-[10px] uppercase text-white/30 mb-1">{t('erp.analytics.to')}</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={cn(inputCls, 'w-auto')} />
          </div>
          <button
            onClick={refetchAll}
            className="flex h-[42px] min-h-[42px] items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white/70 transition hover:bg-white/[0.06]"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', anyFetching && 'animate-spin')} />
            {t('erp.analytics.refresh')}
          </button>
        </div>
      </div>

      {/* KPIs */}
      {overview.isLoading ? (
        <div className="flex items-center justify-center py-14">
          <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label={t('erp.analytics.kpi.pageviews')} value={fmtNum(ov?.pageviews)} icon={Eye} />
          <KpiCard label={t('erp.analytics.kpi.events')} value={fmtNum(ov?.events)} icon={MousePointerClick} />
          <KpiCard label={t('erp.analytics.kpi.visitors')} value={fmtNum(ov?.uniqueVisitors)} icon={Users} />
          <KpiCard label={t('erp.analytics.kpi.sessions')} value={fmtNum(ov?.sessions)} icon={Layers} />
          <KpiCard label={t('erp.analytics.kpi.bounceRate')} value={`${ov?.bounceRate ?? 0}`} suffix="%" icon={TrendingDown} />
          <KpiCard label={t('erp.analytics.kpi.viewsPerSession')} value={`${ov?.viewsPerSession ?? 0}`} icon={Repeat} />
        </div>
      )}

      {/* Traffic over time */}
      <SectionCard title={t('erp.analytics.sections.trafficOverTime')} icon={LineChartIcon}>
        <div className="flex items-center gap-1 px-4 pt-3">
          {(['hour', 'day', 'month'] as const).map((iv) => (
            <button
              key={iv}
              onClick={() => setInterval(iv)}
              className={cn(
                'rounded-lg px-2.5 py-1 text-xs transition',
                interval === iv ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : 'text-white/40 hover:text-white/70',
              )}
            >
              {t(`erp.analytics.interval.${iv}`)}
            </button>
          ))}
        </div>
        {timeseries.isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 text-amber-400 animate-spin" /></div>
        ) : (
          <Sparkline series={timeseries.data?.series ?? []} />
        )}
      </SectionCard>

      {/* Pages + Referrers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title={t('erp.analytics.sections.topPages')} icon={FileText}>
          <BarList rows={topPages.data?.rows ?? []} />
        </SectionCard>
        <SectionCard title={t('erp.analytics.sections.topReferrers')} icon={ExternalLink}>
          <BarList rows={topReferrers.data?.rows ?? []} labelFmt={(k) => k || t('erp.analytics.direct')} />
        </SectionCard>
      </div>

      {/* Devices + Browsers + Countries */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard title={t('erp.analytics.sections.devices')} icon={Monitor}>
          {dv.length === 0 ? <EmptyRow /> : (
            <div className="p-3 space-y-2">
              {dv.map((r: any) => {
                const Icon = DEVICE_ICON[r.key] ?? Monitor;
                return (
                  <div key={r.key} className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] text-white/60">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-white/70 capitalize">{r.key || '—'}</span>
                        <span className="text-white/40">{fmtNum(r.count)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                        <div className="h-full bg-amber-500/50" style={{ width: `${(r.count / dvMax) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
        <SectionCard title={t('erp.analytics.sections.browsers')} icon={Chrome}>
          <BarList rows={browsers.data?.rows ?? []} />
        </SectionCard>
        <SectionCard title={t('erp.analytics.sections.countries')} icon={Globe}>
          <BarList rows={countries.data?.rows ?? []} />
        </SectionCard>
      </div>

      {/* Top events */}
      <SectionCard title={t('erp.analytics.sections.topEvents')} icon={MousePointerClick}>
        <BarList rows={topEvents.data?.rows ?? []} />
      </SectionCard>
    </div>
  );
}
