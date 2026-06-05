'use client';

/**
 * ERP — Projects Management Page (/erp/projects)
 * ADMIN + EMPLOYEE: paginated list, stats, search, create/edit/delete.
 * Glassmorphism + #fbbf24 gold design system. EN/AR i18n. RTL aware.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderOpen,
  Search,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  PauseCircle,
  XCircle,
  LayoutGrid,
  Calendar,
  User,
  Briefcase,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { projectsApi, clientsApi } from '@/lib/api';
import { cn, getInitials, getAvatarColor } from '@/lib/utils';
import type { Project, PaginatedProjects, Client } from '@/types';

// ─── Types ─────────────────────────────────────────────────────────────────────

type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';

// ─── Constants ─────────────────────────────────────────────────────────────────

const STATUS_FILTERS: { label: string; value: ProjectStatus | 'ALL' }[] = [
  { label: 'All',       value: 'ALL'       },
  { label: 'Planning',  value: 'PLANNING'  },
  { label: 'Active',    value: 'ACTIVE'    },
  { label: 'On Hold',   value: 'ON_HOLD'   },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

const STATUS_BADGE: Record<ProjectStatus, string> = {
  PLANNING:  'border-blue-400/30    bg-blue-400/10    text-blue-400',
  ACTIVE:    'border-emerald-400/30 bg-emerald-400/10 text-emerald-400',
  ON_HOLD:   'border-amber-400/30   bg-amber-400/10   text-amber-400',
  COMPLETED: 'border-purple-400/30  bg-purple-400/10  text-purple-400',
  CANCELLED: 'border-red-400/30     bg-red-400/10     text-red-400',
};

const STATUS_ICON: Record<ProjectStatus, React.ComponentType<{ className?: string }>> = {
  PLANNING:  Clock,
  ACTIVE:    CheckCircle2,
  ON_HOLD:   PauseCircle,
  COMPLETED: CheckCircle2,
  CANCELLED: XCircle,
};

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const createSchema = z.object({
  title:       z.string().min(2, 'Title must be at least 2 characters').max(255),
  description: z.string().optional(),
  clientId:    z.string().uuid('Please select a valid client'),
  status:      z.enum(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']).default('PLANNING'),
  startDate:   z.string().optional(),
  endDate:     z.string().optional(),
});

const editSchema = createSchema.partial().omit({ clientId: true });

type CreateFormValues = z.infer<typeof createSchema>;
type EditFormValues   = z.infer<typeof editSchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ProjectSkeleton() {
  return (
    <div className="rounded-xl border border-white/5 bg-white/3 p-4 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/10" />
          <div className="space-y-2">
            <div className="h-4 w-40 rounded bg-white/10" />
            <div className="h-3 w-24 rounded bg-white/5" />
          </div>
        </div>
        <div className="h-6 w-20 rounded-full bg-white/10" />
      </div>
      <div className="mt-3 h-3 w-full rounded bg-white/5" />
      <div className="mt-3 flex gap-4">
        <div className="h-3 w-28 rounded bg-white/5" />
        <div className="h-3 w-20 rounded bg-white/5" />
      </div>
    </div>
  );
}

// ─── Project Card ─────────────────────────────────────────────────────────────

interface ProjectCardProps {
  project:   Project;
  isAdmin:   boolean;
  onEdit:    (p: Project) => void;
  onDelete:  (p: Project) => void;
}

function ProjectCard({ project, isAdmin, onEdit, onDelete }: ProjectCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const StatusIcon = STATUS_ICON[project.status as ProjectStatus] ?? Clock;
  const router = useRouter();

  const clientName = project.client?.user?.name ?? 'Unknown Client';
  const ownerName  = project.owner?.name ?? 'Unassigned';

  return (
    <div
      className="group relative rounded-xl border border-white/5 bg-white/3 hover:bg-white/5 transition-colors cursor-pointer"
      onClick={() => router.push(`/erp/projects/${project.id}`)}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={cn(
                'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold',
                getAvatarColor(project.title),
              )}
            >
              {getInitials(project.title)}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-white truncate">{project.title}</p>
              <p className="text-xs text-white/50 truncate mt-0.5">
                <Briefcase className="inline w-3 h-3 mr-1" />
                {clientName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Status badge */}
            <span
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border',
                STATUS_BADGE[project.status as ProjectStatus] ?? STATUS_BADGE.PLANNING,
              )}
            >
              <StatusIcon className="w-3 h-3" />
              {project.status.replace('_', ' ')}
            </span>

            {/* Actions menu */}
            <div
              className="relative"
              onClick={(e) => { e.stopPropagation(); setMenuOpen(prev => !prev); }}
            >
              <button className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors min-h-[36px]">
                <MoreVertical className="w-4 h-4" />
              </button>
              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -5 }}
                    className="absolute right-0 top-full mt-1 w-40 rounded-xl border border-white/10 bg-[#1a1a1a] shadow-xl z-20 overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => { setMenuOpen(false); onEdit(project); }}
                      className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-white/80 hover:bg-white/5 transition-colors min-h-[44px]"
                    >
                      <Pencil className="w-4 h-4" /> Edit Project
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => { setMenuOpen(false); onDelete(project); }}
                        className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-400 hover:bg-red-400/10 transition-colors min-h-[44px]"
                      >
                        <Trash2 className="w-4 h-4" /> Delete Project
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Description */}
        {project.description && (
          <p className="mt-2 text-xs text-white/50 line-clamp-2">{project.description}</p>
        )}

        {/* Meta */}
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-white/40">
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" /> {ownerName}
          </span>
          {project.startDate && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(project.startDate)}
              {project.endDate && ` → ${formatDate(project.endDate)}`}
            </span>
          )}
          <span className="text-white/30">
            {new Date(project.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────

function Modal({ isOpen, onClose, title, subtitle, children }: {
  isOpen: boolean; onClose: () => void;
  title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0d0d0d] shadow-2xl overflow-hidden"
            role="dialog" aria-modal="true"
          >
            <div className="p-6 border-b border-white/5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">{title}</h2>
                  {subtitle && <p className="text-sm text-white/50 mt-0.5">{subtitle}</p>}
                </div>
                <button onClick={onClose} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors min-h-[36px]" aria-label="Close">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ─── Form Field ───────────────────────────────────────────────────────────────

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-white/70 mb-1.5">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-400" role="alert">{error}</p>}
    </div>
  );
}

