import React from 'react';
import { View, Text, RefreshControl, ScrollView } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { dashboardApi, projectsApi } from '@/lib/endpoints';
import { Loading } from '@/components/ui';
import {
  ScreenBackground,
  GlassScreen,
  GlassCard,
  StatCard,
  SectionLabel,
  Avatar,
} from '@/components/glass';
import { DonutChart, ProgressRing, GroupedBarChart } from '@/components/charts';
import { useT } from '@/i18n';
import { spacing, radius, font, useTheme } from '@/theme';
import type { DashboardStats, FinancialChartMonth } from '@/types';

// ─── formatters ──────────────────────────────────────────────────────────────
function money(n: number): string {
  const v = Number(n ?? 0);
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
}
function monthShort(ym: string): string {
  // 'YYYY-MM' → 'Jan'
  const [y, m] = ym.split('-').map(Number);
  if (!m) return ym;
  return new Date(y, m - 1, 1).toLocaleString(undefined, { month: 'short' });
}

// ═══════════════════════════════════════════════════════════════════════════
// Staff dashboard
// ═══════════════════════════════════════════════════════════════════════════
function StaffDashboard() {
  const { colors } = useTheme();
  const { t } = useT();

  const stats = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardApi.stats().then((r) => r.data.data as DashboardStats),
  });
  const chart = useQuery({
    queryKey: ['dashboard-financial-chart'],
    queryFn: () => dashboardApi.financialChart().then((r) => r.data.data as FinancialChartMonth[]),
  });

  const d = stats.data;
  const fetching = stats.isFetching || chart.isFetching;

  const refetchAll = () => {
    stats.refetch();
    chart.refetch();
  };

  if (stats.isLoading) {
    return (
      <View style={{ height: 300 }}>
        <Loading />
      </View>
    );
  }

  const projectSlices = d
    ? [
        { label: t('dashboard.projectStatus.active'), value: d.projectsByStatus?.active ?? 0, color: colors.chart[2] },
        { label: t('dashboard.projectStatus.planning'), value: d.projectsByStatus?.planning ?? 0, color: colors.chart[1] },
        { label: t('dashboard.projectStatus.onHold'), value: d.projectsByStatus?.onHold ?? 0, color: colors.chart[0] },
        { label: t('dashboard.projectStatus.completed'), value: d.projectsByStatus?.completed ?? 0, color: colors.chart[4] },
        { label: t('dashboard.projectStatus.cancelled'), value: d.projectsByStatus?.cancelled ?? 0, color: colors.chart[3] },
      ]
    : [];
  const totalProjects = projectSlices.reduce((s, x) => s + x.value, 0);

  const contractSlices = d
    ? [
        { label: t('dashboard.contractStatus.signed'), value: d.contractsByStatus?.signed ?? 0, color: colors.chart[2] },
        { label: t('dashboard.contractStatus.sent'), value: d.contractsByStatus?.sent ?? 0, color: colors.chart[1] },
        { label: t('dashboard.contractStatus.draft'), value: d.contractsByStatus?.draft ?? 0, color: colors.chart[0] },
        { label: t('dashboard.contractStatus.rejected'), value: d.contractsByStatus?.rejected ?? 0, color: colors.chart[3] },
      ]
    : [];

  const months = chart.data ?? [];

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={fetching} onRefresh={refetchAll} tintColor={colors.accent} />}
    >
      {/* Net balance hero */}
      <GlassCard raised padded={false} style={{ marginBottom: spacing.md }}>
        <View style={{ padding: spacing.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View>
              <Text style={{ color: colors.textFaint, fontSize: font.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                {t('dashboard.netBalance')}
              </Text>
              <Text style={{ color: colors.text, fontSize: 34, fontWeight: '800', letterSpacing: -1, marginTop: 4 }}>
                {money(d?.netBalance ?? 0)}
              </Text>
            </View>
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: radius.md,
                backgroundColor: (d?.netBalance ?? 0) >= 0 ? colors.successSoft : colors.dangerSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons
                name={(d?.netBalance ?? 0) >= 0 ? 'trending-up' : 'trending-down'}
                size={24}
                color={(d?.netBalance ?? 0) >= 0 ? colors.success : colors.danger}
              />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.xl, marginTop: spacing.md }}>
            <View>
              <Text style={{ color: colors.success, fontSize: font.md, fontWeight: '800' }}>{money(d?.totalIncome ?? 0)}</Text>
              <Text style={{ color: colors.textFaint, fontSize: font.xs }}>{t('dashboard.income')}</Text>
            </View>
            <View>
              <Text style={{ color: colors.danger, fontSize: font.md, fontWeight: '800' }}>{money(d?.totalExpenses ?? 0)}</Text>
              <Text style={{ color: colors.textFaint, fontSize: font.xs }}>{t('dashboard.expenses')}</Text>
            </View>
            <View>
              <Text style={{ color: colors.warning, fontSize: font.md, fontWeight: '800' }}>{money(d?.outstandingInvoices ?? 0)}</Text>
              <Text style={{ color: colors.textFaint, fontSize: font.xs }}>{t('dashboard.outstanding')}</Text>
            </View>
          </View>
        </View>
      </GlassCard>

      {/* KPI grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg }}>
        <StatCard label={t('dashboard.clients')} value={String(d?.totalClients ?? 0)} icon="people-circle-outline" tint={colors.chart[1]} width="48%" caption={t('dashboard.thisMonthCount', { count: d?.newClientsThisMonth ?? 0 })} />
        <StatCard label={t('dashboard.leads')} value={String(d?.totalLeads ?? 0)} icon="magnet-outline" tint={colors.chart[4]} width="48%" caption={t('dashboard.thisMonthCount', { count: d?.newLeadsThisMonth ?? 0 })} />
        <StatCard label={t('dashboard.activeProjects')} value={String(d?.activeProjects ?? 0)} icon="folder-open-outline" tint={colors.chart[2]} width="48%" />
        <StatCard label={t('dashboard.overdueInvoices')} value={String(d?.overdueInvoicesCount ?? 0)} icon="alert-circle-outline" tint={colors.danger} width="48%" />
      </View>

      {/* Income vs expenses trend */}
      <SectionLabel>{t('dashboard.incomeVsExpenses')}</SectionLabel>
      <GlassCard style={{ marginBottom: spacing.lg }}>
        {months.length === 0 ? (
          <Text style={{ color: colors.textFaint, fontSize: font.sm }}>{t('dashboard.noFinancialHistory')}</Text>
        ) : (
          <GroupedBarChart
            labels={months.map((m) => monthShort(m.month))}
            seriesA={months.map((m) => m.income)}
            seriesB={months.map((m) => m.expenses)}
            colorA={colors.success}
            colorB={colors.danger}
            legendA={t('dashboard.income')}
            legendB={t('dashboard.expenses')}
            height={190}
          />
        )}
      </GlassCard>

      {/* Task completion + projects donut */}
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
        <GlassCard style={{ flex: 1, alignItems: 'center' }}>
          <SectionLabel style={{ alignSelf: 'flex-start' }}>{t('dashboard.taskCompletion')}</SectionLabel>
          <ProgressRing percent={d?.completionRate ?? 0} label={t('dashboard.done')} />
          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
            <Mini label={t('dashboard.doneLabel')} value={d?.completedTasks ?? 0} color={colors.success} />
            <Mini label={t('dashboard.pending')} value={d?.pendingTasks ?? 0} color={colors.warning} />
            <Mini label={t('dashboard.delayed')} value={d?.delayedTasks ?? 0} color={colors.danger} />
          </View>
        </GlassCard>
      </View>

      {/* Projects breakdown donut */}
      <SectionLabel>{t('dashboard.projectsByStatus')}</SectionLabel>
      <GlassCard style={{ marginBottom: spacing.lg }}>
        <DonutChart data={projectSlices} centerValue={String(totalProjects)} centerLabel={t('dashboard.projectsCenter')} />
      </GlassCard>

      {/* Contracts breakdown donut */}
      <SectionLabel>{t('dashboard.contractsByStatus')}</SectionLabel>
      <GlassCard style={{ marginBottom: spacing.lg }}>
        <DonutChart
          data={contractSlices}
          centerValue={String(contractSlices.reduce((s, x) => s + x.value, 0))}
          centerLabel={t('dashboard.contractsCenter')}
        />
      </GlassCard>
    </ScrollView>
  );
}

