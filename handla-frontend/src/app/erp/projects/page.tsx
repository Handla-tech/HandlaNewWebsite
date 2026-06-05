'use client';

/**
 * ERP — Projects Management Page (/erp/projects)
 * Enhanced premium UI
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
  AlertCircle,
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

// ─── Shared styles ─────────────────────────────────────────────────────────────

const inputCls = (hasError?: boolean) => cn(
  'w-full rounded-xl border bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none transition-all focus:bg-white/[0.06] focus:border-[#fbbf24]/50 min-h-[44px]',
  hasError ? 'border-red-400/50' : 'border-white/10',
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ProjectSkeleton() {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0f0f0f] p-4 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/[0.06]" />
          <div className="space-y-2 pt-0.5">
            <div className="h-4 w-40 rounded-lg bg-white/[0.06]" />
            <div className="h-3 w-24 rounded-lg bg-white/[0.04]" />
          </div>
        </div>
        <div className="h-6 w-20 rounded-full bg-white/[0.06]" />
      </div>
      <div className="mt-3 h-3 w-full rounded-lg bg-white/[0.04]" />
      <div className="mt-3 flex gap-4">
        <div className="h-3 w-28 rounded-lg bg-white/[0.04]" />
        <div className="h-3 w-20 rounded-lg bg-white/[0.04]" />
      </div>
    </div>
  );
}

// ─── Project Card ─────────────────────────────────────────────────────────────

interface ProjectCardProps {
  project:  Project;
  isAdmin:  boolean;
  onEdit:   (p: Project) => void;
  onDelete: (p: Project) => void;
}

function ProjectCard({ project, isAdmin, onEdit, onDelete }: ProjectCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const StatusIcon = STATUS_ICON[project.status as ProjectStatus] ?? Clock;
  const router     = useRouter();

  const clientName = project.client?.user?.name ?? 'Unknown Client';
  const ownerName  = project.owner?.name ?? 'Unassigned';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative rounded-2xl border border-white/[0.06] bg-[#0f0f0f] hover:bg-[#131313] hover:border-white/[0.10] transition-all duration-200 cursor-pointer"
      onClick={() => router.push(`/erp/projects/${project.id}`)}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(
              'flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ring-2 ring-black/20',
              getAvatarColor(project.title),
            )}>
              {getInitials(project.title)}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-white truncate text-sm">{project.title}</p>
              <p className="text-[11px] text-white/35 truncate mt-0.5 flex items-center gap-1">
                <Briefcase className="inline w-3 h-3 flex-shrink-0" />
                {clientName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={cn(
              'flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border',
              STATUS_BADGE[project.status as ProjectStatus] ?? STATUS_BADGE.PLANNING,
            )}>
              <StatusIcon className="w-3 h-3" />
              {project.status.replace('_', ' ')}
            </span>

            <div className="relative" onClick={(e) => { e.stopPropagation(); setMenuOpen(prev => !prev); }}>
              <button className="flex h-7 w-7 items-center justify-center rounded-lg text-white/25 hover:text-white hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100">
                <MoreVertical className="w-4 h-4" />
              </button>
              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -5 }}
                    className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-white/10 bg-[#161616] shadow-2xl z-20 overflow-hidden py-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => { setMenuOpen(false); onEdit(project); }}
                      className="flex items-center gap-2.5 w-full px-3.5 py-2 text-sm text-white/70 hover:bg-white/[0.06] hover:text-white transition-colors min-h-[40px]"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Edit Project
                    </button>
                    {isAdmin && (
                      <>
                        <div className="my-1 border-t border-white/[0.06]" />
                        <button
                          onClick={() => { setMenuOpen(false); onDelete(project); }}
                          className="flex items-center gap-2.5 w-full px-3.5 py-2 text-sm text-red-400 hover:bg-red-400/10 transition-colors min-h-[40px]"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Description */}
        {project.description && (
          <p className="mt-2.5 text-[11px] text-white/35 line-clamp-2 leading-relaxed">{project.description}</p>
        )}

        {/* Meta */}
        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-white/30 pt-3 border-t border-white/[0.05]">
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
        </div>
      </div>
    </motion.div>
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
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#111] shadow-2xl overflow-hidden"
            role="dialog" aria-modal="true"
          >
            <div className="p-5 border-b border-white/[0.06]">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-base font-bold text-white">{title}</h2>
                  {subtitle && <p className="text-xs text-white/30 mt-0.5">{subtitle}</p>}
                </div>
                <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors" aria-label="Close">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-5">{children}</div>
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
      <label className="block text-xs font-medium text-white/50 mb-1.5">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-400" role="alert">{error}</p>}
    </div>
  );
}

// ─── Create Project Modal ─────────────────────────────────────────────────────

