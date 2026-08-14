'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3, TrendingUp, TrendingDown, DollarSign, Wallet, Receipt,
  Clock, Users, FolderKanban, LifeBuoy, Loader2, AlertCircle, RefreshCw,
} from 'lucide-react';
import { reportsApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, currency = '') {
  const v = Number(n ?? 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency && currency !== 'UNSPECIFIED' ? `${currency} ${v}` : v;
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function startOfYear() {
  return `${new Date().getFullYear()}-01-01`;
}
function endOfYear() {
  return `${new Date().getFullYear()}-12-31`;
}

const inputCls =
  'w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-white/25 outline-none transition focus:border-amber-500/40 focus:bg-black/60';

// ─── Report tabs ──────────────────────────────────────────────────────────────

type ReportTab =
  | 'profit-loss' | 'cash-flow' | 'tax-summary' | 'ar-aging' | 'ap-aging'
  | 'revenue' | 'projects' | 'support';

const TABS: { id: ReportTab; icon: any; group: 'Financial' | 'Operational' }[] = [
  { id: 'profit-loss', icon: TrendingUp,    group: 'Financial' },
  { id: 'cash-flow',   icon: Wallet,        group: 'Financial' },
  { id: 'tax-summary', icon: Receipt,       group: 'Financial' },
  { id: 'ar-aging',    icon: Clock,         group: 'Financial' },
  { id: 'ap-aging',    icon: Clock,         group: 'Financial' },
  { id: 'revenue',     icon: DollarSign,    group: 'Operational' },
  { id: 'projects',    icon: FolderKanban,  group: 'Operational' },
  { id: 'support',     icon: LifeBuoy,      group: 'Operational' },
];

const BUCKET_KEYS = ['current', 'd1_30', 'd31_60', 'd61_90', 'd90_plus'] as const;

// ─── Small presentational pieces ──────────────────────────────────────────────

function StatCard({
  label, value, icon: Icon, tone = 'default',
}: {
  label: string; value: string; icon: any;
  tone?: 'default' | 'positive' | 'negative';
}) {
  const toneCls =
    tone === 'positive'
      ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'
      : tone === 'negative'
      ? 'border-red-500/20 bg-red-500/5 text-red-400'
      : 'border-white/10 bg-white/[0.02] text-white';
  const iconBg =
    tone === 'positive' ? 'bg-emerald-500/20 text-emerald-400'
    : tone === 'negative' ? 'bg-red-500/20 text-red-400'
    : 'bg-amber-500/20 text-amber-400';
  return (
    <div className={cn('rounded-2xl border p-4', toneCls)}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-semibold text-white/25 uppercase tracking-wide">{label}</p>
        <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg', iconBg)}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}

function SectionCard({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
      {title && (
        <div className="px-4 py-3 border-b border-white/10">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
        </div>
      )}
      {children}
    </div>
  );
}

function EmptyRow({ text }: { text?: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <BarChart3 className="w-8 h-8 text-white/15 mb-3" />
      <p className="text-sm text-white/40">{text ?? t('erp.reports.noData')}</p>
    </div>
  );
}

// ─── Report renderers ─────────────────────────────────────────────────────────

function ProfitLossView({ data }: { data: any }) {
  const { t } = useTranslation();
  const currencies: any[] = data?.currencies ?? [];
  if (!currencies.length) return <EmptyRow />;
  return (
    <div className="space-y-4">
      {currencies.map((c) => (
        <SectionCard key={c.currency} title={t('erp.reports.currencyLabel', { currency: c.currency })}>
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/10">
            <div className="p-4">
              <p className="text-[11px] font-semibold text-emerald-400 uppercase mb-2">{t('erp.reports.pl.income')}</p>
              {c.income.length === 0 && <p className="text-sm text-white/30">—</p>}
              {c.income.map((l: any) => (
                <div key={l.code} className="flex justify-between py-1 text-sm">
                  <span className="text-white/60">{l.code} · {l.name}</span>
                  <span className="text-emerald-400 font-medium">{fmt(l.amount, c.currency)}</span>
                </div>
              ))}
            </div>
            <div className="p-4">
              <p className="text-[11px] font-semibold text-red-400 uppercase mb-2">{t('erp.reports.pl.expenses')}</p>
              {c.expenses.length === 0 && <p className="text-sm text-white/30">—</p>}
              {c.expenses.map((l: any) => (
                <div key={l.code} className="flex justify-between py-1 text-sm">
                  <span className="text-white/60">{l.code} · {l.name}</span>
                  <span className="text-red-400 font-medium">{fmt(l.amount, c.currency)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 border-t border-white/10 text-center divide-x divide-white/10">
            <div className="p-3">
              <p className="text-[10px] text-white/30 uppercase">{t('erp.reports.pl.totalIncome')}</p>
              <p className="text-emerald-400 font-bold">{fmt(c.totalIncome, c.currency)}</p>
            </div>
            <div className="p-3">
              <p className="text-[10px] text-white/30 uppercase">{t('erp.reports.pl.totalExpense')}</p>
              <p className="text-red-400 font-bold">{fmt(c.totalExpense, c.currency)}</p>
            </div>
            <div className="p-3">
              <p className="text-[10px] text-white/30 uppercase">{t('erp.reports.pl.netProfit')}</p>
              <p className={cn('font-bold', c.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                {fmt(c.netProfit, c.currency)}
              </p>
            </div>
          </div>
        </SectionCard>
      ))}
    </div>
  );
}

function CashFlowView({ data }: { data: any }) {
  const { t } = useTranslation();
  const totals: any[] = data?.totals ?? [];
  const series: any[] = data?.series ?? [];
  if (!totals.length) return <EmptyRow />;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {totals.map((tt) => (
          <SectionCard key={tt.currency}>
            <div className="p-4">
              <p className="text-[11px] font-semibold text-white/40 uppercase mb-2">{tt.currency}</p>
              <div className="flex justify-between text-sm py-0.5">
                <span className="text-white/50">{t('erp.reports.cashFlow.inflow')}</span>
                <span className="text-emerald-400">{fmt(tt.inflow, tt.currency)}</span>
              </div>
              <div className="flex justify-between text-sm py-0.5">
                <span className="text-white/50">{t('erp.reports.cashFlow.outflow')}</span>
                <span className="text-red-400">{fmt(tt.outflow, tt.currency)}</span>
              </div>
              <div className="flex justify-between text-sm py-0.5 border-t border-white/10 mt-1 pt-1">
                <span className="text-white/70 font-medium">{t('erp.reports.cashFlow.net')}</span>
                <span className={cn('font-bold', tt.net >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {fmt(tt.net, tt.currency)}
                </span>
              </div>
            </div>
          </SectionCard>
        ))}
      </div>

      <SectionCard title={t('erp.reports.cashFlow.byGroup', { group: data?.groupBy ?? 'month' })}>
        {series.length === 0 ? (
          <EmptyRow />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase text-white/30 border-b border-white/10">
                  <th className="px-4 py-2">{t('erp.reports.cashFlow.period')}</th>
                  <th className="px-4 py-2">{t('erp.reports.cashFlow.currency')}</th>
                  <th className="px-4 py-2 text-right">{t('erp.reports.cashFlow.inflow')}</th>
                  <th className="px-4 py-2 text-right">{t('erp.reports.cashFlow.outflow')}</th>
                  <th className="px-4 py-2 text-right">{t('erp.reports.cashFlow.net')}</th>
                </tr>
              </thead>
              <tbody>
                {series.flatMap((s: any) =>
                  s.currencies.map((c: any, i: number) => (
                    <tr key={`${s.period}-${c.currency}`} className="border-b border-white/5">
                      <td className="px-4 py-2 text-white/70">{i === 0 ? s.period : ''}</td>
                      <td className="px-4 py-2 text-white/40">{c.currency}</td>
                      <td className="px-4 py-2 text-right text-emerald-400">{fmt(c.inflow)}</td>
                      <td className="px-4 py-2 text-right text-red-400">{fmt(c.outflow)}</td>
                      <td className={cn('px-4 py-2 text-right font-medium', c.net >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                        {fmt(c.net)}
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function TaxSummaryView({ data }: { data: any }) {
  const { t } = useTranslation();
  const currencies: any[] = data?.currencies ?? [];
  if (!currencies.length) return <EmptyRow />;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {currencies.map((c) => (
        <SectionCard key={c.currency} title={t('erp.reports.currencyLabel', { currency: c.currency })}>
          <div className="p-4 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-white/50">{t('erp.reports.tax.outputTax')}</span>
              <span className="text-white">{fmt(c.outputTax, c.currency)}</span>
            </div>
            <div className="flex justify-between text-white/30 text-xs">
              <span>{t('erp.reports.tax.taxableBase')}</span><span>{fmt(c.outputTaxable, c.currency)}</span>
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-white/50">{t('erp.reports.tax.inputTax')}</span>
              <span className="text-white">{fmt(c.inputTax, c.currency)}</span>
            </div>
            <div className="flex justify-between text-white/30 text-xs">
              <span>{t('erp.reports.tax.taxableBase')}</span><span>{fmt(c.inputTaxable, c.currency)}</span>
            </div>
            <div className="flex justify-between border-t border-white/10 mt-2 pt-2">
              <span className="text-white/70 font-medium">{t('erp.reports.tax.netTaxPayable')}</span>
              <span className={cn('font-bold', c.netTaxPayable >= 0 ? 'text-amber-400' : 'text-emerald-400')}>
                {fmt(c.netTaxPayable, c.currency)}
              </span>
            </div>
          </div>
        </SectionCard>
      ))}
    </div>
  );
}

function AgingView({ data }: { data: any }) {
  const { t } = useTranslation();
  const currencies: any[] = data?.currencies ?? [];
  const detail: any[] = data?.detail ?? [];
  if (!currencies.length) return <EmptyRow text={t('erp.reports.aging.noBalances')} />;
  return (
    <div className="space-y-4">
      {currencies.map((c) => (
        <SectionCard key={c.currency} title={t('erp.reports.currencyLabel', { currency: c.currency })}>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-white/10 text-center">
            {BUCKET_KEYS.map((b) => (
              <div key={b} className="p-3">
                <p className="text-[10px] text-white/30 uppercase">{t(`erp.reports.buckets.${b}`)}</p>
                <p className="text-white font-semibold text-sm">{fmt(c[b], c.currency)}</p>
              </div>
            ))}
            <div className="p-3 bg-amber-500/5">
              <p className="text-[10px] text-amber-400/60 uppercase">{t('erp.reports.aging.total')}</p>
              <p className="text-amber-400 font-bold text-sm">{fmt(c.total, c.currency)}</p>
            </div>
          </div>
        </SectionCard>
      ))}

      <SectionCard title={t('erp.reports.aging.detail')}>
        {detail.length === 0 ? (
          <EmptyRow />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase text-white/30 border-b border-white/10">
                  <th className="px-4 py-2">{t('erp.reports.aging.number')}</th>
                  <th className="px-4 py-2">{t('erp.reports.aging.party')}</th>
                  <th className="px-4 py-2">{t('erp.reports.aging.dueDate')}</th>
                  <th className="px-4 py-2">{t('erp.reports.aging.bucket')}</th>
                  <th className="px-4 py-2 text-right">{t('erp.reports.aging.amount')}</th>
                </tr>
              </thead>
              <tbody>
                {detail.map((d: any) => (
                  <tr key={d.id} className="border-b border-white/5">
                    <td className="px-4 py-2 text-white/70">{d.number}</td>
                    <td className="px-4 py-2 text-white/60">{d.party ?? '—'}</td>
                    <td className="px-4 py-2 text-white/50">{fmtDate(d.dueDate)}</td>
                    <td className="px-4 py-2">
                      <span className={cn(
                        'inline-block rounded-full px-2 py-0.5 text-[10px] font-medium border',
                        d.bucket === 'current'
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                          : 'border-red-500/30 bg-red-500/10 text-red-400',
                      )}>
                        {t(`erp.reports.buckets.${d.bucket}`)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-white">{fmt(d.amount, d.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function RevenueView({ data }: { data: any }) {
  const { t } = useTranslation();
  const rows: any[] = data?.rows ?? [];
  if (!rows.length) return <EmptyRow text={t('erp.reports.revenue.noInvoices')} />;
  return (
    <SectionCard title={t('erp.reports.revenue.cardTitle')}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase text-white/30 border-b border-white/10">
              <th className="px-4 py-2">{t('erp.reports.revenue.client')}</th>
              <th className="px-4 py-2">{t('erp.reports.revenue.currency')}</th>
              <th className="px-4 py-2 text-right">{t('erp.reports.revenue.invoices')}</th>
              <th className="px-4 py-2 text-right">{t('erp.reports.revenue.revenue')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any, i: number) => (
              <tr key={`${r.clientId}-${r.currency}-${i}`} className="border-b border-white/5">
                <td className="px-4 py-2 text-white/70">{r.clientName ?? '—'}</td>
                <td className="px-4 py-2 text-white/40">{r.currency}</td>
                <td className="px-4 py-2 text-right text-white/50">{r.invoiceCount}</td>
                <td className="px-4 py-2 text-right text-emerald-400 font-medium">{fmt(r.revenue, r.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function ProjectsView({ data }: { data: any }) {
  const { t } = useTranslation();
  const byStatus: Record<string, number> = data?.byStatus ?? {};
  const entries = Object.entries(byStatus);
  if (!entries.length) return <EmptyRow text={t('erp.reports.projects.none')} />;
  const total = data?.total ?? 0;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatCard label={t('erp.reports.projects.totalProjects')} value={String(total)} icon={FolderKanban} />
        {entries.map(([status, count]) => (
          <StatCard key={status} label={t(`erp.statusLabel.${status}`)} value={String(count)} icon={FolderKanban} />
        ))}
      </div>
    </div>
  );
}

function SupportView({ data }: { data: any }) {
  const { t } = useTranslation();
  if (!data) return <EmptyRow />;
  const byStatus: Record<string, number> = data.byStatus ?? {};
  const byPriority: Record<string, number> = data.byPriority ?? {};
  const byCategory: Record<string, number> = data.byCategory ?? {};
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label={t('erp.reports.supportView.totalTickets')} value={String(data.total ?? 0)} icon={LifeBuoy} />
        <StatCard label={t('erp.reports.supportView.open')} value={String(data.open ?? 0)} icon={LifeBuoy} />
        <StatCard label={t('erp.reports.supportView.resolved')} value={String(data.resolved ?? 0)} icon={LifeBuoy} tone="positive" />
        <StatCard label={t('erp.reports.supportView.slaBreached')} value={String(data.slaBreached ?? 0)} icon={AlertCircle} tone={data.slaBreached ? 'negative' : 'default'} />
        <StatCard
          label={t('erp.reports.supportView.avgResolution')}
          value={data.avgResolutionHours != null ? `${data.avgResolutionHours}h` : '—'}
          icon={Clock}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { title: t('erp.reports.supportView.byStatus'), map: byStatus, kind: 'status' as const },
          { title: t('erp.reports.supportView.byPriority'), map: byPriority, kind: 'priority' as const },
          { title: t('erp.reports.supportView.byCategory'), map: byCategory, kind: 'category' as const },
        ].map((b) => (
          <SectionCard key={b.title} title={b.title}>
            <div className="p-4 space-y-1.5">
              {Object.entries(b.map).length === 0 && <p className="text-sm text-white/30">—</p>}
              {Object.entries(b.map).map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm">
                  <span className="text-white/60">{t(`erp.support.${b.kind}.${k}`)}</span>
                  <span className="text-white font-medium">{v}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        ))}
      </div>
    </div>
  );
}

// ─── Data fetch per tab ─────────────────────────────────────────────────────

function useReportQuery(tab: ReportTab, params: Record<string, string>, enabled: boolean) {
  return useQuery({
    queryKey: ['erp-report', tab, params],
    queryFn: () => {
      const p = params;
      switch (tab) {
        case 'profit-loss': return reportsApi.profitLoss(p).then((r) => r.data.data);
        case 'cash-flow':   return reportsApi.cashFlow(p).then((r) => r.data.data);
        case 'tax-summary': return reportsApi.taxSummary(p).then((r) => r.data.data);
        case 'ar-aging':    return reportsApi.arAging(p).then((r) => r.data.data);
        case 'ap-aging':    return reportsApi.apAging(p).then((r) => r.data.data);
        case 'revenue':     return reportsApi.revenueByClient(p).then((r) => r.data.data);
        case 'projects':    return reportsApi.projectsStatus(p).then((r) => r.data.data);
        case 'support':     return reportsApi.supportStats(p).then((r) => r.data.data);
      }
    },
    enabled,
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [tab, setTab] = useState<ReportTab>('profit-loss');
  const [from, setFrom] = useState(startOfYear());
  const [to, setTo] = useState(endOfYear());
  const [groupBy, setGroupBy] = useState<'month' | 'quarter' | 'year'>('month');

  const params: Record<string, string> = { from, to };
  if (tab === 'cash-flow') params.groupBy = groupBy;

  const { data, isLoading, isFetching, refetch } = useReportQuery(tab, params, mounted);

  if (!mounted) return null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20">
            <BarChart3 className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">{t('erp.reports.title')}</h1>
            <p className="text-xs text-white/40">{t('erp.reports.subtitle')}</p>
          </div>
        </div>

        {/* Date range */}
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-[10px] uppercase text-white/30 mb-1">{t('erp.reports.from')}</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={cn(inputCls, 'w-auto')} />
          </div>
          <div>
            <label className="block text-[10px] uppercase text-white/30 mb-1">{t('erp.reports.to')}</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={cn(inputCls, 'w-auto')} />
          </div>
          {tab === 'cash-flow' && (
            <div>
              <label className="block text-[10px] uppercase text-white/30 mb-1">{t('erp.reports.groupBy')}</label>
              <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as any)} className={cn(inputCls, 'w-auto')}>
                <option value="month">{t('erp.reports.groupByMonth')}</option>
                <option value="quarter">{t('erp.reports.groupByQuarter')}</option>
                <option value="year">{t('erp.reports.groupByYear')}</option>
              </select>
            </div>
          )}
          <button
            onClick={() => refetch()}
            className="flex h-[42px] min-h-[42px] items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white/70 transition hover:bg-white/[0.06]"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin')} />
            {t('erp.reports.refresh')}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 rounded-2xl border border-white/10 bg-white/[0.02] p-1.5">
        {TABS.map((tb) => {
          const Icon = tb.icon;
          const active = tab === tb.id;
          return (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={cn(
                'flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition min-h-[40px]',
                active ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]',
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {t(`erp.reports.tabs.${tb.id}`)}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="min-h-[200px]">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
          </div>
        ) : (
          <>
            {tab === 'profit-loss' && <ProfitLossView data={data} />}
            {tab === 'cash-flow' && <CashFlowView data={data} />}
            {tab === 'tax-summary' && <TaxSummaryView data={data} />}
            {tab === 'ar-aging' && <AgingView data={data} />}
            {tab === 'ap-aging' && <AgingView data={data} />}
            {tab === 'revenue' && <RevenueView data={data} />}
            {tab === 'projects' && <ProjectsView data={data} />}
            {tab === 'support' && <SupportView data={data} />}
          </>
        )}
      </div>
    </div>
  );
}
