'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import {
  Receipt, ArrowLeft, CreditCard, Trash2, Edit2, Loader2,
  X, Calendar, User, Building, CheckCircle, Clock, AlertCircle,
  DollarSign, FileText, Download,
} from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { useTranslation } from '@/hooks/useTranslation';
import { invoicesApi } from '@/lib/api';
import { Invoice, InvoicePaymentStatus } from '@/types';
// NOTE: jspdf + jspdf-autotable + qrcode together are ~150 kB. We load them
// lazily so they don't impact the first paint of the invoice detail page.
// The bundle is fetched the first time the user clicks "Download PDF".

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
// ─── MarkPaidModal ────────────────────────────────────────────────────────────

function MarkPaidModal({ invoice, onClose, onSaved }: { invoice: Invoice; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    setLoading(true); setError('');
    try {
      await invoicesApi.markInvoicePaid(invoice.id);
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? t('erp.invoices.detail.markPaidFailed'));
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
            <h3 className="text-lg font-bold text-white">{t('erp.invoices.detail.markPaidSubtitle')}</h3>
            <p className="text-sm text-gray-400">{invoice.invoiceNumber} — ${Number(invoice.total).toFixed(2)}</p>
          </div>
        </div>
        <p className="text-gray-300 mb-4 text-sm">{t('erp.invoices.detail.markPaidConfirm')}</p>
        {error && <div className="p-3 mb-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:bg-white/5 transition-colors">{t('erp.invoices.detail.cancel')}</button>
          <button onClick={handleConfirm} disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />} {t('erp.invoices.detail.confirmPaid')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── DeleteModal ──────────────────────────────────────────────────────────────

function DeleteModal({ invoice, onClose, onDeleted }: { invoice: Invoice; onClose: () => void; onDeleted: () => void }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    setLoading(true); setError('');
    try {
      await invoicesApi.deleteInvoice(invoice.id);
      onDeleted();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? t('erp.invoices.detail.deleteFailed'));
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
            <h3 className="text-lg font-bold text-white">{t('erp.invoices.actions.delete')}</h3>
            <p className="text-sm text-gray-400">{invoice.invoiceNumber}</p>
          </div>
        </div>
        <p className="text-gray-300 mb-4 text-sm">{t('erp.invoices.detail.deleteWarning')}</p>
        {error && <div className="p-3 mb-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:bg-white/5 transition-colors">{t('erp.invoices.detail.cancel')}</button>
          <button onClick={handleDelete} disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />} {t('erp.invoices.detail.delete')}
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

  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin    = user?.role === 'ADMIN';
  const isEmployee = user?.role === 'EMPLOYEE';

  const [showMarkPaid, setShowMarkPaid] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError]     = useState<string>('');

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
        <h3 className="text-lg font-semibold text-gray-300">{t('erp.invoices.detail.notFound')}</h3>
        <Link href="/erp/invoices" className="mt-4 text-[#fbbf24] hover:underline text-sm">← {t('erp.invoices.detail.backToInvoices')}</Link>
      </div>
    );
  }

  const canMarkPaid = (isAdmin || isEmployee) && invoice.paymentStatus !== 'PAID';
  const canDelete   = isAdmin && invoice.paymentStatus === 'UNPAID';
  const StatusIcon  = STATUS_ICON[invoice.paymentStatus];
  const isOverdue   = invoice.paymentStatus === 'OVERDUE';

  // PDF download — runs entirely client-side. The PDF library bundle is loaded
  // lazily on first click so the invoice page itself stays light. The browser
  // will block the download if the user navigates away mid-generation, which
  // is acceptable here.
  const handleDownloadPdf = async () => {
    if (!invoice) return;
    setPdfLoading(true);
    setPdfError('');
    try {
      const { downloadInvoicePdf } = await import('@/lib/pdf/invoice-pdf');
      await downloadInvoicePdf(invoice);
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('PDF generation failed', e);
      setPdfError(e?.message ?? t('erp.invoices.detail.pdfGenFailedGeneric'));
    } finally {
      setPdfLoading(false);
    }
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['erp-invoice', id] });
    qc.invalidateQueries({ queryKey: ['erp-invoices'] });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Link href="/erp/invoices" className="flex items-center gap-1 hover:text-[#fbbf24] transition-colors">
          <ArrowLeft className="w-4 h-4" /> {t('erp.invoices.title')}
        </Link>
        <span>/</span>
        <span className="text-white">{invoice.invoiceNumber}</span>
      </div>

      {/* Status banners */}
      {invoice.paymentStatus === 'PAID' && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-400" />
          <div>
            <p className="font-semibold text-emerald-300">{t('erp.invoices.banners.paid')}</p>
            {invoice.paidAt && (
              <p className="text-sm text-emerald-400/70">{t('erp.invoices.detail.paidOnDate', { date: new Date(invoice.paidAt).toLocaleDateString() })}</p>
            )}
          </div>
        </div>
      )}
      {isOverdue && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <div>
              <p className="font-semibold text-red-300">{t('erp.invoices.banners.overdue')}</p>
              <p className="text-sm text-red-400/70">{t('erp.invoices.detail.overdueDueDate', { date: invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : t('erp.ui.notAvailable') })}</p>
            </div>
          </div>
          {canMarkPaid && (
            <button onClick={() => setShowMarkPaid(true)}
              className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition-colors flex items-center gap-2">
              <CreditCard className="w-4 h-4" /> {t('erp.invoices.detail.markPaidButton')}
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
              {t(`erp.invoiceStatus.${invoice.paymentStatus}`)}
            </span>
            <button
              onClick={handleDownloadPdf}
              disabled={pdfLoading}
              title={t('erp.invoices.detail.downloadPdfTitle')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#fbbf24]/15 border border-[#fbbf24]/30 text-[#fbbf24] text-sm hover:bg-[#fbbf24]/25 disabled:opacity-60 disabled:cursor-wait transition-colors"
            >
              {pdfLoading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Download className="w-4 h-4" />}
              {pdfLoading ? t('erp.invoices.detail.generating') : t('erp.invoices.detail.downloadPdf')}
            </button>
            {canMarkPaid && invoice.paymentStatus !== 'OVERDUE' && (
              <button onClick={() => setShowMarkPaid(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-sm hover:bg-emerald-500/30 transition-colors">
                <CreditCard className="w-4 h-4" /> {t('erp.invoices.detail.markPaidButton')}
              </button>
            )}
            {canDelete && (
              <button onClick={() => setShowDelete(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 text-sm hover:bg-red-500/30 transition-colors">
                <Trash2 className="w-4 h-4" /> {t('erp.invoices.detail.delete')}
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
              <FileText className="w-5 h-5 text-[#fbbf24]" /> {t('erp.invoices.fields.lineItems')}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-gray-400">
                    <th className="text-left pb-2 font-medium">{t('erp.invoices.fields.description')}</th>
                    <th className="text-center pb-2 font-medium w-16">{t('erp.invoices.fields.quantity')}</th>
                    <th className="text-right pb-2 font-medium w-24">{t('erp.invoices.fields.unitPrice')}</th>
                    <th className="text-right pb-2 font-medium w-24">{t('erp.invoices.fields.lineTotal')}</th>
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
                <span>{t('erp.invoices.fields.subtotal')}</span>
                <span>${Number(invoice.subtotal).toFixed(2)}</span>
              </div>
              {Number(invoice.taxRate) > 0 && (
                <div className="flex justify-between text-sm text-gray-400">
                  <span>{t('erp.invoices.fields.taxAmount')} ({Number(invoice.taxRate)}%)</span>
                  <span>${Number(invoice.taxAmount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-white text-base pt-2 border-t border-white/10">
                <span>{t('erp.invoices.fields.total')}</span>
                <span className="text-[#fbbf24] text-xl">${Number(invoice.total).toFixed(2)} {invoice.currency}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
              <h3 className="text-sm font-semibold text-gray-400 mb-2">{t('erp.invoices.fields.notes')}</h3>
              <p className="text-gray-300 text-sm whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}
        </div>

        {/* Metadata sidebar (1/3) */}
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-4">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">{t('erp.invoices.detail.detailsHeading')}</h3>

            <div className="flex items-start gap-3">
              <User className="w-4 h-4 text-gray-500 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500">{t('erp.invoices.fields.client')}</p>
                <p className="text-sm text-white">{invoice.client?.user?.name ?? invoice.clientId}</p>
                {invoice.client?.company && <p className="text-xs text-gray-400">{invoice.client.company}</p>}
              </div>
            </div>

            {invoice.owner && (
              <div className="flex items-start gap-3">
                <User className="w-4 h-4 text-gray-500 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">{t('erp.invoices.fields.owner')}</p>
                  <p className="text-sm text-white">{invoice.owner.name}</p>
                </div>
              </div>
            )}

            {invoice.dueDate && (
              <div className="flex items-start gap-3">
                <Calendar className={`w-4 h-4 mt-0.5 ${isOverdue ? 'text-red-400' : 'text-gray-500'}`} />
                <div>
                  <p className="text-xs text-gray-500">{t('erp.invoices.fields.dueDate')}</p>
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
                  <p className="text-xs text-gray-500">{t('erp.invoices.fields.paidAt')}</p>
                  <p className="text-sm text-white">{new Date(invoice.paidAt).toLocaleDateString()}</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <Calendar className="w-4 h-4 text-gray-500 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500">{t('erp.invoices.fields.issuedAt')}</p>
                <p className="text-sm text-white">{new Date(invoice.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          {/* Payment summary card */}
          <div className="p-5 rounded-2xl bg-[#fbbf24]/10 border border-[#fbbf24]/20">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-4 h-4 text-[#fbbf24]" />
              <p className="text-sm font-semibold text-[#fbbf24]">{t('erp.invoices.summary.amountDue')}</p>
            </div>
            <p className="text-3xl font-bold text-white">${Number(invoice.total).toFixed(2)}</p>
            <p className="text-xs text-gray-400 mt-1">{invoice.currency}</p>
          </div>
        </div>
      </div>

      {/* PDF error toast */}
      {pdfError && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm shadow-2xl backdrop-blur flex items-start gap-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">{t('erp.invoices.detail.pdfGenFailed')}</p>
            <p className="text-xs text-red-400/80 mt-0.5">{pdfError}</p>
          </div>
          <button onClick={() => setPdfError('')} className="text-red-400/60 hover:text-red-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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
