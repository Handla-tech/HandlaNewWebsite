'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2, MessageSquare, Plus, CheckCircle2,
  AlertCircle, RefreshCw, Zap, FileText,
  FilePenLine, Send, XCircle, FileSignature, ExternalLink,
  Receipt, CreditCard, FolderOpen, UserX, Download, Upload,
  Paperclip, X as XIcon,
} from 'lucide-react';
import Link from 'next/link';
import ChatWindow from '@/components/chat/ChatWindow';
import { chatApi, contractsApi, invoicesApi, projectsApi } from '@/lib/api';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import axios from 'axios';
import type { Conversation, ConversationStatus, Contract, ContractStatus, Invoice, InvoicePaymentStatus, PaginatedInvoices, Project, ProjectStatus } from '@/types';

// ─── Status badge colours (mirrors ChatWindow) ────────────────────────────────

const STATUS_COLORS: Record<ConversationStatus, string> = {
  ACTIVE:    'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  ON_HOLD:   'text-amber-400  bg-amber-400/10  border-amber-400/20',
  COMPLETED: 'text-[#666]     bg-[#1a1a1a]     border-[#2a2a2a]',
};
const STATUS_LABELS: Record<ConversationStatus, string> = {
  ACTIVE:    'Active',
  ON_HOLD:   'On Hold',
  COMPLETED: 'Completed',
};

// ─── Contract status config ───────────────────────────────────────────────────

const CONTRACT_STATUS_BADGE: Record<ContractStatus, string> = {
  DRAFT:    'border-slate-400/30   bg-slate-400/10   text-slate-400',
  SENT:     'border-amber-400/30   bg-amber-400/10   text-amber-400',
  SIGNED:   'border-emerald-400/30 bg-emerald-400/10 text-emerald-400',
  REJECTED: 'border-red-400/30     bg-red-400/10     text-red-400',
};

const CONTRACT_STATUS_ICON: Record<ContractStatus, React.ComponentType<{ className?: string }>> = {
  DRAFT:    FilePenLine,
  SENT:     Send,
  SIGNED:   CheckCircle2,
  REJECTED: XCircle,
};

// ─── Invoice status config ────────────────────────────────────────────────────

const INV_STATUS_BADGE: Record<InvoicePaymentStatus, string> = {
  UNPAID:  'bg-gray-500/20 text-gray-300 border border-gray-500/30',
  PAID:    'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  OVERDUE: 'bg-red-500/20 text-red-300 border border-red-500/30',
};
const INV_STATUS_LABEL: Record<InvoicePaymentStatus, string> = {
  UNPAID:  'Unpaid',
  PAID:    'Paid',
  OVERDUE: 'Overdue',
};

// ─── Dashboard tabs ───────────────────────────────────────────────────────────

type DashboardTab = 'chat' | 'contracts' | 'invoices' | 'projects';

// ─── Project status colours (CLIENT view) ─────────────────────────────────────

const PROJECT_STATUS_BADGE: Record<ProjectStatus, string> = {
  PLANNING:  'border-blue-400/30    bg-blue-400/10    text-blue-400',
  ACTIVE:    'border-emerald-400/30 bg-emerald-400/10 text-emerald-400',
  ON_HOLD:   'border-amber-400/30   bg-amber-400/10   text-amber-400',
  COMPLETED: 'border-purple-400/30  bg-purple-400/10  text-purple-400',
  CANCELLED: 'border-red-400/30     bg-red-400/10     text-red-400',
};

// ─── Page-level state machine ─────────────────────────────────────────────────

type PageState =
  | { phase: 'loading' }
  | { phase: 'ready';   conversation: Conversation }
  | { phase: 'empty' }
  | { phase: 'error';   message: string };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractFirst(res: { data: unknown }): Conversation | null {
  const envelope = res.data as {
    data?: { conversations?: Conversation[] } | Conversation[] | null;
  };
  const inner = envelope?.data;
  if (!inner) return null;
  if (!Array.isArray(inner) && 'conversations' in inner) {
    return (inner as { conversations: Conversation[] }).conversations[0] ?? null;
  }
  const list = Array.isArray(inner) ? inner : [];
  return list[0] ?? null;
}

