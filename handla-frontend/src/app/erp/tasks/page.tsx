'use client';

/**
 * ERP — Tasks Management Page (/erp/tasks)
 * Enhanced premium UI
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/useDebounce';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropdown, DropdownPortal } from '@/components/ui/DropdownPortal';
import {
  CheckSquare,
  Search,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Calendar,
  User,
  FolderOpen,
  ArrowUpRight,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { tasksApi, projectsApi } from '@/lib/api';
import { cn, getInitials, getAvatarColor } from '@/lib/utils';
import type { Task, PaginatedTasks, Project, TaskStatus } from '@/types';

// ─── Constants ─────────────────────────────────────────────────────────────────

const STATUS_FILTERS: { label: string; value: TaskStatus | 'ALL' }[] = [
  { label: 'All',         value: 'ALL'         },
  { label: 'Pending',     value: 'PENDING'     },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'Completed',   value: 'COMPLETED'   },
  { label: 'Delayed',     value: 'DELAYED'     },
];

const STATUS_BADGE: Record<TaskStatus, string> = {
  PENDING:     'border-white/15       bg-white/5         text-white/50',
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

const STATUS_COLOR: Record<TaskStatus, string> = {
  PENDING:     'text-white/40',
  IN_PROGRESS: 'text-blue-400',
  COMPLETED:   'text-emerald-400',
  DELAYED:     'text-red-400',
};

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const createSchema = z.object({
  title:       z.string().min(2, 'Title must be at least 2 characters').max(255),
  description: z.string().optional(),
  projectId:   z.string().uuid('Please select a valid project'),
  assigneeId:  z.string().uuid().optional().or(z.literal('')),
  status:      z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'DELAYED']).default('PENDING'),
  dueDate:     z.string().optional(),
});

type CreateFormValues = z.infer<typeof createSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isOverdue(dueDate: string | null, status: TaskStatus): boolean {
  if (!dueDate || status === 'COMPLETED') return false;
  return new Date(dueDate) < new Date();
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function TaskRowSkeleton() {
  return (
    <div className="animate-pulse flex items-center gap-4 px-4 py-3.5 rounded-xl border border-white/[0.05] bg-white/[0.02]">
      <div className="h-8 w-8 rounded-lg bg-white/[0.06] flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-48 rounded-lg bg-white/[0.06]" />
        <div className="h-3 w-32 rounded-lg bg-white/[0.04]" />
      </div>
      <div className="h-6 w-20 rounded-full bg-white/[0.06]" />
      <div className="h-4 w-24 rounded-lg bg-white/[0.06]" />
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, status }: { label: string; value: number; status: TaskStatus }) {
  const configs: Record<TaskStatus, { border: string; bg: string; color: string }> = {
    PENDING:     { border: 'border-white/10',       bg: 'bg-white/[0.03]',  color: 'text-white/60' },
    IN_PROGRESS: { border: 'border-blue-500/20',    bg: 'bg-blue-500/5',    color: 'text-blue-400' },
    COMPLETED:   { border: 'border-emerald-500/20', bg: 'bg-emerald-500/5', color: 'text-emerald-400' },
    DELAYED:     { border: 'border-red-500/20',     bg: 'bg-red-500/5',     color: 'text-red-400' },
  };
  const cfg = configs[status];
  const Icon = STATUS_ICON[status];
  return (
    <div className={cn('rounded-2xl border p-4', cfg.border, cfg.bg)}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-semibold text-white/25 uppercase tracking-wide">{label}</p>
        <Icon className={cn('w-3.5 h-3.5', STATUS_COLOR[status], status === 'IN_PROGRESS' && 'animate-spin')} />
      </div>
      <p className={cn('text-2xl font-bold', cfg.color)}>{value}</p>
    </div>
  );
}

// ─── Task Row ─────────────────────────────────────────────────────────────────

function TaskRow({ task, role, onEdit, onDelete }: {
  task: Task; role: string; onEdit: (t: Task) => void; onDelete: (t: Task) => void;
}) {
  const menu   = useDropdown('right');
  const router  = useRouter();
  const StatusIcon = STATUS_ICON[task.status];
  const overdue = isOverdue(task.dueDate, task.status);

  return (
    <div
      className="group flex items-center gap-4 px-4 py-3.5 rounded-xl border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04] hover:border-[#fbbf24]/20 transition-all cursor-pointer"
      onClick={() => router.push(`/erp/tasks/${task.id}`)}
    >
      {/* Status icon */}
      <div className={cn(
        'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border',
        task.status === 'PENDING'     && 'border-white/10 bg-white/5',
        task.status === 'IN_PROGRESS' && 'border-blue-400/20 bg-blue-400/10',
        task.status === 'COMPLETED'   && 'border-emerald-400/20 bg-emerald-400/10',
        task.status === 'DELAYED'     && 'border-red-400/20 bg-red-400/10',
      )}>
        <StatusIcon className={cn('h-3.5 w-3.5', STATUS_COLOR[task.status], task.status === 'IN_PROGRESS' && 'animate-spin')} />
      </div>

      {/* Title + project */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-white truncate text-sm">{task.title}</p>
          <ArrowUpRight className="h-3 w-3 text-white/20 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        </div>
        {task.project && (
          <p className="text-[11px] text-white/30 truncate mt-0.5 flex items-center gap-1">
            <FolderOpen className="inline h-3 w-3" />
            {task.project.title}
          </p>
        )}
      </div>

      {/* Status badge */}
      <span className={cn('hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-semibold flex-shrink-0', STATUS_BADGE[task.status])}>
        {task.status.replace('_', ' ')}
      </span>

      {/* Due date */}
      <div className={cn('hidden md:flex items-center gap-1.5 text-[11px] min-w-[100px] flex-shrink-0', overdue ? 'text-red-400' : 'text-white/30')}>
        <Calendar className="h-3 w-3" />
        {task.dueDate ? formatDate(task.dueDate) : '—'}
        {overdue && <AlertTriangle className="h-3 w-3 text-red-400" />}
      </div>

      {/* Assignee */}
      {task.assignee && (
        <div className="hidden lg:flex items-center gap-1.5 flex-shrink-0">
          <span className={cn('h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white', getAvatarColor(task.assignee.name))}>
            {getInitials(task.assignee.name)}
          </span>
          <span className="text-[11px] text-white/30">{task.assignee.name}</span>
        </div>
      )}

      {/* Actions — portal-rendered to escape overflow containers */}
      <div ref={menu.triggerRef} className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={menu.toggle}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-white/25 hover:text-white hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100"
          aria-label="Task actions"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
        <DropdownPortal isOpen={menu.isOpen} style={menu.dropdownStyle} onClose={menu.close} width={152}>
          <div className="rounded-xl border border-white/10 bg-[#161616] shadow-2xl py-1.5">
            <button
              onClick={() => { onEdit(task); menu.close(); }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
            {role === 'ADMIN' && (
              <>
                <div className="my-1 border-t border-white/[0.06]" />
                <button
                  onClick={() => { onDelete(task); menu.close(); }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-400/5 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </>
            )}
          </div>
        </DropdownPortal>
      </div>
    </div>
  );
}

// ─── Task Modal (Create / Edit) ───────────────────────────────────────────────

function TaskModal({ mode, initial, projects, onClose, onSubmit, isLoading }: {
  mode: 'create' | 'edit';
  initial?: Partial<CreateFormValues>;
  projects: Project[];
  onClose: () => void;
  onSubmit: (values: CreateFormValues) => void;
  isLoading: boolean;
}) {
  const { register, handleSubmit, control, formState: { errors } } = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      title: initial?.title ?? '', description: initial?.description ?? '',
      projectId: initial?.projectId ?? '', assigneeId: initial?.assigneeId ?? '',
      status: initial?.status ?? 'PENDING', dueDate: initial?.dueDate ?? '',
    },
  });

  const sharedInput = 'w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder-white/20 focus:border-[#fbbf24]/50 focus:outline-none focus:bg-white/[0.06] transition-all';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative z-10 w-full max-w-lg rounded-2xl border border-white/10 bg-[#111] shadow-2xl"
        role="dialog" aria-modal="true" aria-labelledby="task-modal-title"
      >
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
          <h2 id="task-modal-title" className="text-base font-bold text-white">
            {mode === 'create' ? 'New Task' : 'Edit Task'}
          </h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5" htmlFor="task-title">Title *</label>
            <input id="task-title" {...register('title')} placeholder="Task title" className={sharedInput}
              aria-invalid={!!errors.title} />
            {errors.title && <p className="mt-1 text-xs text-red-400">{errors.title.message}</p>}
          </div>

          {mode === 'create' && (
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5" htmlFor="task-project">Project *</label>
              <Controller name="projectId" control={control} render={({ field }) => (
                <select id="task-project" {...field} className={cn(sharedInput, 'bg-[#0f0f0f]')} aria-invalid={!!errors.projectId}>
                  <option value="">Select a project...</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              )} />
              {errors.projectId && <p className="mt-1 text-xs text-red-400">{errors.projectId.message}</p>}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5" htmlFor="task-desc">Description</label>
            <textarea id="task-desc" {...register('description')} rows={3}
              placeholder="Task description (optional)"
              className={cn(sharedInput, 'resize-none h-auto min-h-0 py-2')} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5" htmlFor="task-status">Status</label>
              <Controller name="status" control={control} render={({ field }) => (
                <select id="task-status" {...field} className={cn(sharedInput, 'bg-[#0f0f0f]')}>
                  <option value="PENDING">Pending</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="DELAYED">Delayed</option>
                </select>
              )} />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5" htmlFor="task-due">Due Date</label>
              <input id="task-due" type="date" {...register('dueDate')} className={sharedInput} />
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] py-2.5 text-sm text-white/60 hover:bg-white/[0.08] hover:text-white transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isLoading}
              className="flex-1 rounded-xl bg-[#fbbf24] py-2.5 text-sm font-semibold text-black hover:bg-[#f59e0b] disabled:opacity-60 transition-colors">
              {isLoading ? 'Saving…' : mode === 'create' ? 'Create Task' : 'Save Changes'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Delete Dialog ────────────────────────────────────────────────────────────

function DeleteDialog({ task, onConfirm, onClose, isLoading }: {
  task: Task; onConfirm: () => void; onClose: () => void; isLoading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="relative z-10 w-full max-w-sm rounded-2xl border border-red-500/20 bg-[#111] p-6 shadow-2xl"
        role="dialog" aria-modal="true"
      >
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20">
          <Trash2 className="h-5 w-5 text-red-400" />
        </div>
        <h3 className="text-base font-bold text-white mb-2">Delete Task</h3>
        <p className="text-sm text-white/50 mb-6">
          Are you sure you want to delete <span className="text-white font-semibold">{task.title}</span>?
          This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] py-2.5 text-sm text-white/60 hover:bg-white/[0.08] hover:text-white transition-colors">Cancel</button>
          <button onClick={onConfirm} disabled={isLoading}
            className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60 transition-colors">
            {isLoading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);

  const [page,         setPage]         = useState(1);
  const [searchInput,  setSearchInput]  = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'ALL'>('ALL');
  const search = useDebounce(searchInput, 300);
  const [createOpen,   setCreateOpen]   = useState(false);
  const [editTask,     setEditTask]     = useState<Task | null>(null);
  const [deleteTask,   setDeleteTask]   = useState<Task | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const params: Record<string, unknown> = { page, limit: 10 };
  if (search)                 params.search = search;
  if (statusFilter !== 'ALL') params.status = statusFilter;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['erp-tasks', params],
    queryFn:  async () => { const res = await tasksApi.getTasks(params); return res.data.data as PaginatedTasks; },
    staleTime: 30_000, retry: 1, refetchOnWindowFocus: false,
    placeholderData: (prev: any) => prev,
  });

  const { data: projectsData } = useQuery({
    queryKey: ['erp-projects-dropdown'],
    queryFn:  async () => { const res = await projectsApi.getProjects({ limit: 50 }); return (res.data.data?.projects ?? []) as Project[]; },
    staleTime: 120_000, retry: 1, refetchOnWindowFocus: false,
  });
  const projects = projectsData ?? [];

  const makeStatQuery = (status: TaskStatus) => ({
    queryKey: ['erp-tasks-stat', status],
    queryFn:  async () => { const res = await tasksApi.getTasks({ limit: 1, status }); return (res.data.data as PaginatedTasks).total; },
    staleTime: 60_000, retry: 1, refetchOnWindowFocus: false,
  });

  const { data: pendingCount    = 0 } = useQuery(makeStatQuery('PENDING'));
  const { data: inProgressCount = 0 } = useQuery(makeStatQuery('IN_PROGRESS'));
  const { data: completedCount  = 0 } = useQuery(makeStatQuery('COMPLETED'));
  const { data: delayedCount    = 0 } = useQuery(makeStatQuery('DELAYED'));

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['erp-tasks'] });
    queryClient.invalidateQueries({ queryKey: ['erp-tasks-stat'] });
  };

  const createMutation = useMutation({
    mutationFn: (data: object) => tasksApi.createTask(data),
    onSuccess:  () => { invalidate(); setCreateOpen(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) => tasksApi.updateTask(id, data),
    onSuccess:  () => { invalidate(); setEditTask(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tasksApi.deleteTask(id),
    onSuccess:  () => { invalidate(); setDeleteTask(null); },
  });

  if (!mounted) return null;

  const tasks      = data?.tasks ?? [];
  const totalPages = data?.pages ?? 1;

  return (
    <div className="space-y-5">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <CheckSquare className="h-4.5 w-4.5 text-emerald-400" />
            </span>
            Tasks
          </h1>
          <p className="mt-1 text-sm text-white/30 ml-11">Manage and track all tasks across projects</p>
        </div>
        {(user?.role === 'ADMIN' || user?.role === 'EMPLOYEE') && (
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-[#fbbf24] px-4 py-2.5 text-sm font-semibold text-black hover:bg-[#f59e0b] transition-colors min-h-[44px]"
          >
            <Plus className="h-4 w-4" /> New Task
          </button>
        )}
      </div>

      {/* ── Stats row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Pending"     value={pendingCount}    status="PENDING"     />
        <StatCard label="In Progress" value={inProgressCount} status="IN_PROGRESS" />
        <StatCard label="Completed"   value={completedCount}  status="COMPLETED"   />
        <StatCard label="Delayed"     value={delayedCount}    status="DELAYED"     />
      </div>

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25" />
          <input
            value={searchInput} onChange={(e) => { setSearchInput(e.target.value); setPage(1); }}
            placeholder="Search tasks..."
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/20 focus:border-[#fbbf24]/50 focus:outline-none focus:bg-white/[0.06] transition-all"
            aria-label="Search tasks"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button key={f.value} onClick={() => { setStatusFilter(f.value); setPage(1); }}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-semibold border transition-all min-h-[44px] sm:min-h-0',
                statusFilter === f.value
                  ? 'bg-[#fbbf24] border-[#fbbf24] text-black'
                  : 'border-white/10 bg-white/[0.03] text-white/40 hover:text-white hover:border-white/20',
              )}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Task List ──────────────────────────────────────────────────── */}
      <div className="space-y-2" role="list" aria-label="Task list" aria-busy={isLoading}>
        {isLoading ? (
          Array(6).fill(0).map((_, i) => <TaskRowSkeleton key={i} />)
        ) : isError ? (
          <div className="flex flex-col items-center py-20 gap-4">
            <AlertTriangle className="h-10 w-10 text-red-400/40" />
            <p className="text-white/30 text-sm">Failed to load tasks.</p>
            <button onClick={() => refetch()} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/50 hover:text-white hover:bg-white/[0.08] transition-colors">Retry</button>
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03]">
              <CheckSquare className="h-8 w-8 text-white/15" />
            </div>
            <p className="text-white/30 text-sm">
              {search || statusFilter !== 'ALL' ? 'No tasks match your filters.' : 'No tasks yet. Create the first one!'}
            </p>
          </div>
        ) : (
          tasks.map((task) => (
            <TaskRow key={task.id} task={task} role={user?.role ?? ''} onEdit={setEditTask} onDelete={setDeleteTask} />
          ))
        )}
      </div>

      {/* ── Pagination ─────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-white/30">{data?.total ?? 0} task{(data?.total ?? 0) !== 1 ? 's' : ''} · page {page} of {totalPages}</p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/40 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all" aria-label="Previous page">
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4));
              const p = start + i;
              return (
                <button key={p} onClick={() => setPage(p)}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg border text-xs font-semibold transition-all',
                    p === page
                      ? 'border-[#fbbf24]/40 bg-[#fbbf24]/10 text-[#fbbf24]'
                      : 'border-white/10 text-white/40 hover:text-white hover:border-white/20',
                  )}
                >{p}</button>
              );
            })}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/40 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all" aria-label="Next page">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {createOpen && (
          <TaskModal
            mode="create" projects={projects} onClose={() => setCreateOpen(false)}
            onSubmit={(values) => {
              const payload: Record<string, unknown> = { title: values.title, projectId: values.projectId, status: values.status };
              if (values.description) payload.description = values.description;
              if (values.dueDate)     payload.dueDate = values.dueDate;
              if (values.assigneeId)  payload.assigneeId = values.assigneeId;
              createMutation.mutate(payload);
            }}
            isLoading={createMutation.isPending}
          />
        )}
        {editTask && (
          <TaskModal
            mode="edit" projects={projects}
            initial={{ title: editTask.title, description: editTask.description ?? '', projectId: editTask.projectId, assigneeId: editTask.assigneeId ?? '', status: editTask.status, dueDate: editTask.dueDate ?? '' }}
            onClose={() => setEditTask(null)}
            onSubmit={(values) => {
              const payload: Record<string, unknown> = { title: values.title, status: values.status };
              if (values.description !== undefined) payload.description = values.description || null;
              if (values.dueDate !== undefined)     payload.dueDate = values.dueDate || null;
              if (values.assigneeId !== undefined)  payload.assigneeId = values.assigneeId || null;
              updateMutation.mutate({ id: editTask.id, data: payload });
            }}
            isLoading={updateMutation.isPending}
          />
        )}
        {deleteTask && (
          <DeleteDialog
            task={deleteTask} onConfirm={() => deleteMutation.mutate(deleteTask.id)}
            onClose={() => setDeleteTask(null)} isLoading={deleteMutation.isPending}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
