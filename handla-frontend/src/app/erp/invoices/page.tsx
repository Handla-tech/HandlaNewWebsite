'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Receipt, Plus, ChevronLeft, ChevronRight, MoreVertical,
  Search, DollarSign, AlertCircle, CheckCircle, Clock,
  Trash2, Edit2, CreditCard, X, Loader2, PlusCircle, MinusCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '@/store/authStore';
import { invoicesApi, clientsApi } from '@/lib/api';
import { Invoice, InvoicePaymentStatus, InvoiceLineItem, Client } from '@/types';

// ─── Status badge config ──────────────────────────────────────────────────────

const STATUS_BADGE: Record<InvoicePaymentStatus, string> = {
  UNPAID:  'bg-gray-500/20 text-gray-300 border border-gray-500/30',
  PAID:    'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  OVERDUE: 'bg-red-500/20 text-red-300 border border-red-500/30',
};
const STATUS_LABEL: Record<InvoicePaymentStatus, string> = {
  UNPAID:  'Unpaid',
  PAID:    'Paid',
  OVERDUE: 'Overdue',
};

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

// ─── Line-item totals preview ─────────────────────────────────────────────────

function computeTotals(items: { quantity: number; unitPrice: number }[], taxRate: number) {
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const taxAmount = (subtotal * taxRate) / 100;
  const total = subtotal + taxAmount;
  return {
    subtotal: +subtotal.toFixed(2),
    taxAmount: +taxAmount.toFixed(2),
    total: +total.toFixed(2),
  };
}

// ─── InvoiceRow ──────────────────────────────────────────────────────────────