function Mini({ label, value, color }: { label: string; value: number; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ color, fontSize: font.lg, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: colors.textFaint, fontSize: font.xs }}>{label}</Text>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Client dashboard (non-staff)
// ═══════════════════════════════════════════════════════════════════════════
function ClientDashboard() {
  const { colors } = useTheme();
  const { t } = useT();
  const router = useRouter();

  const projects = useQuery({
    queryKey: ['dashboard-my-projects'],
    queryFn: () => projectsApi.mine({ limit: 20 }).then((r) => r.data.data),
  });

  const rows = projects.data?.projects ?? [];
  const active = rows.filter((p) => p.status === 'ACTIVE').length;
  const completed = rows.filter((p) => p.status === 'COMPLETED').length;

  const shortcuts: { label: string; icon: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap; route: string; tint: string }[] = [
    { label: t('dashboard.shortcutMessages'), icon: 'chatbubbles-outline', route: '/(app)/chat', tint: colors.chart[1] },
    { label: t('dashboard.shortcutSupport'), icon: 'ticket-outline', route: '/(app)/support', tint: colors.chart[0] },
    { label: t('dashboard.shortcutProjects'), icon: 'folder-open-outline', route: '/(app)/projects', tint: colors.chart[2] },
    { label: t('dashboard.shortcutDocuments'), icon: 'briefcase-outline', route: '/(app)/sales', tint: colors.chart[4] },
  ];

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={projects.isFetching} onRefresh={() => projects.refetch()} tintColor={colors.accent} />}
    >
      {/* Portal hero */}
      <GlassCard raised style={{ marginBottom: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <LinearGradient
            colors={colors.accentGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: 46, height: 46, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="sparkles-outline" size={24} color="#0a0a0a" />
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: font.md, fontWeight: '800' }}>{t('dashboard.portalTitle')}</Text>
            <Text style={{ color: colors.textFaint, fontSize: font.sm, marginTop: 2 }}>
              {t('dashboard.portalSubtitle')}
            </Text>
          </View>
        </View>
      </GlassCard>

      {/* Project summary */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg }}>
        <StatCard label={t('dashboard.totalProjects')} value={String(rows.length)} icon="folder-open-outline" tint={colors.chart[2]} width="48%" />
        <StatCard label={t('dashboard.active')} value={String(active)} icon="flash-outline" tint={colors.chart[0]} width="48%" />
        <StatCard label={t('dashboard.completed')} value={String(completed)} icon="checkmark-done-outline" tint={colors.chart[1]} width="100%" />
      </View>

      {/* Shortcuts */}
      <SectionLabel>{t('dashboard.quickActions')}</SectionLabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {shortcuts.map((s) => (
          <GlassCard key={s.label} onPress={() => router.push(s.route as never)} padded={false} style={{ width: '48%' }}>
            <View style={{ padding: spacing.lg, alignItems: 'flex-start', gap: spacing.sm }}>
              <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={s.icon} size={22} color={s.tint} />
              </View>
              <Text style={{ color: colors.text, fontSize: font.md, fontWeight: '700' }}>{s.label}</Text>
            </View>
          </GlassCard>
        ))}
      </View>
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
export default function DashboardScreen() {
  const { colors } = useTheme();
  const { t } = useT();
  const user = useAuthStore((s) => s.user);
  const isStaff = useAuthStore((s) => s.isStaff());

  return (
    <GlassScreen>
      {/* Greeting header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: spacing.md,
        }}
      >
        <Avatar name={user?.name} size={48} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.textFaint, fontSize: font.sm }}>{t('dashboard.welcomeBack')}</Text>
          <Text style={{ color: colors.text, fontSize: font.xl, fontWeight: '800', letterSpacing: -0.5 }} numberOfLines={1}>
            {user?.name ?? 'Handla'}
          </Text>
        </View>
        <View
          style={{
            backgroundColor: colors.accentSoft,
            borderColor: colors.accentBorder,
            borderWidth: 1,
            borderRadius: radius.pill,
            paddingHorizontal: spacing.md,
            paddingVertical: 4,
          }}
        >
          <Text style={{ color: colors.accent, fontSize: font.xs, fontWeight: '800' }}>{user?.role}</Text>
        </View>
      </View>

      {isStaff ? <StaffDashboard /> : <ClientDashboard />}
    </GlassScreen>
  );
}