function CreateProjectModal({ isOpen, onClose, clients, clientsLoading }: {
  isOpen: boolean; onClose: () => void; clients: Client[]; clientsLoading: boolean;
}) {
  const qc = useQueryClient();
  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } =
    useForm<CreateFormValues>({ resolver: zodResolver(createSchema) });

  const mutation = useMutation({
    mutationFn: (data: CreateFormValues) => projectsApi.createProject(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['erp-projects'] }); reset(); onClose(); },
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Project" subtitle="Create a project for an existing client.">
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <Field label="Project Title *" error={errors.title?.message}>
          <input {...register('title')} placeholder="e.g. Website Redesign" className={inputCls(!!errors.title)} />
        </Field>

        <Field label="Client *" error={errors.clientId?.message}>
          <Controller name="clientId" control={control} render={({ field }) => (
            <select {...field} disabled={clientsLoading} className={cn(inputCls(!!errors.clientId), 'bg-[#0f0f0f]', clientsLoading && 'opacity-60 cursor-wait')}>
              <option value="">{clientsLoading ? 'Loading clients…' : clients.length === 0 ? 'No clients found' : 'Select a client…'}</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.user?.name ?? c.id}{c.company ? ` (${c.company})` : ''}</option>)}
            </select>
          )} />
        </Field>

        <Field label="Description" error={errors.description?.message}>
          <textarea {...register('description')} rows={3} placeholder="Brief project description…" className={cn(inputCls(!!errors.description), 'resize-none h-auto min-h-0 py-2')} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Status" error={errors.status?.message}>
            <Controller name="status" control={control} defaultValue="PLANNING" render={({ field }) => (
              <select {...field} className={cn(inputCls(!!errors.status), 'bg-[#0f0f0f]')}>
                <option value="PLANNING">Planning</option>
                <option value="ACTIVE">Active</option>
                <option value="ON_HOLD">On Hold</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            )} />
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
          <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {(mutation.error as any)?.response?.data?.message ?? 'Failed to create project'}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white transition-colors text-sm min-h-[44px]">Cancel</button>
          <button type="submit" disabled={isSubmitting || mutation.isPending}
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#fbbf24] text-black font-semibold hover:bg-[#f59e0b] transition-colors text-sm disabled:opacity-50 min-h-[44px]">
            {mutation.isPending ? 'Creating…' : 'Create Project'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Edit Project Modal ───────────────────────────────────────────────────────

function EditProjectModal({ isOpen, onClose, project }: { isOpen: boolean; onClose: () => void; project: Project | null }) {
  const qc = useQueryClient();
  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } =
    useForm<EditFormValues>({ resolver: zodResolver(editSchema) });

  const mutation = useMutation({
    mutationFn: (data: EditFormValues) => projectsApi.updateProject(project!.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['erp-projects'] }); reset(); onClose(); },
  });

  if (!project) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Project" subtitle="Update project details.">
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <Field label="Project Title" error={errors.title?.message}>
          <input {...register('title')} defaultValue={project.title} className={inputCls(!!errors.title)} />
        </Field>
        <Field label="Description" error={errors.description?.message}>
          <textarea {...register('description')} defaultValue={project.description ?? ''} rows={3} className={cn(inputCls(!!errors.description), 'resize-none h-auto min-h-0 py-2')} />
        </Field>
        <Field label="Status" error={errors.status?.message}>
          <Controller name="status" control={control} defaultValue={project.status as ProjectStatus} render={({ field }) => (
            <select {...field} className={cn(inputCls(!!errors.status), 'bg-[#0f0f0f]')}>
              <option value="PLANNING">Planning</option>
              <option value="ACTIVE">Active</option>
              <option value="ON_HOLD">On Hold</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          )} />
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
          <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {(mutation.error as any)?.response?.data?.message ?? 'Failed to update project'}
          </div>
        )}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white transition-colors text-sm min-h-[44px]">Cancel</button>
          <button type="submit" disabled={isSubmitting || mutation.isPending}
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#fbbf24] text-black font-semibold hover:bg-[#f59e0b] transition-colors text-sm disabled:opacity-50 min-h-[44px]">
            {mutation.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────

function DeleteConfirmDialog({ isOpen, onClose, project }: { isOpen: boolean; onClose: () => void; project: Project | null }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => projectsApi.deleteProject(project!.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['erp-projects'] }); onClose(); },
  });

  if (!project) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Project">
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/8 p-3">
          <Trash2 className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-white/60">
            Are you sure you want to delete <strong className="text-white">&quot;{project.title}&quot;</strong>?
            This will also delete all tasks associated with it. This action cannot be undone.
          </p>
        </div>
        {mutation.isError && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {(mutation.error as any)?.response?.data?.message ?? 'Failed to delete project'}
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white transition-colors text-sm min-h-[44px]">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
            className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors text-sm disabled:opacity-50 min-h-[44px]">
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

  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'ALL'>('ALL');
  const [page,         setPage]         = useState(1);
  const [createOpen,   setCreateOpen]   = useState(false);
  const [editProject,  setEditProject]  = useState<Project | null>(null);
  const [deleteProject, setDeleteProject] = useState<Project | null>(null);

  if (typeof window !== 'undefined' && !mounted) setMounted(true);

  const isAdmin    = user?.role === 'ADMIN';
  const isEmployee = user?.role === 'EMPLOYEE';

  const params = {
    page, limit: 12,
    ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
    ...(search ? { search } : {}),
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['erp-projects', params],
    queryFn:  () => projectsApi.getProjects(params).then(r => r.data.data as PaginatedProjects),
    staleTime: 30_000, retry: 1, refetchOnWindowFocus: false,
    enabled: !!(isAdmin || isEmployee),
  });

  const { data: clientsData, isLoading: clientsLoading } = useQuery({
    queryKey: ['erp-clients-for-projects'],
    queryFn:  () => clientsApi.getClients({ limit: 100 }).then(r => r.data.data.clients as Client[]),
    staleTime: 60_000, retry: 1, refetchOnWindowFocus: false, enabled: !!user,
  });
  const clients = clientsData ?? [];

  const projects = data?.projects ?? [];
  const total    = data?.total ?? 0;
  const pages    = data?.pages ?? 1;

  const { data: allData } = useQuery({
    queryKey: ['erp-projects-all-stats'],
    queryFn:  () => projectsApi.getProjects({ limit: 200 }).then(r => r.data.data as PaginatedProjects),
    staleTime: 60_000, retry: 1, refetchOnWindowFocus: false, enabled: !!(isAdmin || isEmployee),
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
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/20">
              <FolderOpen className="w-4.5 h-4.5 text-purple-400" />
            </span>
            Projects
          </h1>
          <p className="text-sm text-white/30 mt-1 ml-11">Manage client projects and track progress.</p>
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
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {[
          { label: 'Total',    value: stats.total,     color: 'text-white',        border: 'border-white/10',       bg: 'bg-white/[0.03]'  },
          { label: 'Planning', value: stats.planning,  color: 'text-blue-400',     border: 'border-blue-500/15',    bg: 'bg-blue-500/5'    },
          { label: 'Active',   value: stats.active,    color: 'text-emerald-400',  border: 'border-emerald-500/15', bg: 'bg-emerald-500/5' },
          { label: 'On Hold',  value: stats.onHold,    color: 'text-amber-400',    border: 'border-amber-500/15',   bg: 'bg-amber-500/5'   },
          { label: 'Done',     value: stats.completed, color: 'text-purple-400',   border: 'border-purple-500/15',  bg: 'bg-purple-500/5'  },
          { label: 'Cancelled',value: stats.cancelled, color: 'text-red-400',      border: 'border-red-500/15',     bg: 'bg-red-500/5'     },
        ].map(s => (
          <div key={s.label} className={cn('rounded-xl border p-3 text-center', s.border, s.bg)}>
            <p className={cn('text-xl font-bold', s.color)}>{s.value}</p>
            <p className="text-[10px] text-white/30 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
          <input
            type="text" placeholder="Search projects…" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-sm text-white placeholder-white/20 outline-none focus:border-[#fbbf24]/50 focus:bg-white/[0.06] transition-all min-h-[44px]"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map(f => (
            <button key={f.value} onClick={() => { setStatusFilter(f.value); setPage(1); }}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all min-h-[44px] sm:min-h-0',
                statusFilter === f.value
                  ? 'bg-[#fbbf24] border-[#fbbf24] text-black'
                  : 'border-white/10 bg-white/[0.03] text-white/40 hover:text-white hover:border-white/20')}>
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
        <div className="flex flex-col items-center py-20 gap-4">
          <AlertCircle className="w-10 h-10 text-red-400/50" />
          <p className="text-white/30 text-sm">Failed to load projects.</p>
          <button onClick={() => refetch()} className="px-4 py-2 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-sm text-white/60 transition-colors">Retry</button>
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03]">
            <LayoutGrid className="w-8 h-8 text-white/15" />
          </div>
          <div className="text-center">
            <p className="text-white/40 text-sm font-medium">
              {isAdmin ? 'No projects found. Create your first project.' : 'You have no projects yet. Create one to get started.'}
            </p>
          </div>
          {(isAdmin || isEmployee) && (
            <button onClick={() => setCreateOpen(true)}
              className="px-4 py-2 rounded-xl bg-[#fbbf24]/10 border border-[#fbbf24]/20 text-[#fbbf24] text-sm hover:bg-[#fbbf24]/20 transition-colors font-semibold">
              + New Project
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {projects.map(project => (
              <ProjectCard key={project.id} project={project} isAdmin={isAdmin} onEdit={setEditProject} onDelete={setDeleteProject} />
            ))}
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-white/30">
                Showing {((page - 1) * 12) + 1}–{Math.min(page * 12, total)} of {total}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/40 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all" aria-label="Previous page">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="flex items-center px-3 text-sm text-white/40">{page} / {pages}</span>
                <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/40 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all" aria-label="Next page">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Modals ── */}
      <CreateProjectModal isOpen={createOpen} onClose={() => setCreateOpen(false)} clients={clients} clientsLoading={clientsLoading} />
      <EditProjectModal   isOpen={!!editProject}   onClose={() => setEditProject(null)}   project={editProject} />
      <DeleteConfirmDialog isOpen={!!deleteProject} onClose={() => setDeleteProject(null)} project={deleteProject} />
    </div>
  );
}
