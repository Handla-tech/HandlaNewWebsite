'use client';

/**
 * Public Contract View — opened when the QR code printed on the PDF
 * is scanned with a phone camera.
 *
 *   URL pattern: /contract/public/:id
 *   Endpoint:    GET /erp/contracts/public/:id (Nest @Public())
 *
 * This page sits outside /erp so the middleware never gates it, and the
 * backend route requires no JWT. The endpoint returns a sanitized
 * projection (rendered body, status, dates, client + issuer display
 * strings only — no raw user objects, no S3 keys, no structured details).
 *
 * Theme: Handla brand — dark base (#0a0a0a) + gold accent (#fbbf24).
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  FileText, CheckCircle, Clock, AlertCircle, XCircle, Calendar,
  Building2, User as UserIcon, Mail, Loader2, ShieldCheck, Send,
} from 'lucide-react';
import { contractsApi } from '@/lib/api';
import type { ContractStatus } from '@/types';

interface PublicContract {
  id:        string;
  title:     string;
  body:      string;
  status:    ContractStatus;
  createdAt: string;
  sentAt:    string | null;
  signedAt:  string | null;
  client: {
    name:    string | null;
    company: string | null;
    email:   string | null;
  } | null;
  issuer: {
    name: string | null;
  } | null;
}

const STATUS_CONFIG: Record<ContractStatus, {
  label: string; bg: string; border: string; text: string; icon: React.ElementType;
}> = {
  DRAFT:    { label: 'Draft',    bg: 'bg-white/[0.05]',   border: 'border-white/20',       text: 'text-white/70',     icon: FileText },
  SENT:     { label: 'Sent',     bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   text: 'text-amber-300',    icon: Send },
  SIGNED:   { label: 'Signed',   bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-300',  icon: CheckCircle },
  REJECTED: { label: 'Rejected', bg: 'bg-red-500/10',     border: 'border-red-500/30',     text: 'text-red-300',      icon: XCircle },
};

export default function PublicContractPage() {
  const { id } = useParams<{ id: string }>();
  const [contract, setContract] = useState<PublicContract | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    contractsApi
      .getPublicContract(id)
      .then((res) => {
        if (cancelled) return;
        // Endpoint returns { message, data: { contract } } — handle both shapes
        const payload = res.data?.data?.contract ?? res.data?.data ?? res.data;
        setContract(payload as PublicContract);
      })
      .catch((e: any) => {
        if (cancelled) return;
        const msg = e?.response?.status === 404
          ? 'Contract not found.'
          : (e?.response?.data?.message ?? 'Failed to load contract.');
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
          <p className="text-sm">Loading contract…</p>
        </div>
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
        <div className="max-w-md w-full p-8 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4">
            <AlertCircle className="w-7 h-7 text-red-400" />
          </div>
          <h1 className="text-lg font-bold text-white mb-1">Unable to load contract</h1>
          <p className="text-sm text-white/40">{error || 'This contract could not be found.'}</p>
        </div>
      </div>
    );
  }

  const status     = STATUS_CONFIG[contract.status];
  const StatusIcon = status.icon;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Top brand bar */}
      <header className="border-b border-white/[0.06] bg-[#0a0a0a]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#fbbf24]/10 border border-[#fbbf24]/30">
              <FileText className="w-4.5 h-4.5 text-[#fbbf24]" />
            </span>
            <div>
              <p className="text-sm font-bold text-white leading-none">Handla</p>
              <p className="text-[10px] uppercase tracking-wider text-white/40 mt-1">Contract viewer</p>
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
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-white/30 mb-1">Contract</p>
              <h1 className="text-2xl font-bold text-white truncate">{contract.title}</h1>
              <p className="text-xs text-white/40 mt-1 flex items-center gap-1.5">
                <Calendar className="w-3 h-3" />
                Created {new Date(contract.createdAt).toLocaleDateString()}
                {contract.sentAt   && ` · Sent ${new Date(contract.sentAt).toLocaleDateString()}`}
                {contract.signedAt && ` · Signed ${new Date(contract.signedAt).toLocaleDateString()}`}
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
          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
            <p className="text-[10px] uppercase tracking-wider text-white/30 mb-2">Issued by</p>
            <p className="text-sm font-semibold text-white">Handla</p>
            {contract.issuer?.name && contract.issuer.name !== 'Handla' && (
              <p className="text-xs text-white/50 mt-0.5">{contract.issuer.name}</p>
            )}
          </div>

          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
            <p className="text-[10px] uppercase tracking-wider text-white/30 mb-2">Contracted with</p>
            {contract.client?.company && (
              <p className="flex items-center gap-1.5 text-sm font-semibold text-white">
                <Building2 className="w-3.5 h-3.5 text-white/40" />
                {contract.client.company}
              </p>
            )}
            {contract.client?.name && (
              <p className="flex items-center gap-1.5 text-xs text-white/60 mt-1">
                <UserIcon className="w-3 h-3 text-white/30" />
                {contract.client.name}
              </p>
            )}
            {contract.client?.email && (
              <p className="flex items-center gap-1.5 text-xs text-white/40 mt-0.5 break-all">
                <Mail className="w-3 h-3 text-white/30" />
                {contract.client.email}
              </p>
            )}
          </div>
        </section>

        {/* Body — rendered as preformatted text. The backend stores either
            authored markdown/HTML-ish text or the auto-rendered output from
            the structured form. We render it as plain pre-wrapped text so
            no third-party HTML injection is possible from this public view. */}
        <section className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
          <p className="text-[10px] uppercase tracking-wider text-white/30 mb-3">Terms</p>
          <article className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap break-words">
            {contract.body || 'No content.'}
          </article>
        </section>

        {/* Status banners */}
        {contract.status === 'SIGNED' && contract.signedAt && (
          <div className="p-4 rounded-2xl bg-emerald-500/[0.06] border border-emerald-500/20 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-300">Contract signed</p>
              <p className="text-xs text-emerald-400/70">
                Digitally accepted on {new Date(contract.signedAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        )}

        {contract.status === 'REJECTED' && (
          <div className="p-4 rounded-2xl bg-red-500/[0.06] border border-red-500/20 flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-300">Contract rejected</p>
              <p className="text-xs text-red-400/70">This contract was not accepted by the client.</p>
            </div>
          </div>
        )}

        {contract.status === 'SENT' && (
          <div className="p-4 rounded-2xl bg-amber-500/[0.06] border border-amber-500/20 flex items-start gap-3">
            <Clock className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-300">Awaiting signature</p>
              <p className="text-xs text-amber-400/70">
                The contract has been sent to the client and is pending their decision.
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="pt-6 pb-10 text-center">
          <p className="text-[11px] text-white/25">
            This page was opened from a QR code printed on a Handla contract PDF.
          </p>
          <p className="text-[10px] text-white/20 mt-1">
            Contract ID: <span className="font-mono">{contract.id.slice(0, 8)}…</span>
          </p>
        </footer>
      </main>
    </div>
  );
}
