'use client';

/**
 * ERP — Testimonials Management Page (/erp/testimonials)
 * ADMIN-only: full CRUD on public-facing testimonials.
 * Accessible via the ERP sidebar; non-admin users are redirected to /erp.
 */

import {
  useState, useCallback, useRef, useEffect,
} from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  useQuery, useMutation, useQueryClient,
} from '@tanstack/react-query';
import {
  Star, Plus, Pencil, Trash2, X, Loader2,
  AlertCircle, Quote, RefreshCw, ImageIcon,
  CheckCircle2, Search, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { testimonialApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Testimonial } from '@/types';

// ─── Zod schema ───────────────────────────────────────────────────────────────

const testimonialSchema = z.object({
  clientName:    z.string().min(1, 'Client name is required'),
  clientCompany: z.string().optional(),
  content:       z.string().min(10, 'Testimonial must be at least 10 characters'),
  imageUrl:      z.string().url('Must be a valid URL').optional().or(z.literal('')),
  rating:        z.number().min(1).max(5),
});

type TestimonialFormData = z.infer<typeof testimonialSchema>;

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 8;
const QUERY_KEY = 'erp-testimonials';

// ─── Star selector ────────────────────────────────────────────────────────────

function StarSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1" onMouseLeave={() => setHovered(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onMouseEnter={() => setHovered(n)}
          onClick={() => onChange(n)}
          className="transition-transform hover:scale-110"
        >
          <Star
            className={cn(
              'h-5 w-5 transition-colors',
              n <= (hovered || value)
                ? 'fill-[#fbbf24] text-[#fbbf24]'
                : 'fill-transparent text-[#444]',
            )}
          />
        </button>
      ))}
    </div>
  );
}

// ─── Star display ─────────────────────────────────────────────────────────────

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            'h-3.5 w-3.5',
            n <= rating
              ? 'fill-[#fbbf24] text-[#fbbf24]'
              : 'fill-transparent text-[#333]',
          )}
        />
      ))}
    </div>
  );
}

// ─── Form field wrapper ───────────────────────────────────────────────────────

