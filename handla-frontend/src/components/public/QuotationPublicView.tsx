'use client';

/**
 * Shared public quotation renderer (view + accept/reject actions).
 *
 * Consumed by BOTH public quotation routes:
 *   - /quotation/public/token/:token   (INFO-01 canonical capability link)
 *   - /quotation/public/:token         (LEGACY url-shape, still token-based)
 *
 * Both routes are token-based (the quotation model never exposed a raw-id
 * public route). The endpoints honour revocation (410) / expiry; the accept /
 * reject actions are validated server-side by the quotation state machine
 * BEFORE any state change. No internal error data is surfaced to the public.
 */

import { useEffect, useState } from 'react';
import {
  FileSignature, CheckCircle, XCircle, Clock, AlertCircle, Calendar,
  Building2, Loader2, ShieldCheck,
} from 'lucide-react';
import { quotationsApi } from '@/lib/api';

export interface PublicQuotation {
  id:         string;
  quoteNumber:string;
  title:      string;
  status:     string;
  subtotal:   number;
  taxRate:    number;
  taxAmount:  number;
  total:      number;
  currency:   string | null;
  validUntil: string | null;
  notes:      string | null;
  createdAt:  string;
  lineItems:  Array<{ description: string; quantity: number; unitPrice: number; lineTotal: number }>;
  client:     { name: string | null; company: string | null } | null;
  issuer:     { name: string | null } | null;
}

