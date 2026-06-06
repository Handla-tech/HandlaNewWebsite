'use client';

/**
 * ERP Dashboard — /erp
 *
 * KPI cards · Financial summary · 6-month chart · Task completion gauge
 * Projects by status bars · Contract status pills · Quick-action buttons
 * Skeleton loading · Error state · EN/AR i18n · RTL aware
 */

import { useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Users,
  Briefcase,
  FolderOpen,
  CheckSquare,
  FileText,
  Receipt,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  CheckCircle2,
  RefreshCw,
  PlusCircle,
  BarChart3,
  Wallet,
  Target,
  Activity,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useErpStats, useErpFinancialChart } from '@/hooks/useErpDashboard';
import { cn } from '@/lib/utils';
import type { DashboardStats, FinancialChartMonth } from '@/hooks/useErpDashboard';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtCurrency(val: number | null | undefined, symbol = '$'): string {
  const n = typeof val === 'number' && isFinite(val) ? val : 0;
  if (Math.abs(n) >= 1_000_000) {
    return `${symbol}${(n / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(n) >= 1_000) {
    return `${symbol}${(n / 1_000).toFixed(1)}K`;
  }
  return `${symbol}${n.toFixed(2)}`;
}

function timeOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

// ─── Animation variants ──────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0 },
};

const stagger = {
  show: { transition: { staggerChildren: 0.05 } },
};

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Premium KPI card */
function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  accent = 'gold',
  trend,
  href,
}: {
  icon:    React.ComponentType<{ className?: string }>;
  label:   string;
  value:   string | number;
  sub?:    string;
  accent?: 'gold' | 'green' | 'red' | 'blue' | 'amber' | 'purple';
  trend?:  'up' | 'down' | 'neutral';
  href?:   string;
}) {
  const accents: Record<string, { bg: string; border: string; icon: string; text: string; glow: string }> = {
    gold:   { bg: 'bg-[#fbbf24]/10',   border: 'border-[#fbbf24]/20',   icon: 'text-[#fbbf24]',   text: 'text-[#fbbf24]',   glow: 'shadow-[#fbbf24]/10' },
    green:  { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: 'text-emerald-400', text: 'text-emerald-400', glow: 'shadow-emerald-500/10' },
    red:    { bg: 'bg-red-500/10',     border: 'border-red-500/20',     icon: 'text-red-400',     text: 'text-red-400',     glow: 'shadow-red-500/10' },
    blue:   { bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    icon: 'text-blue-400',    text: 'text-blue-400',    glow: 'shadow-blue-500/10' },
    amber:  { bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   icon: 'text-amber-400',   text: 'text-amber-400',   glow: 'shadow-amber-500/10' },
    purple: { bg: 'bg-purple-500/10',  border: 'border-purple-500/20',  icon: 'text-purple-400',  text: 'text-purple-400',  glow: 'shadow-purple-500/10' },
  };
  const ac = accents[accent];

  const content = (
    <motion.div
      variants={fadeUp}
      className={cn(
        'group relative overflow-hidden rounded-2xl border p-4 transition-all duration-200',
        'bg-[#0f0f0f] hover:bg-[#131313]',
        ac.border,
        href && 'cursor-pointer hover:shadow-lg',
        href && ac.glow,
      )}
    >
      {/* Ambient glow */}
      <div className={cn('pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full blur-3xl opacity-30', ac.bg)} />

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">{label}</p>
          <p className={cn('text-2xl font-bold tracking-tight', ac.text)}>{value}</p>
          {sub && <p className="mt-1 truncate text-[11px] text-white/30">{sub}</p>}
        </div>
        <div className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border', ac.bg, ac.border)}>
          <Icon className={cn('h-5 w-5', ac.icon)} />
        </div>
      </div>

      {trend && (
        <div className="mt-3 flex items-center gap-1.5 pt-3 border-t border-white/[0.05]">
          {trend === 'up'   && <><TrendingUp   className="h-3 w-3 text-emerald-400" /><span className="text-[10px] text-emerald-400">Trending up</span></>}
          {trend === 'down' && <><TrendingDown  className="h-3 w-3 text-red-400"     /><span className="text-[10px] text-red-400">Trending down</span></>}
          {trend === 'neutral' && <><Activity  className="h-3 w-3 text-white/30"    /><span className="text-[10px] text-white/30">Stable</span></>}
          {href && <ArrowUpRight className="ml-auto h-3 w-3 text-white/20 group-hover:text-white/50 transition-colors" />}
        </div>
      )}
    </motion.div>
  );

  if (href) return <Link href={href}>{content}</Link>;
  return content;
}

/** Skeleton placeholder */
function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded-xl bg-white/[0.04]', className)} />
  );
}

/** Section header */
function SectionHeader({ title, icon: Icon }: { title: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#fbbf24]/10">
        <Icon className="h-3.5 w-3.5 text-[#fbbf24]" />
      </div>
      <h2 className="text-xs font-semibold uppercase tracking-widest text-white/40">{title}</h2>
    </div>
  );
}

// ─── Financial Chart (pure CSS bars) ─────────────────────────────────────────

function FinancialChart({ data }: { data: FinancialChartMonth[] }) {
  const safeData = Array.isArray(data) ? data : [];
  const maxVal = useMemo(
    () => Math.max(...safeData.flatMap(d => [d.income, d.expenses]), 1),
    [safeData],
  );

  const monthLabel = (ym: string) => {
    const [y, m] = ym.split('-');
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleString('default', { month: 'short' });
  };

  if (safeData.length === 0 || safeData.every(d => d.income === 0 && d.expenses === 0)) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-white/20">
        No financial data available for this period.
      </div>
    );
  }

  return (
    <div className="flex h-52 items-end justify-between gap-2 px-2">
      {safeData.map((d) => (
        <div key={d.month} className="flex flex-1 flex-col items-center gap-1.5">
          {/* Bars */}
          <div className="flex w-full items-end justify-center gap-0.5" style={{ height: '168px' }}>
            {/* Income bar */}
            <div
              className="w-1/2 rounded-t-md bg-gradient-to-t from-emerald-600/60 to-emerald-500/80 transition-all duration-700 hover:from-emerald-600/80 hover:to-emerald-400"
              style={{ height: `${Math.max((d.income / maxVal) * 168, 3)}px` }}
              title={`Income: ${fmtCurrency(d.income)}`}
            />
            {/* Expenses bar */}
            <div
              className="w-1/2 rounded-t-md bg-gradient-to-t from-red-600/60 to-red-500/80 transition-all duration-700 hover:from-red-600/80 hover:to-red-400"
              style={{ height: `${Math.max((d.expenses / maxVal) * 168, 3)}px` }}
              title={`Expenses: ${fmtCurrency(d.expenses)}`}
            />
          </div>
          {/* Month label */}
          <span className="text-[10px] font-medium text-white/30">{monthLabel(d.month)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Task Completion Gauge ───────────────────────────────────────────────────

function TaskGauge({
  rate,
  completed,
  total,
}: {
  rate:      number;
  completed: number;
  total:     number;
}) {
  const R        = 60;
  const cx       = 70;
  const cy       = 70;
  const strokeW  = 8;
  const circumference = Math.PI * R;
  const offset   = circumference - (rate / 100) * circumference;
  const trackColour = rate >= 70 ? '#10b981' : rate >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width="140" height="80" viewBox="0 0 140 80">
        {/* Background track */}
        <path
          d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeW}
          strokeLinecap="round"
        />
        {/* Value arc */}
        <path
          d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`}
          fill="none"
          stroke={trackColour}
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000"
          style={{ filter: `drop-shadow(0 0 6px ${trackColour}60)` }}
        />
        {/* Rate label */}
        <text x={cx} y={cy - 8} textAnchor="middle" fontSize="22" fontWeight="800" fill={trackColour}>
          {rate}%
        </text>
        <text x={cx} y={cy + 8} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.3)">
          completion
        </text>
      </svg>
      <div className="flex gap-5 text-[11px] text-white/40">
        <span><span className="font-bold text-emerald-400">{completed}</span> done</span>
        <span><span className="font-bold text-white/70">{total}</span> total</span>
      </div>
    </div>
  );
}

