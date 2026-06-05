'use client';

/**
 * ERP — Task Detail Page (/erp/tasks/[id])
 * Shows full task details with inline status update for ADMIN and EMPLOYEE.
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckSquare,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Calendar,
  User,
  FolderOpen,
  ArrowLeft,
  ChevronDown,
  Check,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { tasksApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Task, TaskStatus } from '@/types';

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<TaskStatus, string> = {
  PENDING:     'border-slate-400/30  bg-slate-400/10  text-slate-300',
  IN_PROGRESS: 'border-blue-400/30   bg-blue-400/10   text-blue-400',
  COMPLETED:   'border-emerald-400/30 bg-emerald-400/10 text-emerald-400',
  DELAYED:     'border-red-400/30    bg-red-400/10    text-red-400',
};

const STATUS_ICON: Record<TaskStatus, React.ComponentType<{ className?: string }>> = {
  PENDING:     Clock,
  IN_PROGRESS: Loader2,
  COMPLETED:   CheckCircle2,
  DELAYED:     AlertTriangle,
};

const ALL_STATUSES: TaskStatus[] = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'DELAYED'];

const STATUS_LABEL: Record<TaskStatus, string> = {
  PENDING:     'Pending',
  IN_PROGRESS: 'In Progress',
  COMPLETED:   'Completed',
  DELAYED:     'Delayed',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function isOverdue(dueDate: string | null, status: TaskStatus): boolean {
  if (!dueDate || status === 'COMPLETED') return false;
  return new Date(dueDate) < new Date();
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-64 rounded bg-white/10" />
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
        <div className="h-6 w-48 rounded bg-white/10" />
        <div className="grid grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-10 rounded bg-white/5" />)}
        </div>
      </div>
    </div>
  );
}

// ─── Meta pill ────────────────────────────────────────────────────────────────

function MetaPill({ icon: Icon, label, value, className }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-white/3', className)}>
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5">
        <Icon className="h-4 w-4 text-white/50" />
      </div>
      <div>
        <p className="text-xs text-white/40">{label}</p>
        <p className="text-sm text-white font-medium">{value}</p>
      </div>
    </div>
  );
}

// ─── Status Selector ─────────────────────────────────────────────────────────

function StatusSelector({
  current,
  onChange,
  isPending,
}: {
  current: TaskStatus;
  onChange: (s: TaskStatus) => void;
  isPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const CurrentIcon = STATUS_ICON[current];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        disabled={isPending}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-colors min-h-[44px]',
          STATUS_BADGE[current],
          'hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed',
        )}
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <CurrentIcon className={cn('h-3.5 w-3.5', current === 'IN_PROGRESS' && 'animate-spin')} />
        )}
        {STATUS_LABEL[current]}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-1 left-0 z-20 w-44 rounded-xl border border-[#2a2a2a] bg-[#111] py-1 shadow-xl">
            {ALL_STATUSES.map(status => {
              const Icon = STATUS_ICON[status];
              const isActive = status === current;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => { onChange(status); setOpen(false); }}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2.5 text-xs transition-colors min-h-[44px]',
                    isActive
                      ? 'text-white bg-white/5'
                      : 'text-white/60 hover:text-white hover:bg-white/5',
                  )}
                >
                  <Icon className={cn('h-3.5 w-3.5', status === 'IN_PROGRESS' && isActive && 'animate-spin')} />
                  {STATUS_LABEL[status]}
                  {isActive && <Check className="ml-auto h-3 w-3 text-[#fbbf24]" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => { setMounted(true); }, []);

  const canUpdateStatus = user?.role === 'ADMIN' || user?.role === 'EMPLOYEE';

  const { data, isLoading, isError } = useQuery({
    queryKey: ['erp-task', id],
    queryFn: async () => {
      const res = await tasksApi.getTask(id);
      return res.data.data.task as Task;
    },
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
    enabled: !!id,
  });

  const statusMutation = useMutation({
    mutationFn: (status: TaskStatus) => tasksApi.updateTask(id, { status }),
    onSuccess: (res: any) => {
      // Update cache with new task data
      const updated = res?.data?.data?.task as Task | undefined;
      if (updated) {
        qc.setQueryData(['erp-task', id], updated);
      } else {
        qc.invalidateQueries({ queryKey: ['erp-task', id] });
      }
      // Also invalidate task list
      qc.invalidateQueries({ queryKey: ['erp-tasks'] });
      setSuccessMsg('Status updated');
      setTimeout(() => setSuccessMsg(''), 3000);
    },
  });

  if (!mounted) return null;

  if (isLoading) return <DetailSkeleton />;

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center py-20 gap-4">
        <AlertTriangle className="h-12 w-12 text-red-400/60" />
        <p className="text-white/50">Task not found or you don&apos;t have access.</p>
        <button onClick={() => router.back()} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/5 transition-colors">
          Go Back
        </button>
      </div>
    );
  }

  const task = data;
  const overdue = isOverdue(task.dueDate, task.status);

  return (
    <div className="space-y-6">
      {/* ── Breadcrumb ─────────────────────────────────────────────────────── */}
      <nav className="flex items-center gap-2 text-sm text-white/40" aria-label="Breadcrumb">
        <Link href="/erp/tasks" className="hover:text-white transition-colors">Tasks</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-white/70 truncate max-w-[200px]">{task.title}</span>
      </nav>

      {/* ── Success toast ──────────────────────────────────────────────────── */}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2.5 text-sm text-emerald-400">
          <Check className="h-4 w-4" /> {successMsg}
        </div>
      )}

      {/* ── Header card ────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl border border-[#fbbf24]/20 bg-[#fbbf24]/10">
            <CheckSquare className="h-7 w-7 text-[#fbbf24]" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-white break-words">{task.title}</h1>
              {overdue && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 text-xs text-red-400">
                  <AlertTriangle className="h-3 w-3" /> Overdue
                </span>
              )}
            </div>

            {/* Project link */}
            {task.project && (
              <Link
                href={`/erp/projects/${task.projectId}`}
                className="inline-flex items-center gap-1.5 text-sm text-[#fbbf24]/70 hover:text-[#fbbf24] transition-colors"
              >
                <FolderOpen className="h-4 w-4" />
                {task.project.title}
              </Link>
            )}

            {/* Status selector — inline, shown directly below title */}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <p className="text-xs text-white/40">Status:</p>
              {canUpdateStatus ? (
                <StatusSelector
                  current={task.status}
                  onChange={(s) => statusMutation.mutate(s)}
                  isPending={statusMutation.isPending}
                />
              ) : (
                (() => {
                  const Icon = STATUS_ICON[task.status];
                  return (
                    <span className={cn('inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium', STATUS_BADGE[task.status])}>
                      <Icon className={cn('h-3 w-3', task.status === 'IN_PROGRESS' && 'animate-spin')} />
                      {STATUS_LABEL[task.status]}
                    </span>
                  );
                })()
              )}
              {statusMutation.isError && (
                <span className="text-xs text-red-400">Failed to update status</span>
              )}
            </div>
          </div>

          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors min-h-[44px] flex-shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </div>
      </div>

      {/* ── Content grid ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Description */}
        <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wide mb-4">Description</h2>
          {task.description ? (
            <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">{task.description}</p>
          ) : (
            <p className="text-sm text-white/30 italic">No description provided.</p>
          )}
        </div>

        {/* Metadata sidebar */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wide px-1">Details</h2>

          <MetaPill
            icon={Calendar}
            label="Due Date"
            value={<span className={overdue ? 'text-red-400' : 'text-white'}>{task.dueDate ? formatDate(task.dueDate) : '—'}</span>}
          />

          {task.assignee && (
            <MetaPill
              icon={User}
              label="Assignee"
              value={task.assignee.name}
            />
          )}

          {task.owner && (
            <MetaPill
              icon={User}
              label="Owner"
              value={task.owner.name}
            />
          )}

          {task.project?.client && (
            <MetaPill
              icon={FolderOpen}
              label="Client"
              value={task.project.client.company ?? `Client #${task.project.clientId.slice(0, 8)}`}
            />
          )}

          <MetaPill
            icon={Clock}
            label="Created"
            value={formatDate(task.createdAt)}
          />

          <MetaPill
            icon={Clock}
            label="Updated"
            value={formatDate(task.updatedAt)}
          />
        </div>
      </div>
    </div>
  );
}
