'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import {
  Receipt, ArrowLeft, CreditCard, Trash2, Edit2, Loader2,
  X, Calendar, User, Building, CheckCircle, Clock, AlertCircle,
  DollarSign, FileText,
} from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { invoicesApi } from '@/lib/api';
import { Invoice, InvoicePaymentStatus } from '@/types';

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<InvoicePaymentStatus, string> = {
  UNPAID:  'bg-gray-500/20 text-gray-300 border border-gray-500/30',
  PAID:    'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  OVERDUE: 'bg-red-500/20 text-red-300 border border-red-500/30',
};
const STATUS_ICON: Record<InvoicePaymentStatus, React.ElementType> = {
  UNPAID:  Clock,
  PAID:    CheckCircle,
  OVERDUE: AlertCircle,
};
const STATUS_LABEL: Record<InvoicePaymentStatus, string> = {
  UNPAID:  'Unpaid',
  PAID:    'Paid',
  OVERDUE: 'Overdue',
};

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

// ─── DeleteModal ──────────────────────────────────────────────────────────────

function DeleteModal({ invoice, onClose, onDeleted }: { invoice: Invoice; onClose: () => void; onDeleted: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    setLoading(true); setError('');
    try {
      await invoicesApi.deleteInvoice(invoice.id);
      onDeleted();
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
        <p className="text-gray-300 mb-4 text-sm">This action cannot be undone.</p>
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

export default function InvoiceDetailPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin    = user?.role === 'ADMIN';
  const isEmployee = user?.role === 'EMPLOYEE';

  const [showMarkPaid, setShowMarkPaid] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const { data: invoice, isLoading, error } = useQuery({
    queryKey: ['erp-invoice', id],
    queryFn: () => invoicesApi.getInvoice(id).then(r => (r.data?.data ?? r.data) as Invoice),
    enabled: mounted && !!id,
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  if (!mounted) return null;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 rounded-lg bg-white/5 animate-pulse" />
        <div className="h-32 rounded-2xl bg-white/5 animate-pulse" />
        <div className="h-64 rounded-2xl bg-white/5 animate-pulse" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-300">Invoice not found</h3>
        <Link href="/erp/invoices" className="mt-4 text-[#fbbf24] hover:underline text-sm">← Back to Invoices</Link>
      </div>
    );
  }

  const canMarkPaid = (isAdmin || isEmployee) && invoice.paymentStatus !== 'PAID';
  const canDelete   = isAdmin && invoice.paymentStatus === 'UNPAID';
  const StatusIcon  = STATUS_ICON[invoice.paymentStatus];
  const isOverdue   = invoice.paymentStatus === 'OVERDUE';

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['erp-invoice', id] });
    qc.invalidateQueries({ queryKey: ['erp-invoices'] });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Link href="/erp/invoices" className="flex items-center gap-1 hover:text-[#fbbf24] transition-colors">
          <ArrowLeft className="w-4 h-4" /> Invoices
        </Link>
        <span>/</span>
        <span className="text-white">{invoice.invoiceNumber}</span>
      </div>

      {/* Status banners */}
      {invoice.paymentStatus === 'PAID' && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-400" />
          <div>
            <p className="font-semibold text-emerald-300">Invoice Paid</p>
            {invoice.paidAt && (
              <p className="text-sm text-emerald-400/70">Paid on {new Date(invoice.paidAt).toLocaleDateString()}</p>
            )}
          </div>
        </div>
      )}
      {isOverdue && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <div>
              <p className="font-semibold text-red-300">Invoice Overdue</p>
              <p className="text-sm text-red-400/70">This invoice was due on {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'N/A'}</p>
            </div>
          </div>
          {canMarkPaid && (
            <button onClick={() => setShowMarkPaid(true)}
              className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition-colors flex items-center gap-2">
              <CreditCard className="w-4 h-4" /> Mark Paid
            </button>
          )}
        </div>
      )}

      {/* Header card */}
      <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-[#fbbf24]/20 border border-[#fbbf24]/30 flex items-center justify-center">
              <Receipt className="w-7 h-7 text-[#fbbf24]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{invoice.invoiceNumber}</h1>
              <p className="text-gray-400 text-sm mt-0.5">
                {invoice.client?.user?.name ?? invoice.clientId}
                {invoice.client?.company ? ` · ${invoice.client.company}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${STATUS_BADGE[invoice.paymentStatus]}`}>
              <StatusIcon className="w-4 h-4" />
              {STATUS_LABEL[invoice.paymentStatus]}
            </span>
            {canMarkPaid && invoice.paymentStatus !== 'OVERDUE' && (
              <button onClick={() => setShowMarkPaid(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-sm hover:bg-emerald-500/30 transition-colors">
                <CreditCard className="w-4 h-4" /> Mark Paid
              </button>
            )}
            {canDelete && (
              <button onClick={() => setShowDelete(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 text-sm hover:bg-red-500/30 transition-colors">
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Line items table (2/3) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#fbbf24]" /> Line Items
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-gray-400">
                    <th className="text-left pb-2 font-medium">Description</th>
                    <th className="text-center pb-2 font-medium w-16">Qty</th>
                    <th className="text-right pb-2 font-medium w-24">Unit Price</th>
                    <th className="text-right pb-2 font-medium w-24">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(invoice.lineItems ?? []).map(item => (
                    <tr key={item.id} className="text-gray-300">
                      <td className="py-3">{item.description}</td>
                      <td className="py-3 text-center">{Number(item.quantity)}</td>
                      <td className="py-3 text-right">${Number(item.unitPrice).toFixed(2)}</td>
                      <td className="py-3 text-right font-medium text-white">${Number(item.lineTotal).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals footer */}
            <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
              <div className="flex justify-between text-sm text-gray-400">
                <span>Subtotal</span>
                <span>${Number(invoice.subtotal).toFixed(2)}</span>
              </div>
              {Number(invoice.taxRate) > 0 && (
                <div className="flex justify-between text-sm text-gray-400">
                  <span>Tax ({Number(invoice.taxRate)}%)</span>
                  <span>${Number(invoice.taxAmount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-white text-base pt-2 border-t border-white/10">
                <span>Total</span>
                <span className="text-[#fbbf24] text-xl">${Number(invoice.total).toFixed(2)} {invoice.currency}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
              <h3 className="text-sm font-semibold text-gray-400 mb-2">Notes</h3>
              <p className="text-gray-300 text-sm whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}
        </div>

        {/* Metadata sidebar (1/3) */}
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-4">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Details</h3>

            <div className="flex items-start gap-3">
              <User className="w-4 h-4 text-gray-500 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500">Client</p>
                <p className="text-sm text-white">{invoice.client?.user?.name ?? invoice.clientId}</p>
                {invoice.client?.company && <p className="text-xs text-gray-400">{invoice.client.company}</p>}
              </div>
            </div>

            {invoice.owner && (
              <div className="flex items-start gap-3">
                <User className="w-4 h-4 text-gray-500 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">Owner</p>
                  <p className="text-sm text-white">{invoice.owner.name}</p>
                </div>
              </div>
            )}

            {invoice.dueDate && (
              <div className="flex items-start gap-3">
                <Calendar className={`w-4 h-4 mt-0.5 ${isOverdue ? 'text-red-400' : 'text-gray-500'}`} />
                <div>
                  <p className="text-xs text-gray-500">Due Date</p>
                  <p className={`text-sm ${isOverdue ? 'text-red-300' : 'text-white'}`}>
                    {new Date(invoice.dueDate).toLocaleDateString()}
                  </p>
                </div>
              </div>
            )}

            {invoice.paidAt && (
              <div className="flex items-start gap-3">
                <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">Paid At</p>
                  <p className="text-sm text-white">{new Date(invoice.paidAt).toLocaleDateString()}</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <Calendar className="w-4 h-4 text-gray-500 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500">Issued</p>
                <p className="text-sm text-white">{new Date(invoice.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          {/* Payment summary card */}
          <div className="p-5 rounded-2xl bg-[#fbbf24]/10 border border-[#fbbf24]/20">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-4 h-4 text-[#fbbf24]" />
              <p className="text-sm font-semibold text-[#fbbf24]">Amount Due</p>
            </div>
            <p className="text-3xl font-bold text-white">${Number(invoice.total).toFixed(2)}</p>
            <p className="text-xs text-gray-400 mt-1">{invoice.currency}</p>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showMarkPaid && invoice && (
        <MarkPaidModal
          invoice={invoice}
          onClose={() => setShowMarkPaid(false)}
          onSaved={() => { setShowMarkPaid(false); invalidate(); }}
        />
      )}
      {showDelete && invoice && (
        <DeleteModal
          invoice={invoice}
          onClose={() => setShowDelete(false)}
          onDeleted={() => { setShowDelete(false); router.push('/erp/invoices'); }}
        />
      )}
    </div>
  );
}
