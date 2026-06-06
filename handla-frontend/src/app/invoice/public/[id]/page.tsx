'use client';

/**
 * Public Invoice View — opened when the QR code printed on the PDF
 * is scanned with a phone camera.
 *
 *   URL pattern: /invoice/public/:id
 *   Endpoint:    GET /erp/invoices/public/:id (Nest @Public())
 *
 * This page is intentionally NOT inside /erp — middleware never gates it,
 * and the backend route requires no JWT. The endpoint returns a sanitized
 * projection (no internal notes, no owner email metadata, no client user
 * raw objects).
 *
 * Theme: Handla brand — dark base (#0a0a0a) + gold accent (#fbbf24).
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Receipt, CheckCircle, Clock, AlertCircle, Calendar, Building2,
  User as UserIcon, Mail, Loader2, ShieldCheck,
} from 'lucide-react';
import { invoicesApi } from '@/lib/api';
import type { InvoicePaymentStatus } from '@/types';

interface PublicInvoice {
  id:            string;
  invoiceNumber: string;
  subtotal:      number;
  taxRate:       number;
  taxAmount:     number;
  total:         number;
  currency:      string;
  paymentStatus: InvoicePaymentStatus;
  dueDate:       string | null;
  paidAt:        string | null;
  createdAt:     string;
  notes:         string | null;
  lineItems: Array<{
    id:          string;
    description: string;
    quantity:    number;
    unitPrice:   number;
    lineTotal:   number;
  }>;
  client: {
    name:    string | null;
    company: string | null;
    email:   string | null;
  } | null;
  issuer: {
    name: string | null;
  } | null;
}

const STATUS_CONFIG: Record<InvoicePaymentStatus, {
  label: string; bg: string; border: string; text: string; icon: React.ElementType;
}> = {
  UNPAID:  { label: 'Unpaid',  bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   text: 'text-amber-300',   icon: Clock },
  PAID:    { label: 'Paid',    bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-300', icon: CheckCircle },
  OVERDUE: { label: 'Overdue', bg: 'bg-red-500/10',     border: 'border-red-500/30',     text: 'text-red-300',     icon: AlertCircle },
};

export default function PublicInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<PublicInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    invoicesApi
      .getPublicInvoice(id)
      .then((res) => {
        if (cancelled) return;
        const data = (res.data?.data ?? res.data) as PublicInvoice;
        setInvoice(data);
      })
      .catch((e: any) => {
        if (cancelled) return;
        const msg = e?.response?.status === 404
          ? 'Invoice not found.'
          : (e?.response?.data?.message ?? 'Failed to load invoice.');
        setError(msg);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-white/40">
          <Loader2 className="w-8 h-8 animate-spin text-[#fbbf24]" />
          <p className="text-sm">Loading invoice…</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
        <div className="max-w-md w-full p-8 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4">
            <AlertCircle className="w-7 h-7 text-red-400" />
          </div>
          <h1 className="text-lg font-bold text-white mb-1">Unable to load invoice</h1>
          <p className="text-sm text-white/40">{error || 'This invoice could not be found.'}</p>
        </div>
      </div>
    );
  }

  const status = STATUS_CONFIG[invoice.paymentStatus];
  const StatusIcon = status.icon;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Top brand bar */}
      <header className="border-b border-white/[0.06] bg-[#0a0a0a]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#fbbf24]/10 border border-[#fbbf24]/30">
              <Receipt className="w-4.5 h-4.5 text-[#fbbf24]" />
            </span>
            <div>
              <p className="text-sm font-bold text-white leading-none">Handla</p>
              <p className="text-[10px] uppercase tracking-wider text-white/40 mt-1">Invoice viewer</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-white/30">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Verified record</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-6 space-y-5">
        {/* Header card */}
        <section className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-white/30 mb-1">Invoice</p>
              <h1 className="text-2xl font-bold text-white">{invoice.invoiceNumber}</h1>
              <p className="text-xs text-white/40 mt-1">
                Issued {new Date(invoice.createdAt).toLocaleDateString()}
                {invoice.dueDate && ` · Due ${new Date(invoice.dueDate).toLocaleDateString()}`}
              </p>
            </div>
            <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${status.bg} ${status.border} ${status.text}`}>
              <StatusIcon className="w-3.5 h-3.5" />
              {status.label}
            </span>
          </div>
        </section>

        {/* Parties */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* From */}
          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
            <p className="text-[10px] uppercase tracking-wider text-white/30 mb-2">From</p>
            <p className="text-sm font-semibold text-white">Handla</p>
            {invoice.issuer?.name && invoice.issuer.name !== 'Handla' && (
              <p className="text-xs text-white/50 mt-0.5">Issued by {invoice.issuer.name}</p>
            )}
          </div>

          {/* Billed to */}
          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
            <p className="text-[10px] uppercase tracking-wider text-white/30 mb-2">Billed to</p>
            {invoice.client?.company && (
              <p className="flex items-center gap-1.5 text-sm font-semibold text-white">
                <Building2 className="w-3.5 h-3.5 text-white/40" />
                {invoice.client.company}
              </p>
            )}
            {invoice.client?.name && (
              <p className="flex items-center gap-1.5 text-xs text-white/60 mt-1">
                <UserIcon className="w-3 h-3 text-white/30" />
                {invoice.client.name}
              </p>
            )}
            {invoice.client?.email && (
              <p className="flex items-center gap-1.5 text-xs text-white/40 mt-0.5 break-all">
                <Mail className="w-3 h-3 text-white/30" />
                {invoice.client.email}
              </p>
            )}
          </div>
        </section>

        {/* Line items table */}
        <section className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
          <h2 className="text-sm font-semibold text-white/80 mb-3">Order details</h2>
          <div className="overflow-x-auto -mx-2 px-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.08] text-white/40">
                  <th className="text-left pb-2 font-medium text-xs">Description</th>
                  <th className="text-center pb-2 font-medium w-14 text-xs">Qty</th>
                  <th className="text-right pb-2 font-medium w-24 text-xs">Unit</th>
                  <th className="text-right pb-2 font-medium w-24 text-xs">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {invoice.lineItems.map((li) => (
                  <tr key={li.id} className="text-white/80">
                    <td className="py-3 pr-2">{li.description}</td>
                    <td className="py-3 text-center text-white/60">{li.quantity}</td>
                    <td className="py-3 text-right text-white/60">${li.unitPrice.toFixed(2)}</td>
                    <td className="py-3 text-right font-semibold text-white">${li.lineTotal.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="mt-4 pt-4 border-t border-white/[0.08] space-y-1.5">
            <div className="flex justify-between text-xs text-white/40">
              <span>Subtotal</span>
              <span>${invoice.subtotal.toFixed(2)}</span>
            </div>
            {invoice.taxRate > 0 && (
              <div className="flex justify-between text-xs text-white/40">
                <span>Tax ({invoice.taxRate}%)</span>
                <span>${invoice.taxAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-white text-base pt-2 mt-1 border-t border-white/[0.08]">
              <span>Total</span>
              <span className="text-[#fbbf24] text-xl">
                ${invoice.total.toFixed(2)} <span className="text-xs text-white/40 font-normal">{invoice.currency}</span>
              </span>
            </div>
          </div>
        </section>

        {/* Notes */}
        {invoice.notes && (
          <section className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
            <p className="text-[10px] uppercase tracking-wider text-white/30 mb-2">Notes</p>
            <p className="text-xs text-white/70 whitespace-pre-wrap">{invoice.notes}</p>
          </section>
        )}

        {/* Paid badge */}
        {invoice.paymentStatus === 'PAID' && invoice.paidAt && (
          <div className="p-4 rounded-2xl bg-emerald-500/[0.06] border border-emerald-500/20 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-300">Payment received</p>
              <p className="text-xs text-emerald-400/70">
                Marked paid on {new Date(invoice.paidAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        )}

        {invoice.paymentStatus === 'OVERDUE' && invoice.dueDate && (
          <div className="p-4 rounded-2xl bg-red-500/[0.06] border border-red-500/20 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-300">This invoice is overdue</p>
              <p className="text-xs text-red-400/70 flex items-center gap-1 mt-0.5">
                <Calendar className="w-3 h-3" />
                Was due {new Date(invoice.dueDate).toLocaleDateString()}
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="pt-6 pb-10 text-center">
          <p className="text-[11px] text-white/25">
            This page was opened from a QR code printed on a Handla invoice PDF.
          </p>
          <p className="text-[10px] text-white/20 mt-1">
            Invoice ID: <span className="font-mono">{invoice.id.slice(0, 8)}…</span>
          </p>
        </footer>
      </main>
    </div>
  );
}