// ─── Project Status Bars ─────────────────────────────────────────────────────

function ProjectStatusBars({ stats }: { stats: DashboardStats }) {
  const items = [
    { label: 'Active',    value: stats.projectsByStatus.active,    colour: 'bg-emerald-500', glow: 'shadow-emerald-500/30' },
    { label: 'Planning',  value: stats.projectsByStatus.planning,  colour: 'bg-blue-500',    glow: 'shadow-blue-500/30' },
    { label: 'On Hold',   value: stats.projectsByStatus.onHold,    colour: 'bg-amber-500',   glow: 'shadow-amber-500/30' },
    { label: 'Completed', value: stats.projectsByStatus.completed, colour: 'bg-purple-500',  glow: 'shadow-purple-500/30' },
    { label: 'Cancelled', value: stats.projectsByStatus.cancelled, colour: 'bg-red-500',     glow: 'shadow-red-500/30' },
  ];
  const total = items.reduce((s, i) => s + i.value, 0) || 1;

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1.5 flex justify-between text-[11px]">
            <span className="font-medium text-white/50">{item.label}</span>
            <span className="font-bold text-white">{item.value}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className={cn('h-full rounded-full transition-all duration-700', item.colour)}
              style={{ width: `${(item.value / total) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Contract Status Pills ───────────────────────────────────────────────────

function ContractPills({ stats }: { stats: DashboardStats }) {
  const pills = [
    { label: 'Draft',    value: stats.contractsByStatus.draft,    cls: 'border-white/10 bg-white/5 text-white/50'          },
    { label: 'Sent',     value: stats.contractsByStatus.sent,     cls: 'border-blue-500/30 bg-blue-500/10 text-blue-400'   },
    { label: 'Signed',   value: stats.contractsByStatus.signed,   cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' },
    { label: 'Rejected', value: stats.contractsByStatus.rejected, cls: 'border-red-500/30 bg-red-500/10 text-red-400'      },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {pills.map((p) => (
        <div
          key={p.label}
          className={cn('rounded-full border px-3 py-1.5 text-[11px] font-semibold flex items-center gap-1.5', p.cls)}
        >
          <span className="text-xs font-bold">{p.value}</span>
          <span className="opacity-70">{p.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Quick Action Buttons ────────────────────────────────────────────────────

function QuickActions() {
  const actions = [
    { label: 'New Client',   href: '/erp/clients',   icon: Briefcase,   accent: 'from-[#fbbf24]/20 to-[#fbbf24]/5 border-[#fbbf24]/20 text-[#fbbf24]'   },
    { label: 'New Project',  href: '/erp/projects',  icon: FolderOpen,  accent: 'from-blue-500/20 to-blue-500/5 border-blue-500/20 text-blue-400'        },
    { label: 'New Task',     href: '/erp/tasks',     icon: CheckSquare, accent: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/20 text-emerald-400' },
    { label: 'New Contract', href: '/erp/contracts', icon: FileText,    accent: 'from-purple-500/20 to-purple-500/5 border-purple-500/20 text-purple-400'  },
    { label: 'New Invoice',  href: '/erp/invoices',  icon: Receipt,     accent: 'from-amber-500/20 to-amber-500/5 border-amber-500/20 text-amber-400'     },
    { label: 'New Expense',  href: '/erp/expenses',  icon: DollarSign,  accent: 'from-red-500/20 to-red-500/5 border-red-500/20 text-red-400'             },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
      {actions.map(({ label, href, icon: Icon, accent }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            'group flex items-center gap-2 rounded-xl border bg-gradient-to-br px-3 py-3 text-xs font-semibold transition-all duration-150 hover:scale-[1.02] hover:shadow-lg',
            accent,
          )}
        >
          <PlusCircle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{label}</span>
        </Link>
      ))}
    </div>
  );
}

// ─── Skeleton Dashboard ───────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>
      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      {/* Chart row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-56 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-56 rounded-2xl" />
      </div>
      {/* Bottom row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    </div>
  );
}

// ─── Error State ──────────────────────────────────────────────────────────────

function DashboardError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 p-10">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10">
        <AlertTriangle className="h-7 w-7 text-red-400" />
      </div>
      <div className="text-center">
        <p className="font-semibold text-white">Failed to load dashboard</p>
        <p className="mt-1 text-sm text-white/30">Could not fetch dashboard data. Please try again.</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="flex items-center gap-2 rounded-xl border border-[#fbbf24]/30 bg-[#fbbf24]/10 px-5 py-2.5 text-sm font-semibold text-[#fbbf24] transition hover:bg-[#fbbf24]/20"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Retry
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ErpDashboardPage() {
  const { user, isAdmin } = useAuth();

  const {
    data:    stats,
    isLoading: statsLoading,
    isError:   statsError,
    refetch:   refetchStats,
  } = useErpStats();

  const {
    data:    chart,
    isLoading: chartLoading,
    refetch:   refetchChart,
  } = useErpFinancialChart();

  const isLoading = statsLoading || chartLoading;
  const hasError  = statsError;

  const greeting  = isAdmin ? `Good ${timeOfDay()}, Admin` : `Good ${timeOfDay()}`;

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading || (!stats && !hasError)) return <DashboardSkeleton />;

  // ── Error ────────────────────────────────────────────────────────────────
  if (hasError || !stats) {
    return (
      <DashboardError
        onRetry={() => { void refetchStats(); void refetchChart(); }}
      />
    );
  }

  const chartData: FinancialChartMonth[] = Array.isArray(chart) ? chart : [];

  // Build status maps with per-key fallbacks so TypeScript doesn't flag
  // duplicate keys (it does when the same property appears both as a literal
  // and inside a spread of a known type — the spread-after-literal pattern
  // is semantically correct but triggers TS 5+ "specified more than once").
  const safeStats: DashboardStats = {
    ...stats,
    projectsByStatus: {
      planning:  stats.projectsByStatus?.planning  ?? 0,
      active:    stats.projectsByStatus?.active    ?? 0,
      onHold:    stats.projectsByStatus?.onHold    ?? 0,
      completed: stats.projectsByStatus?.completed ?? 0,
      cancelled: stats.projectsByStatus?.cancelled ?? 0,
    },
    contractsByStatus: {
      draft:    stats.contractsByStatus?.draft    ?? 0,
      sent:     stats.contractsByStatus?.sent     ?? 0,
      signed:   stats.contractsByStatus?.signed   ?? 0,
      rejected: stats.contractsByStatus?.rejected ?? 0,
    },
  };

  return (
    <div className="min-h-full space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-[#fbbf24]" />
            <h1 className="text-xl font-bold tracking-tight text-white">{greeting}!</h1>
          </div>
          <p className="text-sm text-white/30">Here&apos;s your business overview for today.</p>
        </div>
        <button
          type="button"
          onClick={() => { void refetchStats(); void refetchChart(); }}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/40 transition hover:border-white/20 hover:text-white"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          KPI CARDS
      ══════════════════════════════════════════════════════════════════ */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
      >
        {isAdmin && (
          <KpiCard
            icon={Users}
            label="Total Leads"
            value={safeStats.totalLeads}
            sub={`+${safeStats.newLeadsThisMonth} this month`}
            accent="gold"
            href="/erp/clients"
          />
        )}
        <KpiCard
          icon={Briefcase}
          label="Total Clients"
          value={safeStats.totalClients}
          sub={`+${safeStats.newClientsThisMonth} this month`}
          accent="blue"
          href="/erp/clients"
        />
        <KpiCard
          icon={FolderOpen}
          label="Active Projects"
          value={safeStats.activeProjects}
          accent="purple"
          href="/erp/projects"
        />
        <KpiCard
          icon={CheckSquare}
          label="Tasks Done"
          value={`${safeStats.completedTasks}/${safeStats.totalTasks}`}
          sub={`${safeStats.completionRate}% complete`}
          accent={safeStats.completionRate >= 70 ? 'green' : safeStats.completionRate >= 40 ? 'amber' : 'red'}
          href="/erp/tasks"
        />
        <KpiCard
          icon={Clock}
          label="Delayed Tasks"
          value={safeStats.delayedTasks}
          accent={safeStats.delayedTasks > 0 ? 'red' : 'green'}
          href="/erp/tasks"
        />
        <KpiCard
          icon={TrendingUp}
          label="Income (Month)"
          value={fmtCurrency(safeStats.totalIncome)}
          accent="green"
          trend="up"
          href="/erp/expenses"
        />
        <KpiCard
          icon={TrendingDown}
          label="Expenses (Month)"
          value={fmtCurrency(safeStats.totalExpenses)}
          accent="red"
          trend="down"
          href="/erp/expenses"
        />
        <KpiCard
          icon={Wallet}
          label="Net Balance"
          value={fmtCurrency(safeStats.netBalance)}
          accent={safeStats.netBalance >= 0 ? 'green' : 'red'}
          trend={safeStats.netBalance >= 0 ? 'up' : 'down'}
        />
        <KpiCard
          icon={Receipt}
          label="Outstanding"
          value={fmtCurrency(safeStats.outstandingInvoices)}
          sub={`${safeStats.overdueInvoicesCount} overdue`}
          accent={safeStats.overdueInvoicesCount > 0 ? 'amber' : 'gold'}
          href="/erp/invoices"
        />
        <KpiCard
          icon={FileText}
          label="Contracts Signed"
          value={safeStats.contractsByStatus.signed}
          sub={`${safeStats.contractsByStatus.sent} awaiting`}
          accent="gold"
          href="/erp/contracts"
        />
      </motion.div>

      {/* ══════════════════════════════════════════════════════════════════
          MIDDLE ROW: Chart (2/3) + Task Gauge (1/3)
      ══════════════════════════════════════════════════════════════════ */}
      <div className="grid gap-4 lg:grid-cols-3">

        {/* Financial Chart — 2 cols */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl border border-white/[0.08] bg-[#0f0f0f] p-5 lg:col-span-2"
        >
          <SectionHeader title="Income vs Expenses — Last 6 Months" icon={BarChart3} />

          {/* Legend */}
          <div className="mb-4 flex gap-4 text-[11px]">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-3 rounded-sm bg-emerald-500/80" />
              <span className="text-white/40">Income</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-3 rounded-sm bg-red-500/80" />
              <span className="text-white/40">Expenses</span>
            </span>
          </div>

          <FinancialChart data={chartData} />
        </motion.div>

        {/* Task Gauge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-[#0f0f0f] p-5"
        >
          <SectionHeader title="Task Progress" icon={Target} />
          {safeStats.totalTasks === 0 ? (
            <div className="flex flex-col items-center gap-3 text-white/20">
              <CheckCircle2 className="h-10 w-10" />
              <p className="text-sm">No tasks yet</p>
            </div>
          ) : (
            <TaskGauge
              rate={safeStats.completionRate}
              completed={safeStats.completedTasks}
              total={safeStats.totalTasks}
            />
          )}
          {/* Delayed / Pending breakdown */}
          <div className="mt-4 grid w-full grid-cols-2 gap-2 text-center">
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 py-2.5">
              <p className="text-lg font-bold text-amber-400">{safeStats.delayedTasks}</p>
              <p className="text-[10px] text-white/30">Delayed</p>
            </div>
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/8 py-2.5">
              <p className="text-lg font-bold text-blue-400">{safeStats.pendingTasks}</p>
              <p className="text-[10px] text-white/30">Pending</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          BOTTOM ROW: Projects by Status + Contracts + Overdue alert
      ══════════════════════════════════════════════════════════════════ */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Projects by status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-2xl border border-white/[0.08] bg-[#0f0f0f] p-5"
        >
          <SectionHeader title="Projects by Status" icon={FolderOpen} />
          <ProjectStatusBars stats={safeStats} />
        </motion.div>

        {/* Contracts + Alerts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-[#0f0f0f] p-5"
        >
          <SectionHeader title="Contracts" icon={FileText} />
          <ContractPills stats={safeStats} />

          {/* Overdue invoice alert */}
          {safeStats.overdueInvoicesCount > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/8 p-3">
              <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-amber-500/20">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-amber-400">
                  {safeStats.overdueInvoicesCount} overdue invoice{safeStats.overdueInvoicesCount !== 1 ? 's' : ''}
                </p>
                <p className="mt-0.5 text-[11px] text-white/30">
                  {fmtCurrency(safeStats.outstandingInvoices)} total outstanding.{' '}
                  <Link href="/erp/invoices" className="underline hover:text-amber-400 transition-colors">
                    View invoices →
                  </Link>
                </p>
              </div>
            </div>
          )}

          {/* Unsigned contracts alert */}
          {safeStats.contractsByStatus.sent > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-blue-500/20 bg-blue-500/8 p-3">
              <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-blue-500/20">
                <FileText className="h-3.5 w-3.5 text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-blue-400">
                  {safeStats.contractsByStatus.sent} contract{safeStats.contractsByStatus.sent !== 1 ? 's' : ''} awaiting signature
                </p>
                <p className="mt-0.5 text-[11px] text-white/30">
                  <Link href="/erp/contracts" className="underline hover:text-blue-400 transition-colors">
                    View contracts →
                  </Link>
                </p>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          QUICK ACTIONS
      ══════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="rounded-2xl border border-white/[0.08] bg-[#0f0f0f] p-5"
      >
        <SectionHeader title="Quick Actions" icon={Activity} />
        <QuickActions />
      </motion.div>
    </div>
  );
}
