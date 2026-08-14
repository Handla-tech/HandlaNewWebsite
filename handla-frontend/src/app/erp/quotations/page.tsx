'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/useDebounce';
import { DropdownPortal } from '@/components/ui/DropdownPortal';
import { DataTable, TableSkeleton, type Column, type RowAction } from '@/components/ui/DataTable';
import {
  FileSignature, Plus, Loader2, Search, X, Edit2, Trash2, Trash,
  ChevronLeft, ChevronRight, AlertCircle, CheckCircle2, Send, Check, Ban,
  ArrowRightLeft, Link2, Copy,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useTranslation } from '@/hooks/useTranslation';
import { quotationsApi, clientsApi } from '@/lib/api';
import type {
  Quotation, PaginatedQuotations, QuotationStatus, PaginatedClients,
} from '@/types';
import { cn } from '@/lib/utils';

const STATUS_BADGE: Record<QuotationStatus, string> = {
  DRAFT:     'border-white/15 bg-white/5 text-white/50',
  SENT:      'border-blue-500/30 bg-blue-500/10 text-blue-400',
  ACCEPTED:  'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  REJECTED:  'border-red-500/30 bg-red-500/10 text-red-400',
  EXPIRED:   'border-amber-500/30 bg-amber-500/10 text-amber-400',
  CONVERTED: 'border-purple-500/30 bg-purple-500/10 text-purple-400',
};
const STATUSES: (QuotationStatus | 'all')[] = ['all', 'DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED'];

const sharedInput =
  'w-full rounded-xl border border-white/10 bg-[#0f0f0f] text-white px-3 py-2.5 text-sm focus:outline-none focus:border-[#fbbf24]/50 focus:bg-white/[0.04] transition-all';

