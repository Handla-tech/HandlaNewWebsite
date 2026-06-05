'use client';

/**
 * ERP — Reusable TaskList component
 * Accepts a projectId prop and fetches all tasks for that project.
 * Used in the /erp/projects/[id] Tasks tab.
 *
 * Features:
 *  - Table / Kanban view toggle
 *  - Inline status update chip (cycle through statuses on click)
 *  - Quick-add task form at bottom (title + due date)
 *  - Loading skeletons + empty state
 */

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  CheckSquare,
  Plus,
  LayoutGrid,
  List,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Calendar,
  ChevronRight,
} from 'lucide-react';
import { tasksApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Task, TaskStatus } from '@/types';

// ─── Status config ────────────────────────────────────────────────────────────

const TASK_STATUSES: TaskStatus[] = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'DELAYED'];

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

const STATUS_LABEL: Record<TaskStatus, string> = {
  PENDING:     'Pending',
  IN_PROGRESS: 'In Progress',
  COMPLETED:   'Completed',
  DELAYED:     'Delayed',
};

// ─── Quick-add schema ─────────────────────────────────────────────────────────

const quickAddSchema = z.object({
  title:   z.string().min(2, 'At least 2 characters').max(255),
  dueDate: z.string().optional(),
});
type QuickAddValues = z.infer<typeof quickAddSchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: string | null | undefined): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isOverdue(dueDate: string | null, status: TaskStatus): boolean {
  if (!dueDate || status === 'COMPLETED') return false;
  return new Date(dueDate) < new Date();
}

