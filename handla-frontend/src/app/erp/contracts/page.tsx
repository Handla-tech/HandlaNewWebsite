'use client';

/**
 * ERP — Contracts Management Page (/erp/contracts)
 * Enhanced premium UI
 */

import { useState, useEffect } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { DataTable, TableSkeleton, type Column, type RowAction } from '@/components/ui/DataTable';
import {
  FileText, Search, Plus, Pencil, Trash2, X,
  ChevronLeft, ChevronRight, Send, CheckCircle2, XCircle,
  FilePenLine, User, Briefcase, FileSignature, AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { contractsApi, clientsApi } from '@/lib/api';
import { cn, getInitials, getAvatarColor } from '@/lib/utils';
import type { Contract, PaginatedContracts, ContractStatus, Client } from '@/types';
import {
  ContractFormFields, buildContractPayload, detailsToFormValues,
  type ContractFormValues,
} from '@/components/erp/ContractFormFields';

// ─── Constants ──────────────────────────────────────────────────────────────

const STATUS_FILTERS: { label: string; value: ContractStatus | 'ALL' }[] = [
  { label: 'All',      value: 'ALL'      },
  { label: 'Draft',    value: 'DRAFT'    },
  { label: 'Sent',     value: 'SENT'     },
  { label: 'Signed',   value: 'SIGNED'   },
  { label: 'Rejected', value: 'REJECTED' },
];

const STATUS_BADGE: Record<ContractStatus, string> = {
  DRAFT:    'border-white/15       bg-white/5         text-white/50',
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
//
// The comprehensive form keeps `details` un-validated at the schema level
// (all 30+ fields are individually optional and the backend validates them
// via class-validator). Only the top-level required fields are strict.

const createSchema = z.object({
  title:    z.string().min(2, 'Title must be at least 2 characters').max(255),
  clientId: z.string().uuid('Please select a valid client'),
  // details is passed through verbatim; no Zod schema needed.
  details:  z.any().optional(),
});

const editSchema = z.object({
  title:    z.string().min(2).max(255),
  clientId: z.string().optional(),
  details:  z.any().optional(),
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function apiErrMsg(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { message?: string } } };
  return e?.response?.data?.message ?? fallback;
}

// ─── Modal wrapper ───────────────────────────────────────────────────────────

function Modal({ isOpen, onClose, title, subtitle, children, size = 'sm' }: {
  isOpen: boolean; onClose: () => void; title: string; subtitle?: string;
  children: React.ReactNode; size?: 'sm' | 'xl';
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            className={cn(
              'relative w-full rounded-2xl border border-white/10 bg-[#111] shadow-2xl overflow-hidden',
              size === 'xl' ? 'max-w-3xl' : 'max-w-lg',
            )}
            role="dialog" aria-modal="true"
          >
            <div className="p-5 border-b border-white/[0.06]">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-base font-bold text-white">{title}</h2>
                  {subtitle && <p className="text-xs text-white/30 mt-0.5">{subtitle}</p>}
                </div>
                <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors" aria-label="Close">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-5 max-h-[78vh] overflow-y-auto">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ─── Create Contract Modal ───────────────────────────────────────────────────

function CreateContractModal({ isOpen, onClose, clients, clientsLoading }: { isOpen: boolean; onClose: () => void; clients: Client[]; clientsLoading: boolean }) {
  const qc = useQueryClient();
  const { register, handleSubmit, control, reset, setValue, getValues, formState: { errors } } =
    useForm<ContractFormValues>({
      resolver: zodResolver(createSchema),
      defaultValues: {
        title: '',
        clientId: '',
        details: {
          ndaIncluded: false,
          hostingIncluded: false,
          domainIncluded: false,
          sslIncluded: false,
          deploymentIncluded: false,
          paymentMilestones: [],
        },
      },
    });

  const mutation = useMutation({
    mutationFn: (values: ContractFormValues) => {
      const payload = buildContractPayload(values);
      return contractsApi.createContract(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['erp-contracts'] }); reset(); onClose(); },
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl"
      title="New Contract"
      subtitle="Build a comprehensive contract by filling in the sections below.">
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <ContractFormFields
          register={register}
          control={control}
          errors={errors}
          clients={clients}
          clientsLoading={clientsLoading}
          setValue={setValue}
          getValues={getValues}
        />
        {mutation.isError && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{apiErrMsg(mutation.error, 'Failed to create contract')}
          </div>
        )}
        <div className="flex gap-3 pt-1 sticky bottom-0 -mx-5 -mb-5 px-5 py-3 bg-[#111] border-t border-white/[0.06]">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white transition-colors text-sm min-h-[44px]">Cancel</button>
          <button type="submit" disabled={mutation.isPending}
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#fbbf24] text-black font-semibold hover:bg-[#f59e0b] transition-colors text-sm disabled:opacity-50 min-h-[44px]">
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
  const { register, handleSubmit, control, reset, formState: { errors } } =
    useForm<ContractFormValues>({
      resolver: zodResolver(editSchema),
      defaultValues: {
        title: '',
        clientId: '',
        details: detailsToFormValues(null),
      },
    });

  // Pre-fill form whenever a different contract is opened.
  useEffect(() => {
    if (isOpen && contract) {
      reset({
        title: contract.title,
        clientId: contract.clientId,
        details: detailsToFormValues(contract.details),
      });
    }
  }, [isOpen, contract, reset]);

  const mutation = useMutation({
    mutationFn: (values: ContractFormValues) => {
      const payload = buildContractPayload(values);
      // Edit endpoint doesn't change clientId; strip it.
      const { clientId: _omit, ...rest } = payload;
      void _omit;
      return contractsApi.updateContract(contract!.id, rest);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['erp-contracts'] }); onClose(); },
  });

  if (!contract) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl"
      title="Edit Contract"
      subtitle="Update this draft contract.">
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <ContractFormFields
          register={register}
          control={control}
          errors={errors}
          hideClientSelect
        />
        {mutation.isError && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{apiErrMsg(mutation.error, 'Failed to update contract')}
          </div>
        )}
        <div className="flex gap-3 pt-1 sticky bottom-0 -mx-5 -mb-5 px-5 py-3 bg-[#111] border-t border-white/[0.06]">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white transition-colors text-sm min-h-[44px]">Cancel</button>
          <button type="submit" disabled={mutation.isPending}
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#fbbf24] text-black font-semibold hover:bg-[#f59e0b] transition-colors text-sm disabled:opacity-50 min-h-[44px]">
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
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/8 p-3">
          <Send className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-white/60">
            Send <strong className="text-white">&ldquo;{contract.title}&rdquo;</strong> to the client for review?
            The client will receive a notification and can accept or reject.
          </p>
        </div>
        {mutation.isError && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{apiErrMsg(mutation.error, 'Failed to send contract')}
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white transition-colors text-sm min-h-[44px]">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 text-black font-semibold hover:bg-amber-400 transition-colors text-sm disabled:opacity-50 min-h-[44px]">
            <Send className="w-3.5 h-3.5" />{mutation.isPending ? 'Sending…' : 'Send to Client'}
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
        <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/8 p-3">
          <Trash2 className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-white/60">
            Permanently delete <strong className="text-white">&ldquo;{contract.title}&rdquo;</strong>? This action cannot be undone.
          </p>
        </div>
        {mutation.isError && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{apiErrMsg(mutation.error, 'Failed to delete contract')}
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white transition-colors text-sm min-h-[44px]">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
            className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors text-sm disabled:opacity-50 min-h-[44px]">
            {mutation.isPending ? 'Deleting…' : 'Delete Contract'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Accept / Reject Confirm Modals ─────────────────────────────────────────

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
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-3">
          <p className="text-sm text-emerald-300">
            By accepting, you agree to the terms in <strong>&ldquo;{contract.title}&rdquo;</strong>.
            A signed copy will be stored securely.
          </p>
        </div>
        {mutation.isError && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{apiErrMsg(mutation.error, 'Failed to accept contract')}
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white transition-colors text-sm min-h-[44px]">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#fbbf24] text-black font-semibold hover:bg-[#f59e0b] transition-colors text-sm disabled:opacity-50 min-h-[44px]">
            <FileSignature className="w-4 h-4" />{mutation.isPending ? 'Accepting…' : 'Accept Contract'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

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
        <p className="text-sm text-white/60">
          Reject <strong className="text-white">&ldquo;{contract.title}&rdquo;</strong>?
          The account team will be notified and can send a revised version.
        </p>
        {mutation.isError && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{apiErrMsg(mutation.error, 'Failed to reject contract')}
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white transition-colors text-sm min-h-[44px]">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
            className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors text-sm disabled:opacity-50 min-h-[44px]">
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
  const router = useRouter();

  const [searchInput,  setSearchInput]  = useState('');
  const [statusFilter, setStatusFilter] = useState<ContractStatus | 'ALL'>('ALL');
  const [page,         setPage]         = useState(1);
  const search = useDebounce(searchInput, 300);
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
    page, limit: 10,
    ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
    ...(search ? { search } : {}),
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['erp-contracts', params],
    queryFn:  () => contractsApi.getContracts(params).then(r => r.data.data as PaginatedContracts),
    staleTime: 30_000, retry: 1, refetchOnWindowFocus: false, enabled: !!user,
    placeholderData: (prev) => prev,
  });

  const { data: clientsData, isLoading: clientsLoading } = useQuery({
    queryKey: ['erp-clients-for-contracts'],
    queryFn:  () => clientsApi.getClients({ limit: 50 }).then(r => r.data.data.clients as Client[]),
    staleTime: 120_000, retry: 1, refetchOnWindowFocus: false, enabled: !!user,
  });
  const clients = clientsData ?? [];

  const makeStatQ = (status: ContractStatus) => ({
    queryKey: ['erp-contracts-stat', status],
    queryFn:  () => contractsApi.getContracts({ limit: 1, status }).then(r => (r.data.data as PaginatedContracts).total),
    staleTime: 120_000, retry: 1, refetchOnWindowFocus: false, enabled: !!user,
  });
  const { data: draftCount    = 0 } = useQuery(makeStatQ('DRAFT'));
  const { data: sentCount     = 0 } = useQuery(makeStatQ('SENT'));
  const { data: signedCount   = 0 } = useQuery(makeStatQ('SIGNED'));
  const { data: rejectedCount = 0 } = useQuery(makeStatQ('REJECTED'));
  const stats = {
    total:    data?.total ?? 0,
    draft:    draftCount,
    sent:     sentCount,
    signed:   signedCount,
    rejected: rejectedCount,
  };

  const contracts = data?.contracts ?? [];
  const total     = data?.total ?? 0;
  const pages     = data?.pages ?? 1;

  // ─── Table columns ─────────────────────────────────────────────────────────
  const columns: Column<Contract>[] = [
    {
      key: 'title',
      header: 'Contract',
      cell: (c) => (
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn('flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold ring-2 ring-black/20', getAvatarColor(c.title))}>
            {getInitials(c.title)}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-white truncate text-sm">{c.title}</p>
            <p className="text-[11px] text-white/35 truncate mt-0.5 flex items-center gap-1">
              <Briefcase className="inline w-3 h-3" />{c.client?.user?.name ?? 'Unknown Client'}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (c) => {
        const StatusIcon = STATUS_ICON[c.status] ?? FilePenLine;
        return (
          <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border', STATUS_BADGE[c.status])}>
            <StatusIcon className="w-3 h-3" />{c.status}
          </span>
        );
      },
    },
    {
      key: 'owner',
      header: 'Owner',
      hideOnMobile: true,
      cell: (c) => (
        <span className="flex items-center gap-1.5 text-white/50 text-xs whitespace-nowrap">
          <User className="w-3 h-3" /> {c.owner?.name ?? 'Unassigned'}
        </span>
      ),
    },
    {
      key: 'sentAt',
      header: 'Sent',
      hideOnMobile: true,
      cell: (c) => (
        c.sentAt
          ? <span className="text-white/50 text-xs whitespace-nowrap">{formatDate(c.sentAt)}</span>
          : <span className="text-white/20 text-xs">—</span>
      ),
    },
    {
      key: 'signedAt',
      header: 'Signed',
      hideOnMobile: true,
      cell: (c) => (
        c.signedAt
          ? <span className="flex items-center gap-1 text-emerald-400/70 text-xs whitespace-nowrap"><CheckCircle2 className="w-3 h-3" />{formatDate(c.signedAt)}</span>
          : <span className="text-white/20 text-xs">—</span>
      ),
    },
  ];

  const rowActions: RowAction<Contract>[] = [
    {
      label: 'Edit Contract', icon: Pencil,
      onClick: (c) => setEditContract(c),
      show: (c) => (isAdmin || isEmployee) && c.status === 'DRAFT',
    },
    {
      label: 'Send to Client', icon: Send,
      onClick: (c) => setSendContract(c),
      show: (c) => (isAdmin || isEmployee) && c.status === 'DRAFT',
    },
    {
      label: 'Accept', icon: CheckCircle2,
      onClick: (c) => setAcceptContract(c),
      show: (c) => isClient && c.status === 'SENT',
    },
    {
      label: 'Reject', icon: XCircle,
      onClick: (c) => setRejectContract(c),
      show: (c) => isClient && c.status === 'SENT',
    },
    {
      label: 'Delete', icon: Trash2, danger: true,
      onClick: (c) => setDeleteContract(c),
      show: (c) => isAdmin && c.status === 'DRAFT',
    },
  ];

  if (!mounted) return null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20">
              <FileText className="w-4.5 h-4.5 text-blue-400" />
            </span>
            Contracts
          </h1>
          <p className="text-sm text-white/30 mt-1 ml-11">
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {[
          { label: 'Total',    value: stats.total,    color: 'text-white',        border: 'border-white/10',       bg: 'bg-white/[0.03]'  },
          { label: 'Draft',    value: stats.draft,    color: 'text-white/50',     border: 'border-white/10',       bg: 'bg-white/[0.03]'  },
          { label: 'Sent',     value: stats.sent,     color: 'text-amber-400',    border: 'border-amber-500/20',   bg: 'bg-amber-500/5'   },
          { label: 'Signed',   value: stats.signed,   color: 'text-emerald-400',  border: 'border-emerald-500/20', bg: 'bg-emerald-500/5' },
          { label: 'Rejected', value: stats.rejected, color: 'text-red-400',      border: 'border-red-500/20',     bg: 'bg-red-500/5'     },
        ].map(s => (
          <div key={s.label} className={cn('rounded-xl border p-3 text-center', s.border, s.bg)}>
            <p className={cn('text-xl font-bold', s.color)}>{s.value}</p>
            <p className="text-[10px] text-white/25 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
          <input type="text" placeholder="Search contracts…" value={searchInput}
            onChange={(e) => { setSearchInput(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-sm text-white placeholder-white/20 outline-none focus:border-[#fbbf24]/50 focus:bg-white/[0.06] transition-all min-h-[44px]" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map(f => (
            <button key={f.value} onClick={() => { setStatusFilter(f.value); setPage(1); }}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all min-h-[44px] sm:min-h-0',
                statusFilter === f.value ? 'bg-[#fbbf24] border-[#fbbf24] text-black' : 'border-white/10 bg-white/[0.03] text-white/40 hover:text-white hover:border-white/20')}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <TableSkeleton cols={5} rows={6} />
      ) : isError ? (
        <div className="flex flex-col items-center py-20 gap-4">
          <AlertCircle className="w-10 h-10 text-red-400/40" />
          <p className="text-white/30 text-sm">Failed to load contracts.</p>
          <button onClick={() => refetch()} className="px-4 py-2 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-sm text-white/50 transition-colors">Retry</button>
        </div>
      ) : contracts.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03]">
            <FileText className="w-8 h-8 text-white/15" />
          </div>
          <div className="text-center">
            <p className="text-white/40 text-sm font-medium">
              {isClient ? 'No contracts found for your account.' : 'No contracts found. Create your first contract.'}
            </p>
          </div>
          {(isAdmin || isEmployee) && (
            <button onClick={() => setCreateOpen(true)}
              className="px-4 py-2 rounded-xl bg-[#fbbf24]/10 border border-[#fbbf24]/20 text-[#fbbf24] text-sm font-semibold hover:bg-[#fbbf24]/20 transition-colors">
              + New Contract
            </button>
          )}
        </div>
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={contracts}
            rowKey={(c) => c.id}
            onRowClick={(c) => router.push(`/erp/contracts/${c.id}`)}
            actions={rowActions}
          />
          {pages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-white/30">{total} contracts · page {page} of {pages}</p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/40 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all" aria-label="Previous page">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(5, pages) }, (_, i) => {
                  const start = Math.max(1, Math.min(page - 2, pages - 4));
                  const p = start + i;
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-lg border text-sm transition-all',
                        p === page
                          ? 'border-[#fbbf24]/40 bg-[#fbbf24]/10 text-[#fbbf24] font-semibold'
                          : 'border-white/10 text-white/40 hover:text-white hover:border-white/20',
                      )}
                    >{p}</button>
                  );
                })}
                <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/40 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all" aria-label="Next page">
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
