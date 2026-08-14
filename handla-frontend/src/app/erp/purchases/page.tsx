'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/useDebounce';
import { DataTable, TableSkeleton, type Column, type RowAction } from '@/components/ui/DataTable';
import {
  ShoppingCart, Plus, Loader2, Search, X, Edit2, Trash2,
  ChevronLeft, ChevronRight, AlertCircle, CheckCircle2, CreditCard, Trash,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useTranslation } from '@/hooks/useTranslation';
import { purchasesApi, suppliersApi } from '@/lib/api';
import type {
  Purchase, PaginatedPurchases, PurchaseStatus, PurchasePaymentStatus,
  PurchaseLineItem, PaginatedSuppliers,
} from '@/types';
import { cn } from '@/lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<PurchaseStatus, string> = {
  DRAFT:     'border-white/15 bg-white/5 text-white/50',
  ORDERED:   'border-blue-500/30 bg-blue-500/10 text-blue-400',
  RECEIVED:  'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  CANCELLED: 'border-red-500/30 bg-red-500/10 text-red-400',
};
const PAY_BADGE: Record<PurchasePaymentStatus, string> = {
  UNPAID:  'border-amber-500/30 bg-amber-500/10 text-amber-400',
  PAID:    'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  OVERDUE: 'border-red-500/30 bg-red-500/10 text-red-400',
};
const STATUSES: PurchaseStatus[] = ['DRAFT', 'ORDERED', 'RECEIVED', 'CANCELLED'];

type ActiveTab = 'all' | PurchasePaymentStatus;

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

// ─── Create / Edit Modal (with line items) ────────────────────────────────────

type LineRow = { description: string; quantity: number; unitPrice: number };

