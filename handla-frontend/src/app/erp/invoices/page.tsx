'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/useDebounce';
import { DataTable, TableSkeleton, type Column, type RowAction } from '@/components/ui/DataTable';
import {
  Receipt, Plus, ChevronLeft, ChevronRight,
  Search, DollarSign, AlertCircle, CheckCircle, Clock,
  Trash2, Edit2, CreditCard, X, Loader2, PlusCircle, MinusCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '@/store/authStore';
import { useTranslation } from '@/hooks/useTranslation';
import { invoicesApi, clientsApi } from '@/lib/api';
import { Invoice, InvoicePaymentStatus, InvoiceLineItem, Client } from '@/types';
import { cn } from '@/lib/utils';

// ─── Status badge config ──────────────────────────────────────────────────────

const STATUS_BADGE: Record<InvoicePaymentStatus, string> = {
  UNPAID:  'border-amber-500/30 bg-amber-500/10 text-amber-400',
  PAID:    'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  OVERDUE: 'border-red-500/30 bg-red-500/10 text-red-400',
};
// ─── Shared styles ─────────────────────────────────────────────────────────────

const sharedInput = 'w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/20 focus:border-[#fbbf24]/50 focus:outline-none focus:bg-white/[0.06] transition-all text-sm';

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const lineItemSchema = z.object({
  description: z.string().min(2).max(500),
  quantity:    z.number().min(0.01),
  unitPrice:   z.number().min(0),
});

const createSchema = z.object({
  clientId:  z.string().uuid('Select a client'),
  lineItems: z.array(lineItemSchema).min(1, 'At least one line item required'),
  taxRate:   z.number().min(0).max(100).optional(),
  dueDate:   z.string().optional(),
  notes:     z.string().optional(),
});

type CreateForm = z.infer<typeof createSchema>;

function computeTotals(items: { quantity: number; unitPrice: number }[], taxRate: number) {
  const subtotal  = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const taxAmount = (subtotal * taxRate) / 100;
  const total     = subtotal + taxAmount;
  return { subtotal: +subtotal.toFixed(2), taxAmount: +taxAmount.toFixed(2), total: +total.toFixed(2) };
}

// ─── CreateInvoiceModal ───────────────────────────────────────────────────────

function CreateInvoiceModal({ clients, clientsLoading, onClose, onSaved }: {
  clients: Client[]; clientsLoading: boolean; onClose: () => void; onSaved: () => void;
}) {
  const { t } = useTranslation();
  const { register, control, handleSubmit, watch, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { lineItems: [{ description: '', quantity: 1, unitPrice: 0 }], taxRate: 0 },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'lineItems' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');
  const watchItems = watch('lineItems');
  const watchTax   = watch('taxRate') ?? 0;
  const totals     = computeTotals(watchItems ?? [], watchTax);

  const onSubmit = async (data: CreateForm) => {
    setSubmitting(true); setError('');
    try {
      await invoicesApi.createInvoice({
        clientId: data.clientId, lineItems: data.lineItems,
        taxRate: data.taxRate ?? 0, dueDate: data.dueDate || undefined, notes: data.notes || undefined,
      });
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? t('erp.invoices.modals.create.createFailed'));
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
          <div>
            <h2 className="text-base font-bold text-white">{t('erp.invoices.modals.create.title')}</h2>
            <p className="text-xs text-white/30 mt-0.5">{t('erp.invoices.modals.create.subtitle')}</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-5">
          {error && <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}

          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">{t('erp.invoices.modals.create.clientLabel')}</label>
            <select {...register('clientId')} disabled={clientsLoading}
              className={cn(sharedInput, 'bg-[#0f0f0f]', clientsLoading && 'opacity-60 cursor-wait')}>
              <option value="">{clientsLoading ? t('erp.invoices.modals.create.clientLoading') : clients.length === 0 ? t('erp.invoices.modals.create.clientNone') : t('erp.invoices.modals.create.clientSelect')}</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.user?.name ?? c.id}{c.company ? ` — ${c.company}` : ''}</option>)}
            </select>
            {errors.clientId && <p className="text-red-400 text-xs mt-1">{errors.clientId.message}</p>}
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-white/50">{t('erp.invoices.modals.create.lineItemsLabel')}</label>
              <button type="button" onClick={() => append({ description: '', quantity: 1, unitPrice: 0 })}
                className="flex items-center gap-1.5 text-xs text-[#fbbf24] hover:text-[#f59e0b] transition-colors font-semibold">
                <PlusCircle className="w-3.5 h-3.5" /> {t('erp.invoices.modals.create.addLineItem')}
              </button>
            </div>
            <div className="space-y-2">
              {fields.map((field, idx) => (
                <div key={field.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="grid grid-cols-12 gap-2 items-start">
                    <input {...register(`lineItems.${idx}.description`)} placeholder={t('erp.invoices.modals.create.descriptionPlaceholder')}
                      className={cn('col-span-6', sharedInput, 'py-2')} />
                    <input type="number" step="0.01" min="0.01" {...register(`lineItems.${idx}.quantity`, { valueAsNumber: true })}
                      placeholder={t('erp.invoices.modals.create.qtyPlaceholder')} className={cn('col-span-2', sharedInput, 'py-2 text-center')} />
                    <input type="number" step="0.01" min="0" {...register(`lineItems.${idx}.unitPrice`, { valueAsNumber: true })}
                      placeholder={t('erp.invoices.modals.create.pricePlaceholder')} className={cn('col-span-3', sharedInput, 'py-2 text-right')} />
                    <button type="button" onClick={() => fields.length > 1 && remove(idx)}
                      className="col-span-1 flex h-9 w-9 items-center justify-center rounded-lg text-red-400 hover:bg-red-400/10 disabled:opacity-30 transition-colors" disabled={fields.length === 1}>
                      <MinusCircle className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-right text-[11px] text-white/25 mt-1.5">
                    {t('erp.invoices.modals.create.lineTotalPrefix')} ${((watchItems?.[idx]?.quantity ?? 0) * (watchItems?.[idx]?.unitPrice ?? 0)).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Tax + due date + notes */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">{t('erp.invoices.modals.create.taxRateLabel')}</label>
              <input type="number" step="0.01" min="0" max="100" {...register('taxRate', { valueAsNumber: true })} className={sharedInput} />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">{t('erp.invoices.modals.create.dueDateLabel')}</label>
              <input type="date" {...register('dueDate')} className={sharedInput} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">{t('erp.invoices.modals.create.notesLabel')}</label>
            <textarea {...register('notes')} rows={2} placeholder={t('erp.invoices.modals.create.notesPlaceholder')} className={cn(sharedInput, 'resize-none')} />
          </div>

          {/* Totals summary */}
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-2">
            <div className="flex justify-between text-sm text-white/40">
              <span>{t('erp.invoices.modals.create.subtotalLabel')}</span><span>${totals.subtotal.toFixed(2)}</span>
            </div>
            {watchTax > 0 && (
              <div className="flex justify-between text-sm text-white/40">
                <span>{t('erp.invoices.modals.create.taxLabel', { rate: watchTax })}</span><span>${totals.taxAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-white border-t border-white/[0.08] pt-2">
              <span>{t('erp.invoices.modals.create.totalLabel')}</span><span className="text-[#fbbf24] text-lg">${totals.total.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white transition-colors text-sm">{t('erp.invoices.modals.create.cancel')}</button>
            <button type="submit" disabled={submitting}
              className="flex-1 py-2.5 rounded-xl bg-[#fbbf24] text-black font-semibold hover:bg-[#f59e0b] disabled:opacity-50 transition-colors text-sm flex items-center justify-center gap-2">
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />} {t('erp.invoices.modals.create.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── MarkPaidModal ────────────────────────────────────────────────────────────

function MarkPaidModal({ invoice, onClose, onSaved }: { invoice: Invoice; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleConfirm = async () => {
    setLoading(true); setError('');
    try { await invoicesApi.markInvoicePaid(invoice.id); onSaved(); }
    catch (e: any) { setError(e?.response?.data?.message ?? t('erp.invoices.modals.markPaid.failed')); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">{t('erp.invoices.modals.markPaid.subtitle')}</h3>
            <p className="text-xs text-white/30">{invoice.invoiceNumber} — ${Number(invoice.total).toFixed(2)}</p>
          </div>
        </div>
        <p className="text-sm text-white/60 mb-4">{t('erp.invoices.modals.markPaid.confirm')}</p>
        {error && <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white transition-colors text-sm">{t('erp.invoices.modals.markPaid.cancel')}</button>
          <button onClick={handleConfirm} disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-600 disabled:opacity-50 transition-colors text-sm flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />} {t('erp.invoices.modals.markPaid.confirmButton')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── DeleteConfirmModal ────────────────────────────────────────────────────────

function DeleteConfirmModal({ invoice, onClose, onSaved }: { invoice: Invoice; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleDelete = async () => {
    setLoading(true); setError('');
    try { await invoicesApi.deleteInvoice(invoice.id); onSaved(); }
    catch (e: any) { setError(e?.response?.data?.message ?? t('erp.invoices.modals.delete.failed')); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">{t('erp.invoices.modals.delete.title')}</h3>
            <p className="text-xs text-white/30">{invoice.invoiceNumber}</p>
          </div>
        </div>
        <p className="text-sm text-white/60 mb-4">{t('erp.invoices.modals.delete.warning')}</p>
        {error && <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white transition-colors text-sm">{t('erp.invoices.modals.delete.cancel')}</button>
          <button onClick={handleDelete} disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 disabled:opacity-50 transition-colors text-sm flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />} {t('erp.invoices.modals.delete.deleteButton')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InvoicesPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { t } = useTranslation();
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const router = useRouter();
  const isAdmin    = user?.role === 'ADMIN';
  const isEmployee = user?.role === 'EMPLOYEE';

  const [page,             setPage]             = useState(1);
  const [searchInput,      setSearchInput]      = useState('');
  const [statusFilter,     setStatusFilter]     = useState<InvoicePaymentStatus | ''>('');
  const search = useDebounce(searchInput, 300);
  const [showCreate,       setShowCreate]       = useState(false);
  const [markPaidInvoice,  setMarkPaidInvoice]  = useState<Invoice | null>(null);
  const [deleteInvoice,    setDeleteInvoice]    = useState<Invoice | null>(null);
  const [editInvoice,      setEditInvoice]      = useState<Invoice | null>(null);

  const params = { page, limit: 10, ...(search ? { search } : {}), ...(statusFilter ? { paymentStatus: statusFilter } : {}) };

  const { data, isLoading } = useQuery({
    queryKey: ['erp-invoices', params],
    queryFn:  () => invoicesApi.getInvoices(params).then(r => r.data?.data ?? r.data),
    enabled: mounted, staleTime: 30_000, retry: 1, refetchOnWindowFocus: false,
    placeholderData: (prev: any) => prev,
  });

  const { data: clientsData, isLoading: clientsLoading } = useQuery({
    queryKey: ['erp-clients-select'],
    queryFn:  () => clientsApi.getClients({ limit: 50 }).then(r => {
      const d = r.data?.data ?? r.data; return (d?.clients ?? d) as Client[];
    }),
    enabled: mounted && !!user, staleTime: 120_000, retry: 1, refetchOnWindowFocus: false,
  });

  // Per-status lightweight stat queries
  const makeStatQ = (status: InvoicePaymentStatus) => ({
    queryKey: ['erp-invoices-stat', status],
    queryFn:  () => invoicesApi.getInvoices({ limit: 1, paymentStatus: status }).then(r => (r.data?.data ?? r.data)?.total ?? 0),
    enabled: mounted, staleTime: 120_000, retry: 1, refetchOnWindowFocus: false,
  });
  const { data: unpaidCount  = 0 } = useQuery(makeStatQ('UNPAID'));
  const { data: paidCount    = 0 } = useQuery(makeStatQ('PAID'));
  const { data: overdueCount = 0 } = useQuery(makeStatQ('OVERDUE'));

  const invoices: Invoice[] = data?.invoices ?? [];
  const total: number       = data?.total ?? 0;
  const pages: number       = data?.pages ?? 1;
  const clients: Client[]   = clientsData ?? [];

  const unpaid  = unpaidCount;
  const paid    = paidCount;
  const overdue = overdueCount;
  const totalRevenue = invoices.filter(i => i.paymentStatus === 'PAID').reduce((s, i) => s + Number(i.total), 0);

  const invalidate = () => { qc.invalidateQueries({ queryKey: ['erp-invoices'] }); qc.invalidateQueries({ queryKey: ['erp-invoices-stat'] }); };

  const columns: Column<Invoice>[] = [
    {
      key: 'invoice',
      header: t('erp.invoices.fields.invoiceNumber'),
      cell: (inv) => (
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-[#fbbf24]/10 border border-[#fbbf24]/20 flex items-center justify-center flex-shrink-0">
            <Receipt className="w-4 h-4 text-[#fbbf24]" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate">{inv.invoiceNumber}</div>
            <div className="text-[11px] text-white/35 truncate">
              {inv.client?.user?.name ?? inv.clientId}
              {inv.client?.company ? ` · ${inv.client.company}` : ''}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'due',
      header: t('erp.invoices.fields.dueDate'),
      hideOnMobile: true,
      cell: (inv) => inv.dueDate
        ? <span className={cn('text-xs', inv.paymentStatus === 'OVERDUE' ? 'text-red-400' : 'text-white/40')}>{new Date(inv.dueDate).toLocaleDateString()}</span>
        : <span className="text-white/20">—</span>,
    },
    {
      key: 'owner',
      header: t('erp.invoices.fields.owner'),
      hideOnMobile: true,
      cell: (inv) => <span className="text-white/50 text-xs">{inv.owner?.name ?? '—'}</span>,
    },
    {
      key: 'status',
      header: t('erp.ui.status'),
      align: 'center',
      cell: (inv) => (
        <span className={cn('px-2.5 py-1 rounded-full text-[10px] font-semibold border inline-block', STATUS_BADGE[inv.paymentStatus])}>
          {t(`erp.invoiceStatus.${inv.paymentStatus}`)}
        </span>
      ),
    },
    {
      key: 'total',
      header: t('erp.invoices.fields.total'),
      align: 'right',
      cell: (inv) => (
        <div className="text-right whitespace-nowrap">
          <div className="text-sm font-bold text-white">${Number(inv.total).toFixed(2)}</div>
          <div className="text-[10px] text-white/25">{inv.currency}</div>
        </div>
      ),
    },
  ];

  const rowActions: RowAction<Invoice>[] = [
    { label: t('erp.invoices.actions.markPaid'), icon: CreditCard, onClick: (inv) => setMarkPaidInvoice(inv), show: (inv) => (isAdmin || isEmployee) && inv.paymentStatus !== 'PAID' },
    { label: t('erp.invoices.actions.edit'), icon: Edit2, onClick: (inv) => setEditInvoice(inv), show: (inv) => (isAdmin || isEmployee) && inv.paymentStatus === 'UNPAID' },
    { label: t('erp.invoices.actions.delete'), icon: Trash2, danger: true, onClick: (inv) => setDeleteInvoice(inv), show: (inv) => isAdmin && inv.paymentStatus === 'UNPAID' },
  ];

  if (!mounted) return null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#fbbf24]/10 border border-[#fbbf24]/20">
              <Receipt className="w-4.5 h-4.5 text-[#fbbf24]" />
            </span>
            {t('erp.invoices.title')}
          </h1>
          <p className="text-sm text-white/30 mt-1 ml-11">{t('erp.invoices.subtitle')}</p>
        </div>
        {(isAdmin || isEmployee) && (
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#fbbf24] text-black font-semibold hover:bg-[#f59e0b] transition-colors text-sm min-h-[44px]">
            <Plus className="w-4 h-4" /> {t('erp.invoices.newInvoice')}
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: t('erp.invoices.stats.total'),   value: total,   icon: Receipt,       color: 'text-white',        border: 'border-white/10',       bg: 'bg-white/[0.03]'  },
          { label: t('erp.invoices.stats.unpaid'),  value: unpaid,  icon: Clock,         color: 'text-amber-400',    border: 'border-amber-500/20',   bg: 'bg-amber-500/5'   },
          { label: t('erp.invoices.stats.paid'),    value: paid,    icon: CheckCircle,   color: 'text-emerald-400',  border: 'border-emerald-500/20', bg: 'bg-emerald-500/5' },
          { label: t('erp.invoices.stats.overdue'), value: overdue, icon: AlertCircle,   color: 'text-red-400',      border: 'border-red-500/20',     bg: 'bg-red-500/5'     },
        ].map(s => (
          <div key={s.label} className={cn('p-4 rounded-2xl border', s.border, s.bg)}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-white/25 uppercase tracking-wide">{s.label}</p>
              <s.icon className={cn('w-3.5 h-3.5', s.color)} />
            </div>
            <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Revenue summary */}
      {(isAdmin || isEmployee) && totalRevenue > 0 && (
        <div className="p-4 rounded-xl bg-[#fbbf24]/8 border border-[#fbbf24]/20 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#fbbf24]/20">
            <DollarSign className="w-4 h-4 text-[#fbbf24]" />
          </div>
          <p className="text-sm text-white/60">
            {t('erp.invoices.revenueOnPage')} <span className="text-[#fbbf24] font-bold">${totalRevenue.toFixed(2)}</span>
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
          <input type="text" placeholder={t('erp.invoices.searchPlaceholder')} value={searchInput}
            onChange={e => { setSearchInput(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#fbbf24]/50 focus:bg-white/[0.06] transition-all" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(['', 'UNPAID', 'PAID', 'OVERDUE'] as const).map(s => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
              className={cn('px-3 py-2 rounded-lg text-xs font-semibold border transition-all min-h-[44px] sm:min-h-0',
                statusFilter === s
                  ? 'bg-[#fbbf24] border-[#fbbf24] text-black'
                  : 'bg-white/[0.03] text-white/40 hover:bg-white/[0.08] hover:text-white border-white/10')}>
              {s === '' ? t('erp.invoices.filters.all') : t(`erp.invoiceStatus.${s as InvoicePaymentStatus}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Invoice list */}
      {isLoading ? (
        <TableSkeleton cols={5} rows={6} />
      ) : invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] mb-4">
            <Receipt className="w-7 h-7 text-white/15" />
          </div>
          <h3 className="text-sm font-semibold text-white/40 mb-1">{t('erp.invoices.empty')}</h3>
          <p className="text-xs text-white/25">
            {(isAdmin || isEmployee) ? t('erp.invoices.emptyHintAdmin') : t('erp.invoices.emptyHintClient')}
          </p>
        </div>
      ) : (
        <DataTable columns={columns} rows={invoices} rowKey={(inv) => inv.id}
          onRowClick={(inv) => router.push(`/erp/invoices/${inv.id}`)} actions={rowActions} />
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-white/30">{t('erp.invoices.pagination.summary', { total, page, pages })}</p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/40 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(5, pages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, pages - 4));
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
            <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/40 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <CreateInvoiceModal clients={clients} clientsLoading={clientsLoading}
          onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); invalidate(); }} />
      )}
      {markPaidInvoice && (
        <MarkPaidModal invoice={markPaidInvoice} onClose={() => setMarkPaidInvoice(null)}
          onSaved={() => { setMarkPaidInvoice(null); invalidate(); }} />
      )}
      {deleteInvoice && (
        <DeleteConfirmModal invoice={deleteInvoice} onClose={() => setDeleteInvoice(null)}
          onSaved={() => { setDeleteInvoice(null); invalidate(); }} />
      )}
    </div>
  );
}
