'use client';

/**
 * ERP — Clients Management Page (/erp/clients)
 * Enhanced premium UI
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropdown, DropdownPortal } from '@/components/ui/DropdownPortal';
import {
  Briefcase,
  Search,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  UserCog,
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Users,
  TrendingDown,
  ArrowUpRight,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { clientsApi, usersApi } from '@/lib/api';
import { cn, getInitials, getAvatarColor } from '@/lib/utils';
import type { Client, PaginatedClients, User } from '@/types';

// ─── Types ─────────────────────────────────────────────────────────────────────

type ClientStatus = 'ACTIVE' | 'INACTIVE' | 'CHURNED';

// ─── Constants ─────────────────────────────────────────────────────────────────

const STATUS_FILTERS: { label: string; value: ClientStatus | 'ALL' }[] = [
  { label: 'All',      value: 'ALL'      },
  { label: 'Active',   value: 'ACTIVE'   },
  { label: 'Inactive', value: 'INACTIVE' },
  { label: 'Churned',  value: 'CHURNED'  },
];

const STATUS_BADGE: Record<ClientStatus, string> = {
  ACTIVE:   'border-emerald-400/30 bg-emerald-400/10 text-emerald-400',
  INACTIVE: 'border-white/20       bg-white/5         text-white/50',
  CHURNED:  'border-red-400/30     bg-red-400/10      text-red-400',
};

const STATUS_ICON: Record<ClientStatus, React.ComponentType<{ className?: string }>> = {
  ACTIVE:   CheckCircle2,
  INACTIVE: AlertCircle,
  CHURNED:  XCircle,
};

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const createSchema = z.object({
  name:     z.string().min(2, 'Name must be at least 2 characters').max(100),
  email:    z.string().email('Valid email required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(64)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Must contain uppercase, lowercase and a number',
    ),
  company:  z.string().max(255).optional(),
  status:   z.enum(['ACTIVE', 'INACTIVE', 'CHURNED'] as const).optional(),
  notes:    z.string().optional(),
});
type CreateForm = z.infer<typeof createSchema>;

const editSchema = z.object({
  company: z.string().max(255).optional(),
  status:  z.enum(['ACTIVE', 'INACTIVE', 'CHURNED'] as const).optional(),
  notes:   z.string().optional(),
});
type EditForm = z.infer<typeof editSchema>;

const assignOwnerSchema = z.object({ newOwnerId: z.string().uuid('Valid employee UUID required') });
type AssignOwnerForm = z.infer<typeof assignOwnerSchema>;

// ─── Shared styles ─────────────────────────────────────────────────────────────

const inputCls = 'w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#fbbf24]/50 focus:bg-white/[0.06] transition-all';
const btnPrimary   = 'px-4 py-2.5 bg-[#fbbf24] text-black rounded-xl text-sm font-semibold hover:bg-[#f59e0b] transition-colors min-h-[44px] disabled:opacity-50';
const btnSecondary = 'px-4 py-2.5 bg-white/[0.06] border border-white/10 text-white/70 rounded-xl text-sm hover:bg-white/[0.10] hover:text-white transition-colors min-h-[44px]';
const modalOverlay = 'fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4';
const modalPanel   = 'bg-[#111] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto';

// ─── Skeleton Row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-6 py-4 border-b border-white/[0.05]">
      <div className="w-10 h-10 rounded-full bg-white/[0.06] animate-pulse" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-40 bg-white/[0.06] rounded-lg animate-pulse" />
        <div className="h-3 w-28 bg-white/[0.04] rounded-lg animate-pulse" />
      </div>
      <div className="h-6 w-20 bg-white/[0.06] rounded-full animate-pulse" />
    </div>
  );
}

// ─── ClientCard ───────────────────────────────────────────────────────────────

function ClientCard({
  client,
  canDelete,
  canAssign,
  onEdit,
  onDelete,
  onAssign,
}: {
  client:    Client;
  canDelete: boolean;
  canAssign: boolean;
  onEdit:    (c: Client) => void;
  onDelete:  (c: Client) => void;
  onAssign:  (c: Client) => void;
}) {
  const menu   = useDropdown('right');
  const router  = useRouter();

  const StatusIcon = STATUS_ICON[client.status as ClientStatus] ?? AlertCircle;
  const name       = client.user?.name ?? 'Unknown';
  const email      = client.user?.email ?? '';
  const ownerName  = client.owner?.name ?? 'Unassigned';
  const initials   = getInitials(name);
  const avatarColor= getAvatarColor(name);

  return (
    <div
      className="group relative flex items-center gap-4 px-5 py-3.5 border-b border-white/[0.05] hover:bg-white/[0.03] transition-colors cursor-pointer"
      onClick={() => router.push(`/erp/clients/${client.id}`)}
    >
      {/* Avatar */}
      <div className={cn(
        'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ring-2 ring-black/30',
        avatarColor,
      )}>
        {initials}
      </div>

      {/* Name + company */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-white truncate">{name}</p>
          <ArrowUpRight className="h-3 w-3 text-white/20 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        </div>
        <p className="text-xs text-white/30 truncate">
          {client.company ?? email}
        </p>
      </div>

      {/* Status badge */}
      <span className={cn(
        'hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-full border flex-shrink-0',
        STATUS_BADGE[client.status as ClientStatus],
      )}>
        <StatusIcon className="w-3 h-3" />
        {client.status}
      </span>

      {/* Owner */}
      <span className="hidden md:block text-xs text-white/30 truncate max-w-[140px] flex-shrink-0">
        {ownerName}
      </span>

      {/* Action menu — portal-rendered to escape overflow containers */}
      <div
        ref={menu.triggerRef}
        className="relative flex-shrink-0"
        onClick={(e) => { e.stopPropagation(); menu.toggle(); }}
      >
        <button
          className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 hover:bg-white/10 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
          aria-label="Client actions"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        <DropdownPortal isOpen={menu.isOpen} style={menu.dropdownStyle} onClose={menu.close}>
          <div className="rounded-xl border border-white/10 bg-[#161616] shadow-2xl py-1.5 overflow-hidden">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(client); menu.close(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors min-h-[40px]"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
            {canAssign && (
              <button
                onClick={(e) => { e.stopPropagation(); onAssign(client); menu.close(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors min-h-[40px]"
              >
                <UserCog className="w-3.5 h-3.5" /> Assign Owner
              </button>
            )}
            {canDelete && (
              <>
                <div className="my-1 border-t border-white/[0.06]" />
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(client); menu.close(); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-400/5 transition-colors min-h-[40px]"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </>
            )}
          </div>
        </DropdownPortal>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function ClientsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isAdmin = user?.role === 'ADMIN';

  const [page,         setPage]         = useState(1);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState<ClientStatus | 'ALL'>('ALL');
  const [showCreate,   setShowCreate]   = useState(false);
  const [editTarget,   setEditTarget]   = useState<Client | null>(null);
  const [assignTarget, setAssignTarget] = useState<Client | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [serverError,  setServerError]  = useState('');

  // ─── Data fetch ────────────────────────────────────────────────────────────
  const { data, isLoading, isError, refetch } = useQuery<PaginatedClients>({
    queryKey: ['erp-clients', page, search, statusFilter],
    queryFn:  () => clientsApi.getClients({
      page, limit: 20,
      ...(search                    && { search }),
      ...(statusFilter !== 'ALL'    && { status: statusFilter }),
    }).then(r => r.data.data as PaginatedClients),
    staleTime: 30_000, retry: 1, refetchOnWindowFocus: false,
  });

  const clients    = data?.clients   ?? [];
  const totalPages = data?.pages     ?? 1;

  // Stats query
  const { data: allData } = useQuery<PaginatedClients>({
    queryKey: ['erp-clients-stats'],
    queryFn:  () => clientsApi.getClients({ limit: 200 }).then(r => r.data.data as PaginatedClients),
    staleTime: 60_000, retry: 1, refetchOnWindowFocus: false,
  });
  const allClients = allData?.clients ?? [];
  const stats = {
    total:    allClients.length,
    active:   allClients.filter(c => c.status === 'ACTIVE').length,
    inactive: allClients.filter(c => c.status === 'INACTIVE').length,
    churned:  allClients.filter(c => c.status === 'CHURNED').length,
  };

  // Employees for assign modal
  const { data: empData } = useQuery<{ users: User[] }>({
    queryKey: ['users-employee-role'],
    queryFn:  () => usersApi.getUsers({ role: 'EMPLOYEE', limit: 200 }).then(r => r.data.data as { users: User[] }),
    staleTime: 60_000, retry: 1, refetchOnWindowFocus: false, enabled: !!assignTarget,
  });
  const employees: User[] = empData?.users ?? [];

  // ─── Mutations ────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async (formData: CreateForm) => {
      const userRes: any = await usersApi.createUser({
        name: formData.name, email: formData.email, password: formData.password, role: 'CLIENT',
      });
      const newUserId: string = userRes.data?.data?.user?.id ?? userRes.data?.user?.id;
      if (!newUserId) throw new Error('User creation did not return an ID');
      try {
        let match: any = null;
        for (let attempt = 0; attempt < 3 && !match; attempt++) {
          if (attempt > 0) await new Promise(res => setTimeout(res, 500));
          const listRes: any = await clientsApi.getClients({ limit: 200 });
          const allClients: any[] = listRes.data?.data?.clients ?? [];
          match = allClients.find((c: any) => c.userId === newUserId);
        }
        if (match && (formData.company || formData.status || formData.notes)) {
          await clientsApi.updateClient(match.id, {
            ...(formData.company && { company: formData.company }),
            ...(formData.status  && { status:  formData.status  }),
            ...(formData.notes   && { notes:   formData.notes   }),
          });
        }
      } catch { /* best-effort */ }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['erp-clients'] }); setShowCreate(false); },
    onError:   (e: any) => {
      const msg = e?.response?.data?.message;
      setServerError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Failed to create client'));
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: object }) => clientsApi.updateClient(id, dto),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['erp-clients'] }); setEditTarget(null); },
    onError:    (e: any) => setServerError(e?.response?.data?.message ?? 'Failed to update client'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => clientsApi.deleteClient(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['erp-clients'] }); setDeleteTarget(null); },
    onError:    (e: any) => setServerError(e?.response?.data?.message ?? 'Failed to delete client'),
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: object }) => clientsApi.assignClientOwner(id, dto),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['erp-clients'] }); setAssignTarget(null); },
    onError:    (e: any) => setServerError(e?.response?.data?.message ?? 'Failed to assign owner'),
  });

  // ─── Forms ────────────────────────────────────────────────────────────────
  const createForm = useForm<CreateForm>({ resolver: zodResolver(createSchema) });
  const editForm   = useForm<EditForm>({ resolver: zodResolver(editSchema) });
  const assignForm = useForm<AssignOwnerForm>({ resolver: zodResolver(assignOwnerSchema) });

  const onCreateSubmit = (data: CreateForm) => { setServerError(''); createMutation.mutate(data); };
  const onEditSubmit   = (data: EditForm)   => { if (!editTarget) return; setServerError(''); editMutation.mutate({ id: editTarget.id, dto: data }); };
  const onAssignSubmit = (data: AssignOwnerForm) => { if (!assignTarget) return; setServerError(''); assignMutation.mutate({ id: assignTarget.id, dto: data }); };

  const handleEdit = (client: Client) => {
    editForm.reset({ company: client.company ?? undefined, status: client.status, notes: client.notes ?? undefined });
    setServerError(''); setEditTarget(client);
  };
  const handleAssign = (client: Client) => { assignForm.reset(); setServerError(''); setAssignTarget(client); };

  return (
    <div className="space-y-5">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#fbbf24]/10 border border-[#fbbf24]/20">
              <Briefcase className="w-4.5 h-4.5 text-[#fbbf24]" />
            </span>
            Clients
          </h1>
          <p className="text-sm text-white/30 mt-1 ml-11">Manage your client accounts and relationships.</p>
        </div>
        <button
          onClick={() => { createForm.reset(); setServerError(''); setShowCreate(true); }}
          className={cn(btnPrimary, 'flex items-center gap-2')}
        >
          <Plus className="w-4 h-4" /> New Client
        </button>
      </div>

      {/* ─── Stats cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total',    value: stats.total,    color: 'text-[#fbbf24]',    border: 'border-[#fbbf24]/15', bg: 'bg-[#fbbf24]/5', icon: Briefcase },
          { label: 'Active',   value: stats.active,   color: 'text-emerald-400',  border: 'border-emerald-500/15', bg: 'bg-emerald-500/5', icon: CheckCircle2 },
          { label: 'Inactive', value: stats.inactive, color: 'text-white/50',     border: 'border-white/10',     bg: 'bg-white/[0.03]', icon: AlertCircle },
          { label: 'Churned',  value: stats.churned,  color: 'text-red-400',      border: 'border-red-500/15',   bg: 'bg-red-500/5',    icon: TrendingDown },
        ].map((s) => (
          <div key={s.label} className={cn('rounded-2xl border p-4 transition-colors', s.border, s.bg)}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-medium text-white/30 uppercase tracking-wide">{s.label}</p>
              <s.icon className={cn('w-3.5 h-3.5', s.color)} />
            </div>
            <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ─── Search + Status filter ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search name or company…"
            className={cn(inputCls, 'pl-10')}
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => { setStatusFilter(f.value); setPage(1); }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all min-h-[44px]',
                statusFilter === f.value
                  ? 'border-[#fbbf24]/40 bg-[#fbbf24]/10 text-[#fbbf24]'
                  : 'border-white/10 bg-white/[0.03] text-white/40 hover:text-white hover:border-white/20',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Table ──────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#0f0f0f] overflow-hidden">
        {/* Table header */}
        <div className="hidden sm:flex items-center gap-4 px-5 py-3 border-b border-white/[0.06] bg-white/[0.02]">
          <div className="w-10 flex-shrink-0" />
          <div className="flex-1 text-[10px] font-semibold uppercase tracking-widest text-white/25">Name / Company</div>
          <div className="w-24 text-center text-[10px] font-semibold uppercase tracking-widest text-white/25">Status</div>
          <div className="hidden md:block w-36 text-[10px] font-semibold uppercase tracking-widest text-white/25">Assigned To</div>
          <div className="w-8" />
        </div>

        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
        ) : isError ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <AlertCircle className="w-10 h-10 text-red-400/50" />
            <p className="text-sm text-white/30">Failed to load clients.</p>
            <button onClick={() => refetch()} className={btnSecondary}>Retry</button>
          </div>
        ) : clients.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03]">
              <Briefcase className="w-6 h-6 text-white/20" />
            </div>
            <div>
              <p className="text-sm font-medium text-white/40">No clients found</p>
              <p className="text-xs text-white/20 mt-1">Try adjusting your search or filters</p>
            </div>
          </div>
        ) : (
          clients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              canDelete={isAdmin}
              canAssign={isAdmin}
              onEdit={handleEdit}
              onDelete={(c) => { setServerError(''); setDeleteTarget(c); }}
              onAssign={handleAssign}
            />
          ))
        )}
      </div>

      {/* ─── Pagination ──────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-white/30">
            Page {page} of {totalPages} · {data?.total ?? 0} clients
          </p>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/40 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/40 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════ MODALS ═══════════════════════════════════════════ */}

      {/* Create Client Modal */}
      <AnimatePresence>
        {showCreate && (
          <div className={modalOverlay} role="dialog" aria-modal="true" aria-labelledby="create-title">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              className={modalPanel}
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 id="create-title" className="text-base font-bold text-white">Create Client</h2>
                  <p className="text-xs text-white/30 mt-0.5">Creates a CLIENT account and client record in one step.</p>
                </div>
                <button onClick={() => setShowCreate(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 hover:bg-white/10 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest">Account Details</p>
                <div>
                  <label htmlFor="create-name" className="block text-xs font-medium text-white/50 mb-1.5">Full Name</label>
                  <input id="create-name" {...createForm.register('name')} placeholder="Jane Smith" className={inputCls} autoComplete="off" />
                  {createForm.formState.errors.name && <p className="text-red-400 text-xs mt-1">{createForm.formState.errors.name.message}</p>}
                </div>
                <div>
                  <label htmlFor="create-email" className="block text-xs font-medium text-white/50 mb-1.5">Email</label>
                  <input id="create-email" type="email" {...createForm.register('email')} placeholder="jane@example.com" className={inputCls} autoComplete="off" />
                  {createForm.formState.errors.email && <p className="text-red-400 text-xs mt-1">{createForm.formState.errors.email.message}</p>}
                </div>
                <div>
                  <label htmlFor="create-password" className="block text-xs font-medium text-white/50 mb-1.5">Temporary Password</label>
                  <input id="create-password" type="password" {...createForm.register('password')} placeholder="Min 8 chars · upper + lower + number" className={inputCls} autoComplete="new-password" />
                  {createForm.formState.errors.password && <p className="text-red-400 text-xs mt-1">{createForm.formState.errors.password.message}</p>}
                </div>

                <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest pt-1">Client Record</p>
                <div>
                  <label htmlFor="create-company" className="block text-xs font-medium text-white/50 mb-1.5">Company (optional)</label>
                  <input id="create-company" {...createForm.register('company')} placeholder="Acme Corp" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="create-status" className="block text-xs font-medium text-white/50 mb-1.5">Status</label>
                  <select id="create-status" {...createForm.register('status')} className={cn(inputCls, 'bg-[#0f0f0f]')}>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="CHURNED">Churned</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="create-notes" className="block text-xs font-medium text-white/50 mb-1.5">Notes (optional)</label>
                  <textarea id="create-notes" {...createForm.register('notes')} rows={2} className={cn(inputCls, 'resize-none')} />
                </div>

                {serverError && <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-400" role="alert"><AlertCircle className="w-4 h-4 flex-shrink-0" />{serverError}</div>}

                <div className="flex justify-end gap-3 pt-1">
                  <button type="button" onClick={() => setShowCreate(false)} className={btnSecondary}>Cancel</button>
                  <button type="submit" disabled={createMutation.isPending} className={btnPrimary}>
                    {createMutation.isPending ? 'Creating…' : 'Create Client'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Client Modal */}
      <AnimatePresence>
        {editTarget && (
          <div className={modalOverlay} role="dialog" aria-modal="true" aria-labelledby="edit-title">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              className={modalPanel}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 id="edit-title" className="text-base font-bold text-white">Edit Client</h2>
                <button onClick={() => setEditTarget(null)} className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 hover:bg-white/10 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
                <div>
                  <label htmlFor="edit-company" className="block text-xs font-medium text-white/50 mb-1.5">Company (optional)</label>
                  <input id="edit-company" {...editForm.register('company')} className={inputCls} />
                </div>
                <div>
                  <label htmlFor="edit-status" className="block text-xs font-medium text-white/50 mb-1.5">Status</label>
                  <select id="edit-status" {...editForm.register('status')} className={cn(inputCls, 'bg-[#0f0f0f]')}>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="CHURNED">Churned</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="edit-notes" className="block text-xs font-medium text-white/50 mb-1.5">Notes (optional)</label>
                  <textarea id="edit-notes" {...editForm.register('notes')} rows={3} className={cn(inputCls, 'resize-none')} />
                </div>
                {serverError && <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-400" role="alert"><AlertCircle className="w-4 h-4 flex-shrink-0" />{serverError}</div>}
                <div className="flex justify-end gap-3 pt-1">
                  <button type="button" onClick={() => setEditTarget(null)} className={btnSecondary}>Cancel</button>
                  <button type="submit" disabled={editMutation.isPending} className={btnPrimary}>{editMutation.isPending ? 'Saving…' : 'Save Changes'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Assign Owner Modal */}
      <AnimatePresence>
        {assignTarget && (
          <div className={modalOverlay} role="dialog" aria-modal="true" aria-labelledby="assign-title">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              className={modalPanel}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 id="assign-title" className="text-base font-bold text-white">Assign Owner</h2>
                <button onClick={() => setAssignTarget(null)} className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 hover:bg-white/10 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={assignForm.handleSubmit(onAssignSubmit)} className="space-y-4">
                <div className="rounded-xl border border-blue-500/20 bg-blue-500/8 p-3">
                  <p className="text-sm text-white/60">
                    Assign a new EMPLOYEE as the owner of <strong className="text-white">{assignTarget.user?.name}</strong>.
                  </p>
                </div>
                <div>
                  <label htmlFor="assign-owner" className="block text-xs font-medium text-white/50 mb-1.5">Employee</label>
                  <select id="assign-owner" {...assignForm.register('newOwnerId')} className={cn(inputCls, 'bg-[#0f0f0f]')}>
                    <option value="">Select an employee…</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.email})</option>)}
                  </select>
                  {assignForm.formState.errors.newOwnerId && <p className="text-red-400 text-xs mt-1">{assignForm.formState.errors.newOwnerId.message}</p>}
                </div>
                {serverError && <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-400" role="alert"><AlertCircle className="w-4 h-4 flex-shrink-0" />{serverError}</div>}
                <div className="flex justify-end gap-3 pt-1">
                  <button type="button" onClick={() => setAssignTarget(null)} className={btnSecondary}>Cancel</button>
                  <button type="submit" disabled={assignMutation.isPending} className={btnPrimary}>{assignMutation.isPending ? 'Assigning…' : 'Assign Owner'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <AnimatePresence>
        {deleteTarget && (
          <div className={modalOverlay} role="dialog" aria-modal="true" aria-labelledby="delete-title">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              className={cn(modalPanel, 'max-w-sm')}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20">
                  <Trash2 className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h2 id="delete-title" className="text-base font-bold text-white">Delete Client</h2>
                  <p className="text-xs text-white/30">This action cannot be undone</p>
                </div>
              </div>
              <p className="text-sm text-white/60 mb-4">
                Are you sure you want to delete <strong className="text-white">{deleteTarget.user?.name}</strong>?
              </p>
              {serverError && <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-400 mb-3" role="alert"><AlertCircle className="w-4 h-4 flex-shrink-0" />{serverError}</div>}
              <div className="flex justify-end gap-3">
                <button onClick={() => setDeleteTarget(null)} className={btnSecondary}>Cancel</button>
                <button
                  onClick={() => deleteMutation.mutate(deleteTarget.id)}
                  disabled={deleteMutation.isPending}
                  className="px-4 py-2.5 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 transition-colors min-h-[44px] disabled:opacity-50"
                >
                  {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
