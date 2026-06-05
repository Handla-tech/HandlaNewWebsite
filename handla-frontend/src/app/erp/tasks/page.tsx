'use client';

/**
 * ERP — Tasks Management Page (/erp/tasks)
 * ADMIN + EMPLOYEE: paginated list, stats, search, create/edit/delete.
 * Glassmorphism + #fbbf24 gold design system. EN/AR i18n. RTL aware.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
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
    <div className="animate-pulse flex items-center gap-4 p-4 rounded-xl border border-white/5 bg-white/3">
      <div className="h-4 w-4 rounded bg-white/10" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-48 rounded bg-white/10" />
        <div className="h-3 w-32 rounded bg-white/5" />
      </div>
      <div className="h-6 w-20 rounded-full bg-white/10" />
      <div className="h-4 w-24 rounded bg-white/10" />
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={cn('rounded-2xl border bg-white/5 backdrop-blur-sm p-4', color)}>
      <p className="text-xs text-white/50 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

// ─── Task Row ─────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  role,
  onEdit,
  onDelete,
}: {
  task: Task;
  role: string;
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const StatusIcon = STATUS_ICON[task.status];
  const overdue = isOverdue(task.dueDate, task.status);

  return (
    <div
      className="group flex items-center gap-4 p-4 rounded-xl border border-white/5 bg-white/3 hover:bg-white/5 hover:border-[#fbbf24]/20 transition-all cursor-pointer"
      onClick={() => router.push(`/erp/tasks/${task.id}`)}
    >
      {/* Status icon */}
      <StatusIcon className={cn('h-4 w-4 flex-shrink-0', {
        'text-slate-400': task.status === 'PENDING',
        'text-blue-400 animate-spin': task.status === 'IN_PROGRESS',
        'text-emerald-400': task.status === 'COMPLETED',
        'text-red-400': task.status === 'DELAYED',
      })} />

      {/* Title + project */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-white truncate">{task.title}</p>
        {task.project && (
          <p className="text-xs text-white/40 truncate mt-0.5">
            <FolderOpen className="inline h-3 w-3 mr-1" />
            {task.project.title}
          </p>
        )}
      </div>

      {/* Status badge */}
      <span className={cn('hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium', STATUS_BADGE[task.status])}>
        {task.status.replace('_', ' ')}
      </span>

      {/* Due date */}
      <div className={cn('hidden md:flex items-center gap-1 text-xs min-w-[100px]', overdue ? 'text-red-400' : 'text-white/40')}>
        <Calendar className="h-3 w-3" />
        {task.dueDate ? formatDate(task.dueDate) : '—'}
        {overdue && <AlertTriangle className="h-3 w-3 ml-0.5" />}
      </div>

      {/* Assignee */}
      {task.assignee && (
        <div className="hidden lg:flex items-center gap-1.5">
          <span
            className={cn('h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold text-white', getAvatarColor(task.assignee.name))}
          >
            {getInitials(task.assignee.name)}
          </span>
          <span className="text-xs text-white/50">{task.assignee.name}</span>
        </div>
      )}

      {/* Actions */}
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setOpen(!open)}
          className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all"
          aria-label="Task actions"
        >
          <MoreVertical className="h-4 w-4 text-white/50" />
        </button>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.1 }}
              className="absolute right-0 top-8 z-50 min-w-[140px] rounded-xl border border-white/10 bg-[#1a1a1a] shadow-xl py-1"
            >
              <button
                onClick={() => { onEdit(task); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
              {role === 'ADMIN' && (
                <button
                  onClick={() => { onDelete(task); setOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-400/5 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Task Modal (Create / Edit) ───────────────────────────────────────────────

function TaskModal({
  mode,
  initial,
  projects,
  onClose,
  onSubmit,
  isLoading,
}: {
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
      title:       initial?.title ?? '',
      description: initial?.description ?? '',
      projectId:   initial?.projectId ?? '',
      assigneeId:  initial?.assigneeId ?? '',
      status:      initial?.status ?? 'PENDING',
      dueDate:     initial?.dueDate ?? '',
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative z-10 w-full max-w-lg rounded-2xl border border-white/10 bg-[#111] shadow-2xl p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-modal-title"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 id="task-modal-title" className="text-lg font-bold text-white">
            {mode === 'create' ? 'New Task' : 'Edit Task'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" aria-label="Close">
            <X className="h-4 w-4 text-white/50" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm text-white/60 mb-1.5" htmlFor="task-title">Title *</label>
            <input
              id="task-title"
              {...register('title')}
              placeholder="Task title"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-[#fbbf24]/50 focus:outline-none focus:ring-1 focus:ring-[#fbbf24]/25"
              aria-invalid={!!errors.title}
              aria-describedby={errors.title ? 'title-error' : undefined}
            />
            {errors.title && <p id="title-error" className="mt-1 text-xs text-red-400">{errors.title.message}</p>}
          </div>

          {/* Project */}
          {mode === 'create' && (
            <div>
              <label className="block text-sm text-white/60 mb-1.5" htmlFor="task-project">Project *</label>
              <Controller
                name="projectId"
                control={control}
                render={({ field }) => (
                  <select
                    id="task-project"
                    {...field}
                    className="w-full rounded-xl border border-white/10 bg-[#111] px-4 py-2.5 text-sm text-white focus:border-[#fbbf24]/50 focus:outline-none"
                    aria-invalid={!!errors.projectId}
                  >
                    <option value="">Select a project...</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                )}
              />
              {errors.projectId && <p className="mt-1 text-xs text-red-400">{errors.projectId.message}</p>}
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-sm text-white/60 mb-1.5" htmlFor="task-desc">Description</label>
            <textarea
              id="task-desc"
              {...register('description')}
              rows={3}
              placeholder="Task description (optional)"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-[#fbbf24]/50 focus:outline-none resize-none"
            />
          </div>

          {/* Status + Due date row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-white/60 mb-1.5" htmlFor="task-status">Status</label>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <select
                    id="task-status"
                    {...field}
                    className="w-full rounded-xl border border-white/10 bg-[#111] px-3 py-2.5 text-sm text-white focus:border-[#fbbf24]/50 focus:outline-none"
                  >
                    <option value="PENDING">Pending</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="DELAYED">Delayed</option>
                  </select>
                )}
              />
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-1.5" htmlFor="task-due">Due Date</label>
              <input
                id="task-due"
                type="date"
                {...register('dueDate')}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-[#fbbf24]/50 focus:outline-none"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-white/70 hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 rounded-xl bg-[#fbbf24] py-2.5 text-sm font-semibold text-black hover:bg-[#f59e0b] disabled:opacity-60 transition-colors"
            >
              {isLoading ? 'Saving…' : mode === 'create' ? 'Create Task' : 'Save Changes'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Delete Dialog ────────────────────────────────────────────────────────────

function DeleteDialog({
  task,
  onConfirm,
  onClose,
  isLoading,
}: {
  task: Task;
  onConfirm: () => void;
  onClose: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative z-10 w-full max-w-sm rounded-2xl border border-red-500/20 bg-[#111] p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20">
          <Trash2 className="h-5 w-5 text-red-400" />
        </div>
        <h3 className="text-lg font-bold text-white mb-2">Delete Task</h3>
        <p className="text-sm text-white/60 mb-6">
          Are you sure you want to delete <span className="text-white font-medium">{task.title}</span>?
          This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-white/70 hover:bg-white/5 transition-colors">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60 transition-colors"
          >
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

  // Filter + pagination state
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'ALL'>('ALL');

  // Modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [deleteTask, setDeleteTask] = useState<Task | null>(null);

  useEffect(() => { setMounted(true); }, []);

  // ─── Query: tasks ──────────────────────────────────────────────────────────
  const params: Record<string, unknown> = { page, limit: 20 };
  if (search)                  params.search = search;
  if (statusFilter !== 'ALL')  params.status = statusFilter;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['erp-tasks', params],
    queryFn: async () => {
      const res = await tasksApi.getTasks(params);
      return res.data.data as PaginatedTasks;
    },
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // ─── Query: projects for the create modal dropdown ─────────────────────────
  const { data: projectsData } = useQuery({
    queryKey: ['erp-projects-dropdown'],
    queryFn: async () => {
      const res = await projectsApi.getProjects({ limit: 100 });
      return (res.data.data?.projects ?? []) as Project[];
    },
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  const projects = projectsData ?? [];

  // ─── Stats ─────────────────────────────────────────────────────────────────
  const { data: allData } = useQuery({
    queryKey: ['erp-tasks-all-stats'],
    queryFn: async () => {
      const res = await tasksApi.getTasks({ limit: 1 });
      return res.data.data as PaginatedTasks;
    },
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Stats per status — separate small queries
  const makeStatQuery = (status: TaskStatus) => ({
    queryKey: ['erp-tasks-stat', status],
    queryFn: async () => {
      const res = await tasksApi.getTasks({ limit: 1, status });
      return (res.data.data as PaginatedTasks).total;
    },
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const { data: pendingCount    = 0 } = useQuery(makeStatQuery('PENDING'));
  const { data: inProgressCount = 0 } = useQuery(makeStatQuery('IN_PROGRESS'));
  const { data: completedCount  = 0 } = useQuery(makeStatQuery('COMPLETED'));
  const { data: delayedCount    = 0 } = useQuery(makeStatQuery('DELAYED'));

  // ─── Mutations ─────────────────────────────────────────────────────────────
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['erp-tasks'] });
    queryClient.invalidateQueries({ queryKey: ['erp-tasks-stat'] });
    queryClient.invalidateQueries({ queryKey: ['erp-tasks-all-stats'] });
  };

  const createMutation = useMutation({
    mutationFn: (data: object) => tasksApi.createTask(data),
    onSuccess: () => { invalidate(); setCreateOpen(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) => tasksApi.updateTask(id, data),
    onSuccess: () => { invalidate(); setEditTask(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tasksApi.deleteTask(id),
    onSuccess: () => { invalidate(); setDeleteTask(null); },
  });

  if (!mounted) return null;

  const tasks = data?.tasks ?? [];
  const totalPages = data?.pages ?? 1;
  const totalTasks = allData?.total ?? 0;

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fbbf24]/10 border border-[#fbbf24]/20">
              <CheckSquare className="h-5 w-5 text-[#fbbf24]" />
            </span>
            Tasks
          </h1>
          <p className="mt-1 text-sm text-white/40">Manage and track all tasks across projects</p>
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

      {/* ── Stats row ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Pending"     value={pendingCount}    color="border-slate-400/20"   />
        <StatCard label="In Progress" value={inProgressCount} color="border-blue-400/20"    />
        <StatCard label="Completed"   value={completedCount}  color="border-emerald-400/20" />
        <StatCard label="Delayed"     value={delayedCount}    color="border-red-400/20"     />
      </div>

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search tasks..."
            className="w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-[#fbbf24]/50 focus:outline-none focus:ring-1 focus:ring-[#fbbf24]/25"
            aria-label="Search tasks"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => { setStatusFilter(f.value); setPage(1); }}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors min-h-[44px] sm:min-h-0',
                statusFilter === f.value
                  ? 'bg-[#fbbf24] text-black'
                  : 'border border-white/10 text-white/60 hover:text-white hover:bg-white/5',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Task List ──────────────────────────────────────────────────────── */}
      <div className="space-y-2" role="list" aria-label="Task list" aria-busy={isLoading}>
        {isLoading ? (
          Array(6).fill(0).map((_, i) => <TaskRowSkeleton key={i} />)
        ) : isError ? (
          <div className="flex flex-col items-center py-20 gap-4">
            <AlertTriangle className="h-10 w-10 text-red-400/60" />
            <p className="text-white/50">Failed to load tasks.</p>
            <button onClick={() => refetch()} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/5 transition-colors">
              Retry
            </button>
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-3">
            <CheckSquare className="h-12 w-12 text-white/10" />
            <p className="text-white/40 text-sm">
              {search || statusFilter !== 'ALL' ? 'No tasks match your filters.' : 'No tasks yet. Create the first one!'}
            </p>
          </div>
        ) : (
          tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              role={user?.role ?? ''}
              onEdit={setEditTask}
              onDelete={setDeleteTask}
            />
          ))
        )}
      </div>

      {/* ── Pagination ─────────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-white/40">{totalTasks} total task{totalTasks !== 1 ? 's' : ''}</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg border border-white/10 text-white/50 hover:text-white hover:bg-white/5 disabled:opacity-30 transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm text-white/60">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-lg border border-white/10 text-white/50 hover:text-white hover:bg-white/5 disabled:opacity-30 transition-colors"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {createOpen && (
          <TaskModal
            mode="create"
            projects={projects}
            onClose={() => setCreateOpen(false)}
            onSubmit={(values) => {
              const payload: Record<string, unknown> = {
                title: values.title,
                projectId: values.projectId,
                status: values.status,
              };
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
            mode="edit"
            projects={projects}
            initial={{
              title:       editTask.title,
              description: editTask.description ?? '',
              projectId:   editTask.projectId,
              assigneeId:  editTask.assigneeId ?? '',
              status:      editTask.status,
              dueDate:     editTask.dueDate ?? '',
            }}
            onClose={() => setEditTask(null)}
            onSubmit={(values) => {
              const payload: Record<string, unknown> = {
                title:  values.title,
                status: values.status,
              };
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
            task={deleteTask}
            onConfirm={() => deleteMutation.mutate(deleteTask.id)}
            onClose={() => setDeleteTask(null)}
            isLoading={deleteMutation.isPending}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
