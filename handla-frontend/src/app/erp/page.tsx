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
  XCircle,
  RefreshCw,
  PlusCircle,
  BarChart3,
  Wallet,
  Target,
  Activity,
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

/** Glassmorphism KPI card */
function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  accent = 'gold',
  trend,
}: {
  icon:    React.ComponentType<{ className?: string }>;
  label:   string;
  value:   string | number;
  sub?:    string;
  accent?: 'gold' | 'green' | 'red' | 'blue' | 'amber' | 'purple';
  trend?:  'up' | 'down' | 'neutral';
}) {
  const accents: Record<string, { bg: string; border: string; icon: string; text: string }> = {
    gold:   { bg: 'bg-[#fbbf24]/8',   border: 'border-[#fbbf24]/20', icon: 'text-[#fbbf24]',   text: 'text-[#fbbf24]'   },
    green:  { bg: 'bg-emerald-500/8', border: 'border-emerald-500/20', icon: 'text-emerald-400', text: 'text-emerald-400' },
    red:    { bg: 'bg-red-500/8',     border: 'border-red-500/20',    icon: 'text-red-400',    text: 'text-red-400'    },
    blue:   { bg: 'bg-blue-500/8',    border: 'border-blue-500/20',   icon: 'text-blue-400',   text: 'text-blue-400'   },
    amber:  { bg: 'bg-amber-500/8',   border: 'border-amber-500/20',  icon: 'text-amber-400',  text: 'text-amber-400'  },
    purple: { bg: 'bg-purple-500/8',  border: 'border-purple-500/20', icon: 'text-purple-400', text: 'text-purple-400' },
  };
  const ac = accents[accent];

  return (
    <motion.div
      variants={fadeUp}
      className={cn(
        'relative overflow-hidden rounded-2xl border p-4',
        'bg-[#0d0d0d] backdrop-blur-sm',
        ac.border,
      )}
    >
      {/* faint radial glow */}
      <div className={cn('pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl opacity-20', ac.bg)} />

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-widest text-[#555]">{label}</p>
          <p className={cn('text-2xl font-bold tracking-tight', ac.text)}>{value}</p>
          {sub && <p className="mt-1 truncate text-[11px] text-[#444]">{sub}</p>}
        </div>
        <div className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl', ac.bg)}>
          <Icon className={cn('h-5 w-5', ac.icon)} />
        </div>
      </div>

      {trend && (
        <div className="mt-2 flex items-center gap-1">
          {trend === 'up'   && <TrendingUp   className="h-3 w-3 text-emerald-400" />}
          {trend === 'down' && <TrendingDown  className="h-3 w-3 text-red-400"     />}
          {trend === 'neutral' && <Activity  className="h-3 w-3 text-[#555]"      />}
        </div>
      )}
    </motion.div>
  );
}

/** Skeleton placeholder */
function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded-xl bg-[#1a1a1a]', className)} />
  );
}

/** Section header */
function SectionHeader({ title, icon: Icon }: { title: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <Icon className="h-4 w-4 text-[#fbbf24]" />
      <h2 className="text-sm font-semibold uppercase tracking-widest text-[#888]">{title}</h2>
    </div>
  );
}