function Field({
  label, error, children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
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

const inputClass =
  'w-full rounded-xl border border-[#2a2a2a] bg-[#141414] px-3 py-2.5 text-sm text-white placeholder-[#555] outline-none transition focus:border-[#fbbf24]/40 focus:ring-1 focus:ring-[#fbbf24]/20';

// ─── Testimonial Modal ────────────────────────────────────────────────────────

function TestimonialModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: Testimonial | null;
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
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TestimonialFormData>({
    resolver: zodResolver(testimonialSchema),
    defaultValues: {
      clientName:    initial?.clientName    ?? '',
      clientCompany: initial?.clientCompany ?? '',
      content:       initial?.content       ?? '',
      imageUrl:      initial?.imageUrl      ?? '',
      rating:        initial?.rating        ?? 5,
    },
  });

  const rating   = watch('rating');
  const imageUrl = watch('imageUrl');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const onSubmit = async (data: TestimonialFormData) => {
    setSubmitError(null);
    const payload = {
      clientName:    data.clientName,
      clientCompany: data.clientCompany || null,
      content:       data.content,
      imageUrl:      data.imageUrl || null,
      rating:        data.rating,
    };
    try {
      if (isEdit) {
        await testimonialApi.update(initial!.id, payload);
      } else {
        await testimonialApi.create(payload);
      }
      onSaved();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })
          ?.response?.data?.message ||
        (err instanceof Error ? err.message : null) ||
        'Something went wrong. Please try again.';
      setSubmitError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? 'Edit Testimonial' : 'Add Testimonial'}
    >
      <motion.div
        key="modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        key="modal-panel"
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ type: 'spring', stiffness: 350, damping: 32 }}
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-[#2a2a2a] bg-[#0f0f0f] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1e1e1e] px-5 py-4">
          <div className="flex items-center gap-2">
            <Quote className="h-4 w-4 text-[#fbbf24]" />
            <h2 className="text-sm font-semibold text-white">
              {isEdit ? 'Edit Testimonial' : 'Add Testimonial'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#555] transition-colors hover:bg-[#1e1e1e] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-5"
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Client Name *" error={errors.clientName?.message}>
              <input
                {...register('clientName')}
                placeholder="Jane Smith"
                className={inputClass}
              />
            </Field>
            <Field label="Company" error={errors.clientCompany?.message}>
              <input
                {...register('clientCompany')}
                placeholder="Acme Corp (optional)"
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Testimonial *" error={errors.content?.message}>
            <textarea
              {...register('content')}
              rows={4}
              placeholder="What the client said…"
              className={cn(inputClass, 'resize-none')}
            />
          </Field>

          <Field label="Avatar Image URL" error={errors.imageUrl?.message}>
            <div className="flex gap-2">
              <input
                {...register('imageUrl')}
                placeholder="https://… (optional)"
                className={cn(inputClass, 'flex-1')}
              />
              {imageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={imageUrl}
                  alt="preview"
                  className="h-10 w-10 flex-shrink-0 rounded-full border border-[#2a2a2a] object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-[#2a2a2a] bg-[#141414]">
                  <ImageIcon className="h-4 w-4 text-[#555]" />
                </div>
              )}
            </div>
          </Field>

          <Field label="Rating *" error={errors.rating?.message}>
            <div className="flex items-center gap-3">
              <StarSelector
                value={rating}
                onChange={(v) => setValue('rating', v, { shouldValidate: true })}
              />
              <span className="text-xs text-[#666]">{rating} / 5</span>
            </div>
          </Field>

          {submitError && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-400">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#2a2a2a] bg-[#141414] px-4 py-2 text-xs font-medium text-[#aaa] transition-all hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-xl border border-[#fbbf24]/30 bg-[#fbbf24]/10 px-4 py-2 text-xs font-semibold text-[#fbbf24] transition-all hover:bg-[#fbbf24]/20 disabled:cursor-wait disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isEdit ? 'Save Changes' : 'Add Testimonial'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Confirm delete dialog ────────────────────────────────────────────────────

function DeleteDialog({
  name,
  onConfirm,
  onCancel,
  isDeleting,
}: {
  name:      string;
  onConfirm: () => void;
  onCancel:  () => void;
  isDeleting: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Confirm delete testimonial"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCancel}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative z-10 w-full max-w-sm rounded-2xl border border-[#2a2a2a] bg-[#0f0f0f] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10">
          <Trash2 className="h-5 w-5 text-red-400" />
        </div>
        <h3 className="mt-4 text-sm font-semibold text-white">Delete Testimonial?</h3>
        <p className="mt-1.5 text-xs text-[#666]">
          This will permanently remove the testimonial from{' '}
          <span className="text-white">{name}</span>. This action cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-[#2a2a2a] bg-[#141414] px-4 py-2 text-xs font-medium text-[#aaa] hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-60"
          >
            {isDeleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Delete
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Testimonial card ─────────────────────────────────────────────────────────

function TestimonialCard({
  t,
  onEdit,
  onDelete,
}: {
  t:        Testimonial;
  onEdit:   () => void;
  onDelete: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="group relative rounded-2xl border border-[#1e1e1e] bg-[#0d0d0d] p-4 transition-all hover:border-[#2a2a2a]"
    >
      {/* Actions — revealed on hover */}
      <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${t.clientName}'s testimonial`}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#2a2a2a] bg-[#141414] text-[#666] transition-all hover:border-[#fbbf24]/30 hover:text-[#fbbf24]"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${t.clientName}'s testimonial`}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#2a2a2a] bg-[#141414] text-[#666] transition-all hover:border-red-500/30 hover:text-red-400"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Rating */}
      <StarDisplay rating={t.rating} />

      {/* Quote */}
      <p className="mt-2.5 line-clamp-3 text-xs leading-relaxed text-[#aaa]">
        &ldquo;{t.content}&rdquo;
      </p>

      {/* Client info */}
      <div className="mt-3 flex items-center gap-2.5 border-t border-[#1a1a1a] pt-3">
        {t.imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={t.imageUrl}
            alt={t.clientName}
            className="h-8 w-8 flex-shrink-0 rounded-full border border-[#2a2a2a] object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-[#2a2a2a] bg-[#1a1a1a] text-[10px] font-bold text-[#888]">
            {t.clientName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-white">{t.clientName}</p>
          {t.clientCompany && (
            <p className="truncate text-[10px] text-[#555]">{t.clientCompany}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TestimonialsPage() {
  const router = useRouter();
  const { user: me, isAdmin, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  // ── ADMIN-only guard ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.replace('/erp');
    }
  }, [authLoading, isAdmin, router]);

  const [page,         setPage]         = useState(1);
  const [search,       setSearch]       = useState('');
  const [modalOpen,    setModalOpen]    = useState(false);
  const [editTarget,   setEditTarget]   = useState<Testimonial | null>(null);
  const editTargetRef                   = useRef<Testimonial | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Testimonial | null>(null);
  const [successMsg,   setSuccessMsg]   = useState<string | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [QUERY_KEY, page, search],
    queryFn: async () => {
      const res = await testimonialApi.getAll({ page, limit: PAGE_SIZE });
      const payload = (res.data as {
        data?: { testimonials?: Testimonial[]; total?: number; page?: number; pages?: number };
      })?.data;
      const items = Array.isArray(payload?.testimonials) ? payload!.testimonials! : [];
      const total = payload?.total ?? items.length;
      return { items, total };
    },
    staleTime: 30_000,
    enabled: !!me,
  });

  const items      = data?.items ?? [];
  const total      = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ── Client-side search filter ──────────────────────────────────────────────
  const filtered = search.trim()
    ? items.filter(
        (t) =>
          t.clientName.toLowerCase().includes(search.toLowerCase()) ||
          (t.clientCompany ?? '').toLowerCase().includes(search.toLowerCase()),
      )
    : items;

  // ── Delete mutation ────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id: string) => testimonialApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      setDeleteTarget(null);
      showSuccess('Testimonial deleted.');
    },
  });

  const showSuccess = useCallback((msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  }, []);

  const handleOpenCreate = () => {
    editTargetRef.current = null;
    setEditTarget(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (t: Testimonial) => {
    editTargetRef.current = t;
    setEditTarget(t);
    setModalOpen(true);
  };

  const handleModalSaved = useCallback(() => {
    const wasEditing = !!editTargetRef.current;
    queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    setModalOpen(false);
    editTargetRef.current = null;
    setEditTarget(null);
    showSuccess(wasEditing ? 'Testimonial updated.' : 'Testimonial added.');
  }, [queryClient, showSuccess]);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col overflow-hidden">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-[#1a1a1a] bg-[#0a0a0a] px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Quote className="h-5 w-5 text-[#fbbf24]" />
              <h1 className="text-base font-semibold text-white">Testimonials</h1>
              <span className="rounded-full border border-[#fbbf24]/20 bg-[#fbbf24]/5 px-2 py-0.5 text-[10px] text-[#fbbf24]">
                {total} total
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[#555]">
              Manage public-facing client testimonials shown on the website.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refetch()}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#2a2a2a] bg-[#141414] text-[#666] transition-all hover:text-white"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="flex items-center gap-2 rounded-xl border border-[#fbbf24]/30 bg-[#fbbf24]/10 px-3 py-2 text-xs font-semibold text-[#fbbf24] transition-all hover:bg-[#fbbf24]/20"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Testimonial
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#555]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by client name or company…"
            className="w-full rounded-xl border border-[#2a2a2a] bg-[#141414] py-2 pl-8 pr-8 text-xs text-white placeholder-[#555] outline-none focus:border-[#fbbf24]/40 focus:ring-1 focus:ring-[#fbbf24]/20"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Success toast ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex flex-shrink-0 items-center gap-2 border-b border-emerald-500/20 bg-emerald-500/5 px-6 py-2.5 text-xs text-emerald-400"
          >
            <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
            {successMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Grid ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-5">

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-[#fbbf24]" />
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <AlertCircle className="h-8 w-8 text-red-400" />
            <p className="text-sm text-[#666]">Failed to load testimonials</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="rounded-xl border border-[#2a2a2a] px-3 py-1.5 text-xs text-[#aaa] hover:text-white"
            >
              Retry
            </button>
          </div>
        )}

        {!isLoading && !isError && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#2a2a2a] bg-[#141414]">
              <Quote className="h-6 w-6 text-[#555]" />
            </div>
            <p className="text-sm font-medium text-[#666]">
              {search ? 'No testimonials match your search' : 'No testimonials yet'}
            </p>
            {!search && (
              <button
                type="button"
                onClick={handleOpenCreate}
                className="flex items-center gap-2 rounded-xl border border-[#fbbf24]/20 bg-[#fbbf24]/5 px-3 py-2 text-xs font-semibold text-[#fbbf24] hover:bg-[#fbbf24]/10"
              >
                <Plus className="h-3.5 w-3.5" />
                Add your first testimonial
              </button>
            )}
          </div>
        )}

        {!isLoading && !isError && filtered.length > 0 && (
          <AnimatePresence mode="popLayout">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((t) => (
                <TestimonialCard
                  key={t.id}
                  t={t}
                  onEdit={() => handleOpenEdit(t)}
                  onDelete={() => setDeleteTarget(t)}
                />
              ))}
            </div>
          </AnimatePresence>
        )}

        {/* Pagination */}
        {!isLoading && !isError && totalPages > 1 && !search && (
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#2a2a2a] bg-[#141414] text-[#666] disabled:opacity-40 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs text-[#555]">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#2a2a2a] bg-[#141414] text-[#666] disabled:opacity-40 hover:text-white"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* ── Modals ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {modalOpen && (
          <TestimonialModal
            key="modal"
            initial={editTarget}
            onClose={() => { setModalOpen(false); setEditTarget(null); }}
            onSaved={handleModalSaved}
          />
        )}
        {deleteTarget && (
          <DeleteDialog
            key="delete"
            name={deleteTarget.clientName}
            onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
            onCancel={() => setDeleteTarget(null)}
            isDeleting={deleteMutation.isPending}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