function fmt(n: number | undefined, currency?: string | null) {
  const c = currency || '';
  return `${c ? c + ' ' : ''}${Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
function clientLabel(c: { company?: string | null; user?: { name?: string } } | null | undefined, t: (k: string) => string) {
  if (!c) return t('erp.quotations.unknownClient');
  return c.user?.name || c.company || t('erp.quotations.unnamedClient');
}

// ─── Status badge ───────────────────────────────────────────────────────────

function QStatus({ status }: { status: QuotationStatus }) {
  const { t } = useTranslation();
  return <span className={cn('inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border', STATUS_BADGE[status])}>{t(`erp.quotations.status.${status}`)}</span>;
}

// ─── Create / Edit Modal ──────────────────────────────────────────────────────

type LineRow = { description: string; quantity: number; unitPrice: number };

function QuotationModal({ isOpen, onClose, editQuotation }: { isOpen: boolean; onClose: () => void; editQuotation: Quotation | null }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const isEdit = editQuotation !== null;

  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState('');
  const [taxRate, setTaxRate] = useState(0);
  const [currency, setCurrency] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineRow[]>([{ description: '', quantity: 1, unitPrice: 0 }]);

  const { data: clientsData } = useQuery({
    queryKey: ['erp-clients-select'],
    queryFn:  () => clientsApi.getClients({ limit: 100 }).then(r => r.data.data as PaginatedClients),
    enabled:  isOpen, staleTime: 60_000,
  });
  const clients = clientsData?.clients ?? [];

  useEffect(() => {
    if (!isOpen) return;
    if (isEdit && editQuotation) {
      setTitle(editQuotation.title); setClientId(editQuotation.clientId);
      setTaxRate(Number(editQuotation.taxRate) || 0); setCurrency(editQuotation.currency ?? '');
      setValidUntil(editQuotation.validUntil ?? ''); setNotes(editQuotation.notes ?? '');
      setLines((editQuotation.lineItems && editQuotation.lineItems.length > 0)
        ? editQuotation.lineItems.map(li => ({ description: li.description, quantity: Number(li.quantity), unitPrice: Number(li.unitPrice) }))
        : [{ description: '', quantity: 1, unitPrice: 0 }]);
    } else {
      setTitle(''); setClientId(''); setTaxRate(0); setCurrency(''); setValidUntil(''); setNotes('');
      setLines([{ description: '', quantity: 1, unitPrice: 0 }]);
    }
  }, [isOpen, isEdit, editQuotation]);

  const { subtotal, taxAmount, total } = useMemo(() => {
    const sub = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);
    const tax = (sub * (Number(taxRate) || 0)) / 100;
    return { subtotal: sub, taxAmount: tax, total: sub + tax };
  }, [lines, taxRate]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload: any = {
        title, clientId,
        lineItems: lines.filter(l => l.description.trim()).map(l => ({ description: l.description, quantity: Number(l.quantity) || 0, unitPrice: Number(l.unitPrice) || 0 })),
        taxRate: Number(taxRate) || 0,
        ...(currency.trim() && { currency: currency.trim().toUpperCase() }),
        ...(validUntil && { validUntil }),
        ...(notes.trim() && { notes: notes.trim() }),
      };
      return isEdit ? quotationsApi.updateQuotation(editQuotation!.id, payload) : quotationsApi.createQuotation(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['erp-quotations'] }); onClose(); },
  });

  function updateLine(i: number, patch: Partial<LineRow>) { setLines(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l)); }
  const canSubmit = title.trim() && clientId && lines.some(l => l.description.trim());

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-[#111] shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4 sticky top-0 bg-[#111] z-10">
          <div>
            <h2 className="text-base font-bold text-white">{isEdit ? t('erp.quotations.modal.editTitle') : t('erp.quotations.modal.newTitle')}</h2>
            <p className="text-xs text-white/30">{t('erp.quotations.modal.subtitle')}</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">{t('erp.quotations.modal.title')}</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder={t('erp.quotations.modal.titlePlaceholder')} className={sharedInput} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">{t('erp.quotations.modal.client')}</label>
              <select value={clientId} onChange={e => setClientId(e.target.value)} className={sharedInput}>
                <option value="">{t('erp.quotations.modal.selectClient')}</option>
                {clients.map(c => <option key={c.id} value={c.id}>{clientLabel(c, t)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">{t('erp.quotations.modal.validUntil')}</label>
              <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className={sharedInput} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-white/50 mb-2">{t('erp.quotations.modal.lineItems')}</label>
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={l.description} onChange={e => updateLine(i, { description: e.target.value })} placeholder={t('erp.quotations.modal.description')} className={cn(sharedInput, 'flex-1')} />
                  <input type="number" step="0.01" min="0" value={l.quantity} onChange={e => updateLine(i, { quantity: parseFloat(e.target.value) || 0 })} className={cn(sharedInput, 'w-20')} title={t('erp.quotations.modal.qty')} />
                  <input type="number" step="0.01" min="0" value={l.unitPrice} onChange={e => updateLine(i, { unitPrice: parseFloat(e.target.value) || 0 })} className={cn(sharedInput, 'w-28')} title={t('erp.quotations.modal.unitPrice')} />
                  <button type="button" onClick={() => setLines(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev)} className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-white/25 hover:text-red-400 hover:bg-red-400/10 transition-colors"><Trash className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setLines(prev => [...prev, { description: '', quantity: 1, unitPrice: 0 }])} className="mt-2 flex items-center gap-1.5 text-xs text-[#fbbf24] hover:text-[#f59e0b] transition-colors"><Plus className="w-3.5 h-3.5" /> {t('erp.quotations.modal.addLine')}</button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">{t('erp.quotations.modal.taxRate')}</label>
                <input type="number" step="0.01" min="0" max="100" value={taxRate} onChange={e => setTaxRate(parseFloat(e.target.value) || 0)} className={sharedInput} />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">{t('erp.quotations.modal.currencyOptional')}</label>
                <input value={currency} onChange={e => setCurrency(e.target.value)} maxLength={3} placeholder="USD" className={cn(sharedInput, 'uppercase')} />
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-sm space-y-1 self-end">
              <div className="flex justify-between text-white/50"><span>{t('erp.quotations.modal.subtotal')}</span><span>{fmt(subtotal, currency)}</span></div>
              <div className="flex justify-between text-white/50"><span>{t('erp.quotations.modal.tax')}</span><span>{fmt(taxAmount, currency)}</span></div>
              <div className="flex justify-between font-bold text-white pt-1 border-t border-white/10"><span>{t('erp.quotations.modal.total')}</span><span>{fmt(total, currency)}</span></div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">{t('erp.quotations.modal.notesOptional')}</label>
            <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} className={cn(sharedInput, 'resize-none')} placeholder={t('erp.quotations.modal.notesPlaceholder')} />
          </div>

          {mutation.isError && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {(mutation.error as any)?.response?.data?.message ?? t('erp.quotations.modal.saveFailed')}
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white text-sm min-h-[44px] transition-colors">{t('erp.common.cancel')}</button>
            <button type="button" disabled={mutation.isPending || !canSubmit} onClick={() => mutation.mutate()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#fbbf24] text-black font-semibold hover:bg-[#f59e0b] text-sm disabled:opacity-50 min-h-[44px] transition-colors">
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {mutation.isPending ? t('erp.common.saving') : isEdit ? t('erp.quotations.modal.saveChanges') : t('erp.quotations.modal.create')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Modal ─────────────────────────────────────────────────────────────

function DeleteModal({ isOpen, quotation, onClose }: { isOpen: boolean; quotation: Quotation | null; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => quotationsApi.deleteQuotation(quotation!.id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['erp-quotations'] }); onClose(); },
  });
  if (!isOpen || !quotation) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#111] shadow-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20"><Trash2 className="w-4.5 h-4.5 text-red-400" /></div>
          <div><h2 className="text-base font-bold text-white">{t('erp.quotations.delete.title')}</h2><p className="text-xs text-white/30">{t('erp.quotations.delete.subtitle')}</p></div>
        </div>
        <p className="text-sm text-white/60">{t('erp.quotations.delete.confirm', { number: quotation.quoteNumber })}</p>
        {mutation.isError && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {(mutation.error as any)?.response?.data?.message ?? t('erp.quotations.delete.failed')}
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white text-sm min-h-[44px] transition-colors">{t('erp.common.cancel')}</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 text-sm disabled:opacity-50 min-h-[44px] transition-colors">{mutation.isPending ? t('erp.common.deleting') : t('erp.common.delete')}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function QuotationsPage() {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<QuotationStatus | 'all'>('all');
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 300);
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editEntry, setEditEntry] = useState<Quotation | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<Quotation | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const params = { page, limit: 10, ...(statusFilter !== 'all' && { status: statusFilter }), ...(search && { search }) };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['erp-quotations', params],
    queryFn:  () => quotationsApi.getQuotations(params).then(r => r.data.data as PaginatedQuotations),
    staleTime: 15_000, enabled: mounted, placeholderData: (prev: any) => prev,
  });
  const quotations = data?.quotations ?? [];
  const totalPages = data?.pages ?? 1;

  const action = useMutation({
    mutationFn: ({ id, type }: { id: string; type: 'send' | 'accept' | 'reject' | 'convert' }) => {
      if (type === 'send')    return quotationsApi.sendQuotation(id);
      if (type === 'accept')  return quotationsApi.acceptQuotation(id);
      if (type === 'reject')  return quotationsApi.rejectQuotation(id);
      return quotationsApi.convertQuotation(id);
    },
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ['erp-quotations'] });
      if (v.type === 'convert') { qc.invalidateQueries({ queryKey: ['erp-contracts'] }); qc.invalidateQueries({ queryKey: ['erp-invoices'] }); setToast(t('erp.quotations.toast.converted')); }
    },
  });

  function copyLink(q: Quotation) {
    const url = `${window.location.origin}/quotation/public/${q.publicToken}`;
    navigator.clipboard?.writeText(url).then(() => { setToast(t('erp.quotations.toast.linkCopied')); setTimeout(() => setToast(null), 2500); });
  }

  useEffect(() => { if (toast) { const timer = setTimeout(() => setToast(null), 2500); return () => clearTimeout(timer); } }, [toast]);

  // ─── Table columns & row actions ────────────────────────────────────────────
  const columns: Column<Quotation>[] = [
    {
      key: 'quote',
      header: t('erp.quotations.col.quote'),
      cell: (q) => (
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-[#fbbf24]/20 bg-[#fbbf24]/10">
            <FileSignature className="w-4 h-4 text-[#fbbf24]" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{q.quoteNumber}</p>
            <p className="text-xs text-white/50 truncate max-w-[240px]">{q.title}</p>
          </div>
        </div>
      ),
    },
    { key: 'client', header: t('erp.quotations.col.client'), hideOnMobile: true, cell: (q) => <span className="text-white/60">{clientLabel(q.client, t)}</span> },
    {
      key: 'created',
      header: t('erp.quotations.col.created'),
      hideOnMobile: true,
      cell: (q) => (
        <div className="text-[12px] text-white/45 whitespace-nowrap">
          {fmtDate(q.createdAt)}
          {q.validUntil && <div className="text-white/25">{t('erp.quotations.valid', { date: fmtDate(q.validUntil) })}</div>}
        </div>
      ),
    },
    { key: 'status', header: t('erp.quotations.col.status'), align: 'center', cell: (q) => <QStatus status={q.status} /> },
    { key: 'total', header: t('erp.quotations.col.total'), align: 'right', cell: (q) => <span className="font-bold text-white whitespace-nowrap">{fmt(q.total, q.currency)}</span> },
  ];

  const rowActions: RowAction<Quotation>[] = [
    { label: t('erp.quotations.actions.edit'), icon: Edit2, onClick: (q) => { setEditEntry(q); setShowModal(true); }, show: (q) => q.status === 'DRAFT' },
    { label: t('erp.quotations.actions.send'), icon: Send, onClick: (q) => action.mutate({ id: q.id, type: 'send' }), show: (q) => q.status === 'DRAFT' },
    { label: t('erp.quotations.actions.accept'), icon: Check, onClick: (q) => action.mutate({ id: q.id, type: 'accept' }), show: (q) => q.status === 'SENT' },
    { label: t('erp.quotations.actions.reject'), icon: Ban, onClick: (q) => action.mutate({ id: q.id, type: 'reject' }), show: (q) => q.status === 'SENT' },
    { label: t('erp.quotations.actions.convert'), icon: ArrowRightLeft, onClick: (q) => action.mutate({ id: q.id, type: 'convert' }), show: (q) => q.status === 'ACCEPTED' },
    { label: t('erp.quotations.actions.copyLink'), icon: Link2, onClick: (q) => copyLink(q) },
    { label: t('erp.quotations.actions.delete'), icon: Trash2, danger: true, onClick: (q) => setDeleteEntry(q), show: (q) => isAdmin && q.status === 'DRAFT' },
  ];

  if (!mounted) return null;

  return (
    <div className="space-y-5">
      {toast && (
        <div className="fixed bottom-5 right-5 z-[60] flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-4 py-2.5 text-sm text-emerald-300 shadow-lg backdrop-blur">
          <Copy className="w-4 h-4" /> {toast}
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#fbbf24]/10 border border-[#fbbf24]/20"><FileSignature className="w-4.5 h-4.5 text-[#fbbf24]" /></span>
            {t('erp.quotations.title')}
          </h1>
          <p className="text-sm text-white/30 mt-1 ml-11">{t('erp.quotations.subtitle')}</p>
        </div>
        <button onClick={() => { setEditEntry(null); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#fbbf24] text-black font-semibold hover:bg-[#f59e0b] transition-colors text-sm min-h-[44px]"><Plus className="w-4 h-4" /> {t('erp.quotations.new')}</button>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06] flex-wrap">
          {STATUSES.map(st => (
            <button key={st} onClick={() => { setStatusFilter(st); setPage(1); }}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                statusFilter === st ? 'bg-[#fbbf24] text-black shadow-sm' : 'text-white/35 hover:text-white')}>
              {t(`erp.quotations.status.${st}`)}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
          <input placeholder={t('erp.quotations.searchPlaceholder')} value={searchInput} onChange={e => { setSearchInput(e.target.value); setPage(1); }} className="pl-8 pr-4 py-2 rounded-lg border border-white/10 bg-white/[0.04] text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#fbbf24]/40 focus:bg-white/[0.06] w-52 transition-all" />
        </div>
      </div>

      {isLoading && <TableSkeleton cols={5} rows={6} />}
      {isError && (
        <div className="text-center py-12 space-y-3"><AlertCircle className="w-8 h-8 text-red-400/50 mx-auto" /><p className="text-sm text-white/30">{t('erp.quotations.loadFailed')}</p>
          <button onClick={() => refetch()} className="px-4 py-2 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-xs text-white/50">{t('erp.common.retry')}</button></div>
      )}
      {!isLoading && !isError && quotations.length === 0 && (
        <div className="text-center py-16 space-y-4"><div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] mx-auto"><FileSignature className="w-7 h-7 text-white/15" /></div><p className="text-sm text-white/30">{t('erp.quotations.empty')}</p></div>
      )}
      {!isLoading && !isError && quotations.length > 0 && (
        <DataTable columns={columns} rows={quotations} rowKey={(q) => q.id} actions={rowActions} />
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-white/30">{t('erp.quotations.pageInfo', { total: data?.total ?? 0, page, pages: totalPages })}</p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/40 hover:text-white hover:border-white/20 disabled:opacity-30 transition-all"><ChevronLeft className="w-4 h-4" /></button>
            <span className="px-3 text-xs text-white/40">{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/40 hover:text-white hover:border-white/20 disabled:opacity-30 transition-all"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      <QuotationModal isOpen={showModal} onClose={() => { setShowModal(false); setEditEntry(null); }} editQuotation={editEntry} />
      <DeleteModal isOpen={deleteEntry !== null} quotation={deleteEntry} onClose={() => setDeleteEntry(null)} />
    </div>
  );
}
