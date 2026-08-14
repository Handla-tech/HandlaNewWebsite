'use client';

/**
 * ERP — Project Detail Page (/erp/projects/[id])
 * Tabs: Overview | Tasks (Tasks tab is a placeholder for ERP-5)
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  FolderOpen,
  ChevronRight,
  Clock,
  CheckCircle2,
  PauseCircle,
  XCircle,
  Calendar,
  User,
  Briefcase,
  CheckSquare,
  FileText,
  ArrowLeft,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import { projectsApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Project, ProjectStatus } from '@/types';
import { TaskList } from '@/components/erp/TaskList';

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  PLANNING:  'border-blue-400/30    bg-blue-400/10    text-blue-400',
  ACTIVE:    'border-emerald-400/30 bg-emerald-400/10 text-emerald-400',
  ON_HOLD:   'border-amber-400/30   bg-amber-400/10   text-amber-400',
  COMPLETED: 'border-purple-400/30  bg-purple-400/10  text-purple-400',
  CANCELLED: 'border-red-400/30     bg-red-400/10     text-red-400',
};

const STATUS_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  PLANNING:  Clock,
  ACTIVE:    CheckCircle2,
  ON_HOLD:   PauseCircle,
  COMPLETED: CheckCircle2,
  CANCELLED: XCircle,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-4 w-48 rounded bg-white/10" />
      <div className="rounded-2xl border border-white/5 bg-white/3 p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-white/10" />
          <div className="space-y-2">
            <div className="h-6 w-56 rounded bg-white/10" />
            <div className="h-4 w-32 rounded bg-white/5" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-white/5" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Tab component ────────────────────────────────────────────────────────────

type Tab = 'overview' | 'tasks';

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProjectDetailPage() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const { user } = useAuth();
  const { t } = useTranslation();
  const router   = useRouter();
  const params   = useParams<{ id: string }>();

  useEffect(() => { setMounted(true); }, []);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['erp-project', params.id],
    queryFn:  () => projectsApi.getProject(params.id).then(r => r.data.data.project as Project),
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
    enabled: !!params.id,
  });

  if (!mounted) return null;

  if (isLoading) return <div className="p-6"><DetailSkeleton /></div>;

  if (isError || !data) {
    return (
      <div className="text-center py-20">
        <p className="text-white/50 mb-4">{t('erp.projects.detail.notFound')}</p>
        <button
          onClick={() => router.push('/erp/projects')}
          className="px-4 py-2 rounded-lg border border-white/10 hover:bg-white/5 text-sm text-white/70 transition-colors"
        >
          ← {t('erp.projects.detail.backToProjects')}
        </button>
      </div>
    );
  }

  const project    = data;
  const StatusIcon = STATUS_ICON[project.status] ?? Clock;
  const clientName = project.client?.user?.name ?? t('erp.ui.unknown');
  const ownerName  = project.owner?.name ?? t('erp.ui.unassigned');

  const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'overview', label: t('erp.projects.tabs.overview'), icon: FileText  },
    { id: 'tasks',    label: t('erp.projects.tabs.tasks'),    icon: CheckSquare },
  ];

  return (
    <div className="space-y-6">
      {/* ── Breadcrumb ── */}
      <nav className="flex items-center gap-2 text-sm text-white/40" aria-label="Breadcrumb">
        <Link href="/erp/projects" className="hover:text-white transition-colors flex items-center gap-1">
          <FolderOpen className="w-4 h-4" /> {t('erp.projects.title')}
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-white/70 truncate max-w-[200px]">{project.title}</span>
      </nav>

      {/* ── Header Card ── */}
      <div className="rounded-2xl border border-white/5 bg-white/3 p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          {/* Icon */}
          <div className="flex-shrink-0 w-14 h-14 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center">
            <FolderOpen className="w-7 h-7 text-[#fbbf24]" />
          </div>

          {/* Title block */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-white truncate">{project.title}</h1>
              <span
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
                  STATUS_BADGE[project.status] ?? STATUS_BADGE.PLANNING,
                )}
              >
                <StatusIcon className="w-3 h-3" />
                {t(`erp.projects.status.${project.status}`)}
              </span>
            </div>

            {/* Client & owner sub-line */}
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-white/50">
              <Link
                href={`/erp/clients/${project.clientId}`}
                className="flex items-center gap-1.5 hover:text-[#fbbf24] transition-colors"
              >
                <Briefcase className="w-3.5 h-3.5" />
                {clientName}
              </Link>
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                {ownerName}
              </span>
            </div>
          </div>

          {/* Back button */}
          <button
            onClick={() => router.push('/erp/projects')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-white/60 hover:bg-white/5 transition-colors text-sm min-h-[44px] flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4" /> {t('erp.ui.back')}
          </button>
        </div>

        {/* Meta pills */}
        <div className="flex flex-wrap gap-3 mt-5 pt-5 border-t border-white/5">
          {project.startDate && (
            <div className="flex items-center gap-1.5 text-xs text-white/50 px-3 py-1.5 rounded-lg bg-white/5">
              <Calendar className="w-3.5 h-3.5 text-[#fbbf24]" />
              {t('erp.projects.detail.startLabel')}: {formatDate(project.startDate)}
            </div>
          )}
          {project.endDate && (
            <div className="flex items-center gap-1.5 text-xs text-white/50 px-3 py-1.5 rounded-lg bg-white/5">
              <Calendar className="w-3.5 h-3.5 text-red-400" />
              {t('erp.projects.detail.dueLabel')}: {formatDate(project.endDate)}
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs text-white/40 px-3 py-1.5 rounded-lg bg-white/5">
            {t('erp.projects.detail.createdLabel')}: {formatDate(project.createdAt)}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 border-b border-white/5 pb-0">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px min-h-[44px]',
                activeTab === tab.id
                  ? 'border-[#fbbf24] text-[#fbbf24]'
                  : 'border-transparent text-white/50 hover:text-white hover:border-white/20',
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
            
          );
        })}
      </div>

      {/* ── Tab Content ── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Description */}
          <div className="lg:col-span-2 rounded-xl border border-white/5 bg-white/3 p-5">
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wide mb-3">
              {t('erp.projects.detail.overview')}
            </h2>
            {project.description ? (
              <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">
                {project.description}
              </p>
            ) : (
              <p className="text-sm text-white/30 italic">{t('erp.projects.detail.noDescription')}</p>
            )}
          </div>

          {/* Metadata sidebar */}
          <div className="rounded-xl border border-white/5 bg-white/3 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wide">
              {t('erp.projects.detail.metadata')}
            </h2>
            <dl className="space-y-3">
              {[
                { label: t('erp.projects.fields.status'), value: t(`erp.projects.status.${project.status}`) },
                { label: t('erp.projects.fields.client'), value: clientName },
                { label: t('erp.projects.fields.owner'),  value: ownerName },
                { label: t('erp.projects.detail.startLabel'),   value: formatDate(project.startDate) },
                { label: t('erp.projects.detail.dueLabel'),     value: formatDate(project.endDate) },
                { label: t('erp.projects.detail.createdLabel'), value: formatDate(project.createdAt) },
                { label: t('erp.projects.detail.updatedLabel'), value: formatDate(project.updatedAt) },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-start gap-2">
                  <dt className="text-xs text-white/40">{label}</dt>
                  <dd className="text-xs text-white/80 text-right">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}

      {activeTab === 'tasks' && (
        <TaskList
          projectId={project.id}
          canCreate={user?.role === 'ADMIN' || user?.role === 'EMPLOYEE'}
        />
      )}
    </div>
  );
}
