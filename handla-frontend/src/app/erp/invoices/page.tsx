'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Receipt, Plus, ChevronLeft, ChevronRight, MoreVertical,
  Search, DollarSign, AlertCircle, CheckCircle, Clock,
  Trash2, Edit2, CreditCard, X, Loader2, PlusCircle, MinusCircle,
  ArrowUpRight,
} from 'lucide-react';
import Link from 'next/link';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '@/store/authStore';
import { invoicesApi, clientsApi } from '@/lib/api';
import { Invoice, InvoicePaymentStatus, InvoiceLineItem, Client } from '@/types';
import { cn } from '@/lib/utils';

// ─── Status badge config ──────────────────────────────────────────────────────

const STATUS_BADGE: Record<InvoicePaymentStatus, string> = {
  UNPAID:  'border-amber-500/30 bg-amber-500/10 text-amber-400',
  PAID:    'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  OVERDUE: 'border-red-500/30 bg-red-500/10 text-red-400',
};
const STATUS_LABEL: Record<InvoicePaymentStatus, string> = {
  UNPAID: 'Unpaid', PAID: 'Paid', OVERDUE: 'Overdue',
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

// ─── InvoiceRow ──────────────────────────────────────────────────────────────

function InvoiceRow({ invoice, isAdmin, isEmployee, onEdit, onMarkPaid, onDelete }: {
  invoice: Invoice; isAdmin: boolean; isEmployee: boolean;
  onEdit: (inv: Invoice) => void; onMarkPaid: (inv: Invoice) => void; onDelete: (inv: Invoice) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const canMarkPaid = (isAdmin || isEmployee) && invoice.paymentStatus !== 'PAID';
  const canEdit     = (isAdmin || isEmployee) && invoice.paymentStatus === 'UNPAID';
  const canDelete   = isAdmin && invoice.paymentStatus === 'UNPAID';
  const isOverdue   = invoice.paymentStatus === 'OVERDUE';

  return (
    <div className="group relative flex items-center justify-between gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.10] transition-all">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-[#fbbf24]/10 border border-[#fbbf24]/20 flex items-center justify-center flex-shrink-0">
          <Receipt className="w-4.5 h-4.5 text-[#fbbf24]" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link href={`/erp/invoices/${invoice.id}`} className="font-semibold text-white hover:text-[#fbbf24] transition-colors text-sm truncate" onClick={(e) => e.stopPropagation()}>
              {invoice.invoiceNumber}
            </Link>
            <ArrowUpRight className="w-3 h-3 text-white/20 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </div>
          <p className="text-xs text-white/30 truncate">
            {invoice.client?.user?.name ?? invoice.clientId}
            {invoice.client?.company ? ` · ${invoice.client.company}` : ''}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="text-right">
          <p className="font-bold text-white text-sm">${Number(invoice.total).toFixed(2)}</p>
          <p className="text-[10px] text-white/25">{invoice.currency}</p>
        </div>

        <span className={cn('px-2.5 py-1 rounded-full text-[11px] font-semibold border', STATUS_BADGE[invoice.paymentStatus])}>
          {STATUS_LABEL[invoice.paymentStatus]}
        </span>

        {invoice.dueDate && (
          <p className={cn('text-[11px] hidden sm:block', isOverdue ? 'text-red-400' : 'text-white/30')}>
            Due {new Date(invoice.dueDate).toLocaleDateString()}
          </p>
        )}

        {invoice.owner && (
          <p className="text-[11px] text-white/25 hidden lg:block">{invoice.owner.name}</p>
        )}

        {(canMarkPaid || canEdit || canDelete) && (
          <div className="relative">
            <button onClick={() => setMenuOpen(!menuOpen)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/25 hover:text-white hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100">
              <MoreVertical className="w-4 h-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-9 w-44 bg-[#161616] border border-white/10 rounded-xl shadow-2xl z-[9999] overflow-hidden py-1.5">
                {canMarkPaid && (
                  <button onClick={() => { onMarkPaid(invoice); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-emerald-400 hover:bg-emerald-400/10 transition-colors min-h-[40px]">
                    <CreditCard className="w-3.5 h-3.5" /> Mark as Paid
                  </button>
                )}
                {canEdit && (
                  <button onClick={() => { onEdit(invoice); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-white/70 hover:bg-white/[0.06] hover:text-white transition-colors min-h-[40px]">
                    <Edit2 className="w-3.5 h-3.5" /> Edit
                  </button>
                )}
                {canDelete && (
                  <>
                    <div className="my-1 border-t border-white/[0.06]" />
                    <button onClick={() => { onDelete(invoice); setMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-red-400 hover:bg-red-400/10 transition-colors min-h-[40px]">
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CreateInvoiceModal ───────────────────────────────────────────────────────

function CreateInvoiceModal({ clients, clientsLoading, onClose, onSaved }: {
  clients: Client[]; clientsLoading: boolean; onClose: () => void; onSaved: () => void;
}) {
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
      setError(e?.response?.data?.message ?? 'Failed to create invoice');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
          <div>
            <h2 className="text-base font-bold text-white">Create Invoice</h2>
            <p className="text-xs text-white/30 mt-0.5">Generate a new client invoice</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-5">
          {error && <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}

          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Client *</label>
            <select {...register('clientId')} disabled={clientsLoading}
              className={cn(sharedInput, 'bg-[#0f0f0f]', clientsLoading && 'opacity-60 cursor-wait')}>
              <option value="">{clientsLoading ? 'Loading clients…' : clients.length === 0 ? 'No clients found' : 'Select client…'}</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.user?.name ?? c.id}{c.company ? ` — ${c.company}` : ''}</option>)}
            </select>
            {errors.clientId && <p className="text-red-400 text-xs mt-1">{errors.clientId.message}</p>}
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-white/50">Line Items *</label>
              <button type="button" onClick={() => append({ description: '', quantity: 1, unitPrice: 0 })}
                className="flex items-center gap-1.5 text-xs text-[#fbbf24] hover:text-[#f59e0b] transition-colors font-semibold">
                <PlusCircle className="w-3.5 h-3.5" /> Add Item
              </button>
            </div>
            <div className="space-y-2">
              {fields.map((field, idx) => (
                <div key={field.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="grid grid-cols-12 gap-2 items-start">
                    <input {...register(`lineItems.${idx}.description`)} placeholder="Description"
                      className={cn('col-span-6', sharedInput, 'py-2')} />
                    <input type="number" step="0.01" min="0.01" {...register(`lineItems.${idx}.quantity`, { valueAsNumber: true })}
                      placeholder="Qty" className={cn('col-span-2', sharedInput, 'py-2 text-center')} />
                    <input type="number" step="0.01" min="0" {...register(`lineItems.${idx}.unitPrice`, { valueAsNumber: true })}
                      placeholder="Price" className={cn('col-span-3', sharedInput, 'py-2 text-right')} />
                    <button type="button" onClick={() => fields.length > 1 && remove(idx)}
                      className="col-span-1 flex h-9 w-9 items-center justify-center rounded-lg text-red-400 hover:bg-red-400/10 disabled:opacity-30 transition-colors" disabled={fields.length === 1}>
                      <MinusCircle className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-right text-[11px] text-white/25 mt-1.5">
                    Line total: ${((watchItems?.[idx]?.quantity ?? 0) * (watchItems?.[idx]?.unitPrice ?? 0)).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Tax + due date + notes */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Tax Rate %</label>
              <input type="number" step="0.01" min="0" max="100" {...register('taxRate', { valueAsNumber: true })} className={sharedInput} />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Due Date</label>
              <input type="date" {...register('dueDate')} className={sharedInput} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Notes</label>
            <textarea {...register('notes')} rows={2} placeholder="Optional payment instructions..." className={cn(sharedInput, 'resize-none')} />
          </div>

          {/* Totals summary */}
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-2">
            <div className="flex justify-between text-sm text-white/40">
              <span>Subtotal</span><span>${totals.subtotal.toFixed(2)}</span>
            </div>
            {watchTax > 0 && (
              <div className="flex justify-between text-sm text-white/40">
                <span>Tax ({watchTax}%)</span><span>${totals.taxAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-white border-t border-white/[0.08] pt-2">
              <span>Total</span><span className="text-[#fbbf24] text-lg">${totals.total.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white transition-colors text-sm">Cancel</button>
            <button type="submit" disabled={submitting}
              className="flex-1 py-2.5 rounded-xl bg-[#fbbf24] text-black font-semibold hover:bg-[#f59e0b] disabled:opacity-50 transition-colors text-sm flex items-center justify-center gap-2">
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />} Create Invoice
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── MarkPaidModal ────────────────────────────────────────────────────────────

function MarkPaidModal({ invoice, onClose, onSaved }: { invoice: Invoice; onClose: () => void; onSaved: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleConfirm = async () => {
    setLoading(true); setError('');
    try { await invoicesApi.markInvoicePaid(invoice.id); onSaved(); }
    catch (e: any) { setError(e?.response?.data?.message ?? 'Failed to mark as paid'); }
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
            <h3 className="text-base font-bold text-white">Mark as Paid</h3>
            <p className="text-xs text-white/30">{invoice.invoiceNumber} — ${Number(invoice.total).toFixed(2)}</p>
          </div>
        </div>
        <p className="text-sm text-white/60 mb-4">Confirm that this invoice has been paid in full?</p>
        {error && <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white transition-colors text-sm">Cancel</button>
          <button onClick={handleConfirm} disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-600 disabled:opacity-50 transition-colors text-sm flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />} Confirm Paid
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── DeleteConfirmModal ────────────────────────────────────────────────────────

function DeleteConfirmModal({ invoice, onClose, onSaved }: { invoice: Invoice; onClose: () => void; onSaved: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleDelete = async () => {
    setLoading(true); setError('');
    try { await invoicesApi.deleteInvoice(invoice.id); onSaved(); }
    catch (e: any) { setError(e?.response?.data?.message ?? 'Failed to delete invoice'); }
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
            <h3 className="text-base font-bold text-white">Delete Invoice</h3>
            <p className="text-xs text-white/30">{invoice.invoiceNumber}</p>
          </div>
        </div>
        <p className="text-sm text-white/60 mb-4">This action cannot be undone. Only UNPAID invoices can be deleted.</p>
        {error && <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white transition-colors text-sm">Cancel</button>
          <button onClick={handleDelete} disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 disabled:opacity-50 transition-colors text-sm flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />} Delete
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

  const { user } = useAuthStore();
  const qc = useQueryClient();
  const isAdmin    = user?.role === 'ADMIN';
  const isEmployee = user?.role === 'EMPLOYEE';

  const [page,             setPage]             = useState(1);
  const [search,           setSearch]           = useState('');
  const [statusFilter,     setStatusFilter]     = useState<InvoicePaymentStatus | ''>('');
  const [showCreate,       setShowCreate]       = useState(false);
  const [markPaidInvoice,  setMarkPaidInvoice]  = useState<Invoice | null>(null);
  const [deleteInvoice,    setDeleteInvoice]    = useState<Invoice | null>(null);
  const [editInvoice,      setEditInvoice]      = useState<Invoice | null>(null);

  const params = { page, limit: 20, ...(search ? { search } : {}), ...(statusFilter ? { paymentStatus: statusFilter } : {}) };

  const { data, isLoading } = useQuery({
    queryKey: ['erp-invoices', params],
    queryFn:  () => invoicesApi.getInvoices(params).then(r => r.data?.data ?? r.data),
    enabled: mounted, staleTime: 30_000, retry: 1, refetchOnWindowFocus: false,
  });

  const { data: clientsData, isLoading: clientsLoading } = useQuery({
    queryKey: ['erp-clients-select'],
    queryFn:  () => clientsApi.getClients({ limit: 100 }).then(r => {
      const d = r.data?.data ?? r.data; return (d?.clients ?? d) as Client[];
    }),
    enabled: mounted && !!user, staleTime: 60_000, retry: 1, refetchOnWindowFocus: false,
  });

  const invoices: Invoice[] = data?.invoices ?? [];
  const total: number       = data?.total ?? 0;
  const pages: number       = data?.pages ?? 1;
  const clients: Client[]   = clientsData ?? [];

  const unpaid  = invoices.filter(i => i.paymentStatus === 'UNPAID').length;
  const paid    = invoices.filter(i => i.paymentStatus === 'PAID').length;
  const overdue = invoices.filter(i => i.paymentStatus === 'OVERDUE').length;
  const totalRevenue = invoices.filter(i => i.paymentStatus === 'PAID').reduce((s, i) => s + Number(i.total), 0);

  const invalidate = () => { qc.invalidateQueries({ queryKey: ['erp-invoices'] }); };

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
            Invoices
          </h1>
          <p className="text-sm text-white/30 mt-1 ml-11">Manage client invoices and payments</p>
        </div>
        {(isAdmin || isEmployee) && (
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#fbbf24] text-black font-semibold hover:bg-[#f59e0b] transition-colors text-sm min-h-[44px]">
            <Plus className="w-4 h-4" /> New Invoice
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total',   value: total,   icon: Receipt,       color: 'text-white',        border: 'border-white/10',       bg: 'bg-white/[0.03]'  },
          { label: 'Unpaid',  value: unpaid,  icon: Clock,         color: 'text-amber-400',    border: 'border-amber-500/20',   bg: 'bg-amber-500/5'   },
          { label: 'Paid',    value: paid,    icon: CheckCircle,   color: 'text-emerald-400',  border: 'border-emerald-500/20', bg: 'bg-emerald-500/5' },
          { label: 'Overdue', value: overdue, icon: AlertCircle,   color: 'text-red-400',      border: 'border-red-500/20',     bg: 'bg-red-500/5'     },
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
            Paid revenue on this page: <span className="text-[#fbbf24] font-bold">${totalRevenue.toFixed(2)}</span>
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
          <input type="text" placeholder="Search invoice number..." value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#fbbf24]/50 focus:bg-white/[0.06] transition-all" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(['', 'UNPAID', 'PAID', 'OVERDUE'] as const).map(s => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
              className={cn('px-3 py-2 rounded-lg text-xs font-semibold border transition-all min-h-[44px] sm:min-h-0',
                statusFilter === s
                  ? 'bg-[#fbbf24] border-[#fbbf24] text-black'
                  : 'bg-white/[0.03] text-white/40 hover:bg-white/[0.08] hover:text-white border-white/10')}>
              {s === '' ? 'All' : STATUS_LABEL[s as InvoicePaymentStatus]}
            </button>
          ))}
        </div>
      </div>

      {/* Invoice list */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-white/[0.04] animate-pulse" />)}
        </div>
      ) : invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] mb-4">
            <Receipt className="w-7 h-7 text-white/15" />
          </div>
          <h3 className="text-sm font-semibold text-white/40 mb-1">No invoices found</h3>
          <p className="text-xs text-white/25">
            {(isAdmin || isEmployee) ? 'Create your first invoice to get started.' : 'No invoices have been issued yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map(inv => (
            <InvoiceRow key={inv.id} invoice={inv} isAdmin={isAdmin} isEmployee={isEmployee}
              onEdit={setEditInvoice} onMarkPaid={setMarkPaidInvoice} onDelete={setDeleteInvoice} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-white/30">{total} invoices total</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/40 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-white/40 px-2">{page} / {pages}</span>
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