function nextStatus(current: TaskStatus): TaskStatus {
  const idx = TASK_STATUSES.indexOf(current);
  return TASK_STATUSES[(idx + 1) % TASK_STATUSES.length];
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function RowSkeleton() {
  return (
    <div className="animate-pulse flex items-center gap-3 py-3 border-b border-white/5">
      <div className="h-4 w-4 rounded bg-white/10" />
      <div className="flex-1 h-4 rounded bg-white/10" />
      <div className="h-5 w-16 rounded-full bg-white/10" />
      <div className="h-4 w-20 rounded bg-white/5" />
    </div>
  );
}

// ─── Task Table Row ───────────────────────────────────────────────────────────

function TaskTableRow({
  task,
  onStatusCycle,
  isUpdating,
}: {
  task: Task;
  onStatusCycle: (task: Task) => void;
  isUpdating: boolean;
}) {
  const StatusIcon = STATUS_ICON[task.status];
  const overdue = isOverdue(task.dueDate, task.status);

  return (
    <div className="flex items-center gap-3 py-3 border-b border-white/5 group hover:bg-white/2 transition-colors">
      {/* Status chip — click to cycle */}
      <button
        onClick={() => onStatusCycle(task)}
        disabled={isUpdating}
        className={cn(
          'flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium transition-all hover:opacity-80 cursor-pointer disabled:opacity-50',
          STATUS_BADGE[task.status],
        )}
        title={`Click to change status → ${STATUS_LABEL[nextStatus(task.status)]}`}
        aria-label={`Status: ${STATUS_LABEL[task.status]}. Click to change to ${STATUS_LABEL[nextStatus(task.status)]}`}
      >
        <StatusIcon className={cn('h-3 w-3', task.status === 'IN_PROGRESS' && 'animate-spin')} />
        <span className="hidden sm:inline">{STATUS_LABEL[task.status]}</span>
      </button>

      {/* Title */}
      <Link
        href={`/erp/tasks/${task.id}`}
        className="flex-1 min-w-0 text-sm text-white hover:text-[#fbbf24] transition-colors truncate"
      >
        {task.title}
      </Link>

      {/* Assignee */}
      {task.assignee && (
        <span className="hidden md:block text-xs text-white/40 truncate max-w-[100px]">
          {task.assignee.name}
        </span>
      )}

      {/* Due date */}
      <div className={cn('hidden sm:flex items-center gap-1 text-xs min-w-[72px]', overdue ? 'text-red-400' : 'text-white/40')}>
        {task.dueDate && (
          <>
            <Calendar className="h-3 w-3" />
            {formatDate(task.dueDate)}
            {overdue && <AlertTriangle className="h-3 w-3" />}
          </>
        )}
      </div>

      {/* Link arrow */}
      <Link href={`/erp/tasks/${task.id}`} className="opacity-0 group-hover:opacity-100 transition-opacity" aria-label="View task detail">
        <ChevronRight className="h-4 w-4 text-white/30" />
      </Link>
    </div>
  );
}

// ─── Kanban Column ────────────────────────────────────────────────────────────

function KanbanColumn({
  status,
  tasks,
  onStatusCycle,
  isUpdating,
}: {
  status: TaskStatus;
  tasks: Task[];
  onStatusCycle: (task: Task) => void;
  isUpdating: boolean;
}) {
  const StatusIcon = STATUS_ICON[status];
  return (
    <div className="flex flex-col gap-2 min-w-[200px] flex-1">
      <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold', STATUS_BADGE[status])}>
        <StatusIcon className="h-3 w-3" />
        {STATUS_LABEL[status]}
        <span className="ml-auto text-white/40">{tasks.length}</span>
      </div>
      {tasks.map((task) => (
        <div
          key={task.id}
          className="rounded-xl border border-white/10 bg-white/5 p-3 hover:border-[#fbbf24]/20 transition-all cursor-pointer"
          onClick={() => onStatusCycle(task)}
          title={`Click to cycle status → ${STATUS_LABEL[nextStatus(task.status)]}`}
        >
          <p className="text-sm text-white truncate mb-2">{task.title}</p>
          {task.dueDate && (
            <div className={cn('flex items-center gap-1 text-xs', isOverdue(task.dueDate, task.status) ? 'text-red-400' : 'text-white/40')}>
              <Calendar className="h-3 w-3" />
              {formatDate(task.dueDate)}
            </div>
          )}
        </div>
      ))}
      {tasks.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/10 p-4 text-center">
          <p className="text-xs text-white/20">Empty</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface TaskListProps {
  /** UUID of the project whose tasks to display */
  projectId: string;
  /** Whether the current user can create tasks (ADMIN or EMPLOYEE who owns the project) */
  canCreate?: boolean;
}

export function TaskList({ projectId, canCreate = false }: TaskListProps) {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  // ─── Query ──────────────────────────────────────────────────────────────
  const { data: tasks = [], isLoading, isError, refetch } = useQuery<Task[]>({
    queryKey: ['erp-tasks-by-project', projectId],
    queryFn: async () => {
      const res = await tasksApi.getTasksByProject(projectId);
      return res.data.data.tasks as Task[];
    },
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
    enabled: !!projectId,
  });

  // ─── Mutations ──────────────────────────────────────────────────────────
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['erp-tasks-by-project', projectId] });
    queryClient.invalidateQueries({ queryKey: ['erp-tasks'] });
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) => tasksApi.updateTask(id, data),
    onSuccess: () => invalidate(),
  });

  const createMutation = useMutation({
    mutationFn: (data: object) => tasksApi.createTask(data),
    onSuccess: () => { invalidate(); setShowQuickAdd(false); reset(); },
  });

  // ─── Quick-add form ─────────────────────────────────────────────────────
  const { register, handleSubmit, reset, formState: { errors } } = useForm<QuickAddValues>({
    resolver: zodResolver(quickAddSchema),
  });

  const handleStatusCycle = (task: Task) => {
    updateMutation.mutate({ id: task.id, data: { status: nextStatus(task.status) } });
  };

  // Group tasks by status for kanban
  const grouped = TASK_STATUSES.reduce<Record<TaskStatus, Task[]>>((acc, s) => {
    acc[s] = tasks.filter(t => t.status === s);
    return acc;
  }, {} as Record<TaskStatus, Task[]>);

  return (
    <div className="space-y-4">
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-white/50">
          <CheckSquare className="h-4 w-4" />
          {isLoading ? '...' : `${tasks.length} task${tasks.length !== 1 ? 's' : ''}`}
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-white/10 overflow-hidden">
            <button
              onClick={() => setViewMode('table')}
              className={cn('p-1.5 transition-colors', viewMode === 'table' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white')}
              aria-label="Table view"
              aria-pressed={viewMode === 'table'}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={cn('p-1.5 transition-colors', viewMode === 'kanban' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white')}
              aria-label="Kanban view"
              aria-pressed={viewMode === 'kanban'}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
          {canCreate && (
            <button
              onClick={() => setShowQuickAdd(!showQuickAdd)}
              className="flex items-center gap-1.5 rounded-lg border border-[#fbbf24]/30 bg-[#fbbf24]/10 px-2.5 py-1.5 text-xs font-medium text-[#fbbf24] hover:bg-[#fbbf24]/20 transition-colors min-h-[36px]"
            >
              <Plus className="h-3.5 w-3.5" /> Add Task
            </button>
          )}
        </div>
      </div>

      {/* ── Loading / Error ───────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-1">
          {[1,2,3].map(i => <RowSkeleton key={i} />)}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center py-10 gap-3">
          <AlertTriangle className="h-8 w-8 text-red-400/60" />
          <p className="text-sm text-white/50">Failed to load tasks.</p>
          <button onClick={() => refetch()} className="text-xs text-[#fbbf24] hover:underline">Retry</button>
        </div>
      ) : tasks.length === 0 && !showQuickAdd ? (
        <div className="flex flex-col items-center py-12 gap-2">
          <CheckSquare className="h-10 w-10 text-white/10" />
          <p className="text-sm text-white/30">No tasks yet.</p>
          {canCreate && (
            <button
              onClick={() => setShowQuickAdd(true)}
              className="mt-2 text-sm text-[#fbbf24] hover:underline"
            >
              Add the first task
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        /* ── Table View ─────────────────────────────────────────────────── */
        <div className="overflow-x-auto" role="table" aria-label="Tasks table">
          {tasks.map((task) => (
            <TaskTableRow
              key={task.id}
              task={task}
              onStatusCycle={handleStatusCycle}
              isUpdating={updateMutation.isPending}
            />
          ))}
        </div>
      ) : (
        /* ── Kanban View ─────────────────────────────────────────────────── */
        <div className="flex gap-3 overflow-x-auto pb-2">
          {TASK_STATUSES.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={grouped[status]}
              onStatusCycle={handleStatusCycle}
              isUpdating={updateMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* ── Quick-add form ────────────────────────────────────────────────── */}
      {canCreate && showQuickAdd && (
        <form
          onSubmit={handleSubmit((values) => {
            createMutation.mutate({
              title: values.title,
              projectId,
              ...(values.dueDate ? { dueDate: values.dueDate } : {}),
            });
          })}
          className="flex flex-col sm:flex-row gap-2 p-3 rounded-xl border border-[#fbbf24]/20 bg-[#fbbf24]/5"
        >
          <input
            {...register('title')}
            placeholder="Task title..."
            autoFocus
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-[#fbbf24]/50 focus:outline-none"
            aria-label="Quick add task title"
            aria-invalid={!!errors.title}
          />
          {errors.title && <p className="text-xs text-red-400 sm:hidden">{errors.title.message}</p>}
          <input
            type="date"
            {...register('dueDate')}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#fbbf24]/50 focus:outline-none"
            aria-label="Due date"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-1 sm:flex-none rounded-lg bg-[#fbbf24] px-3 py-2 text-xs font-semibold text-black hover:bg-[#f59e0b] disabled:opacity-60 transition-colors"
            >
              {createMutation.isPending ? 'Adding…' : 'Add'}
            </button>
            <button
              type="button"
              onClick={() => { setShowQuickAdd(false); reset(); }}
              className="flex-1 sm:flex-none rounded-lg border border-white/10 px-3 py-2 text-xs text-white/60 hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
