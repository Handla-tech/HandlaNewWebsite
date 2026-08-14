'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/useDebounce';
import { DataTable, TableSkeleton, type Column, type RowAction } from '@/components/ui/DataTable';
import {
  Truck, Plus, Loader2, Search, X, Edit2, Trash2,
  ChevronLeft, ChevronRight, Mail, Phone, Building2, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '@/store/authStore';
import { suppliersApi } from '@/lib/api';
import type { Supplier, PaginatedSuppliers } from '@/types';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';

// ─── Zod schema ───────────────────────────────────────────────────────────────

type TFn = (key: string, params?: Record<string, any>) => string;

const makeSupplierSchema = (t: TFn) => z.object({
  name:     z.string().min(1, t('erp.suppliers.modal.nameRequired')).max(150),
  company:  z.string().max(150).optional().or(z.literal('')),
  email:    z.string().email(t('erp.suppliers.modal.invalidEmail')).optional().or(z.literal('')),
  phone:    z.string().max(40).optional().or(z.literal('')),
  taxId:    z.string().max(60).optional().or(z.literal('')),
  address:  z.string().optional().or(z.literal('')),
  notes:    z.string().optional().or(z.literal('')),
  isActive: z.boolean().optional(),
});
type SupplierForm = z.infer<ReturnType<typeof makeSupplierSchema>>;

function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

const sharedInput =
  'w-full rounded-xl border border-white/10 bg-[#0f0f0f] text-white px-3 py-2.5 text-sm focus:outline-none focus:border-[#fbbf24]/50 focus:bg-white/[0.04] transition-all';

// ─── Create / Edit Modal ──────────────────────────────────────────────────────

function SupplierModal({ isOpen, onClose, editSupplier }: { isOpen: boolean; onClose: () => void; editSupplier: Supplier | null }) {
  const qc = useQueryClient();
  const { t } = useTranslation();
  const isEdit = editSupplier !== null;

  const { register, handleSubmit, reset, formState: { errors } } = useForm<SupplierForm>({
    resolver: zodResolver(makeSupplierSchema(t)),
    defaultValues: { name: '', company: '', email: '', phone: '', taxId: '', address: '', notes: '', isActive: true },
  });

  useEffect(() => {
    if (isEdit && editSupplier) {
      reset({
        name: editSupplier.name, company: editSupplier.company ?? '', email: editSupplier.email ?? '',
        phone: editSupplier.phone ?? '', taxId: editSupplier.taxId ?? '', address: editSupplier.address ?? '',
        notes: editSupplier.notes ?? '', isActive: editSupplier.isActive,
      });
    } else {
      reset({ name: '', company: '', email: '', phone: '', taxId: '', address: '', notes: '', isActive: true });
    }
  }, [isEdit, editSupplier, reset, isOpen]);

  const mutation = useMutation({
    mutationFn: (data: SupplierForm) => {
      // Convert empty strings to null so the backend stores clean values.
      const payload = Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, v === '' ? null : v]),
      );
      return isEdit ? suppliersApi.updateSupplier(editSupplier!.id, payload) : suppliersApi.createSupplier(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['erp-suppliers'] }); onClose(); },
  });

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#111] shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4 sticky top-0 bg-[#111] z-10">
          <div>
            <h2 className="text-base font-bold text-white">{isEdit ? t('erp.suppliers.modal.editTitle') : t('erp.suppliers.modal.newTitle')}</h2>
            <p className="text-xs text-white/30">{isEdit ? t('erp.suppliers.modal.editSubtitle') : t('erp.suppliers.modal.newSubtitle')}</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">{t('erp.suppliers.modal.name')}</label>
              <input {...register('name')} className={sharedInput} placeholder={t('erp.suppliers.modal.namePlaceholder')} />
              {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">{t('erp.suppliers.modal.company')}</label>
              <input {...register('company')} className={sharedInput} placeholder={t('erp.suppliers.modal.companyPlaceholder')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">{t('erp.suppliers.modal.email')}</label>
              <input {...register('email')} className={sharedInput} placeholder={t('erp.suppliers.modal.emailPlaceholder')} />
              {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">{t('erp.suppliers.modal.phone')}</label>
              <input {...register('phone')} className={sharedInput} placeholder={t('erp.suppliers.modal.phonePlaceholder')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">{t('erp.suppliers.modal.taxId')}</label>
              <input {...register('taxId')} className={sharedInput} placeholder={t('erp.suppliers.modal.taxIdPlaceholder')} />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer">
                <input type="checkbox" {...register('isActive')} className="h-4 w-4 rounded border-white/20 bg-[#0f0f0f] accent-[#fbbf24]" />
                {t('erp.suppliers.modal.activeSupplier')}
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">{t('erp.suppliers.modal.address')}</label>
            <textarea rows={2} {...register('address')} className={cn(sharedInput, 'resize-none')} placeholder={t('erp.suppliers.modal.addressPlaceholder')} />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">{t('erp.suppliers.modal.notes')}</label>
            <textarea rows={2} {...register('notes')} className={cn(sharedInput, 'resize-none')} placeholder={t('erp.suppliers.modal.notesPlaceholder')} />
          </div>

          {mutation.isError && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {(mutation.error as any)?.response?.data?.message ?? t('erp.suppliers.modal.saveFailed')}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white text-sm min-h-[44px] transition-colors">{t('erp.common.cancel')}</button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#fbbf24] text-black font-semibold hover:bg-[#f59e0b] text-sm disabled:opacity-50 min-h-[44px] transition-colors">
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {mutation.isPending ? t('erp.common.saving') : isEdit ? t('erp.suppliers.modal.saveChanges') : t('erp.suppliers.modal.add')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteModal({ isOpen, supplier, onClose }: { isOpen: boolean; supplier: Supplier | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { t } = useTranslation();
  const mutation = useMutation({
    mutationFn: () => suppliersApi.deleteSupplier(supplier!.id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['erp-suppliers'] }); onClose(); },
  });

  if (!isOpen || !supplier) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#111] shadow-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20">
            <Trash2 className="w-4.5 h-4.5 text-red-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">{t('erp.suppliers.delete.title')}</h2>
            <p className="text-xs text-white/30">{t('erp.suppliers.delete.subtitle')}</p>
          </div>
        </div>
        <p className="text-sm text-white/60">{t('erp.suppliers.delete.confirm', { name: supplier.name })}</p>
        {mutation.isError && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {(mutation.error as any)?.response?.data?.message ?? t('erp.suppliers.delete.failed')}
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white text-sm min-h-[44px] transition-colors">{t('erp.common.cancel')}</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
            className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 text-sm disabled:opacity-50 min-h-[44px] transition-colors">
            {mutation.isPending ? t('erp.common.deleting') : t('erp.common.delete')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SuppliersPage() {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 300);
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editEntry, setEditEntry] = useState<Supplier | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<Supplier | null>(null);

  const params = { page, limit: 12, ...(search && { search }) };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['erp-suppliers', params],
    queryFn:  () => suppliersApi.getSuppliers(params).then(r => r.data.data as PaginatedSuppliers),
    staleTime: 15_000, enabled: mounted,
    placeholderData: (prev: any) => prev,
  });

  const suppliers  = data?.suppliers ?? [];
  const totalPages = data?.pages ?? 1;

  function openCreate() { setEditEntry(null); setShowModal(true); }
  function openEdit(s: Supplier) { setEditEntry(s); setShowModal(true); }

  const columns: Column<Supplier>[] = [
    {
      key: 'name',
      header: t('erp.suppliers.col.name'),
      cell: (s) => (
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-[#fbbf24]/20 bg-[#fbbf24]/10">
            <Building2 className="w-4 h-4 text-[#fbbf24]" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate">{s.name}</div>
            {s.company && <div className="text-[11px] text-white/35 truncate">{s.company}</div>}
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      header: t('erp.suppliers.col.email'),
      hideOnMobile: true,
      cell: (s) => s.email
        ? <span className="flex items-center gap-1.5 text-white/60"><Mail className="w-3.5 h-3.5 text-white/30" />{s.email}</span>
        : <span className="text-white/20">—</span>,
    },
    {
      key: 'phone',
      header: t('erp.suppliers.col.phone'),
      hideOnMobile: true,
      cell: (s) => s.phone
        ? <span className="flex items-center gap-1.5 text-white/60"><Phone className="w-3.5 h-3.5 text-white/30" />{s.phone}</span>
        : <span className="text-white/20">—</span>,
    },
    {
      key: 'taxId',
      header: t('erp.suppliers.col.taxId'),
      hideOnMobile: true,
      cell: (s) => s.taxId ? <span className="text-white/60">{s.taxId}</span> : <span className="text-white/20">—</span>,
    },
    {
      key: 'added',
      header: t('erp.suppliers.col.added'),
      hideOnMobile: true,
      cell: (s) => <span className="text-white/40 text-xs">{fmtDate(s.createdAt)}</span>,
    },
    {
      key: 'status',
      header: t('erp.suppliers.col.status'),
      align: 'center',
      cell: (s) => (
        <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold border inline-block',
          s.isActive
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
            : 'border-white/10 bg-white/5 text-white/40')}>
          {s.isActive ? t('erp.suppliers.status.active') : t('erp.suppliers.status.inactive')}
        </span>
      ),
    },
  ];

  const rowActions: RowAction<Supplier>[] = [
    { label: t('erp.suppliers.actions.edit'), icon: Edit2, onClick: (s) => openEdit(s) },
    { label: t('erp.suppliers.actions.delete'), icon: Trash2, danger: true, onClick: (s) => setDeleteEntry(s), show: () => isAdmin },
  ];

  if (!mounted) return null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#fbbf24]/10 border border-[#fbbf24]/20">
              <Truck className="w-4.5 h-4.5 text-[#fbbf24]" />
            </span>
            {t('erp.suppliers.title')}
          </h1>
          <p className="text-sm text-white/30 mt-1 ml-11">{t('erp.suppliers.subtitle')}</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#fbbf24] text-black font-semibold hover:bg-[#f59e0b] transition-colors text-sm min-h-[44px]">
          <Plus className="w-4 h-4" /> {t('erp.suppliers.new')}
        </button>
      </div>

      {/* Search */}
      <div className="relative w-full sm:w-72">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
        <input placeholder={t('erp.suppliers.searchPlaceholder')} value={searchInput} onChange={e => { setSearchInput(e.target.value); setPage(1); }}
          className="w-full pl-8 pr-4 py-2 rounded-lg border border-white/10 bg-white/[0.04] text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#fbbf24]/40 focus:bg-white/[0.06] transition-all" />
      </div>

      {/* List */}
      {isLoading && <TableSkeleton cols={6} rows={6} />}

      {isError && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-red-400/50 mx-auto" />
            <p className="text-sm text-white/30">{t('erp.suppliers.loadFailed')}</p>
            <button onClick={() => refetch()} className="px-4 py-2 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-xs text-white/50 transition-colors">{t('erp.common.retry')}</button>
          </div>
        </div>
      )}

      {!isLoading && !isError && suppliers.length === 0 && (
        <div className="flex items-center justify-center py-16">
          <div className="text-center space-y-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] mx-auto">
              <Truck className="w-7 h-7 text-white/15" />
            </div>
            <p className="text-sm text-white/30">{t('erp.suppliers.empty')}</p>
            <button onClick={openCreate} className="px-4 py-2 rounded-xl border border-[#fbbf24]/30 bg-[#fbbf24]/10 text-[#fbbf24] text-xs font-semibold hover:bg-[#fbbf24]/20 transition-colors">
              {t('erp.suppliers.addFirst')}
            </button>
          </div>
        </div>
      )}

      {!isLoading && !isError && suppliers.length > 0 && (
        <DataTable columns={columns} rows={suppliers} rowKey={(s) => s.id} actions={rowActions} />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-white/30">{t('erp.suppliers.pageInfo', { total: data?.total ?? 0, page, totalPages })}</p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/40 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs text-white/40">{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/40 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <SupplierModal isOpen={showModal} onClose={() => { setShowModal(false); setEditEntry(null); }} editSupplier={editEntry} />
      <DeleteModal isOpen={deleteEntry !== null} supplier={deleteEntry} onClose={() => setDeleteEntry(null)} />
    </div>
  );
}