function fmt(n: number, currency?: string | null) {
  const c = currency || '';
  return `${c ? c + ' ' : ''}${Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}
function publicErrorMessage(status?: number, serverMsg?: string): string {
  if (status === 410) return 'This link is no longer available.';
  if (status === 404) return 'This link is invalid or has expired.';
  return serverMsg && status && status < 500 ? serverMsg : 'Quotation not found or link expired.';
}

export default function QuotationPublicView({ token }: { token: string }) {
  const [quotation, setQuotation] = useState<PublicQuotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<'accept' | 'reject' | null>(null);
  const [actionDone, setActionDone] = useState<'accept' | 'reject' | null>(null);

  async function load() {
    setLoading(true); setError(null);
    try {
      const r = await quotationsApi.getPublicQuotation(token);
      setQuotation(r.data.data as PublicQuotation);
    } catch (e: any) {
      setError(publicErrorMessage(e?.response?.status, e?.response?.data?.message));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (token) load(); /* eslint-disable-next-line */ }, [token]);

  async function doAction(type: 'accept' | 'reject') {
    setActionLoading(type);
    try {
      if (type === 'accept') await quotationsApi.publicAccept(token);
      else await quotationsApi.publicReject(token);
      setActionDone(type);
      await load();
    } catch (e: any) {
      setError(publicErrorMessage(e?.response?.status, e?.response?.data?.message) === 'Quotation not found or link expired.'
        ? 'Action failed. Please try again.'
        : publicErrorMessage(e?.response?.status, e?.response?.data?.message));
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[#fbbf24] animate-spin" />
          <p className="text-sm text-white/40">Loading quotation…</p>
        </div>
      </div>
    );
  }

  if (error || !quotation) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 mx-auto">
            <AlertCircle className="w-7 h-7 text-red-400" />
          </div>
          <p className="text-white/70">{error ?? 'Quotation not found.'}</p>
        </div>
      </div>
    );
  }

  const isPending = quotation.status === 'SENT';
  const isAccepted = quotation.status === 'ACCEPTED' || quotation.status === 'CONVERTED';
  const isRejected = quotation.status === 'REJECTED';
  const isExpired = quotation.status === 'EXPIRED';

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white py-8 px-4">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#fbbf24] to-[#f59e0b]">
              <FileSignature className="h-4 w-4 text-black" />
            </div>
            <span className="font-bold text-lg tracking-tight">Handla</span>
          </div>
          <span className="text-xs text-white/30 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Secure quote</span>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/10 bg-[#111] overflow-hidden">
          <div className="border-b border-white/[0.06] p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-white/30 uppercase tracking-widest">Quotation</p>
                <h1 className="text-xl font-bold mt-1">{quotation.title}</h1>
                <p className="text-sm text-white/40 mt-0.5">{quotation.quoteNumber}</p>
              </div>
              <StatusPill status={quotation.status} />
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-white/40">
              {quotation.client && (
                <span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" />{quotation.client.name ?? quotation.client.company ?? 'Client'}</span>
              )}
              <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />Issued {fmtDate(quotation.createdAt)}</span>
              {quotation.validUntil && <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Valid until {fmtDate(quotation.validUntil)}</span>}
            </div>
          </div>

          {/* Line items */}
          <div className="p-6">
            <div className="space-y-2">
              {quotation.lineItems.map((li, i) => (
                <div key={i} className="flex items-center justify-between gap-4 py-2 border-b border-white/[0.04] last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm text-white/80 truncate">{li.description}</p>
                    <p className="text-xs text-white/30">{li.quantity} × {fmt(li.unitPrice, quotation.currency)}</p>
                  </div>
                  <span className="text-sm font-medium text-white flex-shrink-0">{fmt(li.lineTotal, quotation.currency)}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-1 text-sm">
              <div className="flex justify-between text-white/50"><span>Subtotal</span><span>{fmt(quotation.subtotal, quotation.currency)}</span></div>
              <div className="flex justify-between text-white/50"><span>Tax ({quotation.taxRate}%)</span><span>{fmt(quotation.taxAmount, quotation.currency)}</span></div>
              <div className="flex justify-between text-lg font-bold text-[#fbbf24] pt-2 border-t border-white/10 mt-2"><span>Total</span><span>{fmt(quotation.total, quotation.currency)}</span></div>
            </div>

            {quotation.notes && (
              <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <p className="text-xs text-white/30 uppercase tracking-wide mb-1">Notes</p>
                <p className="text-sm text-white/60 whitespace-pre-wrap">{quotation.notes}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="border-t border-white/[0.06] p-6">
            {actionDone === 'accept' || isAccepted ? (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-emerald-300">
                <CheckCircle className="w-5 h-5" /> Quotation accepted. We&apos;ll be in touch shortly.
              </div>
            ) : actionDone === 'reject' || isRejected ? (
              <div className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300">
                <XCircle className="w-5 h-5" /> Quotation declined.
              </div>
            ) : isExpired ? (
              <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-300">
                <Clock className="w-5 h-5" /> This quotation has expired. Please contact us for an updated quote.
              </div>
            ) : isPending ? (
              <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={() => doAction('accept')} disabled={actionLoading !== null}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#fbbf24] text-black font-semibold hover:bg-[#f59e0b] disabled:opacity-50 transition-colors min-h-[48px]">
                  {actionLoading === 'accept' ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />} Accept Quotation
                </button>
                <button onClick={() => doAction('reject')} disabled={actionLoading !== null}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-white/15 bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white disabled:opacity-50 transition-colors min-h-[48px]">
                  {actionLoading === 'reject' ? <Loader2 className="w-5 h-5 animate-spin" /> : <XCircle className="w-5 h-5" />} Decline
                </button>
              </div>
            ) : (
              <p className="text-sm text-white/40 text-center">This quotation is not currently open for a response.</p>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-white/20">Issued by {quotation.issuer?.name ?? 'Handla'}</p>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT:     'border-white/15 bg-white/5 text-white/50',
    SENT:      'border-blue-500/30 bg-blue-500/10 text-blue-300',
    ACCEPTED:  'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    REJECTED:  'border-red-500/30 bg-red-500/10 text-red-300',
    EXPIRED:   'border-amber-500/30 bg-amber-500/10 text-amber-300',
    CONVERTED: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
  };
  return <span className={`px-3 py-1 rounded-full text-xs font-semibold border flex-shrink-0 ${map[status] ?? map.DRAFT}`}>{status}</span>;
}
