'use client';

/**
 * ERP — Contracts Management Page (/erp/contracts)
 *
 * ADMIN + EMPLOYEE: paginated list, stats, search, create/edit/send/delete.
 * CLIENT: view own contracts, accept/reject SENT contracts.
 * Glassmorphism + #fbbf24 gold design system.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Search, Plus, MoreVertical, Pencil, Trash2, X,
  ChevronLeft, ChevronRight, Send, CheckCircle2, XCircle,
  FilePenLine, User, Briefcase, FileSignature,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { contractsApi, clientsApi } from '@/lib/api';
import { cn, getInitials, getAvatarColor } from '@/lib/utils';
import type { Contract, PaginatedContracts, ContractStatus, Client } from '@/types';

// ─── Constants ──────────────────────────────────────────────────────────────

const STATUS_FILTERS: { label: string; value: ContractStatus | 'ALL' }[] = [
  { label: 'All',      value: 'ALL'      },
  { label: 'Draft',    value: 'DRAFT'    },
  { label: 'Sent',     value: 'SENT'     },
  { label: 'Signed',   value: 'SIGNED'   },
  { label: 'Rejected', value: 'REJECTED' },
];

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

// ─── Zod Schemas ────────────────────────────────────────────────────────────

const createSchema = z.object({
  title:    z.string().min(2, 'Title must be at least 2 characters').max(255),
  body:     z.string().min(10, 'Contract body must be at least 10 characters'),
  clientId: z.string().uuid('Please select a valid client'),
});

const editSchema = z.object({
  title: z.string().min(2).max(255).optional(),
  body:  z.string().min(10).optional(),
});

type CreateFormValues = z.infer<typeof createSchema>;
type EditFormValues   = z.infer<typeof editSchema>;

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function apiErrMsg(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { message?: string } } };
  return e?.response?.data?.message ?? fallback;
}

// ─── Skeleton ───────────────────────────────────────────────────────────────

function ContractSkeleton() {
  return (
    <div className="rounded-xl border border-white/5 bg-white/3 p-4 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/10" />
          <div className="space-y-2">
            <div className="h-4 w-40 rounded bg-white/10" />
            <div className="h-3 w-24 rounded bg-white/5" />
          </div>
        </div>
        <div className="h-6 w-20 rounded-full bg-white/10" />
      </div>
      <div className="mt-3 h-3 w-3/4 rounded bg-white/5" />
      <div className="mt-3 flex gap-4">
        <div className="h-3 w-28 rounded bg-white/5" />
        <div className="h-3 w-20 rounded bg-white/5" />
      </div>
    </div>
  );
}

// ─── Contract Card ───────────────────────────────────────────────────────────

interface ContractCardProps {
  contract:   Contract;
  isAdmin:    boolean;
  isEmployee: boolean;
  isClient:   boolean;
  onEdit:     (c: Contract) => void;
  onDelete:   (c: Contract) => void;
  onSend:     (c: Contract) => void;
  onAccept:   (c: Contract) => void;
  onReject:   (c: Contract) => void;
}

function ContractCard({
  contract, isAdmin, isEmployee, isClient,
  onEdit, onDelete, onSend, onAccept, onReject,
}: ContractCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const StatusIcon = STATUS_ICON[contract.status] ?? FilePenLine;
  const router     = useRouter();

  const clientName = contract.client?.user?.name ?? 'Unknown Client';
  const ownerName  = contract.owner?.name ?? 'Unassigned';
  const canEdit    = (isAdmin || isEmployee) && contract.status === 'DRAFT';
  const canSend    = (isAdmin || isEmployee) && contract.status === 'DRAFT';
  const canDelete  = isAdmin && contract.status === 'DRAFT';
  const canAccept  = isClient && contract.status === 'SENT';
  const canReject  = isClient && contract.status === 'SENT';

  return (
    <div
      className="group relative rounded-xl border border-white/5 bg-white/3 hover:bg-white/5 transition-colors cursor-pointer"
      onClick={() => router.push(`/erp/contracts/${contract.id}`)}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn('flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold', getAvatarColor(contract.title))}>
              {getInitials(contract.title)}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-white truncate">{contract.title}</p>
              <p className="text-xs text-white/50 truncate mt-0.5">
                <Briefcase className="inline w-3 h-3 mr-1" />{clientName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border', STATUS_BADGE[contract.status])}>
              <StatusIcon className="w-3 h-3" />{contract.status}
            </span>

            {(isAdmin || isEmployee) && (
              <div className="relative" onClick={(e) => { e.stopPropagation(); setMenuOpen(p => !p); }}>
                <button className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors min-h-[36px]">
                  <MoreVertical className="w-4 h-4" />
                </button>
                <AnimatePresence>
                  {menuOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -5 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -5 }}
                      className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-white/10 bg-[#1a1a1a] shadow-xl z-20 overflow-hidden"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {canEdit && (
                        <button onClick={() => { setMenuOpen(false); onEdit(contract); }}
                          className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-white/80 hover:bg-white/5 transition-colors min-h-[44px]">
                          <Pencil className="w-4 h-4" /> Edit Contract
                        </button>
                      )}
                      {canSend && (
                        <button onClick={() => { setMenuOpen(false); onSend(contract); }}
                          className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-amber-400 hover:bg-amber-400/10 transition-colors min-h-[44px]">
                          <Send className="w-4 h-4" /> Send to Client
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => { setMenuOpen(false); onDelete(contract); }}
                          className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-400 hover:bg-red-400/10 transition-colors min-h-[44px]">
                          <Trash2 className="w-4 h-4" /> Delete
                        </button>
                      )}
                      {!canEdit && !canSend && !canDelete && (
                        <div className="px-4 py-3 text-xs text-white/30">No actions available</div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        {/* Body preview */}
        <p className="mt-2 text-xs text-white/40 line-clamp-2 leading-relaxed">{contract.body}</p>

        {/* Meta */}
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-white/40">
          <span className="flex items-center gap-1"><User className="w-3 h-3" /> {ownerName}</span>
          {contract.sentAt && (
            <span className="flex items-center gap-1"><Send className="w-3 h-3" /> Sent {formatDate(contract.sentAt)}</span>
          )}
          {contract.signedAt && (
            <span className="flex items-center gap-1 text-emerald-400/60">
              <CheckCircle2 className="w-3 h-3" /> Signed {formatDate(contract.signedAt)}
            </span>
          )}
          {!contract.sentAt && <span className="text-white/30">{formatDate(contract.createdAt)}</span>}
        </div>

        {/* CLIENT accept/reject quick-actions */}
        {(canAccept || canReject) && (
          <div className="mt-3 flex gap-2 pt-3 border-t border-white/5" onClick={(e) => e.stopPropagation()}>
            {canAccept && (
              <button onClick={() => onAccept(contract)}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors min-h-[36px]">
                <CheckCircle2 className="w-3.5 h-3.5" /> Accept
              </button>
            )}
            {canReject && (
              <button onClick={() => onReject(contract)}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors min-h-[36px]">
                <XCircle className="w-3.5 h-3.5" /> Reject
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Modal wrapper ───────────────────────────────────────────────────────────

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

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-white/70 mb-1.5">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-400" role="alert">{error}</p>}
    </div>
  );
}

function inputCls(hasError?: boolean) {
  return cn(
    'w-full rounded-lg border bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-colors focus:bg-white/8 focus:border-[#fbbf24]/50 min-h-[44px]',
    hasError ? 'border-red-400/50' : 'border-white/10',
  );
}

// ─── Create Contract Modal ───────────────────────────────────────────────────

function CreateContractModal({ isOpen, onClose, clients, clientsLoading }: { isOpen: boolean; onClose: () => void; clients: Client[]; clientsLoading: boolean }) {
  const qc = useQueryClient();
  const { register, handleSubmit, control, reset, formState: { errors } } =
    useForm<CreateFormValues>({ resolver: zodResolver(createSchema) });

  const mutation = useMutation({
    mutationFn: (data: CreateFormValues) => contractsApi.createContract(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['erp-contracts'] }); reset(); onClose(); },
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Contract" subtitle="Draft a contract for a client.">
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <Field label="Contract Title *" error={errors.title?.message}>
          <input {...register('title')} placeholder="e.g. Website Development Agreement" className={inputCls(!!errors.title)} />
        </Field>
        <Field label="Client *" error={errors.clientId?.message}>
          <Controller name="clientId" control={control} render={({ field }) => (
            <select
              {...field}
              disabled={clientsLoading}
              className={cn(inputCls(!!errors.clientId), 'bg-[#1a1a1a]', clientsLoading && 'opacity-60 cursor-wait')}
            >
              <option value="">
                {clientsLoading ? 'Loading clients…' : clients.length === 0 ? 'No clients found' : 'Select a client…'}
              </option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.user?.name ?? c.id}{c.company ? ` (${c.company})` : ''}</option>
              ))}
            </select>
          )} />
        </Field>
        <Field label="Contract Body *" error={errors.body?.message}>
          <textarea {...register('body')} rows={8}
            placeholder="Enter the full contract text, terms and conditions…"
            className={cn(inputCls(!!errors.body), 'resize-y min-h-[160px] h-auto py-2')} />
        </Field>
        {mutation.isError && (
          <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            {apiErrMsg(mutation.error, 'Failed to create contract')}
          </p>
        )}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-white/70 hover:bg-white/5 transition-colors text-sm min-h-[44px]">Cancel</button>
          <button type="submit" disabled={mutation.isPending}
            className="flex-1 px-4 py-2.5 rounded-lg bg-[#fbbf24] text-black font-semibold hover:bg-[#f59e0b] transition-colors text-sm disabled:opacity-50 min-h-[44px]">
            {mutation.isPending ? 'Creating…' : 'Create Draft'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Edit Contract Modal ─────────────────────────────────────────────────────

function EditContractModal({ isOpen, onClose, contract }: { isOpen: boolean; onClose: () => void; contract: Contract | null }) {
  const qc = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } =
    useForm<EditFormValues>({ resolver: zodResolver(editSchema) });

  const mutation = useMutation({
    mutationFn: (data: EditFormValues) => contractsApi.updateContract(contract!.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['erp-contracts'] }); reset(); onClose(); },
  });

  if (!contract) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Contract" subtitle="Update this draft contract.">
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <Field label="Contract Title" error={errors.title?.message}>
          <input {...register('title')} defaultValue={contract.title} className={inputCls(!!errors.title)} />
        </Field>
        <Field label="Contract Body" error={errors.body?.message}>
          <textarea {...register('body')} defaultValue={contract.body} rows={8}
            className={cn(inputCls(!!errors.body), 'resize-y min-h-[160px] h-auto py-2')} />
        </Field>
        {mutation.isError && (
          <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            {apiErrMsg(mutation.error, 'Failed to update contract')}
          </p>
        )}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-white/70 hover:bg-white/5 transition-colors text-sm min-h-[44px]">Cancel</button>
          <button type="submit" disabled={mutation.isPending}
            className="flex-1 px-4 py-2.5 rounded-lg bg-[#fbbf24] text-black font-semibold hover:bg-[#f59e0b] transition-colors text-sm disabled:opacity-50 min-h-[44px]">
            {mutation.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Send Confirm Modal ──────────────────────────────────────────────────────

function SendConfirmModal({ isOpen, onClose, contract }: { isOpen: boolean; onClose: () => void; contract: Contract | null }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => contractsApi.sendContract(contract!.id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['erp-contracts'] }); onClose(); },
  });

  if (!contract) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Send Contract to Client">
      <div className="space-y-4">
        <p className="text-sm text-white/70">
          Send <strong className="text-white">&ldquo;{contract.title}&rdquo;</strong> to the client for review?
          The client will receive a notification and can accept or reject the contract.
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