function inputCls(hasError?: boolean) {
  return cn(
    'w-full rounded-lg border bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-colors focus:bg-white/8 focus:border-[#fbbf24]/50 min-h-[44px]',
    hasError ? 'border-red-400/50' : 'border-white/10',
  );
}

// ─── Create Project Modal ─────────────────────────────────────────────────────

function CreateProjectModal({
  isOpen, onClose, clients, clientsLoading,
}: {
  isOpen: boolean; onClose: () => void; clients: Client[]; clientsLoading: boolean;
}) {
  const qc = useQueryClient();
  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } =
    useForm<CreateFormValues>({ resolver: zodResolver(createSchema) });

  const mutation = useMutation({
    mutationFn: (data: CreateFormValues) => projectsApi.createProject(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['erp-projects'] });
      reset(); onClose();
    },
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Project" subtitle="Create a project for an existing client.">
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <Field label="Project Title *" error={errors.title?.message}>
          <input {...register('title')} placeholder="e.g. Website Redesign" className={inputCls(!!errors.title)} />
        </Field>

        <Field label="Client *" error={errors.clientId?.message}>
          <Controller
            name="clientId"
            control={control}
            render={({ field }) => (
              <select
                {...field}
                disabled={clientsLoading}
                className={cn(inputCls(!!errors.clientId), 'bg-[#1a1a1a]', clientsLoading && 'opacity-60 cursor-wait')}
              >
                <option value="">
                  {clientsLoading ? 'Loading clients…' : clients.length === 0 ? 'No clients found' : 'Select a client…'}
                </option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.user?.name ?? c.id}{c.company ? ` (${c.company})` : ''}
                  </option>
                ))}
              </select>
            )}
          />
        </Field>

        <Field label="Description" error={errors.description?.message}>
          <textarea
            {...register('description')}
            rows={3}
            placeholder="Brief project description…"
            className={cn(inputCls(!!errors.description), 'resize-none h-auto min-h-0 py-2')}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Status" error={errors.status?.message}>
            <Controller
              name="status"
              control={control}
              defaultValue="PLANNING"
              render={({ field }) => (
                <select {...field} className={cn(inputCls(!!errors.status), 'bg-[#1a1a1a]')}>
                  <option value="PLANNING">Planning</option>
                  <option value="ACTIVE">Active</option>
                  <option value="ON_HOLD">On Hold</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              )}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Start Date" error={errors.startDate?.message}>
            <input {...register('startDate')} type="date" className={inputCls(!!errors.startDate)} />
          </Field>
          <Field label="End Date" error={errors.endDate?.message}>
            <input {...register('endDate')} type="date" className={inputCls(!!errors.endDate)} />
          </Field>
        </div>

        {mutation.isError && (
          <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            {(mutation.error as any)?.response?.data?.message ?? 'Failed to create project'}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-white/70 hover:bg-white/5 transition-colors text-sm min-h-[44px]">
            Cancel
          </button>
          <button
            type="submit" disabled={isSubmitting || mutation.isPending}
            className="flex-1 px-4 py-2.5 rounded-lg bg-[#fbbf24] text-black font-semibold hover:bg-[#f59e0b] transition-colors text-sm disabled:opacity-50 min-h-[44px]"
          >
            {mutation.isPending ? 'Creating…' : 'Create Project'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Edit Project Modal ───────────────────────────────────────────────────────

function EditProjectModal({
  isOpen, onClose, project,
}: {
  isOpen: boolean; onClose: () => void; project: Project | null;
}) {
  const qc = useQueryClient();
  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } =
    useForm<EditFormValues>({ resolver: zodResolver(editSchema) });

  const mutation = useMutation({
    mutationFn: (data: EditFormValues) =>
      projectsApi.updateProject(project!.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['erp-projects'] });
      reset(); onClose();
    },
  });

  if (!project) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Project" subtitle="Update project details.">
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <Field label="Project Title" error={errors.title?.message}>
          <input {...register('title')} defaultValue={project.title} placeholder="Project title" className={inputCls(!!errors.title)} />
        </Field>

        <Field label="Description" error={errors.description?.message}>
          <textarea
            {...register('description')}
            defaultValue={project.description ?? ''}
            rows={3}
            placeholder="Brief project description…"
            className={cn(inputCls(!!errors.description), 'resize-none h-auto min-h-0 py-2')}
          />
        </Field>

        <Field label="Status" error={errors.status?.message}>
          <Controller
            name="status"
            control={control}
            defaultValue={project.status as ProjectStatus}
            render={({ field }) => (
              <select {...field} className={cn(inputCls(!!errors.status), 'bg-[#1a1a1a]')}>
                <option value="PLANNING">Planning</option>
                <option value="ACTIVE">Active</option>
                <option value="ON_HOLD">On Hold</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            )}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Start Date" error={errors.startDate?.message}>
            <input {...register('startDate')} type="date" defaultValue={project.startDate ?? ''} className={inputCls(!!errors.startDate)} />
          </Field>
          <Field label="End Date" error={errors.endDate?.message}>
            <input {...register('endDate')} type="date" defaultValue={project.endDate ?? ''} className={inputCls(!!errors.endDate)} />
          </Field>
        </div>

        {mutation.isError && (
          <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            {(mutation.error as any)?.response?.data?.message ?? 'Failed to update project'}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-white/70 hover:bg-white/5 transition-colors text-sm min-h-[44px]">
            Cancel
          </button>
          <button
            type="submit" disabled={isSubmitting || mutation.isPending}
            className="flex-1 px-4 py-2.5 rounded-lg bg-[#fbbf24] text-black font-semibold hover:bg-[#f59e0b] transition-colors text-sm disabled:opacity-50 min-h-[44px]"
          >
            {mutation.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────

function DeleteConfirmDialog({
  isOpen, onClose, project,
}: {
  isOpen: boolean; onClose: () => void; project: Project | null;
}) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => projectsApi.deleteProject(project!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['erp-projects'] });
      onClose();
    },
  });

  if (!project) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Project">
      <div className="space-y-4">
        <p className="text-sm text-white/70">
          Are you sure you want to delete <strong className="text-white">&quot;{project.title}&quot;</strong>?
          This will also delete all tasks associated with it. This action cannot be undone.
        </p>
        {mutation.isError && (
          <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            {(mutation.error as any)?.response?.data?.message ?? 'Failed to delete project'}
          </p>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-white/70 hover:bg-white/5 transition-colors text-sm min-h-[44px]">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="flex-1 px-4 py-2.5 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors text-sm disabled:opacity-50 min-h-[44px]"
          >
            {mutation.isPending ? 'Deleting…' : 'Delete Project'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const [mounted, setMounted] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  // Filters & pagination
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'ALL'>('ALL');
  const [page,         setPage]         = useState(1);

  // Modal state
  const [createOpen,        setCreateOpen]        = useState(false);
  const [editProject,       setEditProject]       = useState<Project | null>(null);
  const [deleteProject,     setDeleteProject]     = useState<Project | null>(null);

  // Mount guard
  if (typeof window !== 'undefined' && !mounted) setMounted(true);

  const isAdmin    = user?.role === 'ADMIN';
  const isEmployee = user?.role === 'EMPLOYEE';

  // Fetch projects
  const params = {
    page,
    limit: 12,
    ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
    ...(search ? { search } : {}),
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['erp-projects', params],
    queryFn:  () => projectsApi.getProjects(params).then(r => r.data.data as PaginatedProjects),
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
    enabled: !!(isAdmin || isEmployee),
  });

  // Fetch clients for create modal — enabled as soon as user is known (not gated
  // behind role check since the route is already protected; firing early avoids
  // an empty dropdown if the modal opens before the role-dependent fetch resolves).
  const { data: clientsData, isLoading: clientsLoading } = useQuery({
    queryKey: ['erp-clients-for-projects'],
    queryFn:  () => clientsApi.getClients({ limit: 100 }).then(r => r.data.data.clients as Client[]),
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
    enabled: !!user,
  });
  const clients = clientsData ?? [];

  // Compute stats from current page data
  const projects  = data?.projects ?? [];
  const total     = data?.total ?? 0;
  const pages     = data?.pages ?? 1;

  // Status count stats (from all projects query without filter)
  const { data: allData } = useQuery({
    queryKey: ['erp-projects-all-stats'],
    queryFn:  () => projectsApi.getProjects({ limit: 200 }).then(r => r.data.data as PaginatedProjects),
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
    enabled: !!(isAdmin || isEmployee),
  });

  const allProjects = allData?.projects ?? [];
  const stats = {
    total:     allData?.total ?? 0,
    planning:  allProjects.filter(p => p.status === 'PLANNING').length,
    active:    allProjects.filter(p => p.status === 'ACTIVE').length,
    onHold:    allProjects.filter(p => p.status === 'ON_HOLD').length,
    completed: allProjects.filter(p => p.status === 'COMPLETED').length,
    cancelled: allProjects.filter(p => p.status === 'CANCELLED').length,
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FolderOpen className="w-6 h-6 text-[#fbbf24]" />
            Projects
          </h1>
          <p className="text-sm text-white/50 mt-1">Manage client projects and track progress.</p>
        </div>
        {(isAdmin || isEmployee) && (
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#fbbf24] text-black font-semibold hover:bg-[#f59e0b] transition-colors text-sm min-h-[44px]"
          >
            <Plus className="w-4 h-4" /> New Project
          </button>
        )}
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total',    value: stats.total,     color: 'text-white' },
          { label: 'Planning',  value: stats.planning,  color: 'text-blue-400' },
          { label: 'Active',    value: stats.active,    color: 'text-emerald-400' },
          { label: 'On Hold',   value: stats.onHold,    color: 'text-amber-400' },
          { label: 'Completed', value: stats.completed, color: 'text-purple-400' },
          { label: 'Cancelled', value: stats.cancelled, color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-white/5 bg-white/3 p-3 text-center">
            <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
            <p className="text-xs text-white/50 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            placeholder="Search projects…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder-white/30 outline-none focus:border-[#fbbf24]/50 transition-colors min-h-[44px]"
          />
        </div>
        {/* Status pills */}
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => { setStatusFilter(f.value); setPage(1); }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors min-h-[36px]',
                statusFilter === f.value
                  ? 'bg-[#fbbf24] border-[#fbbf24] text-black'
                  : 'border-white/10 text-white/60 hover:text-white hover:border-white/20',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <ProjectSkeleton key={i} />)}
        </div>
      ) : isError ? (
        <div className="text-center py-20 text-white/50">
          <p className="mb-3">Failed to load projects.</p>
          <button onClick={() => refetch()} className="px-4 py-2 rounded-lg border border-white/10 hover:bg-white/5 text-sm transition-colors">
            Retry
          </button>
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20">
          <LayoutGrid className="w-12 h-12 text-white/10 mx-auto mb-4" />
          <p className="text-white/50 text-sm">
            {isAdmin ? 'No projects found. Create your first project.' : 'You have no projects yet. Create one to get started.'}
          </p>
          {(isAdmin || isEmployee) && (
            <button
              onClick={() => setCreateOpen(true)}
              className="mt-4 px-4 py-2 rounded-lg bg-[#fbbf24]/10 border border-[#fbbf24]/20 text-[#fbbf24] text-sm hover:bg-[#fbbf24]/20 transition-colors"
            >
              + New Project
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {projects.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                isAdmin={isAdmin}
                onEdit={setEditProject}
                onDelete={setDeleteProject}
              />
            ))}
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-white/40">
                Showing {((page - 1) * 12) + 1}–{Math.min(page * 12, total)} of {total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg border border-white/10 text-white/60 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors min-h-[36px]"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 py-1.5 text-sm text-white/60">{page} / {pages}</span>
                <button
                  onClick={() => setPage(p => Math.min(pages, p + 1))}
                  disabled={page === pages}
                  className="p-2 rounded-lg border border-white/10 text-white/60 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors min-h-[36px]"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Modals ── */}
      <CreateProjectModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        clients={clients}
        clientsLoading={clientsLoading}
      />
      <EditProjectModal
        isOpen={!!editProject}
        onClose={() => setEditProject(null)}
        project={editProject}
      />
      <DeleteConfirmDialog
        isOpen={!!deleteProject}
        onClose={() => setDeleteProject(null)}
        project={deleteProject}
      />
    </div>
  );
}
