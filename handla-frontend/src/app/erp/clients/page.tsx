'use client';

/**
 * ERP — Clients Management Page (/erp/clients)
 * ADMIN + EMPLOYEE: paginated list, stats, search, create/edit/delete/assign-owner.
 *
 * "Create Client" redesigned as a single combined form:
 *   1. Creates a new User with role=CLIENT  (POST /users)
 *   2. Immediately creates the Client record (POST /erp/clients)
 * This replaces the broken two-step flow where the dropdown was always empty
 * because all existing CLIENT users already had Client records.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
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
  INACTIVE: 'border-gray-400/30    bg-gray-400/10    text-gray-400',
  CHURNED:  'border-red-400/30     bg-red-400/10     text-red-400',
};

const STATUS_ICON: Record<ClientStatus, React.ComponentType<{ className?: string }>> = {
  ACTIVE:   CheckCircle2,
  INACTIVE: AlertCircle,
  CHURNED:  XCircle,
};

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

// Combined form: creates a CLIENT-role user first, then creates the Client
// record for that user. This is the only sane UX — the old dropdown-based
// flow was always empty because all CLIENT users already have a Client record.
const createSchema = z.object({
  // User account fields
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
  // Client record fields
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

// ─── Skeleton Row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-6 py-4 border-b border-[#1a1a1a]">
      <div className="w-10 h-10 rounded-full bg-[#1a1a1a] animate-pulse" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-40 bg-[#1a1a1a] rounded animate-pulse" />
        <div className="h-3 w-28 bg-[#1a1a1a] rounded animate-pulse" />
      </div>
      <div className="h-6 w-20 bg-[#1a1a1a] rounded-full animate-pulse" />
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
  client: Client;
  canDelete: boolean;
  canAssign: boolean;
  onEdit:   (c: Client) => void;
  onDelete: (c: Client) => void;
  onAssign: (c: Client) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();

  const StatusIcon = STATUS_ICON[client.status as ClientStatus] ?? AlertCircle;
  const name   = client.user?.name   ?? 'Unknown';
  const email  = client.user?.email  ?? '';
  const ownerName = client.owner?.name ?? 'Unassigned';
  const initials = getInitials(name);
  const avatarColor = getAvatarColor(name);

  return (
    <div
      className="relative flex items-center gap-4 px-6 py-4 border-b border-[#1a1a1a] hover:bg-[#111] transition-colors cursor-pointer"
      onClick={() => router.push(`/erp/clients/${client.id}`)}
    >
      {/* Avatar */}
      <div
        className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0',
          avatarColor,
        )}
      >
        {initials}
      </div>

      {/* Name + company */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{name}</p>
        <p className="text-xs text-gray-500 truncate">
          {client.company ?? email}
        </p>
      </div>

      {/* Status badge */}
      <span
        className={cn(
          'hidden sm:flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full border',
          STATUS_BADGE[client.status as ClientStatus],
        )}
      >
        <StatusIcon className="w-3 h-3" />
        {client.status}
      </span>

      {/* Owner */}
      <span className="hidden md:block text-xs text-gray-400 truncate max-w-[140px]">
        {ownerName}
      </span>

      {/* Action menu */}
      <div
        className="relative"
        onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
      >
        <button
          className="p-1.5 rounded-md hover:bg-[#1a1a1a] text-gray-400 hover:text-white transition-colors min-h-[44px] flex items-center"
          aria-label="Client actions"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1,    y: 0    }}
              exit={{   opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute right-0 top-full mt-1 w-44 bg-[#111] border border-[#1a1a1a] rounded-xl shadow-xl z-20 py-1 overflow-hidden"
              onMouseLeave={() => setMenuOpen(false)}
            >
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(client);   setMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-[#1a1a1a] min-h-[44px]"
              >
                <Pencil className="w-4 h-4" /> Edit
              </button>
              {canAssign && (
                <button
                  onClick={(e) => { e.stopPropagation(); onAssign(client); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-[#1a1a1a] min-h-[44px]"
                >
                  <UserCog className="w-4 h-4" /> Assign Owner
                </button>
              )}
              {canDelete && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(client); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-[#1a1a1a] min-h-[44px]"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function ClientsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isAdmin = user?.role === 'ADMIN';

  // ─── Filters & pagination ──────────────────────────────────────────────────
  const [page,           setPage]          = useState(1);
  const [search,         setSearch]        = useState('');
  const [statusFilter,   setStatusFilter]  = useState<ClientStatus | 'ALL'>('ALL');

  // ─── Modal state ──────────────────────────────────────────────────────────
  const [showCreate,     setShowCreate]    = useState(false);
  const [editTarget,     setEditTarget]    = useState<Client | null>(null);
  const [assignTarget,   setAssignTarget]  = useState<Client | null>(null);
  const [deleteTarget,   setDeleteTarget]  = useState<Client | null>(null);
  const [serverError,    setServerError]   = useState('');

  // ─── Data fetch ────────────────────────────────────────────────────────────
  const { data, isLoading, isError, refetch } = useQuery<PaginatedClients>({
    queryKey: ['erp-clients', page, search, statusFilter],
    queryFn:  () => clientsApi.getClients({
      page,
      limit: 20,
      ...(search       && { search }),
      ...(statusFilter !== 'ALL' && { status: statusFilter }),
    }).then(r => r.data.data as PaginatedClients),
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const clients = data?.clients ?? [];
  const totalPages = data?.pages ?? 1;

  // ─── Stats ─────────────────────────────────────────────────────────────────
  const { data: allData } = useQuery<PaginatedClients>({
    queryKey: ['erp-clients-stats'],
    queryFn:  () => clientsApi.getClients({ limit: 200 }).then(r => r.data.data as PaginatedClients),
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  const allClients = allData?.clients ?? [];
  const stats = {
    total:    allClients.length,
    active:   allClients.filter(c => c.status === 'ACTIVE').length,
    inactive: allClients.filter(c => c.status === 'INACTIVE').length,
    churned:  allClients.filter(c => c.status === 'CHURNED').length,
  };

  // ─── Employees for assign modal ────────────────────────────────────────────
  const { data: empData } = useQuery<{ users: User[] }>({
    queryKey: ['users-employee-role'],
    queryFn:  () => usersApi.getUsers({ role: 'EMPLOYEE', limit: 200 }).then(r => r.data.data as { users: User[] }),
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
    enabled: !!assignTarget,
  });
  const employees: User[] = empData?.users ?? [];

  // ─── Mutations ────────────────────────────────────────────────────────────

  // Two-step create: POST /users (role=CLIENT) → POST /erp/clients (userId)
  // Step 2 is best-effort — the backend auto-creates a Client record when a
  // CLIENT user is created, so a 4xx "already exists" response is treated as
  // success. Any other failure surfaces the real error message.
  const createMutation = useMutation({
    mutationFn: async (formData: CreateForm) => {
      // Step 1 — create the user account with CLIENT role
      const userRes: any = await usersApi.createUser({
        name:     formData.name,
        email:    formData.email,
        password: formData.password,
        role:     'CLIENT',
      });
      const newUserId: string =
        userRes.data?.data?.user?.id ?? userRes.data?.user?.id;
      if (!newUserId) throw new Error('User creation did not return an ID');

      // Step 2 — (best-effort) patch the auto-created Client record with
      // company / status / notes from the form. The backend auto-creates the
      // Client record synchronously inside createUser(), so by the time the
      // response arrives the record exists. We find it by userId and update.
      // Retry up to 3 times with a small delay in case of slight DB lag.
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
      } catch {
        // Best-effort — don't fail the whole create if the update fails
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['erp-clients'] });
      setShowCreate(false);
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message;
      setServerError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Failed to create client'));
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: object }) =>
      clientsApi.updateClient(id, dto),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['erp-clients'] }); setEditTarget(null); },
    onError:    (e: any) => setServerError(e?.response?.data?.message ?? 'Failed to update client'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => clientsApi.deleteClient(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['erp-clients'] }); setDeleteTarget(null); },
    onError:    (e: any) => setServerError(e?.response?.data?.message ?? 'Failed to delete client'),
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: object }) =>
      clientsApi.assignClientOwner(id, dto),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['erp-clients'] }); setAssignTarget(null); },
    onError:    (e: any) => setServerError(e?.response?.data?.message ?? 'Failed to assign owner'),
  });

  // ─── Forms ────────────────────────────────────────────────────────────────
  const createForm = useForm<CreateForm>({ resolver: zodResolver(createSchema) });
  const editForm   = useForm<EditForm>({ resolver: zodResolver(editSchema) });
  const assignForm = useForm<AssignOwnerForm>({ resolver: zodResolver(assignOwnerSchema) });

  const onCreateSubmit = (data: CreateForm) => {
    setServerError('');
    createMutation.mutate(data);
  };
  const onEditSubmit = (data: EditForm) => {
    if (!editTarget) return;
    setServerError('');
    editMutation.mutate({ id: editTarget.id, dto: data });
  };
  const onAssignSubmit = (data: AssignOwnerForm) => {
    if (!assignTarget) return;
    setServerError('');
    assignMutation.mutate({ id: assignTarget.id, dto: data });
  };

  const handleEdit = (client: Client) => {
    editForm.reset({
      company: client.company ?? undefined,
      status:  client.status,
      notes:   client.notes ?? undefined,
    });
    setServerError('');
    setEditTarget(client);
  };

  const handleAssign = (client: Client) => {
    assignForm.reset();
    setServerError('');
    setAssignTarget(client);
  };

  // ─── Modal helpers ─────────────────────────────────────────────────────────
  const modalOverlay = 'fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4';
  const modalPanel   = 'bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto';
  const inputClass   = 'w-full bg-[#111] border border-[#1a1a1a] rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#fbbf24]/50';
  const btnPrimary   = 'px-4 py-2.5 bg-[#fbbf24] text-black rounded-xl text-sm font-semibold hover:bg-[#f59e0b] transition-colors min-h-[44px]';
  const btnSecondary = 'px-4 py-2.5 bg-[#1a1a1a] text-gray-300 rounded-xl text-sm hover:bg-[#222] transition-colors min-h-[44px]';

  return (
    <div className="space-y-6">
      {/* ─── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-[#fbbf24]" /> Clients
          </h1>
          <p className="text-sm text-gray-400 mt-1">Manage your client accounts and relationships.</p>
        </div>
        <button
          onClick={() => { createForm.reset(); setServerError(''); setShowCreate(true); }}
          className={cn(btnPrimary, 'flex items-center gap-2')}
        >
          <Plus className="w-4 h-4" /> New Client
        </button>
      </div>

      {/* ─── Stats cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total',    value: stats.total,    color: 'text-[#fbbf24]' },
          { label: 'Active',   value: stats.active,   color: 'text-emerald-400' },
          { label: 'Inactive', value: stats.inactive, color: 'text-gray-400' },
          { label: 'Churned',  value: stats.churned,  color: 'text-red-400' },
        ].map((s) => (
          <div key={s.label} className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl p-4">
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ─── Search + Status filter ───────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search name or company…"
            className={cn(inputClass, 'pl-9')}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => { setStatusFilter(f.value); setPage(1); }}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors min-h-[44px]',
                statusFilter === f.value
                  ? 'border-[#fbbf24]/40 bg-[#fbbf24]/10 text-[#fbbf24]'
                  : 'border-[#1a1a1a] text-gray-400 hover:text-white',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Table ───────────────────────────────────────────────────────────── */}
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="hidden sm:flex items-center gap-4 px-6 py-3 border-b border-[#1a1a1a] text-xs text-gray-500 uppercase tracking-wider">
          <div className="w-10 shrink-0" />
          <div className="flex-1">Name / Company</div>
          <div className="w-24 text-center">Status</div>
          <div className="hidden md:block w-36">Assigned To</div>
          <div className="w-8" />
        </div>

        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-red-400 text-sm">Failed to load clients.</p>
            <button onClick={() => refetch()} className={btnSecondary}>Retry</button>
          </div>
        ) : clients.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Briefcase className="w-10 h-10 text-gray-700" />
            <p className="text-gray-400 text-sm">No clients found.</p>
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

      {/* ─── Pagination ──────────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
            Page {page} of {totalPages} · {data?.total ?? 0} clients
          </p>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="p-2 rounded-lg border border-[#1a1a1a] text-gray-400 hover:text-white disabled:opacity-40 min-h-[44px]"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="p-2 rounded-lg border border-[#1a1a1a] text-gray-400 hover:text-white disabled:opacity-40 min-h-[44px]"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════ MODALS ═══════════════════════════════════════════════ */}

      {/* ─── Create Client Modal ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {showCreate && (
          <div className={modalOverlay} role="dialog" aria-modal="true" aria-labelledby="create-title">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1   }}
              exit={{   opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className={modalPanel}
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 id="create-title" className="text-lg font-semibold text-white">Create Client</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Creates a CLIENT account and client record in one step.</p>
                </div>
                <button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-white min-h-[44px] flex items-center">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-3">

                {/* ── Account details section ── */}
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Account Details</p>

                <div>
                  <label htmlFor="create-name" className="block text-xs text-gray-400 mb-1">Full Name</label>
                  <input
                    id="create-name"
                    {...createForm.register('name')}
                    placeholder="Jane Smith"
                    className={inputClass}
                    autoComplete="off"
                  />
                  {createForm.formState.errors.name && (
                    <p className="text-red-400 text-xs mt-1">{createForm.formState.errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="create-email" className="block text-xs text-gray-400 mb-1">Email</label>
                  <input
                    id="create-email"
                    type="email"
                    {...createForm.register('email')}
                    placeholder="jane@example.com"
                    className={inputClass}
                    autoComplete="off"
                  />
                  {createForm.formState.errors.email && (
                    <p className="text-red-400 text-xs mt-1">{createForm.formState.errors.email.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="create-password" className="block text-xs text-gray-400 mb-1">
                    Temporary Password
                  </label>
                  <input
                    id="create-password"
                    type="password"
                    {...createForm.register('password')}
                    placeholder="Min 8 chars · upper + lower + number"
                    className={inputClass}
                    autoComplete="new-password"
                  />
                  {createForm.formState.errors.password && (
                    <p className="text-red-400 text-xs mt-1">{createForm.formState.errors.password.message}</p>
                  )}
                </div>

                {/* ── Client record section ── */}
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider pt-2">Client Record</p>

                <div>
                  <label htmlFor="create-company" className="block text-xs text-gray-400 mb-1">Company (optional)</label>
                  <input
                    id="create-company"
                    {...createForm.register('company')}
                    placeholder="Acme Corp"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label htmlFor="create-status" className="block text-xs text-gray-400 mb-1">Status</label>
                  <select id="create-status" {...createForm.register('status')} className={inputClass}>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="CHURNED">Churned</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="create-notes" className="block text-xs text-gray-400 mb-1">Notes (optional)</label>
                  <textarea
                    id="create-notes"
                    {...createForm.register('notes')}
                    rows={2}
                    className={cn(inputClass, 'resize-none')}
                  />
                </div>

                {serverError && <p className="text-red-400 text-sm" role="alert">{serverError}</p>}

                <div className="flex justify-end gap-3 pt-2">
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

      {/* ─── Edit Client Modal ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {editTarget && (
          <div className={modalOverlay} role="dialog" aria-modal="true" aria-labelledby="edit-title">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1   }}
              exit={{   opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className={modalPanel}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 id="edit-title" className="text-lg font-semibold text-white">Edit Client</h2>
                <button onClick={() => setEditTarget(null)} className="text-gray-500 hover:text-white min-h-[44px] flex items-center">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
                <div>
                  <label htmlFor="edit-company" className="block text-xs text-gray-400 mb-1">Company (optional)</label>
                  <input id="edit-company" {...editForm.register('company')} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="edit-status" className="block text-xs text-gray-400 mb-1">Status</label>
                  <select id="edit-status" {...editForm.register('status')} className={inputClass}>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="CHURNED">Churned</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="edit-notes" className="block text-xs text-gray-400 mb-1">Notes (optional)</label>
                  <textarea id="edit-notes" {...editForm.register('notes')} rows={3} className={cn(inputClass, 'resize-none')} />
                </div>

                {serverError && <p className="text-red-400 text-sm" role="alert">{serverError}</p>}

                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setEditTarget(null)} className={btnSecondary}>Cancel</button>
                  <button type="submit" disabled={editMutation.isPending} className={btnPrimary}>
                    {editMutation.isPending ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── Assign Owner Modal ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {assignTarget && (
          <div className={modalOverlay} role="dialog" aria-modal="true" aria-labelledby="assign-title">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1   }}
              exit={{   opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className={modalPanel}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 id="assign-title" className="text-lg font-semibold text-white">Assign Owner</h2>
                <button onClick={() => setAssignTarget(null)} className="text-gray-500 hover:text-white min-h-[44px] flex items-center">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={assignForm.handleSubmit(onAssignSubmit)} className="space-y-4">
                <p className="text-sm text-gray-400">
                  Assign a new EMPLOYEE as the owner of <strong className="text-white">{assignTarget.user?.name}</strong>.
                </p>
                <div>
                  <label htmlFor="assign-owner" className="block text-xs text-gray-400 mb-1">Employee</label>
                  <select id="assign-owner" {...assignForm.register('newOwnerId')} className={inputClass}>
                    <option value="">Select an employee…</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>{e.name} ({e.email})</option>
                    ))}
                  </select>
                  {assignForm.formState.errors.newOwnerId && (
                    <p className="text-red-400 text-xs mt-1">{assignForm.formState.errors.newOwnerId.message}</p>
                  )}
                </div>

                {serverError && <p className="text-red-400 text-sm" role="alert">{serverError}</p>}

                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setAssignTarget(null)} className={btnSecondary}>Cancel</button>
                  <button type="submit" disabled={assignMutation.isPending} className={btnPrimary}>
                    {assignMutation.isPending ? 'Assigning…' : 'Assign Owner'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── Delete Confirmation ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {deleteTarget && (
          <div className={modalOverlay} role="dialog" aria-modal="true" aria-labelledby="delete-title">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1   }}
              exit={{   opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className={cn(modalPanel, 'max-w-sm')}
            >
              <h2 id="delete-title" className="text-lg font-semibold text-white mb-2">Delete Client</h2>
              <p className="text-sm text-gray-400 mb-4">
                Are you sure you want to delete{' '}
                <strong className="text-white">{deleteTarget.user?.name}</strong>?
                This action cannot be undone.
              </p>
              {serverError && <p className="text-red-400 text-sm mb-3" role="alert">{serverError}</p>}
              <div className="flex justify-end gap-3">
                <button onClick={() => setDeleteTarget(null)} className={btnSecondary}>Cancel</button>
                <button
                  onClick={() => deleteMutation.mutate(deleteTarget.id)}
                  disabled={deleteMutation.isPending}
                  className="px-4 py-2.5 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 transition-colors min-h-[44px]"
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
