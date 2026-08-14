'use client';

/**
 * ERP — Website Projects Management (/erp/website/projects)
 * ADMIN-only: full CRUD on public-facing website portfolio projects.
 *
 * NOTE: these are WEBSITE showcase projects — completely separate from ERP
 * delivery projects (/erp/projects).
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FolderGit2, Plus, Pencil, Trash2, X, Loader2, AlertCircle,
  RefreshCw, ImageIcon, CheckCircle2, Search, ChevronLeft, ChevronRight, Star,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { websiteProjectApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { WebsiteProject } from '@/types';

// ─── Zod schema ───────────────────────────────────────────────────────────────

const schema = z.object({
  title:       z.string().min(2, 'Title is required'),
  clientName:  z.string().optional(),
  summary:     z.string().optional(),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  category:    z.string().optional(),
  imageUrl:    z.string().url('Must be a valid URL').optional().or(z.literal('')),
  projectUrl:  z.string().url('Must be a valid URL').optional().or(z.literal('')),
  tagsCsv:     z.string().optional(),
  featured:    z.boolean(),
  sortOrder:   z.number().min(0),
});

type FormData = z.infer<typeof schema>;

const PAGE_SIZE = 12;
const QUERY_KEY = 'erp-website-projects';

const inputClass =
  'w-full rounded-xl border border-[#2a2a2a] bg-[#141414] px-3 py-2.5 text-sm text-white placeholder-[#555] outline-none transition focus:border-[#fbbf24]/40 focus:ring-1 focus:ring-[#fbbf24]/20';

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-[#aaa]">{label}</label>
      {children}
      {error && (
        <p className="flex items-center gap-1 text-[11px] text-red-400">
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function ProjectModal({
  initial, onClose, onSaved,
}: {
  initial: WebsiteProject | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!initial;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const {
    register, handleSubmit, setValue, watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title:       initial?.title       ?? '',
      clientName:  initial?.clientName  ?? '',
      summary:     initial?.summary     ?? '',
      description: initial?.description  ?? '',
      category:    initial?.category    ?? '',
      imageUrl:    initial?.imageUrl    ?? '',
      projectUrl:  initial?.projectUrl  ?? '',
      tagsCsv:     (initial?.tags ?? []).join(', '),
      featured:    initial?.featured    ?? false,
      sortOrder:   initial?.sortOrder   ?? 0,
    },
  });

  const imageUrl = watch('imageUrl');
  const featured = watch('featured');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const onSubmit = async (data: FormData) => {
    setSubmitError(null);
    const tags = (data.tagsCsv ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const payload = {
      title:       data.title,
      clientName:  data.clientName || null,
      summary:     data.summary || null,
      description: data.description,
      category:    data.category || null,
      imageUrl:    data.imageUrl || null,
      projectUrl:  data.projectUrl || null,
      tags:        tags.length ? tags : null,
      featured:    data.featured,
      sortOrder:   data.sortOrder,
    };
    try {
      if (isEdit) await websiteProjectApi.update(initial!.id, payload);
      else await websiteProjectApi.create(payload);
      onSaved();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err instanceof Error ? err.message : null) ||
        'Something went wrong. Please try again.';
      setSubmitError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }} transition={{ type: 'spring', stiffness: 350, damping: 32 }}
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-[#2a2a2a] bg-[#0f0f0f] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#1e1e1e] px-5 py-4">
          <div className="flex items-center gap-2">
            <FolderGit2 className="h-4 w-4 text-[#fbbf24]" />
            <h2 className="text-sm font-semibold text-white">{isEdit ? 'Edit Project' : 'Add Project'}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close dialog"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#555] transition-colors hover:bg-[#1e1e1e] hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="max-h-[72vh] space-y-4 overflow-y-auto px-5 py-5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Title *" error={errors.title?.message}>
              <input {...register('title')} placeholder="TechFlow SaaS Platform" className={inputClass} />
            </Field>
            <Field label="Client / Company" error={errors.clientName?.message}>
              <input {...register('clientName')} placeholder="TechFlow (optional)" className={inputClass} />
            </Field>
          </div>

          <Field label="Summary (one line)" error={errors.summary?.message}>
            <input {...register('summary')} placeholder="Short tagline shown on cards" className={inputClass} />
          </Field>

          <Field label="Description *" error={errors.description?.message}>
            <textarea {...register('description')} rows={4} placeholder="Full project description…" className={cn(inputClass, 'resize-none')} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Category" error={errors.category?.message}>
              <input {...register('category')} placeholder="SaaS, ERP, Mobile…" className={inputClass} />
            </Field>
            <Field label="Sort order" error={errors.sortOrder?.message}>
              <input type="number" {...register('sortOrder', { valueAsNumber: true })} className={inputClass} />
            </Field>
          </div>

          <Field label="Tags (comma-separated)" error={errors.tagsCsv?.message}>
            <input {...register('tagsCsv')} placeholder="Next.js, NestJS, MySQL" className={inputClass} />
          </Field>

          <Field label="Project URL" error={errors.projectUrl?.message}>
            <input {...register('projectUrl')} placeholder="https://… (optional)" className={inputClass} />
          </Field>

          <Field label="Cover Image URL" error={errors.imageUrl?.message}>
            <div className="flex gap-2">
              <input {...register('imageUrl')} placeholder="https://… (optional)" className={cn(inputClass, 'flex-1')} />
              {imageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={imageUrl} alt="preview"
                  className="h-10 w-10 flex-shrink-0 rounded-lg border border-[#2a2a2a] object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-[#2a2a2a] bg-[#141414]">
                  <ImageIcon className="h-4 w-4 text-[#555]" />
                </div>
              )}
            </div>
          </Field>

          <button type="button" onClick={() => setValue('featured', !featured, { shouldValidate: true })}
            className="flex items-center gap-2 rounded-xl border border-[#2a2a2a] bg-[#141414] px-3 py-2.5 text-xs font-medium text-[#aaa] transition-all hover:text-white">
            <Star className={cn('h-4 w-4', featured ? 'fill-[#fbbf24] text-[#fbbf24]' : 'text-[#555]')} />
            {featured ? 'Featured on landing page' : 'Not featured'}
          </button>

          {submitError && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-400">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="rounded-xl border border-[#2a2a2a] bg-[#141414] px-4 py-2 text-xs font-medium text-[#aaa] transition-all hover:text-white">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting}
              className="flex items-center gap-2 rounded-xl border border-[#fbbf24]/30 bg-[#fbbf24]/10 px-4 py-2 text-xs font-semibold text-[#fbbf24] transition-all hover:bg-[#fbbf24]/20 disabled:cursor-wait disabled:opacity-60">
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isEdit ? 'Save Changes' : 'Add Project'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Delete dialog ────────────────────────────────────────────────────────────

function DeleteDialog({ name, onConfirm, onCancel, isDeleting }: {
  name: string; onConfirm: () => void; onCancel: () => void; isDeleting: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="relative z-10 w-full max-w-sm rounded-2xl border border-[#2a2a2a] bg-[#0f0f0f] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10">
          <Trash2 className="h-5 w-5 text-red-400" />
        </div>
        <h3 className="mt-4 text-sm font-semibold text-white">Delete Project?</h3>
        <p className="mt-1.5 text-xs text-[#666]">
          This will permanently remove <span className="text-white">{name}</span>. This action cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel}
            className="rounded-xl border border-[#2a2a2a] bg-[#141414] px-4 py-2 text-xs font-medium text-[#aaa] hover:text-white">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={isDeleting}
            className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-60">
            {isDeleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Delete
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function ProjectRow({ p, onEdit, onDelete }: { p: WebsiteProject; onEdit: () => void; onDelete: () => void }) {
  return (
    <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
      className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0f0f0f] transition-all hover:border-white/[0.12] hover:bg-[#131313]">
      <div className="absolute right-3 top-3 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button type="button" onClick={onEdit} aria-label={`Edit ${p.title}`}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#2a2a2a] bg-[#141414]/90 text-[#666] transition-all hover:border-[#fbbf24]/30 hover:text-[#fbbf24]">
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={onDelete} aria-label={`Delete ${p.title}`}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#2a2a2a] bg-[#141414]/90 text-[#666] transition-all hover:border-red-500/30 hover:text-red-400">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#141414]">
        {p.imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={p.imageUrl} alt={p.title} className="h-full w-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <FolderGit2 className="h-8 w-8 text-[#333]" />
          </div>
        )}
        {p.featured && (
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-[#fbbf24] backdrop-blur-sm">
            <Star className="h-2.5 w-2.5 fill-[#fbbf24]" /> Featured
          </span>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-white">{p.title}</h3>
          {p.category && (
            <span className="flex-shrink-0 rounded-md bg-[#1a1a1a] px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-[#888]">
              {p.category}
            </span>
          )}
        </div>
        {p.clientName && <p className="mt-0.5 text-[11px] text-[#555]">{p.clientName}</p>}
        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[#888]">{p.summary || p.description}</p>
      </div>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WebsiteProjectsPage() {
  const router = useRouter();
  const { user: me, isAdmin, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!authLoading && !isAdmin) router.replace('/erp');
  }, [authLoading, isAdmin, router]);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<WebsiteProject | null>(null);
  const editTargetRef = useRef<WebsiteProject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WebsiteProject | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [QUERY_KEY, page],
    queryFn: async () => {
      const res = await websiteProjectApi.getAll({ page, limit: PAGE_SIZE });
      const payload = (res.data as { data?: { projects?: WebsiteProject[]; total?: number } })?.data;
      const items = Array.isArray(payload?.projects) ? payload!.projects! : [];
      return { items, total: payload?.total ?? items.length };
    },
    staleTime: 30_000,
    enabled: !!me,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const filtered = search.trim()
    ? items.filter((p) =>
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        (p.clientName ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (p.category ?? '').toLowerCase().includes(search.toLowerCase()))
    : items;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => websiteProjectApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      setDeleteTarget(null);
      showSuccess('Project deleted.');
    },
  });

  const showSuccess = useCallback((msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  }, []);

  const handleOpenCreate = () => { editTargetRef.current = null; setEditTarget(null); setModalOpen(true); };
  const handleOpenEdit = (p: WebsiteProject) => { editTargetRef.current = p; setEditTarget(p); setModalOpen(true); };

  const handleModalSaved = useCallback(() => {
    const wasEditing = !!editTargetRef.current;
    queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    setModalOpen(false);
    editTargetRef.current = null;
    setEditTarget(null);
    showSuccess(wasEditing ? 'Project updated.' : 'Project added.');
  }, [queryClient, showSuccess]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-shrink-0 border-b border-white/[0.06] bg-[#0c0c0c] px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <FolderGit2 className="h-5 w-5 text-[#fbbf24]" />
              <h1 className="text-base font-semibold text-white">Website Projects</h1>
              <span className="rounded-full border border-[#fbbf24]/20 bg-[#fbbf24]/5 px-2 py-0.5 text-[10px] text-[#fbbf24]">
                {total} total
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[#555]">
              Portfolio / case studies shown on the public website. Separate from ERP delivery projects.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => refetch()}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#2a2a2a] bg-[#141414] text-[#666] transition-all hover:text-white">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={handleOpenCreate}
              className="flex items-center gap-2 rounded-xl border border-[#fbbf24]/30 bg-[#fbbf24]/10 px-3 py-2 text-xs font-semibold text-[#fbbf24] transition-all hover:bg-[#fbbf24]/20">
              <Plus className="h-3.5 w-3.5" /> Add Project
            </button>
          </div>
        </div>

        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#555]" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, client or category…"
            className="w-full rounded-xl border border-[#2a2a2a] bg-[#141414] py-2 pl-8 pr-8 text-xs text-white placeholder-[#555] outline-none focus:border-[#fbbf24]/40 focus:ring-1 focus:ring-[#fbbf24]/20" />
          {search && (
            <button type="button" onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {successMsg && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="flex flex-shrink-0 items-center gap-2 border-b border-emerald-500/20 bg-emerald-500/5 px-6 py-2.5 text-xs text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
            {successMsg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto bg-[#080808] px-6 py-5">
        {isLoading && (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-[#fbbf24]" /></div>
        )}
        {isError && (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <AlertCircle className="h-8 w-8 text-red-400" />
            <p className="text-sm text-[#666]">Failed to load projects</p>
            <button type="button" onClick={() => refetch()}
              className="rounded-xl border border-[#2a2a2a] px-3 py-1.5 text-xs text-[#aaa] hover:text-white">Retry</button>
          </div>
        )}
        {!isLoading && !isError && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#2a2a2a] bg-[#141414]">
              <FolderGit2 className="h-6 w-6 text-[#555]" />
            </div>
            <p className="text-sm font-medium text-[#666]">{search ? 'No projects match your search' : 'No website projects yet'}</p>
            {!search && (
              <button type="button" onClick={handleOpenCreate}
                className="flex items-center gap-2 rounded-xl border border-[#fbbf24]/20 bg-[#fbbf24]/5 px-3 py-2 text-xs font-semibold text-[#fbbf24] hover:bg-[#fbbf24]/10">
                <Plus className="h-3.5 w-3.5" /> Add your first project
              </button>
            )}
          </div>
        )}
        {!isLoading && !isError && filtered.length > 0 && (
          <AnimatePresence mode="popLayout">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((p) => (
                <ProjectRow key={p.id} p={p} onEdit={() => handleOpenEdit(p)} onDelete={() => setDeleteTarget(p)} />
              ))}
            </div>
          </AnimatePresence>
        )}

        {!isLoading && !isError && totalPages > 1 && !search && (
          <div className="mt-6 flex items-center justify-center gap-3">
            <button type="button" disabled={page === 1} onClick={() => setPage((p) => p - 1)}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#2a2a2a] bg-[#141414] text-[#666] hover:text-white disabled:opacity-40">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs text-[#555]">{page} / {totalPages}</span>
            <button type="button" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#2a2a2a] bg-[#141414] text-[#666] hover:text-white disabled:opacity-40">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {modalOpen && (
          <ProjectModal key="modal" initial={editTarget}
            onClose={() => { setModalOpen(false); setEditTarget(null); }} onSaved={handleModalSaved} />
        )}
        {deleteTarget && (
          <DeleteDialog key="delete" name={deleteTarget.title}
            onConfirm={() => deleteMutation.mutate(deleteTarget.id)} onCancel={() => setDeleteTarget(null)}
            isDeleting={deleteMutation.isPending} />
        )}
      </AnimatePresence>
    </div>
  );
}