// ─── Financial Chart (pure CSS bars, no external chart lib) ─────────────────

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
      <div className="flex h-40 items-center justify-center text-sm text-[#444]">
        No financial data available for this period.
      </div>
    );
  }

  return (
    <div className="flex h-48 items-end justify-between gap-2 px-2">
      {safeData.map((d) => (
        <div key={d.month} className="flex flex-1 flex-col items-center gap-1">
          {/* Bars */}
          <div className="flex w-full items-end justify-center gap-0.5" style={{ height: '160px' }}>
            {/* Income bar */}
            <div
              className="w-1/2 rounded-t-sm bg-emerald-500/60 transition-all duration-700"
              style={{ height: `${Math.max((d.income / maxVal) * 160, 2)}px` }}
              title={`Income: ${fmtCurrency(d.income)}`}
            />
            {/* Expenses bar */}
            <div
              className="w-1/2 rounded-t-sm bg-red-500/60 transition-all duration-700"
              style={{ height: `${Math.max((d.expenses / maxVal) * 160, 2)}px` }}
              title={`Expenses: ${fmtCurrency(d.expenses)}`}
            />
          </div>
          {/* Month label */}
          <span className="text-[10px] font-medium text-[#555]">{monthLabel(d.month)}</span>
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
  // SVG arc gauge (180°)
  const R        = 60;
  const cx       = 70;
  const cy       = 70;
  const strokeW  = 10;
  const circumference = Math.PI * R; // half circle
  const offset   = circumference - (rate / 100) * circumference;

  // Colour: green ≥70, amber 40-69, red <40
  const trackColour = rate >= 70 ? '#10b981' : rate >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="140" height="80" viewBox="0 0 140 80">
        {/* Background arc */}
        <path
          d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`}
          fill="none"
          stroke="#1e1e1e"
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
        />
        {/* Rate label */}
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          fontSize="20"
          fontWeight="700"
          fill={trackColour}
        >
          {rate}%
        </text>
        <text
          x={cx}
          y={cy + 10}
          textAnchor="middle"
          fontSize="9"
          fill="#555"
        >
          completion
        </text>
      </svg>
      <div className="flex gap-4 text-[11px] text-[#666]">
        <span><span className="font-bold text-emerald-400">{completed}</span> done</span>
        <span><span className="font-bold text-white">{total}</span> total</span>
      </div>
    </div>
  );
}

// ─── Project Status Bars ─────────────────────────────────────────────────────

function ProjectStatusBars({ stats }: { stats: DashboardStats }) {
  const items = [
    { label: 'Active',    value: stats.projectsByStatus.active,    colour: 'bg-emerald-500' },
    { label: 'Planning',  value: stats.projectsByStatus.planning,  colour: 'bg-blue-500'    },
    { label: 'On Hold',   value: stats.projectsByStatus.onHold,    colour: 'bg-amber-500'   },
    { label: 'Completed', value: stats.projectsByStatus.completed, colour: 'bg-purple-500'  },
    { label: 'Cancelled', value: stats.projectsByStatus.cancelled, colour: 'bg-red-500'     },
  ];
  const total = items.reduce((s, i) => s + i.value, 0) || 1;

  return (
    <div className="space-y-2.5">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex justify-between text-[11px]">
            <span className="text-[#888]">{item.label}</span>
            <span className="font-semibold text-white">{item.value}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1a1a1a]">
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
    { label: 'Draft',    value: stats.contractsByStatus.draft,    cls: 'border-[#333] bg-[#1a1a1a] text-[#888]'    },
    { label: 'Sent',     value: stats.contractsByStatus.sent,     cls: 'border-blue-500/30 bg-blue-500/10 text-blue-400'   },
    { label: 'Signed',   value: stats.contractsByStatus.signed,   cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' },
    { label: 'Rejected', value: stats.contractsByStatus.rejected, cls: 'border-red-500/30 bg-red-500/10 text-red-400' },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {pills.map((p) => (
        <div
          key={p.label}
          className={cn('rounded-full border px-3 py-1 text-[11px] font-semibold', p.cls)}
        >
          {p.label} <span className="ml-1 font-bold">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Quick Action Buttons ────────────────────────────────────────────────────

function QuickActions() {
  const actions = [
    { label: 'New Client',   href: '/erp/clients',   icon: Briefcase, accent: 'text-[#fbbf24]'   },
    { label: 'New Project',  href: '/erp/projects',  icon: FolderOpen, accent: 'text-blue-400'   },
    { label: 'New Task',     href: '/erp/tasks',     icon: CheckSquare, accent: 'text-emerald-400' },
    { label: 'New Contract', href: '/erp/contracts', icon: FileText,   accent: 'text-purple-400'  },
    { label: 'New Invoice',  href: '/erp/invoices',  icon: Receipt,    accent: 'text-amber-400'   },
    { label: 'New Expense',  href: '/erp/expenses',  icon: DollarSign, accent: 'text-red-400'     },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
      {actions.map(({ label, href, icon: Icon, accent }) => (
        <Link
          key={href}
          href={href}
          className="flex items-center gap-2 rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] px-3 py-2.5 text-xs font-medium text-[#888] transition-all hover:border-[#2a2a2a] hover:bg-[#141414] hover:text-white"
        >
          <PlusCircle className={cn('h-3.5 w-3.5', accent)} />
          {label}
        </Link>
      ))}
    </div>
  );
}

// ─── Skeleton Dashboard ───────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-6">
      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      {/* Chart row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-48 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-48 rounded-2xl" />
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
    <div className="flex h-full flex-col items-center justify-center gap-4 p-10">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/8">
        <AlertTriangle className="h-7 w-7 text-red-400" />
      </div>
      <div className="text-center">
        <p className="font-semibold text-white">Failed to load dashboard</p>
        <p className="mt-1 text-sm text-[#555]">Could not fetch dashboard data. Please try again.</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="flex items-center gap-2 rounded-xl border border-[#fbbf24]/30 bg-[#fbbf24]/10 px-4 py-2 text-sm font-semibold text-[#fbbf24] transition hover:bg-[#fbbf24]/20"
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

  const greeting  = isAdmin ? `Good ${timeOfDay()}, Admin!` : `Good ${timeOfDay()}!`;

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

  // ── Normalise nested objects so deeply-undefined API fields never crash ──
  const safeStats: DashboardStats = {
    ...stats,
    projectsByStatus: {
      planning:  0,
      active:    0,
      onHold:    0,
      completed: 0,
      cancelled: 0,
      ...( stats.projectsByStatus ?? {}),
    },
    contractsByStatus: {
      draft:    0,
      sent:     0,
      signed:   0,
      rejected: 0,
      ...(stats.contractsByStatus ?? {}),
    },
  };

  return (
    <div className="min-h-full overflow-auto bg-[#0a0a0a] p-4 sm:p-6">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">{greeting}</h1>
          <p className="mt-0.5 text-sm text-[#555]">Here&apos;s your business overview.</p>
        </div>
        <button
          type="button"
          onClick={() => { void refetchStats(); void refetchChart(); }}
          className="flex items-center gap-1.5 rounded-xl border border-[#1e1e1e] px-3 py-2 text-xs text-[#666] transition hover:border-[#2a2a2a] hover:text-white"
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
        className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
      >
        {/* ── Leads / Clients ── */}
        {isAdmin && (
          <KpiCard
            icon={Users}
            label="Total Leads"
            value={safeStats.totalLeads}
            sub={`+${safeStats.newLeadsThisMonth} this month`}
            accent="gold"
          />
        )}
        <KpiCard
          icon={Briefcase}
          label="Total Clients"
          value={safeStats.totalClients}
          sub={`+${safeStats.newClientsThisMonth} this month`}
          accent="blue"
        />
        {/* ── Projects ── */}
        <KpiCard
          icon={FolderOpen}
          label="Active Projects"
          value={safeStats.activeProjects}
          accent="purple"
        />
        {/* ── Tasks ── */}
        <KpiCard
          icon={CheckSquare}
          label="Tasks Done"
          value={`${safeStats.completedTasks}/${safeStats.totalTasks}`}
          sub={`${safeStats.completionRate}% complete`}
          accent={safeStats.completionRate >= 70 ? 'green' : safeStats.completionRate >= 40 ? 'amber' : 'red'}
        />
        <KpiCard
          icon={Clock}
          label="Delayed Tasks"
          value={safeStats.delayedTasks}
          accent={safeStats.delayedTasks > 0 ? 'red' : 'green'}
        />
        {/* ── Financial ── */}
        <KpiCard
          icon={TrendingUp}
          label="Income (Month)"
          value={fmtCurrency(safeStats.totalIncome)}
          accent="green"
          trend="up"
        />
        <KpiCard
          icon={TrendingDown}
          label="Expenses (Month)"
          value={fmtCurrency(safeStats.totalExpenses)}
          accent="red"
          trend="down"
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
        />
        <KpiCard
          icon={FileText}
          label="Contracts Signed"
          value={safeStats.contractsByStatus.signed}
          sub={`${safeStats.contractsByStatus.sent} awaiting signature`}
          accent="gold"
        />
      </motion.div>

      {/* ══════════════════════════════════════════════════════════════════
          MIDDLE ROW: Chart (2/3) + Task Gauge (1/3)
      ══════════════════════════════════════════════════════════════════ */}
      <div className="mb-6 grid gap-4 lg:grid-cols-3">

        {/* Financial Chart — 2 cols */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl border border-[#1e1e1e] bg-[#0d0d0d] p-5 lg:col-span-2"
        >
          <SectionHeader title="Income vs Expenses — Last 6 Months" icon={BarChart3} />

          {/* Legend */}
          <div className="mb-4 flex gap-4 text-[11px]">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-[#888]">Income</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
              <span className="text-[#888]">Expenses</span>
            </span>
          </div>

          <FinancialChart data={chartData} />
        </motion.div>

        {/* Task Gauge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col items-center justify-center rounded-2xl border border-[#1e1e1e] bg-[#0d0d0d] p-5"
        >
          <SectionHeader title="Task Progress" icon={Target} />
          {safeStats.totalTasks === 0 ? (
            <div className="flex flex-col items-center gap-2 text-[#444]">
              <CheckCircle2 className="h-8 w-8" />
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
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 py-2">
              <p className="text-lg font-bold text-amber-400">{safeStats.delayedTasks}</p>
              <p className="text-[10px] text-[#555]">Delayed</p>
            </div>
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/8 py-2">
              <p className="text-lg font-bold text-blue-400">{safeStats.pendingTasks}</p>
              <p className="text-[10px] text-[#555]">Pending</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          BOTTOM ROW: Projects by Status + Contracts + Overdue alert
      ══════════════════════════════════════════════════════════════════ */}
      <div className="mb-6 grid gap-4 lg:grid-cols-2">

        {/* Projects by status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-2xl border border-[#1e1e1e] bg-[#0d0d0d] p-5"
        >
          <SectionHeader title="Projects by Status" icon={FolderOpen} />
          <ProjectStatusBars stats={safeStats} />
        </motion.div>

        {/* Contracts + Overdue alert */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col gap-4 rounded-2xl border border-[#1e1e1e] bg-[#0d0d0d] p-5"
        >
          <SectionHeader title="Contracts" icon={FileText} />
          <ContractPills stats={safeStats} />

          {/* Overdue invoice alert */}
          {safeStats.overdueInvoicesCount > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/8 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-amber-400">
                  {safeStats.overdueInvoicesCount} overdue invoice{safeStats.overdueInvoicesCount !== 1 ? 's' : ''}
                </p>
                <p className="mt-0.5 text-[11px] text-[#666]">
                  {fmtCurrency(safeStats.outstandingInvoices)} total outstanding.{' '}
                  <Link href="/erp/invoices" className="underline hover:text-amber-400">
                    View invoices →
                  </Link>
                </p>
              </div>
            </div>
          )}

          {/* Unsigned contracts alert */}
          {safeStats.contractsByStatus.sent > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-blue-500/20 bg-blue-500/8 p-3">
              <FileText className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-400" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-blue-400">
                  {safeStats.contractsByStatus.sent} contract{safeStats.contractsByStatus.sent !== 1 ? 's' : ''} awaiting signature
                </p>
                <p className="mt-0.5 text-[11px] text-[#666]">
                  <Link href="/erp/contracts" className="underline hover:text-blue-400">
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
        className="rounded-2xl border border-[#1e1e1e] bg-[#0d0d0d] p-5"
      >
        <SectionHeader title="Quick Actions" icon={Activity} />
        <QuickActions />
      </motion.div>
    </div>
  );
}
