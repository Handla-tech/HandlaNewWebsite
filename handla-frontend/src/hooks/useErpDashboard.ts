'use client';

/**
 * useErpDashboard — TanStack Query hooks for ERP Dashboard data.
 *
 * Provides:
 *   - useErpStats()         → DashboardStats (KPI cards, counters, financials)
 *   - useErpFinancialChart() → FinancialChartMonth[] (last 6 months chart data)
 *
 * Both queries:
 *   - staleTime: 30 s  (re-fetch every 30 s when window gains focus)
 *   - retry: 1
 *   - enabled only when the user is authenticated
 */

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { dashboardApi } from '@/lib/api';

// ─── Response types (mirrors backend DTOs) ──────────────────────────────────

export interface ProjectsByStatus {
  planning:  number;
  active:    number;
  onHold:    number;
  completed: number;
  cancelled: number;
}

export interface ContractsByStatus {
  draft:    number;
  sent:     number;
  signed:   number;
  rejected: number;
}

export interface DashboardStats {
  // Lead / Client
  totalLeads:          number;
  totalClients:        number;
  newLeadsThisMonth:   number;
  newClientsThisMonth: number;
  // Projects
  activeProjects:    number;
  projectsByStatus:  ProjectsByStatus;
  // Tasks
  totalTasks:      number;
  completedTasks:  number;
  completionRate:  number;
  delayedTasks:    number;
  pendingTasks:    number;
  // Financial
  totalIncome:          number;
  totalExpenses:        number;
  netBalance:           number;
  outstandingInvoices:  number;
  overdueInvoicesCount: number;
  // Contracts
  contractsByStatus: ContractsByStatus;
}

export interface FinancialChartMonth {
  month:    string; // 'YYYY-MM'
  income:   number;
  expenses: number;
}

// ─── Query keys ──────────────────────────────────────────────────────────────

export const erpDashboardKeys = {
  all:           ['erpDashboard'] as const,
  stats:         () => [...erpDashboardKeys.all, 'stats']          as const,
  financialChart: () => [...erpDashboardKeys.all, 'financialChart'] as const,
};

// ─── Hooks ───────────────────────────────────────────────────────────────────

/**
 * useErpStats — fetches role-aware KPI stats from GET /erp/dashboard/stats.
 */
export function useErpStats() {
  const user = useAuthStore(s => s.user);
  return useQuery<DashboardStats>({
    queryKey: erpDashboardKeys.stats(),
    queryFn:  async () => {
      const res = await dashboardApi.getStats();
      // res        = AxiosResponse
      // res.data   = TransformInterceptor envelope { success, data: DashboardStats, ... }
      // res.data.data = DashboardStats
      return res.data.data as DashboardStats;
    },
    staleTime:        30_000,
    retry:            1,
    enabled:          !!user,
  });
}

/**
 * useErpFinancialChart — fetches last 6 months chart data from
 * GET /erp/dashboard/financial-chart.
 */
export function useErpFinancialChart() {
  const user = useAuthStore(s => s.user);
  return useQuery<FinancialChartMonth[]>({
    queryKey: erpDashboardKeys.financialChart(),
    queryFn:  async () => {
      const res = await dashboardApi.getFinancialChart();
      return res.data.data as FinancialChartMonth[];
    },
    staleTime:        30_000,
    retry:            1,
    enabled:          !!user,
  });
}