function InvoiceRow({
  invoice,
  isAdmin,
  isEmployee,
  onEdit,
  onMarkPaid,
  onDelete,
}: {
  invoice: Invoice;
  isAdmin: boolean;
  isEmployee: boolean;
  onEdit: (inv: Invoice) => void;
  onMarkPaid: (inv: Invoice) => void;
  onDelete: (inv: Invoice) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const canMarkPaid = (isAdmin || isEmployee) && invoice.paymentStatus !== 'PAID';
  const canEdit     = (isAdmin || isEmployee) && invoice.paymentStatus === 'UNPAID';
  const canDelete   = isAdmin && invoice.paymentStatus === 'UNPAID';
  const isOverdue   = invoice.paymentStatus === 'OVERDUE';

  return (
    <div className="relative flex items-center justify-between gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/8 transition-all">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-lg bg-[#fbbf24]/20 border border-[#fbbf24]/30 flex items-center justify-center flex-shrink-0">
          <Receipt className="w-5 h-5 text-[#fbbf24]" />
        </div>
        <div className="min-w-0">
          <Link href={`/erp/invoices/${invoice.id}`} className="font-semibold text-white hover:text-[#fbbf24] transition-colors block truncate">
            {invoice.invoiceNumber}
          </Link>
          <p className="text-sm text-gray-400 truncate">
            {invoice.client?.user?.name ?? invoice.clientId}
            {invoice.client?.company ? ` · ${invoice.client.company}` : ''}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Total */}
        <div className="text-right">
          <p className="font-semibold text-white">${Number(invoice.total).toFixed(2)}</p>
          <p className="text-xs text-gray-500">{invoice.currency}</p>
        </div>

        {/* Status */}
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[invoice.paymentStatus]}`}>
          {STATUS_LABEL[invoice.paymentStatus]}
        </span>

        {/* Due date */}
        {invoice.dueDate && (
          <p className={`text-xs hidden sm:block ${isOverdue ? 'text-red-400' : 'text-gray-400'}`}>
            Due {new Date(invoice.dueDate).toLocaleDateString()}
          </p>
        )}

        {/* Owner */}
        {invoice.owner && (
          <p className="text-xs text-gray-500 hidden lg:block">{invoice.owner.name}</p>
        )}

        {/* Action menu */}
        {(canMarkPaid || canEdit || canDelete) && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-8 w-44 bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl z-20 overflow-hidden">
                {canMarkPaid && (
                  <button
                    onClick={() => { onMarkPaid(invoice); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-emerald-300 hover:bg-white/5 transition-colors"
                  >
                    <CreditCard className="w-4 h-4" /> Mark as Paid
                  </button>
                )}
                {canEdit && (
                  <button
                    onClick={() => { onEdit(invoice); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" /> Edit
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => { onDelete(invoice); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-white/5 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
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

function CreateInvoiceModal({
  clients,
  clientsLoading,
  onClose,
  onSaved,
}: {
  clients: Client[];
  clientsLoading: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { register, control, handleSubmit, watch, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { lineItems: [{ description: '', quantity: 1, unitPrice: 0 }], taxRate: 0 },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'lineItems' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const watchItems = watch('lineItems');
  const watchTax = watch('taxRate') ?? 0;
  const totals = computeTotals(watchItems ?? [], watchTax);

  const onSubmit = async (data: CreateForm) => {
    setSubmitting(true); setError('');
    try {
      await invoicesApi.createInvoice({
        clientId: data.clientId,
        lineItems: data.lineItems,
        taxRate: data.taxRate ?? 0,
        dueDate: data.dueDate || undefined,
        notes: data.notes || undefined,
      });
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to create invoice');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-xl font-bold text-white">Create Invoice</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-gray-400"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
          {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Client *</label>
            <select
              {...register('clientId')}
              disabled={clientsLoading}
              className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-[#fbbf24]/50 focus:outline-none${clientsLoading ? ' opacity-60 cursor-wait' : ''}`}
            >
              <option value="">
                {clientsLoading ? 'Loading clients…' : clients.length === 0 ? 'No clients found' : 'Select client…'}
              </option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.user?.name ?? c.id}{c.company ? ` — ${c.company}` : ''}</option>
              ))}
            </select>
            {errors.clientId && <p className="text-red-400 text-xs mt-1">{errors.clientId.message}</p>}
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-400">Line Items *</label>
              <button type="button" onClick={() => append({ description: '', quantity: 1, unitPrice: 0 })}
                className="flex items-center gap-1 text-xs text-[#fbbf24] hover:text-[#fbbf24]/80 transition-colors">
                <PlusCircle className="w-3.5 h-3.5" /> Add Item
              </button>
            </div>
            <div className="space-y-2">
              {fields.map((field, idx) => (
                <div key={field.id} className="grid grid-cols-12 gap-2 items-start">
                  <input
                    {...register(`lineItems.${idx}.description`)}
                    placeholder="Description"
                    className="col-span-6 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-[#fbbf24]/50 focus:outline-none placeholder-gray-500"
                  />
                  <input
                    type="number" step="0.01" min="0.01"
                    {...register(`lineItems.${idx}.quantity`, { valueAsNumber: true })}
                    placeholder="Qty"
                    className="col-span-2 bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-white text-sm focus:border-[#fbbf24]/50 focus:outline-none text-center"
                  />
                  <input
                    type="number" step="0.01" min="0"
                    {...register(`lineItems.${idx}.unitPrice`, { valueAsNumber: true })}
                    placeholder="Price"
                    className="col-span-3 bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-white text-sm focus:border-[#fbbf24]/50 focus:outline-none text-right"
                  />
                  <button type="button" onClick={() => fields.length > 1 && remove(idx)}
                    className="col-span-1 p-2 text-red-400 hover:text-red-300 disabled:opacity-30" disabled={fields.length === 1}>
                    <MinusCircle className="w-4 h-4" />
                  </button>
                  {/* Line total preview */}
                  <p className="col-span-full text-right text-xs text-gray-500">
                    Line total: ${((watchItems?.[idx]?.quantity ?? 0) * (watchItems?.[idx]?.unitPrice ?? 0)).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Tax + due date + notes */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Tax Rate %</label>
              <input type="number" step="0.01" min="0" max="100"
                {...register('taxRate', { valueAsNumber: true })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-[#fbbf24]/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Due Date</label>
              <input type="date" {...register('dueDate')}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-[#fbbf24]/50 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Notes</label>
            <textarea {...register('notes')} rows={2} placeholder="Optional payment instructions..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-[#fbbf24]/50 focus:outline-none placeholder-gray-500 resize-none"
            />
          </div>

          {/* Totals summary */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1">
            <div className="flex justify-between text-sm text-gray-400">
              <span>Subtotal</span><span>${totals.subtotal.toFixed(2)}</span>
            </div>
            {watchTax > 0 && (
              <div className="flex justify-between text-sm text-gray-400">
                <span>Tax ({watchTax}%)</span><span>${totals.taxAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-white border-t border-white/10 pt-2 mt-2">
              <span>Total</span><span className="text-[#fbbf24]">${totals.total.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-white/10 text-gray-400 hover:bg-white/5 transition-colors">Cancel</button>
            <button type="submit" disabled={submitting}
              className="flex-1 py-3 rounded-xl bg-[#fbbf24] text-black font-semibold hover:bg-[#f59e0b] disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
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
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    setLoading(true); setError('');
    try {
      await invoicesApi.markInvoicePaid(invoice.id);
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to mark as paid');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
            <CreditCard className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Mark as Paid</h3>
            <p className="text-sm text-gray-400">{invoice.invoiceNumber} — ${Number(invoice.total).toFixed(2)}</p>
          </div>
        </div>
        <p className="text-gray-300 mb-4 text-sm">Confirm that this invoice has been paid in full?</p>
        {error && <div className="p-3 mb-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:bg-white/5 transition-colors">Cancel</button>
          <button onClick={handleConfirm} disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />} Confirm Paid
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── DeleteConfirmModal ───────────────────────────────────────────────────────

function DeleteConfirmModal({ invoice, onClose, onSaved }: { invoice: Invoice; onClose: () => void; onSaved: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    setLoading(true); setError('');
    try {
      await invoicesApi.deleteInvoice(invoice.id);
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to delete invoice');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center">
            <Trash2 className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Delete Invoice</h3>
            <p className="text-sm text-gray-400">{invoice.invoiceNumber}</p>
          </div>
        </div>
        <p className="text-gray-300 mb-4 text-sm">This action cannot be undone. Only UNPAID invoices can be deleted.</p>
        {error && <div className="p-3 mb-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:bg-white/5 transition-colors">Cancel</button>
          <button onClick={handleDelete} disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
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
  const isClient   = user?.role === 'CLIENT';

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoicePaymentStatus | ''>('');
  const [showCreate, setShowCreate] = useState(false);
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
  const [markPaidInvoice, setMarkPaidInvoice] = useState<Invoice | null>(null);
  const [deleteInvoice, setDeleteInvoice] = useState<Invoice | null>(null);

  const params = {
    page, limit: 20,
    ...(search ? { search } : {}),
    ...(statusFilter ? { paymentStatus: statusFilter } : {}),
  };

  const { data, isLoading } = useQuery({
    queryKey: ['erp-invoices', params],
    queryFn: () => invoicesApi.getInvoices(params).then(r => r.data?.data ?? r.data),
    enabled: mounted,
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // enabled: mounted && !!user fires as soon as auth resolves — avoids empty
  // dropdown when modal opens before a role-gated query would have fired.
  const { data: clientsData, isLoading: clientsLoading } = useQuery({
    queryKey: ['erp-clients-select'],
    queryFn: () => clientsApi.getClients({ limit: 100 }).then(r => {
      const d = r.data?.data ?? r.data;
      return (d?.clients ?? d) as Client[];
    }),
    enabled: mounted && !!user,
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const invoices: Invoice[] = data?.invoices ?? [];
  const total: number = data?.total ?? 0;
  const pages: number = data?.pages ?? 1;
  const clients: Client[] = clientsData ?? [];

  // Stats from current page (live)
  const unpaid  = invoices.filter(i => i.paymentStatus === 'UNPAID').length;
  const paid    = invoices.filter(i => i.paymentStatus === 'PAID').length;
  const overdue = invoices.filter(i => i.paymentStatus === 'OVERDUE').length;
  const totalRevenue = invoices.filter(i => i.paymentStatus === 'PAID').reduce((s, i) => s + Number(i.total), 0);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['erp-invoices'] });
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Receipt className="w-7 h-7 text-[#fbbf24]" /> Invoices
          </h1>
          <p className="text-gray-400 text-sm mt-1">Manage client invoices and payments</p>
        </div>
        {(isAdmin || isEmployee) && (
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#fbbf24] text-black font-semibold hover:bg-[#f59e0b] transition-colors">
            <Plus className="w-4 h-4" /> New Invoice
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: total, icon: Receipt, color: 'text-white', bg: 'bg-white/5' },
          { label: 'Unpaid', value: unpaid, icon: Clock, color: 'text-amber-300', bg: 'bg-amber-500/10' },
          { label: 'Paid', value: paid, icon: CheckCircle, color: 'text-emerald-300', bg: 'bg-emerald-500/10' },
          { label: 'Overdue', value: overdue, icon: AlertCircle, color: 'text-red-300', bg: 'bg-red-500/10' },
        ].map(s => (
          <div key={s.label} className={`p-4 rounded-xl ${s.bg} border border-white/10`}>
            <div className="flex items-center gap-2 mb-2">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <span className="text-gray-400 text-sm">{s.label}</span>
            </div>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Revenue summary */}
      {(isAdmin || isEmployee) && totalRevenue > 0 && (
        <div className="p-4 rounded-xl bg-[#fbbf24]/10 border border-[#fbbf24]/20 flex items-center gap-3">
          <DollarSign className="w-5 h-5 text-[#fbbf24]" />
          <p className="text-sm text-gray-300">
            Paid revenue on this page: <span className="text-[#fbbf24] font-semibold">${totalRevenue.toFixed(2)}</span>
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text" placeholder="Search invoice number..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#fbbf24]/50"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['', 'UNPAID', 'PAID', 'OVERDUE'] as const).map(s => (
            <button key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-[#fbbf24] text-black'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'
              }`}>
              {s === '' ? 'All' : STATUS_LABEL[s as InvoicePaymentStatus]}
            </button>
          ))}
        </div>
      </div>

      {/* Invoice list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Receipt className="w-12 h-12 text-gray-600 mb-4" />
          <h3 className="text-lg font-semibold text-gray-400 mb-2">No invoices found</h3>
          <p className="text-gray-500 text-sm">
            {(isAdmin || isEmployee) ? 'Create your first invoice to get started.' : 'No invoices have been issued yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map(inv => (
            <InvoiceRow
              key={inv.id}
              invoice={inv}
              isAdmin={isAdmin}
              isEmployee={isEmployee}
              onEdit={setEditInvoice}
              onMarkPaid={setMarkPaidInvoice}
              onDelete={setDeleteInvoice}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">{total} invoices total</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 disabled:opacity-40 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-400 px-2">{page} / {pages}</span>
            <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
              className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 disabled:opacity-40 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <CreateInvoiceModal
          clients={clients}
          clientsLoading={clientsLoading}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); invalidate(); }}
        />
      )}
      {markPaidInvoice && (
        <MarkPaidModal
          invoice={markPaidInvoice}
          onClose={() => setMarkPaidInvoice(null)}
          onSaved={() => { setMarkPaidInvoice(null); invalidate(); }}
        />
      )}
      {deleteInvoice && (
        <DeleteConfirmModal
          invoice={deleteInvoice}
          onClose={() => setDeleteInvoice(null)}
          onSaved={() => { setDeleteInvoice(null); invalidate(); }}
        />
      )}
    </div>
  );
}
