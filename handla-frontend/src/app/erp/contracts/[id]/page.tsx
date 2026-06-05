'use client';

/**
 * ERP — Contract Detail Page (/erp/contracts/[id])
 *
 * Displays full contract body, metadata sidebar, and action buttons.
 * CLIENT view with SENT status shows accept/reject panel with confirmation modals.
 * ADMIN/EMPLOYEE can edit (DRAFT), send (DRAFT), or download signed copy (SIGNED).
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, ChevronRight, FilePenLine, Send, CheckCircle2, XCircle,
  Pencil, Trash2, X, ArrowLeft, User, Briefcase, Calendar,
  Download, FileSignature, ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { contractsApi } from '@/lib/api';
import { cn, getInitials, getAvatarColor } from '@/lib/utils';
import type { Contract, ContractStatus } from '@/types';

// ─── Status config ───────────────────────────────────────────────────────────

const STATUS_BADGE: Record<ContractStatus, string> = {
  DRAFT:    'border-slate-400/30   bg-slate-400/10   text-slate-400',
  SENT:     'border-amber-400/30   bg-amber-400/10   text-amber-400',
  SIGNED:   'border-emerald-400/30 bg-emerald-400/10 text-emerald-400',
  REJECTED: 'border-red-400/30     bg-red-400/10     text-red-400',
};

const STATUS_ICON: Record<ContractStatus, React.ComponentType<{ className?: string }>> = {
  DRAFT:    FilePenLine,
  SENT:     Send,
  SIGNED:   CheckCircle2,
  REJECTED: XCircle,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(d: string | null | undefined, opts?: Intl.DateTimeFormatOptions) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', opts ?? { year: 'numeric', month: 'long', day: 'numeric' });
}

function apiErrMsg(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { message?: string } } };
  return e?.response?.data?.message ?? fallback;
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-4 w-48 rounded bg-white/10" />
      <div className="rounded-2xl border border-white/5 bg-white/3 p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-white/10" />
          <div className="space-y-2">
            <div className="h-6 w-56 rounded bg-white/10" />
            <div className="h-4 w-32 rounded bg-white/5" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-64 rounded-xl bg-white/5" />
        <div className="h-48 rounded-xl bg-white/5" />
      </div>
    </div>
  );
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────

function Modal({ isOpen, onClose, title, subtitle, children }: {
  isOpen: boolean; onClose: () => void;
  title: string; subtitle?: string; children: React.ReactNode;
}) {
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
            className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0d0d0d] shadow-2xl overflow-hidden"
            role="dialog" aria-modal="true"
          >
            <div className="p-6 border-b border-white/5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">{title}</h2>
                  {subtitle && <p className="text-sm text-white/50 mt-0.5">{subtitle}</p>}
                </div>
                <button onClick={onClose} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors min-h-[36px]" aria-label="Close">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 max-h-[70vh] overflow-y-auto">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ─── Edit Contract Modal ─────────────────────────────────────────────────────

function EditContractModal({ isOpen, onClose, contract, onSuccess }: {
  isOpen: boolean; onClose: () => void; contract: Contract; onSuccess: () => void;
}) {
  const [title, setTitle] = useState(contract.title);
  const [body,  setBody]  = useState(contract.body);
  const qc = useQueryClient();

  useEffect(() => {
    if (isOpen) { setTitle(contract.title); setBody(contract.body); }
  }, [isOpen, contract]);

  const mutation = useMutation({
    mutationFn: () => contractsApi.updateContract(contract.id, { title, body }),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['erp-contract', contract.id] });
      qc.invalidateQueries({ queryKey: ['erp-contracts'] });
      onSuccess(); onClose();
    },
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Contract" subtitle="Update this draft contract.">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5">Contract Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-[#fbbf24]/50 min-h-[44px]" />
        </div>
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5">Contract Body</label>
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={10}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-[#fbbf24]/50 resize-y min-h-[180px] h-auto" />
        </div>
        {mutation.isError && (
          <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            {apiErrMsg(mutation.error, 'Failed to update contract')}
          </p>
        )}
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-white/70 hover:bg-white/5 transition-colors text-sm min-h-[44px]">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !title.trim() || !body.trim()}
            className="flex-1 px-4 py-2.5 rounded-lg bg-[#fbbf24] text-black font-semibold hover:bg-[#f59e0b] transition-colors text-sm disabled:opacity-50 min-h-[44px]">
            {mutation.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Send Confirm Modal ───────────────────────────────────────────────────────

function SendConfirmModal({ isOpen, onClose, contract, onSuccess }: {
  isOpen: boolean; onClose: () => void; contract: Contract; onSuccess: () => void;
}) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => contractsApi.sendContract(contract.id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['erp-contract', contract.id] });
      qc.invalidateQueries({ queryKey: ['erp-contracts'] });
      onSuccess(); onClose();
    },
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Send Contract to Client">
      <div className="space-y-4">
        <p className="text-sm text-white/70">
          Send <strong className="text-white">&ldquo;{contract.title}&rdquo;</strong> to the client for review?
          The client will receive a notification and can accept or reject the contract.
          This action changes status from DRAFT to SENT and cannot be reversed.
        </p>
        {mutation.isError && (
          <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            {apiErrMsg(mutation.error, 'Failed to send contract')}
          </p>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-white/70 hover:bg-white/5 transition-colors text-sm min-h-[44px]">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500/90 text-black font-semibold hover:bg-amber-400 transition-colors text-sm disabled:opacity-50 min-h-[44px]">
            <Send className="w-4 h-4" />{mutation.isPending ? 'Sending…' : 'Send to Client'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteConfirmModal({ isOpen, onClose, contract }: {
  isOpen: boolean; onClose: () => void; contract: Contract;
}) {
  const router = useRouter();
  const mutation = useMutation({
    mutationFn: () => contractsApi.deleteContract(contract.id),
    onSuccess:  () => router.push('/erp/contracts'),
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Contract">
      <div className="space-y-4">
        <p className="text-sm text-white/70">
          Permanently delete <strong className="text-white">&ldquo;{contract.title}&rdquo;</strong>? This cannot be undone.
        </p>
        {mutation.isError && (
          <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            {apiErrMsg(mutation.error, 'Failed to delete contract')}
          </p>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-white/70 hover:bg-white/5 transition-colors text-sm min-h-[44px]">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
            className="flex-1 px-4 py-2.5 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors text-sm disabled:opacity-50 min-h-[44px]">
            {mutation.isPending ? 'Deleting…' : 'Delete Contract'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Accept Confirm Modal ─────────────────────────────────────────────────────

function AcceptConfirmModal({ isOpen, onClose, contract, onSuccess }: {
  isOpen: boolean; onClose: () => void; contract: Contract; onSuccess: () => void;
}) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => contractsApi.acceptContract(contract.id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['erp-contract', contract.id] });
      qc.invalidateQueries({ queryKey: ['erp-contracts'] });
      onSuccess(); onClose();
    },
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Accept Contract" subtitle="Digitally sign this agreement.">
      <div className="space-y-4">
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
          <p className="text-sm text-emerald-300">
            By accepting, you agree to all terms and conditions in <strong>&ldquo;{contract.title}&rdquo;</strong>.
            A signed copy will be generated and stored securely on your behalf.
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
      </div>
    </Modal>
  );
}

// ─── Reject Confirm Modal ─────────────────────────────────────────────────────

function RejectConfirmModal({ isOpen, onClose, contract, onSuccess }: {
  isOpen: boolean; onClose: () => void; contract: Contract; onSuccess: () => void;
}) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => contractsApi.rejectContract(contract.id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['erp-contract', contract.id] });
      qc.invalidateQueries({ queryKey: ['erp-contracts'] });
      onSuccess(); onClose();
    },
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reject Contract">
      <div className="space-y-4">
        <p className="text-sm text-white/70">
          Reject <strong className="text-white">&ldquo;{contract.title}&rdquo;</strong>?
          The account team will be notified and can send a revised version if needed.
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
      </div>
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ContractDetailPage() {
  const [mounted, setMounted] = useState(false);
  const { user } = useAuth();
  const router   = useRouter();
  const params   = useParams<{ id: string }>();

  const [editOpen,   setEditOpen]   = useState(false);
  const [sendOpen,   setSendOpen]   = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  // PDF url state
  const [pdfUrl,     setPdfUrl]     = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError,   setPdfError]   = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['erp-contract', params.id],
    queryFn:  () => contractsApi.getContract(params.id).then(r => r.data.data.contract as Contract),
    staleTime: 30_000, retry: 1, refetchOnWindowFocus: false,
    enabled: !!params.id,
  });

  const fetchPdfUrl = async () => {
    if (!data) return;
    setPdfLoading(true);
    setPdfError(null);
    try {
      const res = await contractsApi.getPdfUrl(data.id);
      const url = (res.data.data as { url?: string })?.url ?? res.data.data;
      setPdfUrl(url as string);
      window.open(url as string, '_blank');
    } catch {
      setPdfError('Could not load document URL');
    } finally {
      setPdfLoading(false);
    }
  };

  if (!mounted) return null;
  if (isLoading) return <div className="p-6"><DetailSkeleton /></div>;

  if (isError || !data) {
    return (
      <div className="text-center py-20">
        <p className="text-white/50 mb-4">Contract not found or access denied.</p>
        <button onClick={() => router.push('/erp/contracts')}
          className="px-4 py-2 rounded-lg border border-white/10 hover:bg-white/5 text-sm text-white/70 transition-colors">
          ← Back to Contracts
        </button>
      </div>
    );
  }

  const contract   = data;
  const StatusIcon = STATUS_ICON[contract.status] ?? FilePenLine;
  const clientName = contract.client?.user?.name ?? 'Unknown Client';
  const ownerName  = contract.owner?.name ?? 'Unassigned';

  const isAdmin    = user?.role === 'ADMIN';
  const isEmployee = user?.role === 'EMPLOYEE';
  const isClient   = user?.role === 'CLIENT';
  const canEdit    = (isAdmin || isEmployee) && contract.status === 'DRAFT';
  const canSend    = (isAdmin || isEmployee) && contract.status === 'DRAFT';
  const canDelete  = isAdmin && contract.status === 'DRAFT';
  const canAccept  = isClient && contract.status === 'SENT';
  const canReject  = isClient && contract.status === 'SENT';
  const canDownload= contract.status === 'SIGNED' && !!contract.s3Key;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-white/40" aria-label="Breadcrumb">
        <Link href="/erp/contracts" className="hover:text-white transition-colors flex items-center gap-1">
          <FileText className="w-4 h-4" /> Contracts
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-white/70 truncate max-w-[200px]">{contract.title}</span>
      </nav>

      {/* Header card */}
      <div className="rounded-2xl border border-white/5 bg-white/3 p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          {/* Icon */}
          <div className={cn('flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center text-lg font-bold', getAvatarColor(contract.title))}>
            {getInitials(contract.title)}
          </div>

          {/* Title block */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-white truncate">{contract.title}</h1>
              <span className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border', STATUS_BADGE[contract.status])}>
                <StatusIcon className="w-3 h-3" />
                {contract.status}
              </span>
            </div>
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-white/50">
              <Link href={`/erp/clients/${contract.clientId}`}
                className="flex items-center gap-1.5 hover:text-[#fbbf24] transition-colors">
                <Briefcase className="w-3.5 h-3.5" />{clientName}
              </Link>
              <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" />{ownerName}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 flex-shrink-0">
            {canEdit && (
              <button onClick={() => setEditOpen(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 text-white/70 hover:bg-white/5 transition-colors text-sm min-h-[40px]">
                <Pencil className="w-4 h-4" /> Edit
              </button>
            )}
            {canSend && (
              <button onClick={() => setSendOpen(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors text-sm min-h-[40px]">
                <Send className="w-4 h-4" /> Send to Client
              </button>
            )}
            {canDownload && (
              <button onClick={fetchPdfUrl} disabled={pdfLoading}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors text-sm disabled:opacity-50 min-h-[40px]">
                {pdfLoading ? (
                  <><span className="w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" /> Loading…</>
                ) : (
                  <><Download className="w-4 h-4" /> Download</>
                )}
              </button>
            )}
            {canDelete && (
              <button onClick={() => setDeleteOpen(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors text-sm min-h-[40px]">
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            )}
            <button onClick={() => router.push('/erp/contracts')}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 text-white/60 hover:bg-white/5 transition-colors text-sm min-h-[40px]">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          </div>
        </div>

        {/* Meta pills */}
        <div className="flex flex-wrap gap-3 mt-5 pt-5 border-t border-white/5">
          <div className="flex items-center gap-1.5 text-xs text-white/50 px-3 py-1.5 rounded-lg bg-white/5">
            <Calendar className="w-3.5 h-3.5 text-[#fbbf24]" /> Created: {formatDate(contract.createdAt)}
          </div>
          {contract.sentAt && (
            <div className="flex items-center gap-1.5 text-xs text-white/50 px-3 py-1.5 rounded-lg bg-white/5">
              <Send className="w-3.5 h-3.5 text-amber-400" /> Sent: {formatDate(contract.sentAt)}
            </div>
          )}
          {contract.signedAt && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400/70 px-3 py-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
              <CheckCircle2 className="w-3.5 h-3.5" /> Signed: {formatDate(contract.signedAt)}
            </div>
          )}
        </div>

        {/* PDF error */}
        {pdfError && (
          <p className="mt-3 text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            {pdfError}
          </p>
        )}
        {pdfUrl && (
          <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400">
            <ExternalLink className="w-3.5 h-3.5" />
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-emerald-300">
              Open signed document in new tab
            </a>
          </div>
        )}
      </div>

      {/* CLIENT: Accept/Reject panel (SENT status only) */}
      {isClient && contract.status === 'SENT' && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-amber-300 flex items-center gap-2">
                <Send className="w-4 h-4" /> Contract Awaiting Your Signature
              </h2>
              <p className="text-sm text-white/60 mt-1">
                Please review the contract terms below, then accept or reject.
              </p>
            </div>
            <div className="flex gap-3 flex-shrink-0">
              <button onClick={() => setRejectOpen(true)}
                className="px-4 py-2.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors text-sm font-medium min-h-[44px]">
                <XCircle className="inline w-4 h-4 mr-1.5" /> Reject
              </button>
              <button onClick={() => setAcceptOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#fbbf24] text-black font-semibold hover:bg-[#f59e0b] transition-colors text-sm min-h-[44px]">
                <FileSignature className="w-4 h-4" /> Accept Contract
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* CONTRACT SIGNED banner */}
      {contract.status === 'SIGNED' && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-300">Contract Signed</p>
            <p className="text-xs text-white/50">
              Digitally signed on {formatDate(contract.signedAt)}
              {canDownload && ' · Use the Download button above to retrieve the signed copy.'}
            </p>
          </div>
        </div>
      )}

      {/* CONTRACT REJECTED banner */}
      {contract.status === 'REJECTED' && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 flex items-center gap-3">
          <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-300">Contract Rejected</p>
            <p className="text-xs text-white/50">The client has rejected this contract. Contact them to discuss revisions.</p>
          </div>
        </div>
      )}

      {/* Body + Metadata */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contract Body */}
        <div className="lg:col-span-2 rounded-xl border border-white/5 bg-white/3 p-5">
          <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wide mb-4">Contract Terms</h2>
          <div className="prose prose-invert prose-sm max-w-none">
            <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">{contract.body}</p>
          </div>
        </div>

        {/* Metadata sidebar */}
        <div className="rounded-xl border border-white/5 bg-white/3 p-5 space-y-5">
          <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wide">Contract Details</h2>
          <dl className="space-y-3">
            {[
              { label: 'Status',   value: contract.status },
              { label: 'Client',   value: clientName },
              { label: 'Owner',    value: ownerName },
              { label: 'Created',  value: formatDate(contract.createdAt, { year: 'numeric', month: 'short', day: 'numeric' }) },
              { label: 'Sent',     value: formatDate(contract.sentAt,    { year: 'numeric', month: 'short', day: 'numeric' }) },
              { label: 'Signed',   value: formatDate(contract.signedAt,  { year: 'numeric', month: 'short', day: 'numeric' }) },
              { label: 'Updated',  value: formatDate(contract.updatedAt, { year: 'numeric', month: 'short', day: 'numeric' }) },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-start gap-2">
                <dt className="text-xs text-white/40">{label}</dt>
                <dd className="text-xs text-white/80 text-right">{value}</dd>
              </div>
            ))}
          </dl>

          {/* Client link */}
          <Link
            href={`/erp/clients/${contract.clientId}`}
            className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition-colors text-sm"
          >
            <Briefcase className="w-4 h-4" /> View Client Profile
            <ExternalLink className="w-3 h-3 ml-auto" />
          </Link>
        </div>
      </div>

      {/* Modals */}
      {canEdit && (
        <EditContractModal isOpen={editOpen} onClose={() => setEditOpen(false)}
          contract={contract} onSuccess={() => refetch()} />
      )}
      {canSend && (
        <SendConfirmModal isOpen={sendOpen} onClose={() => setSendOpen(false)}
          contract={contract} onSuccess={() => refetch()} />
      )}
      {canDelete && (
        <DeleteConfirmModal isOpen={deleteOpen} onClose={() => setDeleteOpen(false)} contract={contract} />
      )}
      {canAccept && (
        <AcceptConfirmModal isOpen={acceptOpen} onClose={() => setAcceptOpen(false)}
          contract={contract} onSuccess={() => refetch()} />
      )}
      {canReject && (
        <RejectConfirmModal isOpen={rejectOpen} onClose={() => setRejectOpen(false)}
          contract={contract} onSuccess={() => refetch()} />
      )}
    </div>
  );
}