function extractOne(res: { data: unknown }): Conversation {
  const envelope = res.data as {
    data?: { conversation?: Conversation } | Conversation | null;
  };
  const inner = envelope?.data;
  if (!inner) return inner as unknown as Conversation;
  if (!Array.isArray(inner) && 'conversation' in inner) {
    return (inner as { conversation: Conversation }).conversation;
  }
  return inner as Conversation;
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function apiErrMsg(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { message?: string } } };
  return e?.response?.data?.message ?? fallback;
}

// ─── Contract Row (Contracts tab) ─────────────────────────────────────────────

function AcceptModal({ isOpen, onClose, contract }: { isOpen: boolean; onClose: () => void; contract: Contract }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => contractsApi.acceptContract(contract.id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['dashboard-contracts'] }); onClose(); },
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0d0d0d] shadow-2xl p-6 space-y-4"
            role="dialog" aria-modal="true"
          >
            <h2 className="text-lg font-semibold text-white">Accept Contract</h2>
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
              <p className="text-sm text-emerald-300">
                By accepting, you agree to the terms in <strong>&ldquo;{contract.title}&rdquo;</strong>.
                A signed copy will be generated and stored securely.
              </p>
            </div>
            {mutation.isError && (
              <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                {apiErrMsg(mutation.error, 'Failed to accept contract')}
              </p>
            )}
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-white/70 hover:bg-white/5 transition-colors text-sm min-h-[44px]">Cancel</button>
              <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#fbbf24] text-black font-semibold hover:bg-[#f59e0b] transition-colors text-sm disabled:opacity-50 min-h-[44px]">
                <FileSignature className="w-4 h-4" />{mutation.isPending ? 'Accepting…' : 'Accept Contract'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function RejectModal({ isOpen, onClose, contract }: { isOpen: boolean; onClose: () => void; contract: Contract }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => contractsApi.rejectContract(contract.id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['dashboard-contracts'] }); onClose(); },
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0d0d0d] shadow-2xl p-6 space-y-4"
            role="dialog" aria-modal="true"
          >
            <h2 className="text-lg font-semibold text-white">Reject Contract</h2>
            <p className="text-sm text-white/70">
              Reject <strong className="text-white">&ldquo;{contract.title}&rdquo;</strong>?
              The account team will be notified and can send a revised version.
            </p>
            {mutation.isError && (
              <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                {apiErrMsg(mutation.error, 'Failed to reject contract')}
              </p>
            )}
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-white/70 hover:bg-white/5 transition-colors text-sm min-h-[44px]">Cancel</button>
              <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
                className="flex-1 px-4 py-2.5 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors text-sm disabled:opacity-50 min-h-[44px]">
                {mutation.isPending ? 'Rejecting…' : 'Reject Contract'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function ContractRow({ contract }: { contract: Contract }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const StatusIcon = CONTRACT_STATUS_ICON[contract.status] ?? FilePenLine;
  const isSent = contract.status === 'SENT';
  const isSigned = contract.status === 'SIGNED';

  const handleDownloadPdf = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pdfLoading) return;
    setPdfLoading(true);
    try {
      const res: any = await contractsApi.getPdfUrl(contract.id);
      const url = res?.data?.data?.url ?? res?.data?.url;
      if (url) {
        // Open the presigned URL directly — avoids CORS issues with fetch()
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch (err: any) {
      console.error('Contract download failed:', err);
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <>
      <div
        onClick={() => router.push(`/erp/contracts/${contract.id}`)}
        className={cn(
          'group rounded-xl border p-4 cursor-pointer transition-colors',
          isSent
            ? 'border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/8'
            : 'border-white/5 bg-white/3 hover:bg-white/5',
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border flex-shrink-0', CONTRACT_STATUS_BADGE[contract.status])}>
                <StatusIcon className="w-3 h-3" />{contract.status}
              </span>
              <p className="font-medium text-white text-sm truncate">{contract.title}</p>
            </div>
            <p className="mt-1 text-xs text-white/40 line-clamp-1">{contract.body}</p>
            <p className="mt-1.5 text-xs text-white/30">
              {contract.sentAt ? `Sent ${formatDate(contract.sentAt)}` : `Created ${formatDate(contract.createdAt)}`}
            </p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <ExternalLink className="w-3.5 h-3.5 text-white/20 group-hover:text-white/40 transition-colors" />
          </div>
        </div>

        {/* Quick accept/reject for SENT */}
        {isSent && (
          <div className="mt-3 flex gap-2 pt-3 border-t border-amber-500/10" onClick={e => e.stopPropagation()}>
            <button onClick={() => setRejectOpen(true)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-red-500/30 text-red-400 text-xs font-medium hover:bg-red-500/10 transition-colors min-h-[36px]">
              <XCircle className="w-3.5 h-3.5" /> Reject
            </button>
            <button onClick={() => setAcceptOpen(true)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#fbbf24] text-black text-xs font-semibold hover:bg-[#f59e0b] transition-colors min-h-[36px]">
              <FileSignature className="w-3.5 h-3.5" /> Accept
            </button>
          </div>
        )}

        {/* PDF download for SIGNED contracts */}
        {isSigned && (
          <div className="mt-3 pt-3 border-t border-emerald-500/10" onClick={e => e.stopPropagation()}>
            <button onClick={handleDownloadPdf} disabled={pdfLoading}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-500/30 text-emerald-400 text-xs font-medium hover:bg-emerald-500/10 transition-colors min-h-[36px] disabled:opacity-50">
              {pdfLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              {pdfLoading ? 'Getting link…' : 'Download Contract'}
            </button>
          </div>
        )}
      </div>

      <AcceptModal isOpen={acceptOpen} onClose={() => setAcceptOpen(false)} contract={contract} />
      <RejectModal isOpen={rejectOpen} onClose={() => setRejectOpen(false)} contract={contract} />
    </>
  );
}

// ─── Contracts Panel ──────────────────────────────────────────────────────────

// ─── Invoices Panel (CLIENT read-only) ───────────────────────────────────────

// ─── Payment Proof Modal ─────────────────────────────────────────────────────

function PaymentProofModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [partialAmount, setPartialAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [payType, setPayType] = useState<'full' | 'partial'>('full');
  const [uploadError, setUploadError] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      let proofUrl: string | undefined;

      // Upload file to S3 via presigned URL if one was selected
      if (selectedFile) {
        setUploadError('');
        // Request presigned PUT URL from backend
        const presignedRes = await chatApi.getPresignedUrl({
          fileName: selectedFile.name,
          contentType: selectedFile.type,
          fileSize: selectedFile.size,
        } as any);
        const presigned = presignedRes.data?.data ?? presignedRes.data;

        // PUT file directly to S3
        await axios.put(presigned.url, selectedFile, {
          headers: { 'Content-Type': selectedFile.type },
          onUploadProgress: (e) => {
            if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100));
          },
        });
        proofUrl = presigned.fileUrl;
      }

      return invoicesApi.submitPaymentProof(invoice.id, {
        proofUrl,
        partialAmount: payType === 'partial' && partialAmount ? Number(partialAmount) : undefined,
        notes: notes || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard-invoices'] });
      setTimeout(onClose, 1500);
    },
    onError: (e: any) => {
      // class-validator returns message as array; join for display
      const msg = e?.response?.data?.message;
      setUploadError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Failed to submit proof'));
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    // 20 MB limit for payment proof files (matches backend PresignedUrlDto @Max)
    if (f.size > 20 * 1024 * 1024) {
      setUploadError('File too large. Max 20 MB.');
      return;
    }
    setUploadError('');
    setSelectedFile(f);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0d0d0d] shadow-2xl p-6 space-y-4"
        role="dialog" aria-modal="true"
      >
        <h2 className="text-lg font-semibold text-white">Submit Payment Proof</h2>
        <p className="text-xs text-white/50">Invoice <strong className="text-white">{invoice.invoiceNumber}</strong> — {invoice.currency} {Number(invoice.total).toFixed(2)}</p>

        {/* Payment type */}
        <div className="grid grid-cols-2 gap-2">
          {(['full', 'partial'] as const).map(t => (
            <button key={t} type="button" onClick={() => setPayType(t)}
              className={cn(
                'px-3 py-2 rounded-lg border text-xs font-medium transition-colors min-h-[40px]',
                payType === t
                  ? 'border-[#fbbf24]/50 bg-[#fbbf24]/10 text-[#fbbf24]'
                  : 'border-white/10 text-white/50 hover:bg-white/5',
              )}
            >
              {t === 'full' ? 'Full Payment' : 'Partial Payment'}
            </button>
          ))}
        </div>

        {payType === 'partial' && (
          <div>
            <label className="text-xs text-white/50 mb-1 block">Amount Paid ({invoice.currency})</label>
            <input
              type="number" min="0" step="0.01"
              value={partialAmount}
              onChange={e => setPartialAmount(e.target.value)}
              placeholder={`0.00 / ${Number(invoice.total).toFixed(2)}`}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/20 focus:border-[#fbbf24]/50 focus:outline-none"
            />
          </div>
        )}

        {/* File upload */}
        <div>
          <label className="text-xs text-white/50 mb-1 block">Proof of Payment (receipt, screenshot, etc.)</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={handleFileChange}
          />
          {selectedFile ? (
            <div className="flex items-center gap-3 rounded-lg border border-[#fbbf24]/30 bg-[#fbbf24]/5 px-3 py-2.5">
              <FileText className="w-4 h-4 text-[#fbbf24] flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-white truncate">{selectedFile.name}</p>
                <p className="text-[10px] text-white/40">{(selectedFile.size / 1024).toFixed(0)} KB</p>
              </div>
              <button
                type="button"
                onClick={() => { setSelectedFile(null); setUploadProgress(0); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                className="text-white/40 hover:text-white transition-colors flex-shrink-0"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 bg-white/3 px-3 py-4 text-white/40 text-xs hover:border-[#fbbf24]/40 hover:text-white/70 transition-colors"
            >
              <Paperclip className="w-4 h-4" />
              Click to attach file (image or PDF, max 20 MB)
            </button>
          )}
          {/* Upload progress */}
          {mutation.isPending && uploadProgress > 0 && uploadProgress < 100 && (
            <div className="mt-2">
              <div className="h-1 w-full rounded-full bg-white/10">
                <div
                  className="h-1 rounded-full bg-[#fbbf24] transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] text-white/40">{uploadProgress}% uploaded</p>
            </div>
          )}
        </div>

        <div>
          <label className="text-xs text-white/50 mb-1 block">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="Any additional details…"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/20 focus:border-[#fbbf24]/50 focus:outline-none resize-none"
          />
        </div>

        {(mutation.isError || uploadError) && (
          <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            {uploadError || apiErrMsg(mutation.error, 'Failed to submit proof')}
          </p>
        )}
        {mutation.isSuccess && (
          <p className="text-sm text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-lg px-3 py-2">
            ✓ Payment proof submitted! Our team will confirm soon.
          </p>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} disabled={mutation.isPending} className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-white/70 hover:bg-white/5 transition-colors text-sm min-h-[44px] disabled:opacity-50">Cancel</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || mutation.isSuccess}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#fbbf24] text-black font-semibold hover:bg-[#f59e0b] transition-colors text-sm disabled:opacity-50 min-h-[44px]"
          >
            {mutation.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" />{uploadProgress > 0 && uploadProgress < 100 ? 'Uploading…' : 'Submitting…'}</>
            ) : (
              <><Upload className="w-4 h-4" />Submit Proof</>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function InvoicesPanel() {
  const router = useRouter();
  const [proofInvoice, setProofInvoice] = useState<Invoice | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard-invoices'],
    queryFn:  () => invoicesApi.getInvoices({ limit: 20 }).then(r => {
      const d = r.data.data as PaginatedInvoices | null;
      return (d?.invoices ?? []) as Invoice[];
    }),
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const invoices = data ?? [];
  const overdueInvoices = invoices.filter(i => i.paymentStatus === 'OVERDUE');
  const unpaidInvoices  = invoices.filter(i => i.paymentStatus === 'UNPAID');

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-white/5 bg-white/3 p-4 animate-pulse h-20" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
          <p className="text-sm text-white/50">Failed to load invoices.</p>
          <button onClick={() => refetch()} className="px-4 py-2 rounded-lg border border-white/10 hover:bg-white/5 text-xs text-white/60 transition-colors">Retry</button>
        </div>
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <Receipt className="w-10 h-10 text-white/10 mx-auto" />
          <p className="text-sm text-white/40">No invoices yet.</p>
          <p className="text-xs text-white/25">Your invoices will appear here once issued.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Overdue alert banner */}
      {overdueInvoices.length > 0 && (
        <div className="flex-shrink-0 mx-4 mt-4 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
          <p className="text-xs font-semibold text-red-300">
            {overdueInvoices.length === 1
              ? '1 invoice is overdue'
              : `${overdueInvoices.length} invoices are overdue`}
          </p>
        </div>
      )}

      {/* Unpaid notice */}
      {overdueInvoices.length === 0 && unpaidInvoices.length > 0 && (
        <div className="flex-shrink-0 mx-4 mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <p className="text-xs font-semibold text-amber-300">
            {unpaidInvoices.length === 1
              ? '1 invoice awaiting payment'
              : `${unpaidInvoices.length} invoices awaiting payment`}
          </p>
        </div>
      )}

      {/* Invoice list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {invoices.map(inv => (
          <div
            key={inv.id}
            className={cn(
              'group rounded-xl border p-4 transition-colors',
              inv.paymentStatus === 'OVERDUE'
                ? 'border-red-500/20 bg-red-500/5'
                : inv.paymentStatus === 'UNPAID'
                ? 'border-amber-500/10 bg-amber-500/3'
                : 'border-white/5 bg-white/3',
            )}
          >
            <div
              onClick={() => router.push(`/erp/invoices/${inv.id}`)}
              className="flex items-start justify-between gap-3 cursor-pointer"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn(
                    'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0',
                    INV_STATUS_BADGE[inv.paymentStatus],
                  )}>
                    {INV_STATUS_LABEL[inv.paymentStatus]}
                  </span>
                  <p className="font-semibold text-white text-sm">{inv.invoiceNumber}</p>
                </div>
                <div className="mt-1.5 flex items-center gap-3 text-xs text-white/40">
                  <span className="flex items-center gap-1">
                    <CreditCard className="w-3 h-3" />
                    {inv.currency} {Number(inv.total).toFixed(2)}
                  </span>
                  {inv.dueDate && (
                    <span className={cn(
                      'flex items-center gap-1',
                      inv.paymentStatus === 'OVERDUE' ? 'text-red-400' : 'text-white/40',
                    )}>
                      Due {new Date(inv.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  )}
                  {inv.paidAt && (
                    <span className="text-emerald-400">
                      Paid {new Date(inv.paidAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  )}
                </div>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-white/20 group-hover:text-white/40 transition-colors flex-shrink-0 mt-0.5" />
            </div>

            {/* Submit payment proof button for UNPAID / OVERDUE */}
            {(inv.paymentStatus === 'UNPAID' || inv.paymentStatus === 'OVERDUE') && (
              <div className="mt-3 pt-3 border-t border-white/5">
                <button
                  onClick={() => setProofInvoice(inv)}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[#fbbf24]/30 text-[#fbbf24] text-xs font-medium hover:bg-[#fbbf24]/10 transition-colors min-h-[36px]"
                >
                  <Upload className="w-3.5 h-3.5" /> Submit Payment Proof
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Payment proof modal */}
        <AnimatePresence>
          {proofInvoice && (
            <PaymentProofModal invoice={proofInvoice} onClose={() => setProofInvoice(null)} />
          )}
        </AnimatePresence>

        {/* View all link */}
        <button
          onClick={() => router.push('/erp/invoices')}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-white/50 hover:text-white hover:bg-white/5 transition-colors text-xs"
        >
          <ExternalLink className="w-3.5 h-3.5" /> View All Invoices
        </button>
      </div>
    </div>
  );
}

// ─── Contracts Panel ──────────────────────────────────────────────────────────

function ContractsPanel() {
  const router = useRouter();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard-contracts'],
    queryFn:  () => contractsApi.getContracts({ limit: 20 }).then(r => {
      const d = r.data.data as { contracts?: Contract[] };
      return (d?.contracts ?? []) as Contract[];
    }),
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const contracts = data ?? [];
  const sentContracts   = contracts.filter(c => c.status === 'SENT');
  const otherContracts  = contracts.filter(c => c.status !== 'SENT');

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-white/5 bg-white/3 p-4 animate-pulse h-24" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
          <p className="text-sm text-white/50">Failed to load contracts.</p>
          <button onClick={() => refetch()} className="px-4 py-2 rounded-lg border border-white/10 hover:bg-white/5 text-xs text-white/60 transition-colors">Retry</button>
        </div>
      </div>
    );
  }

  if (contracts.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <FileText className="w-10 h-10 text-white/10 mx-auto" />
          <p className="text-sm text-white/40">No contracts yet.</p>
          <p className="text-xs text-white/25">Your account manager will send contracts here when ready.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Pending action banner */}
      {sentContracts.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <p className="text-xs font-semibold text-amber-300">
            {sentContracts.length === 1
              ? '1 contract awaiting your signature'
              : `${sentContracts.length} contracts awaiting your signature`}
          </p>
        </div>
      )}

      {/* SENT contracts first */}
      {sentContracts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-white/30 uppercase tracking-wide font-medium px-1">Awaiting Signature</p>
          {sentContracts.map(c => <ContractRow key={c.id} contract={c} />)}
        </div>
      )}

      {/* Other contracts */}
      {otherContracts.length > 0 && (
        <div className="space-y-2">
          {sentContracts.length > 0 && (
            <p className="text-xs text-white/30 uppercase tracking-wide font-medium px-1">History</p>
          )}
          {otherContracts.map(c => <ContractRow key={c.id} contract={c} />)}
        </div>
      )}

      {/* View all */}
      <button
        onClick={() => router.push('/erp/contracts')}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-white/50 hover:text-white hover:bg-white/5 transition-colors text-xs"
      >
        <ExternalLink className="w-3.5 h-3.5" /> View All Contracts
      </button>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

// ─── Projects Panel (CLIENT view) ────────────────────────────────────────────

function ProjectsPanel() {
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-projects'],
    queryFn:  () => projectsApi.getMyProjects().then(r => {
      const d = r.data?.data ?? r.data;
      return ((d as any)?.projects ?? d) as Project[];
    }),
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const projects: Project[] = data ?? [];

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center" aria-busy="true" aria-label="Loading projects">
        <Loader2 className="h-5 w-5 animate-spin text-[#fbbf24]" />
      </div>
    );
  }

  if (!projects.length) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <FolderOpen className="h-8 w-8 text-[#444]" aria-hidden="true" />
        <p className="text-sm font-medium text-white">No projects yet</p>
        <p className="text-xs text-[#555]">Your assigned projects will appear here once created.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-auto p-4">
      {projects.map(p => (
        <button
          key={p.id}
          onClick={() => router.push(`/dashboard/projects/${p.id}`)}
          className="flex w-full items-start gap-3 rounded-xl border border-[#1a1a1a] bg-white/[0.02] p-4 text-left transition-colors hover:border-[#fbbf24]/20 hover:bg-[#fbbf24]/5 min-h-[44px]"
          aria-label={`View project: ${p.title}`}
        >
          <FolderOpen className="mt-0.5 h-4 w-4 shrink-0 text-[#fbbf24]" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{p.title}</p>
            {p.description && (
              <p className="mt-0.5 line-clamp-1 text-xs text-[#666]">{p.description}</p>
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className={cn(
                'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium',
                PROJECT_STATUS_BADGE[p.status],
              )}>
                {p.status.replace('_', ' ')}
              </span>
              {p.startDate && (
                <span className="text-[10px] text-[#555]">
                  Started {new Date(p.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </span>
              )}
            </div>
          </div>
          <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#444]" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, isLead } = useAuth();
  const isClient = user?.role === 'CLIENT';
  const searchParams = useSearchParams();

  // Tab is driven by ?tab= URL param (set by sidebar links)
  const activeTab = (searchParams.get('tab') as DashboardTab) ?? 'chat';
  // Keep a setter for backward compatibility with existing tab-switching calls (no-op now)
  const setActiveTab = (_: DashboardTab) => {};
  const [state,         setState]         = useState<PageState>({ phase: 'loading' });
  const [isCompleting,  setCompleting]    = useState(false);
  const [completedMsg,  setCompletedMsg]  = useState<string | null>(null);

  // ── Load or auto-create a conversation ──────────────────────────────────
  const loadConversation = useCallback(async () => {
    setState({ phase: 'loading' });
    try {
      const listRes  = await chatApi.getConversations();
      const existing = extractFirst(listRes);

      if (existing) {
        setState({ phase: 'ready', conversation: existing });
        return;
      }

      const createRes = await chatApi.createConversation({});
      const created   = extractOne(createRes);
      setState({ phase: 'ready', conversation: created });
    } catch (err: unknown) {
      const axErr = err as {
        response?: { data?: { message?: string | string[]; error?: string } };
        message?: string;
      };
      const raw = axErr?.response?.data?.message;
      const msg =
        (Array.isArray(raw) ? raw[0] : raw) ??
        axErr?.message ??
        'Failed to load conversation';
      setState({ phase: 'error', message: msg });
    }
  }, []);

  useEffect(() => {
    if (user) loadConversation();
  }, [user, loadConversation]);

  // ── Mark conversation as COMPLETED ──────────────────────────────────────
  const handleMarkComplete = useCallback(async () => {
    if (state.phase !== 'ready') return;
    if (state.conversation.status === 'COMPLETED') return;

    setCompleting(true);
    setCompletedMsg(null);
    try {
      await chatApi.updateStatus(state.conversation.id, { status: 'COMPLETED' });
      setState({
        phase: 'ready',
        conversation: { ...state.conversation, status: 'COMPLETED' },
      });
      setCompletedMsg('Conversation marked as completed.');
      setTimeout(() => setCompletedMsg(null), 4000);
    } catch {
      setCompletedMsg('Could not update status — please try again.');
      setTimeout(() => setCompletedMsg(null), 4000);
    } finally {
      setCompleting(false);
    }
  }, [state]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: LOADING
  // ─────────────────────────────────────────────────────────────────────────

  if (state.phase === 'loading') {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="h-12 w-12 rounded-full bg-gold-400/10 border border-gold-400/20 flex items-center justify-center">
              <Zap className="h-5 w-5 text-gold-400" />
            </div>
            <span className="absolute -top-1 -right-1 h-3.5 w-3.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold-400 opacity-40" />
              <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-gold-400/60" />
            </span>
          </div>
          <p className="text-xs text-[#555]">Setting up your workspace…</p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: ERROR
  // ─────────────────────────────────────────────────────────────────────────

  if (state.phase === 'error') {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex max-w-sm flex-col items-center gap-5 text-center"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20">
            <AlertCircle className="h-7 w-7 text-red-400" />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-white">Something went wrong</p>
            <p className="text-xs text-[#666]">{state.message}</p>
          </div>
          <button
            type="button"
            onClick={loadConversation}
            className="flex items-center gap-2 rounded-xl border border-[#2a2a2a] bg-[#141414] px-4 py-2 text-xs font-medium text-[#aaa] transition-all hover:text-white hover:border-[#3a3a3a]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </motion.div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: EMPTY
  // ─────────────────────────────────────────────────────────────────────────

  if (state.phase === 'empty') {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex max-w-sm flex-col items-center gap-5 text-center"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-400/10 border border-gold-400/20">
            <MessageSquare className="h-7 w-7 text-gold-400" />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-white">No conversation yet</p>
            <p className="text-xs text-[#666]">
              Start a new conversation with our team — we&apos;re ready to help.
            </p>
          </div>
          <button
            type="button"
            onClick={loadConversation}
            className="flex items-center gap-2 rounded-xl bg-gold-400/10 border border-gold-400/20 px-4 py-2 text-xs font-semibold text-gold-400 transition-all hover:bg-gold-400/20"
          >
            <Plus className="h-3.5 w-3.5" />
            Start Conversation
          </button>
        </motion.div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: READY
  // ─────────────────────────────────────────────────────────────────────────

  const { conversation } = state;
  const isActive    = conversation.status === 'ACTIVE';
  const isCompleted = conversation.status === 'COMPLETED';

  return (
    <div className="flex h-full flex-col gap-0 overflow-hidden">

      {/* ── LEAD banner ────────────────────────────────────────────────── */}
      {isLead && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-shrink-0 items-center gap-3 border-b border-[#fbbf24]/20 bg-[#fbbf24]/5 px-4 py-3"
          role="status"
          aria-label="Account status: Lead"
        >
          <UserX className="h-4 w-4 shrink-0 text-[#fbbf24]" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[#fbbf24]">Your Account Status: Lead</p>
            <p className="mt-0.5 text-[10px] text-[#888]">
              A member of our team will be assigned to you shortly. You can use the chat below to get in touch.
            </p>
          </div>
        </motion.div>
      )}

      {/* Tab bar removed — navigation is now in the sidebar */}

      {/* ── Toolbar strip (chat tab only) ─────────────────────────────── */}
      {activeTab === 'chat' && (
        <>
          <div className="flex flex-shrink-0 items-center justify-between border-b border-[#1a1a1a] bg-[#0a0a0a] px-4 py-2.5">
            <div className="flex items-center gap-2.5">
              <span className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest',
                STATUS_COLORS[conversation.status],
              )}>
                {STATUS_LABELS[conversation.status]}
              </span>
              <span className="hidden sm:inline text-[11px] text-[#555]">
                Conversation #{conversation.id.slice(-6).toUpperCase()}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <AnimatePresence>
                {isActive && (
                  <motion.button
                    key="complete-btn"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.15 }}
                    type="button"
                    onClick={handleMarkComplete}
                    disabled={isCompleting}
                    className={cn(
                      'flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-semibold transition-all',
                      isCompleting
                        ? 'border-[#2a2a2a] bg-[#141414] text-[#555] cursor-wait'
                        : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/10',
                    )}
                  >
                    {isCompleting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3" />
                    )}
                    {isCompleting ? 'Completing…' : 'Mark as Complete'}
                  </motion.button>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {isCompleted && (
                  <motion.div
                    key="completed-badge"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex items-center gap-1.5 rounded-xl border border-[#2a2a2a] bg-[#141414] px-3 py-1.5 text-[11px] font-semibold text-[#555]"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    Completed
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Status toast */}
          <AnimatePresence>
            {completedMsg && (
              <motion.div
                key="toast"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="flex flex-shrink-0 items-center gap-2 border-b border-emerald-500/20 bg-emerald-500/5 px-4 py-2 text-xs text-emerald-400"
              >
                <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                {completedMsg}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Chat window */}
          <div className="flex-1 overflow-hidden p-3 sm:p-4">
            <ChatWindow conversation={conversation} />
          </div>
        </>
      )}

      {/* ── Contracts tab ─────────────────────────────────────────────── */}
      {activeTab === 'contracts' && (
        <div
          className="flex flex-col flex-1 overflow-hidden"
          role="tabpanel"
          id="tab-panel-contracts"
          aria-labelledby="tab-contracts"
        >
          <div className="flex-shrink-0 px-4 py-3 border-b border-[#1a1a1a] bg-[#0a0a0a]">
            <p className="text-xs text-[#555]">Your contracts — review and sign pending agreements.</p>
          </div>
          <ContractsPanel />
        </div>
      )}

      {/* ── Invoices tab ──────────────────────────────────────────────── */}
      {activeTab === 'invoices' && (
        <div
          className="flex flex-col flex-1 overflow-hidden"
          role="tabpanel"
          id="tab-panel-invoices"
          aria-labelledby="tab-invoices"
        >
          <div className="flex-shrink-0 px-4 py-3 border-b border-[#1a1a1a] bg-[#0a0a0a]">
            <p className="text-xs text-[#555]">Your invoices — view payment status and history.</p>
          </div>
          <InvoicesPanel />
        </div>
      )}

      {/* ── Projects tab ─────────────────────────────────────────────── */}
      {activeTab === 'projects' && (
        <div
          className="flex flex-col flex-1 overflow-hidden"
          role="tabpanel"
          id="tab-panel-projects"
          aria-labelledby="tab-projects"
        >
          <div className="flex-shrink-0 px-4 py-3 border-b border-[#1a1a1a] bg-[#0a0a0a]">
            <p className="text-xs text-[#555]">Your assigned projects — click to view tasks and details.</p>
          </div>
          <ProjectsPanel />
        </div>
      )}
    </div>
  );
}
