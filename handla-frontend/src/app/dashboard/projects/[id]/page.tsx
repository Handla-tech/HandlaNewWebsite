'use client';

/**
 * Client-facing Project Detail Page (/dashboard/projects/[id])
 * Read-only view: overview + task list for the authenticated CLIENT.
 */

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  FolderOpen,
  ChevronLeft,
  Clock,
  CheckCircle2,
  PauseCircle,
  XCircle,
  Calendar,
  Loader2,
  AlertCircle,
  CheckSquare,
  Circle,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { projectsApi, tasksApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Project, ProjectStatus, Task } from '@/types';

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

function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="h-6 w-48 rounded bg-[#1e1e1e]" />
      <div className="h-4 w-full rounded bg-[#1a1a1a]" />
      <div className="h-4 w-3/4 rounded bg-[#1a1a1a]" />
      <div className="mt-6 space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-12 rounded-xl bg-[#1a1a1a]" />
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClientProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const { data: project, isLoading, isError } = useQuery<Project>({
    queryKey: ['dashboard-project', id],
    queryFn: () => projectsApi.getProject(id).then(r => {
      const d = r.data?.data ?? r.data;
      return (d?.project ?? d) as Project;
    }),
    enabled: !!id && !!user,
    staleTime: 30_000,
    retry: 1,
  });

  // Tasks are NOT eagerly loaded on the project endpoint — fetch them
  // separately via the project-scoped task endpoint, which the backend
  // permits for CLIENT users (provided the project belongs to their
  // linked client record).
  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ['dashboard-project-tasks', id],
    queryFn: () => tasksApi.getTasksByProject(id).then(r => {
      const d = r.data?.data ?? r.data;
      return (d?.tasks ?? d ?? []) as Task[];
    }),
    enabled: !!id && !!user,
    staleTime: 30_000,
    retry: 1,
  });

  return (
    <div className="flex h-full flex-col bg-[#0a0a0a]">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 border-b border-[#1e1e1e] px-4 py-4">
        <button
          type="button"
          onClick={() => router.push('/dashboard?tab=projects')}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#555] hover:bg-[#1a1a1a] hover:text-white transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <FolderOpen className="h-4 w-4 text-[#fbbf24] flex-shrink-0" />
          <h1 className="truncate text-sm font-semibold text-white">
            {isLoading ? 'Loading…' : (project?.title ?? 'Project')}
          </h1>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {isLoading && <Skeleton />}

        {isError && (
          <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
            <AlertCircle className="h-8 w-8 text-red-400" />
            <p className="text-sm text-red-400">Failed to load project.</p>
            <button
              onClick={() => router.push('/dashboard?tab=projects')}
              className="text-xs text-white/50 hover:text-white transition-colors"
            >
              ← Back to projects
            </button>
          </div>
        )}

        {project && !isLoading && (
          <div className="p-5 space-y-5">
            {/* Status + badge row */}
            <div className="flex flex-wrap items-center gap-2">
              {(() => {
                const Icon = STATUS_ICON[project.status] ?? Clock;
                return (
                  <span className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold',
                    STATUS_BADGE[project.status],
                  )}>
                    <Icon className="h-3 w-3" />
                    {project.status.replace('_', ' ')}
                  </span>
                );
              })()}
            </div>

            {/* Description */}
            {project.description && (
              <p className="text-sm text-[#aaa] leading-relaxed">{project.description}</p>
            )}

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] px-4 py-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Calendar className="h-3.5 w-3.5 text-[#555]" />
                  <p className="text-[10px] uppercase tracking-wide text-[#555]">Start Date</p>
                </div>
                <p className="text-sm font-medium text-white">{formatDate(project.startDate)}</p>
              </div>
              <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] px-4 py-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Calendar className="h-3.5 w-3.5 text-[#555]" />
                  <p className="text-[10px] uppercase tracking-wide text-[#555]">End Date</p>
                </div>
                <p className="text-sm font-medium text-white">{formatDate(project.endDate)}</p>
              </div>
            </div>

            {/* Tasks */}
            <div>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#555]">
                Tasks {tasks.length > 0 && `(${tasks.length})`}
              </h2>
              {tasks.length === 0 ? (
                <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] px-4 py-6 text-center">
                  <CheckSquare className="mx-auto mb-2 h-6 w-6 text-[#333]" />
                  <p className="text-xs text-[#555]">No tasks yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tasks.map((task: Task) => (
                    <div
                      key={task.id}
                      className="flex items-start gap-3 rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] px-4 py-3"
                    >
                      {task.status === 'COMPLETED' ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
                      ) : (
                        <Circle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#444]" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className={cn(
                          'text-sm font-medium',
                          task.status === 'COMPLETED' ? 'text-[#666] line-through' : 'text-white',
                        )}>
                          {task.title}
                        </p>
                        {task.description && (
                          <p className="mt-0.5 text-xs text-[#555] line-clamp-2">{task.description}</p>
                        )}
                        {task.dueDate && (
                          <p className="mt-1 text-[10px] text-[#444]">
                            Due {formatDate(task.dueDate)}
                          </p>
                        )}
                      </div>
                      <span className={cn(
                        'flex-shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium',
                        task.status === 'COMPLETED'
                          ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-400'
                          : task.status === 'IN_PROGRESS'
                          ? 'border-blue-400/30 bg-blue-400/10 text-blue-400'
                          : 'border-[#333] bg-[#111] text-[#666]',
                      )}>
                        {task.status?.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