// ─── Delete Confirm Modal ────────────────────────────────────────────────────

function DeleteConfirmModal({ isOpen, onClose, contract }: { isOpen: boolean; onClose: () => void; contract: Contract | null }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => contractsApi.deleteContract(contract!.id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['erp-contracts'] }); onClose(); },
  });

  if (!contract) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Contract">
      <div className="space-y-4">
        <p className="text-sm text-white/70">
          Permanently delete <strong className="text-white">&ldquo;{contract.title}&rdquo;</strong>? This action cannot be undone.
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

// ─── Accept Confirm Modal ────────────────────────────────────────────────────

function AcceptConfirmModal({ isOpen, onClose, contract }: { isOpen: boolean; onClose: () => void; contract: Contract | null }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => contractsApi.acceptContract(contract!.id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['erp-contracts'] }); onClose(); },
  });

  if (!contract) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Accept Contract" subtitle="Digitally sign this agreement.">
      <div className="space-y-4">
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
      </div>
    </Modal>
  );
}

// ─── Reject Confirm Modal ────────────────────────────────────────────────────

function RejectConfirmModal({ isOpen, onClose, contract }: { isOpen: boolean; onClose: () => void; contract: Contract | null }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => contractsApi.rejectContract(contract!.id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['erp-contracts'] }); onClose(); },
  });

  if (!contract) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reject Contract">
      <div className="space-y-4">
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
      </div>
    </Modal>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ContractsPage() {
  const [mounted, setMounted] = useState(false);
  const { user } = useAuth();

  const [search,       setSearch]      = useState('');
  const [statusFilter, setStatusFilter] = useState<ContractStatus | 'ALL'>('ALL');
  const [page,         setPage]         = useState(1);

  const [createOpen,     setCreateOpen]     = useState(false);
  const [editContract,   setEditContract]   = useState<Contract | null>(null);
  const [sendContract,   setSendContract]   = useState<Contract | null>(null);
  const [deleteContract, setDeleteContract] = useState<Contract | null>(null);
  const [acceptContract, setAcceptContract] = useState<Contract | null>(null);
  const [rejectContract, setRejectContract] = useState<Contract | null>(null);

  if (typeof window !== 'undefined' && !mounted) setMounted(true);

  const isAdmin    = user?.role === 'ADMIN';
  const isEmployee = user?.role === 'EMPLOYEE';
  const isClient   = user?.role === 'CLIENT';

  const params = {
    page, limit: 12,
    ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
    ...(search ? { search } : {}),
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['erp-contracts', params],
    queryFn:  () => contractsApi.getContracts(params).then(r => r.data.data as PaginatedContracts),
    staleTime: 30_000, retry: 1, refetchOnWindowFocus: false,
    enabled: !!user,
  });

  // enabled: !!user fires as soon as auth resolves — avoids empty dropdown
  // when modal opens before a role-gated query would have run.
  const { data: clientsData, isLoading: clientsLoading } = useQuery({
    queryKey: ['erp-clients-for-contracts'],
    queryFn:  () => clientsApi.getClients({ limit: 100 }).then(r => r.data.data.clients as Client[]),
    staleTime: 60_000, retry: 1, refetchOnWindowFocus: false,
    enabled: !!user,
  });
  const clients = clientsData ?? [];

  const { data: allData } = useQuery({
    queryKey: ['erp-contracts-stats'],
    queryFn:  () => contractsApi.getContracts({ limit: 200 }).then(r => r.data.data as PaginatedContracts),
    staleTime: 60_000, retry: 1, refetchOnWindowFocus: false,
    enabled: !!user,
  });

  const allContracts = allData?.contracts ?? [];
  const stats = {
    total:    allData?.total ?? 0,
    draft:    allContracts.filter(c => c.status === 'DRAFT').length,
    sent:     allContracts.filter(c => c.status === 'SENT').length,
    signed:   allContracts.filter(c => c.status === 'SIGNED').length,
    rejected: allContracts.filter(c => c.status === 'REJECTED').length,
  };

  const contracts = data?.contracts ?? [];
  const total     = data?.total ?? 0;
  const pages     = data?.pages ?? 1;

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-[#fbbf24]" /> Contracts
          </h1>
          <p className="text-sm text-white/50 mt-1">
            {isClient ? 'View and sign your contracts.' : 'Manage client contracts and agreements.'}
          </p>
        </div>
        {(isAdmin || isEmployee) && (
          <button onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#fbbf24] text-black font-semibold hover:bg-[#f59e0b] transition-colors text-sm min-h-[44px]">
            <Plus className="w-4 h-4" /> New Contract
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'Total',    value: stats.total,    color: 'text-white'       },
          { label: 'Draft',    value: stats.draft,    color: 'text-slate-400'   },
          { label: 'Sent',     value: stats.sent,     color: 'text-amber-400'   },
          { label: 'Signed',   value: stats.signed,   color: 'text-emerald-400' },
          { label: 'Rejected', value: stats.rejected, color: 'text-red-400'     },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-white/5 bg-white/3 p-3 text-center">
            <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
            <p className="text-xs text-white/50 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input type="text" placeholder="Search contracts…" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder-white/30 outline-none focus:border-[#fbbf24]/50 transition-colors min-h-[44px]" />
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map(f => (
            <button key={f.value} onClick={() => { setStatusFilter(f.value); setPage(1); }}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors min-h-[36px]',
                statusFilter === f.value ? 'bg-[#fbbf24] border-[#fbbf24] text-black' : 'border-white/10 text-white/60 hover:text-white hover:border-white/20')}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <ContractSkeleton key={i} />)}
        </div>
      ) : isError ? (
        <div className="text-center py-20 text-white/50">
          <p className="mb-3">Failed to load contracts.</p>
          <button onClick={() => refetch()} className="px-4 py-2 rounded-lg border border-white/10 hover:bg-white/5 text-sm transition-colors">Retry</button>
        </div>
      ) : contracts.length === 0 ? (
        <div className="text-center py-20">
          <FileText className="w-12 h-12 text-white/10 mx-auto mb-4" />
          <p className="text-white/50 text-sm">
            {isClient ? 'No contracts found for your account.' : 'No contracts found. Create your first contract.'}
          </p>
          {(isAdmin || isEmployee) && (
            <button onClick={() => setCreateOpen(true)}
              className="mt-4 px-4 py-2 rounded-lg bg-[#fbbf24]/10 border border-[#fbbf24]/20 text-[#fbbf24] text-sm hover:bg-[#fbbf24]/20 transition-colors">
              + New Contract
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {contracts.map(contract => (
              <ContractCard
                key={contract.id} contract={contract}
                isAdmin={isAdmin} isEmployee={isEmployee} isClient={isClient}
                onEdit={setEditContract} onDelete={setDeleteContract}
                onSend={setSendContract} onAccept={setAcceptContract} onReject={setRejectContract}
              />
            ))}
          </div>
          {pages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-white/40">
                Showing {((page - 1) * 12) + 1}–{Math.min(page * 12, total)} of {total}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-2 rounded-lg border border-white/10 text-white/60 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors min-h-[36px]" aria-label="Previous page">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 py-1.5 text-sm text-white/60">{page} / {pages}</span>
                <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                  className="p-2 rounded-lg border border-white/10 text-white/60 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors min-h-[36px]" aria-label="Next page">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <CreateContractModal isOpen={createOpen} onClose={() => setCreateOpen(false)} clients={clients} clientsLoading={clientsLoading} />
      <EditContractModal   isOpen={!!editContract}   onClose={() => setEditContract(null)}   contract={editContract} />
      <SendConfirmModal    isOpen={!!sendContract}    onClose={() => setSendContract(null)}    contract={sendContract} />
      <DeleteConfirmModal  isOpen={!!deleteContract}  onClose={() => setDeleteContract(null)}  contract={deleteContract} />
      <AcceptConfirmModal  isOpen={!!acceptContract}  onClose={() => setAcceptContract(null)}  contract={acceptContract} />
      <RejectConfirmModal  isOpen={!!rejectContract}  onClose={() => setRejectContract(null)}  contract={rejectContract} />
    </div>
  );
}