function PurchaseModal({ isOpen, onClose, editPurchase }: { isOpen: boolean; onClose: () => void; editPurchase: Purchase | null }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const isEdit = editPurchase !== null;

  const [supplierId, setSupplierId] = useState('');
  const [status, setStatus] = useState<PurchaseStatus>('DRAFT');
  const [taxRate, setTaxRate] = useState(0);
  const [currency, setCurrency] = useState('');
  const [accountCode, setAccountCode] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineRow[]>([{ description: '', quantity: 1, unitPrice: 0 }]);

  const { data: suppliersData } = useQuery({
    queryKey: ['erp-suppliers-select'],
    queryFn:  () => suppliersApi.getSuppliers({ limit: 100, isActive: 'true' }).then(r => r.data.data as PaginatedSuppliers),
    enabled:  isOpen, staleTime: 60_000,
  });
  const suppliers = suppliersData?.suppliers ?? [];

  useEffect(() => {
    if (!isOpen) return;
    if (isEdit && editPurchase) {
      setSupplierId(editPurchase.supplierId);
      setStatus(editPurchase.status);
      setTaxRate(Number(editPurchase.taxRate) || 0);
      setCurrency(editPurchase.currency ?? '');
      setAccountCode(editPurchase.accountCode ?? '');
      setOrderDate(editPurchase.orderDate ?? '');
      setDueDate(editPurchase.dueDate ?? '');
      setNotes(editPurchase.notes ?? '');
      setLines(
        (editPurchase.lineItems && editPurchase.lineItems.length > 0)
          ? editPurchase.lineItems.map(li => ({ description: li.description, quantity: Number(li.quantity), unitPrice: Number(li.unitPrice) }))
          : [{ description: '', quantity: 1, unitPrice: 0 }],
      );
    } else {
      setSupplierId(''); setStatus('DRAFT'); setTaxRate(0); setCurrency(''); setAccountCode('');
      setOrderDate(new Date().toISOString().slice(0, 10)); setDueDate(''); setNotes('');
      setLines([{ description: '', quantity: 1, unitPrice: 0 }]);
    }
  }, [isOpen, isEdit, editPurchase]);

  const { subtotal, taxAmount, total } = useMemo(() => {
    const sub = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);
    const tax = (sub * (Number(taxRate) || 0)) / 100;
    return { subtotal: sub, taxAmount: tax, total: sub + tax };
  }, [lines, taxRate]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload: any = {
        supplierId,
        lineItems: lines.filter(l => l.description.trim()).map(l => ({
          description: l.description, quantity: Number(l.quantity) || 0, unitPrice: Number(l.unitPrice) || 0,
        })),
        taxRate: Number(taxRate) || 0,
        status,
        ...(currency.trim() && { currency: currency.trim().toUpperCase() }),
        ...(accountCode.trim() && { accountCode: accountCode.trim() }),
        ...(orderDate && { orderDate }),
        ...(dueDate && { dueDate }),
        ...(notes.trim() && { notes: notes.trim() }),
      };
      return isEdit ? purchasesApi.updatePurchase(editPurchase!.id, payload) : purchasesApi.createPurchase(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['erp-purchases'] }); onClose(); },
  });

  function updateLine(i: number, patch: Partial<LineRow>) {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  }

  const canSubmit = supplierId && lines.some(l => l.description.trim());

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-[#111] shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4 sticky top-0 bg-[#111] z-10">
          <div>
            <h2 className="text-base font-bold text-white">{isEdit ? t('erp.purchases.modal.editTitle') : t('erp.purchases.modal.newTitle')}</h2>
            <p className="text-xs text-white/30">{t('erp.purchases.modal.subtitle')}</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">{t('erp.purchases.modal.supplier')}</label>
              <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className={sharedInput}>
                <option value="">{t('erp.purchases.modal.selectSupplier')}</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">{t('erp.purchases.modal.status')}</label>
              <select value={status} onChange={e => setStatus(e.target.value as PurchaseStatus)} className={sharedInput}>
                {STATUSES.map(s => <option key={s} value={s}>{t(`erp.purchases.status.${s}`)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">{t('erp.purchases.modal.orderDate')}</label>
              <input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} className={sharedInput} />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">{t('erp.purchases.modal.dueDate')}</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={sharedInput} />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">{t('erp.purchases.modal.currencyOptional')}</label>
              <input value={currency} onChange={e => setCurrency(e.target.value)} maxLength={3} placeholder="USD" className={cn(sharedInput, 'uppercase')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">{t('erp.purchases.modal.accountCodeOptional')}</label>
              <input value={accountCode} onChange={e => setAccountCode(e.target.value)} placeholder="5000" className={sharedInput} />
            </div>
          </div>

          {/* Line items */}
          <div>
            <label className="block text-xs font-medium text-white/50 mb-2">{t('erp.purchases.modal.lineItems')}</label>
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={l.description} onChange={e => updateLine(i, { description: e.target.value })} placeholder={t('erp.purchases.modal.description')}
                    className={cn(sharedInput, 'flex-1')} />
                  <input type="number" step="0.01" min="0" value={l.quantity} onChange={e => updateLine(i, { quantity: parseFloat(e.target.value) || 0 })}
                    className={cn(sharedInput, 'w-20')} title={t('erp.purchases.modal.qty')} />
                  <input type="number" step="0.01" min="0" value={l.unitPrice} onChange={e => updateLine(i, { unitPrice: parseFloat(e.target.value) || 0 })}
                    className={cn(sharedInput, 'w-28')} title={t('erp.purchases.modal.unitPrice')} />
                  <button type="button" onClick={() => setLines(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev)}
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-white/25 hover:text-red-400 hover:bg-red-400/10 transition-colors">
                    <Trash className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setLines(prev => [...prev, { description: '', quantity: 1, unitPrice: 0 }])}
              className="mt-2 flex items-center gap-1.5 text-xs text-[#fbbf24] hover:text-[#f59e0b] transition-colors">
              <Plus className="w-3.5 h-3.5" /> {t('erp.purchases.modal.addLine')}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">{t('erp.purchases.modal.taxRate')}</label>
              <input type="number" step="0.01" min="0" max="100" value={taxRate} onChange={e => setTaxRate(parseFloat(e.target.value) || 0)} className={sharedInput} />
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-sm space-y-1">
              <div className="flex justify-between text-white/50"><span>{t('erp.purchases.modal.subtotal')}</span><span>{fmt(subtotal, currency)}</span></div>
              <div className="flex justify-between text-white/50"><span>{t('erp.purchases.modal.tax')}</span><span>{fmt(taxAmount, currency)}</span></div>
              <div className="flex justify-between font-bold text-white pt-1 border-t border-white/10"><span>{t('erp.purchases.modal.total')}</span><span>{fmt(total, currency)}</span></div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">{t('erp.purchases.modal.notesOptional')}</label>
            <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} className={cn(sharedInput, 'resize-none')} placeholder={t('erp.purchases.modal.notesPlaceholder')} />
          </div>

          {mutation.isError && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {(mutation.error as any)?.response?.data?.message ?? t('erp.purchases.modal.saveFailed')}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white text-sm min-h-[44px] transition-colors">{t('erp.common.cancel')}</button>
            <button type="button" disabled={mutation.isPending || !canSubmit} onClick={() => mutation.mutate()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#fbbf24] text-black font-semibold hover:bg-[#f59e0b] text-sm disabled:opacity-50 min-h-[44px] transition-colors">
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {mutation.isPending ? t('erp.common.saving') : isEdit ? t('erp.purchases.modal.saveChanges') : t('erp.purchases.modal.create')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Mark Paid Modal ──────────────────────────────────────────────────────────

function MarkPaidModal({ isOpen, purchase, onClose }: { isOpen: boolean; purchase: Purchase | null; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  useEffect(() => { if (isOpen) setPaidAt(new Date().toISOString().slice(0, 10)); }, [isOpen]);

  const mutation = useMutation({
    mutationFn: () => purchasesApi.markPurchasePaid(purchase!.id, { paidAt }),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['erp-purchases'] });
      qc.invalidateQueries({ queryKey: ['erp-expenses'] });
      onClose();
    },
  });

  if (!isOpen || !purchase) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#111] shadow-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <CreditCard className="w-4.5 h-4.5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">{t('erp.purchases.markPaid.title')}</h2>
            <p className="text-xs text-white/30">{t('erp.purchases.markPaid.subtitle')}</p>
          </div>
        </div>
        <p className="text-sm text-white/60">
          {t('erp.purchases.markPaid.confirm', { number: purchase.purchaseNumber, amount: fmt(purchase.total, purchase.currency) })}
        </p>
        <div>
          <label className="block text-xs font-medium text-white/50 mb-1.5">{t('erp.purchases.markPaid.paymentDate')}</label>
          <input type="date" value={paidAt} onChange={e => setPaidAt(e.target.value)} className={sharedInput} />
        </div>
        {mutation.isError && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {(mutation.error as any)?.response?.data?.message ?? t('erp.purchases.markPaid.failed')}
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white text-sm min-h-[44px] transition-colors">{t('erp.common.cancel')}</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
            className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-600 text-sm disabled:opacity-50 min-h-[44px] transition-colors">
            {mutation.isPending ? t('erp.common.saving') : t('erp.purchases.markPaid.confirmButton')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Modal ─────────────────────────────────────────────────────────────

function DeleteModal({ isOpen, purchase, onClose }: { isOpen: boolean; purchase: Purchase | null; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => purchasesApi.deletePurchase(purchase!.id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['erp-purchases'] }); onClose(); },
  });
  if (!isOpen || !purchase) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#111] shadow-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20"><Trash2 className="w-4.5 h-4.5 text-red-400" /></div>
          <div><h2 className="text-base font-bold text-white">{t('erp.purchases.delete.title')}</h2><p className="text-xs text-white/30">{t('erp.purchases.delete.subtitle')}</p></div>
        </div>
        <p className="text-sm text-white/60">{t('erp.purchases.delete.confirm', { number: purchase.purchaseNumber })}</p>
        {mutation.isError && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {(mutation.error as any)?.response?.data?.message ?? t('erp.purchases.delete.failed')}
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

export default function PurchasesPage() {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  const [activeTab, setActiveTab] = useState<ActiveTab>('all');
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 300);
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editEntry, setEditEntry] = useState<Purchase | null>(null);
  const [payEntry, setPayEntry] = useState<Purchase | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<Purchase | null>(null);

  const params = {
    page, limit: 10,
    ...(activeTab !== 'all' && { paymentStatus: activeTab }),
    ...(search && { search }),
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['erp-purchases', params],
    queryFn:  () => purchasesApi.getPurchases(params).then(r => r.data.data as PaginatedPurchases),
    staleTime: 15_000, enabled: mounted,
    placeholderData: (prev: any) => prev,
  });

  const purchases  = data?.purchases ?? [];
  const totalPages = data?.pages ?? 1;

  function openCreate() { setEditEntry(null); setShowModal(true); }
  function openEdit(p: Purchase) { setEditEntry(p); setShowModal(true); }

  const columns: Column<Purchase>[] = [
    {
      key: 'po',
      header: t('erp.purchases.col.po'),
      cell: (p) => (
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-[#fbbf24]/20 bg-[#fbbf24]/10">
            <ShoppingCart className="w-4 h-4 text-[#fbbf24]" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate">{p.purchaseNumber}</div>
            <div className="text-[11px] text-white/35 truncate">{p.supplier?.name ?? t('erp.purchases.unknownSupplier')}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'dates',
      header: t('erp.purchases.col.dates'),
      hideOnMobile: true,
      cell: (p) => (
        <div className="text-xs text-white/40 space-y-0.5">
          {p.orderDate && <div>{t('erp.purchases.ordered', { date: fmtDate(p.orderDate) })}</div>}
          {p.dueDate && <div>{t('erp.purchases.due', { date: fmtDate(p.dueDate) })}</div>}
        </div>
      ),
    },
    {
      key: 'status',
      header: t('erp.purchases.col.status'),
      align: 'center',
      cell: (p) => (
        <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold border inline-block', STATUS_BADGE[p.status])}>{t(`erp.purchases.status.${p.status}`)}</span>
      ),
    },
    {
      key: 'payment',
      header: t('erp.purchases.col.payment'),
      align: 'center',
      cell: (p) => (
        <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold border inline-block', PAY_BADGE[p.paymentStatus])}>{t(`erp.purchases.payment.${p.paymentStatus}`)}</span>
      ),
    },
    {
      key: 'total',
      header: t('erp.purchases.col.total'),
      align: 'right',
      cell: (p) => <span className="text-sm font-bold text-white whitespace-nowrap">{fmt(p.total, p.currency)}</span>,
    },
  ];

  const rowActions: RowAction<Purchase>[] = [
    { label: t('erp.purchases.actions.markPaid'), icon: CreditCard, onClick: (p) => setPayEntry(p), show: (p) => p.paymentStatus !== 'PAID' },
    { label: t('erp.purchases.actions.edit'), icon: Edit2, onClick: (p) => openEdit(p), show: (p) => p.paymentStatus !== 'PAID' },
    { label: t('erp.purchases.actions.delete'), icon: Trash2, danger: true, onClick: (p) => setDeleteEntry(p), show: () => isAdmin },
  ];

  if (!mounted) return null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#fbbf24]/10 border border-[#fbbf24]/20">
              <ShoppingCart className="w-4.5 h-4.5 text-[#fbbf24]" />
            </span>
            {t('erp.purchases.title')}
          </h1>
          <p className="text-sm text-white/30 mt-1 ml-11">{t('erp.purchases.subtitle')}</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#fbbf24] text-black font-semibold hover:bg-[#f59e0b] transition-colors text-sm min-h-[44px]">
          <Plus className="w-4 h-4" /> {t('erp.purchases.new')}
        </button>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          {(['all', 'UNPAID', 'PAID', 'OVERDUE'] as ActiveTab[]).map(tb => (
            <button key={tb} onClick={() => { setActiveTab(tb); setPage(1); }}
              className={cn('px-4 py-1.5 rounded-lg text-xs font-semibold transition-all',
                activeTab === tb ? 'bg-[#fbbf24] text-black shadow-sm' : 'text-white/35 hover:text-white')}>
              {t(`erp.purchases.payment.${tb}`)}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
          <input placeholder={t('erp.purchases.searchPlaceholder')} value={searchInput} onChange={e => { setSearchInput(e.target.value); setPage(1); }}
            className="pl-8 pr-4 py-2 rounded-lg border border-white/10 bg-white/[0.04] text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#fbbf24]/40 focus:bg-white/[0.06] w-52 transition-all" />
        </div>
      </div>

      {/* List */}
      {isLoading && <TableSkeleton cols={5} rows={6} />}
      {isError && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-red-400/50 mx-auto" />
            <p className="text-sm text-white/30">{t('erp.purchases.loadFailed')}</p>
            <button onClick={() => refetch()} className="px-4 py-2 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-xs text-white/50 transition-colors">{t('erp.common.retry')}</button>
          </div>
        </div>
      )}
      {!isLoading && !isError && purchases.length === 0 && (
        <div className="flex items-center justify-center py-16">
          <div className="text-center space-y-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] mx-auto"><ShoppingCart className="w-7 h-7 text-white/15" /></div>
            <p className="text-sm text-white/30">{t('erp.purchases.empty')}</p>
            <button onClick={openCreate} className="px-4 py-2 rounded-xl border border-[#fbbf24]/30 bg-[#fbbf24]/10 text-[#fbbf24] text-xs font-semibold hover:bg-[#fbbf24]/20 transition-colors">{t('erp.purchases.createFirst')}</button>
          </div>
        </div>
      )}
      {!isLoading && !isError && purchases.length > 0 && (
        <DataTable columns={columns} rows={purchases} rowKey={(p) => p.id} actions={rowActions} />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-white/30">{t('erp.purchases.pageInfo', { total: data?.total ?? 0, page, pages: totalPages })}</p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/40 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"><ChevronLeft className="w-4 h-4" /></button>
            <span className="px-3 text-xs text-white/40">{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/40 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* Modals */}
      <PurchaseModal isOpen={showModal} onClose={() => { setShowModal(false); setEditEntry(null); }} editPurchase={editEntry} />
      <MarkPaidModal isOpen={payEntry !== null} purchase={payEntry} onClose={() => setPayEntry(null)} />
      <DeleteModal isOpen={deleteEntry !== null} purchase={deleteEntry} onClose={() => setDeleteEntry(null)} />
    </div>
  );
}
