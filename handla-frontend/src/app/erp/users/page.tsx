'use client';

/**
 * ERP — Users Management Page (/erp/users)
 * ADMIN-only: full CRUD on system users.
 *
 * Features:
 *  - Role-count stats header (ADMIN / EMPLOYEE / CLIENT / LEAD)
 *  - Active / Archived tab switcher
 *  - Search bar + role-filter pills
 *  - UserRow: avatar initials (color-coded by role), name, email, role badge,
 *             disabled badge, action menu
 *  - CreateUserModal  (RHF + Zod)
 *  - ChangeRoleModal
 *  - PromoteLeadDialog
 *  - ReassignOwnershipDialog
 *  - Delete/Archive choice modal — admin chooses between permanent delete or
 *    soft-archive (all records preserved)
 *  - Disable / Enable user toggle (blocks login without touching records)
 *  - Unarchive button in archive view
 *  - Pagination
 *  - Loading skeleton & empty state
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Search,
  Plus,
  MoreVertical,
  Pencil,
  ArrowUpCircle,
  Shuffle,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  Shield,
  UserCheck,
  Briefcase,
  TrendingUp,
  AlertTriangle,
  Archive,
  ArchiveRestore,
  Ban,
  CheckCircle2,
  KeyRound,
  Edit2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usersApi } from '@/lib/api';
import { cn, getInitials, getAvatarColor } from '@/lib/utils';
import type { User } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type UserRole = 'ADMIN' | 'EMPLOYEE' | 'CLIENT' | 'LEAD';

interface PaginatedUsers {
  users:  User[];
  total:  number;
  page:   number;
  pages:  number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_FILTERS: { label: string; value: UserRole | 'ALL' }[] = [
  { label: 'All',      value: 'ALL'      },
  { label: 'Admin',    value: 'ADMIN'    },
  { label: 'Employee', value: 'EMPLOYEE' },
  { label: 'Client',   value: 'CLIENT'   },
  { label: 'Lead',     value: 'LEAD'     },
];

const ROLE_BADGE: Record<UserRole, string> = {
  ADMIN:    'border-[#fbbf24]/30 bg-[#fbbf24]/10 text-[#fbbf24]',
  EMPLOYEE: 'border-blue-400/30 bg-blue-400/10 text-blue-400',
  CLIENT:   'border-emerald-400/30 bg-emerald-400/10 text-emerald-400',
  LEAD:     'border-purple-400/30 bg-purple-400/10 text-purple-400',
};

const ROLE_ICONS: Record<UserRole, React.ComponentType<{ className?: string }>> = {
  ADMIN:    Shield,
  EMPLOYEE: UserCheck,
  CLIENT:   Briefcase,
  LEAD:     TrendingUp,
};

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const createUserSchema = z.object({
  email:    z.string().email('Valid email required'),
  name:     z.string().min(2, 'At least 2 chars').max(100),
  password: z
    .string()
    .min(8, 'At least 8 characters')
    .max(64)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Must include uppercase, lowercase, and a digit',
    ),
  role: z.enum(['ADMIN', 'EMPLOYEE', 'CLIENT', 'LEAD'] as const),
});
type CreateUserForm = z.infer<typeof createUserSchema>;

const changeRoleSchema = z.object({
  role: z.enum(['ADMIN', 'EMPLOYEE', 'CLIENT', 'LEAD'] as const),
});
type ChangeRoleForm = z.infer<typeof changeRoleSchema>;

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Animated modal backdrop + panel */
function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = 'max-w-md',
}: {
  open:      boolean;
  onClose:   () => void;
  title:     string;
  children:  React.ReactNode;
  maxWidth?: string;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            key="panel"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            className={cn(
              'fixed left-1/2 top-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[#2a2a2a] bg-[#111] p-6 shadow-2xl',
              maxWidth,
            )}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1 text-[#555] transition-colors hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/** Small inline form error */
function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-[11px] text-red-400">{msg}</p>;
}

/** Role badge pill */
function RoleBadge({ role }: { role: UserRole }) {
  const Icon = ROLE_ICONS[role];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        ROLE_BADGE[role],
      )}
    >
      <Icon className="h-2.5 w-2.5" />
      {role}
    </span>
  );
}

/** Single user row */
function UserRow({
  user,
  currentUserId,
  isArchiveView,
  onEdit,
  onResetPassword,
  onChangeRole,
  onPromote,
  onReassign,
  onDeleteOrArchive,
  onDisable,
  onEnable,
  onUnarchive,
}: {
  user:              User;
  currentUserId:     string;
  isArchiveView:     boolean;
  onEdit:            (u: User) => void;
  onResetPassword:   (u: User) => void;
  onChangeRole:      (u: User) => void;
  onPromote:         (u: User) => void;
  onReassign:        (u: User) => void;
  onDeleteOrArchive: (u: User) => void;
  onDisable:         (u: User) => void;
  onEnable:          (u: User) => void;
  onUnarchive:       (u: User) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isSelf = user.id === currentUserId;

  return (
    <div className={cn(
      'group flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors',
      user.isArchived
        ? 'border-[#2a1a1a] bg-[#0d0a0a] opacity-75'
        : user.isDisabled
          ? 'border-[#1e1e2a] bg-[#0d0d0f] opacity-80'
          : 'border-[#1e1e1e] bg-[#0d0d0d] hover:border-[#2a2a2a] hover:bg-[#111]',
    )}>
      {/* Avatar */}
      <div
        className={cn(
          'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white',
          getAvatarColor(user.id),
          (user.isDisabled || user.isArchived) && 'opacity-50',
        )}
      >
        {getInitials(user.name)}
      </div>

      {/* Name + email */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium text-white">{user.name}</p>
          {isSelf && (
            <span className="rounded-full border border-[#fbbf24]/20 bg-[#fbbf24]/5 px-1.5 py-0.5 text-[9px] text-[#fbbf24]">
              You
            </span>
          )}
          {user.isArchived && (
            <span className="inline-flex items-center gap-1 rounded-full border border-orange-500/30 bg-orange-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-orange-400">
              <Archive className="h-2.5 w-2.5" /> Archived
            </span>
          )}
          {!user.isArchived && user.isDisabled && (
            <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-red-400">
              <Ban className="h-2.5 w-2.5" /> Disabled
            </span>
          )}
        </div>
        <p className="truncate text-xs text-[#555]">{user.email}</p>
      </div>

      {/* Role badge */}
      <RoleBadge role={user.role as UserRole} />

      {/* Joined date */}
      <p className="hidden text-[10px] text-[#444] sm:block">
        {new Date(user.createdAt).toLocaleDateString('en-GB', {
          day: '2-digit', month: 'short', year: 'numeric',
        })}
      </p>

      {/* Action menu */}
      <div className="relative flex-shrink-0">
        <button
          type="button"
          onClick={() => setMenuOpen(v => !v)}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[#444] transition-colors hover:bg-[#1a1a1a] hover:text-white"
        >
          <MoreVertical className="h-4 w-4" />
        </button>

        <AnimatePresence>
          {menuOpen && (
            <>
              {/* click-away overlay */}
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />

              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1,    y: 0  }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                className="absolute right-0 top-8 z-[9999] min-w-[175px] rounded-xl border border-[#2a2a2a] bg-[#111] py-1 shadow-xl"
              >
                {/* Archive view: only show Restore */}
                {isArchiveView ? (
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); onUnarchive(user); }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-emerald-400 transition-colors hover:bg-emerald-400/5"
                  >
                    <ArchiveRestore className="h-3.5 w-3.5" /> Restore from Archive
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => { setMenuOpen(false); onEdit(user); }}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-[#aaa] transition-colors hover:bg-[#1a1a1a] hover:text-white"
                    >
                      <Edit2 className="h-3.5 w-3.5" /> Edit User
                    </button>

                    <button
                      type="button"
                      onClick={() => { setMenuOpen(false); onResetPassword(user); }}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-[#aaa] transition-colors hover:bg-[#1a1a1a] hover:text-white"
                    >
                      <KeyRound className="h-3.5 w-3.5" /> Reset Password
                    </button>

                    <button
                      type="button"
                      onClick={() => { setMenuOpen(false); onChangeRole(user); }}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-[#aaa] transition-colors hover:bg-[#1a1a1a] hover:text-white"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Change Role
                    </button>

                    {user.role === 'LEAD' && (
                      <button
                        type="button"
                        onClick={() => { setMenuOpen(false); onPromote(user); }}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-purple-400 transition-colors hover:bg-purple-400/5"
                      >
                        <ArrowUpCircle className="h-3.5 w-3.5" /> Promote to Client
                      </button>
                    )}

                    {user.role === 'EMPLOYEE' && (
                      <button
                        type="button"
                        onClick={() => { setMenuOpen(false); onReassign(user); }}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-blue-400 transition-colors hover:bg-blue-400/5"
                      >
                        <Shuffle className="h-3.5 w-3.5" /> Reassign Ownership
                      </button>
                    )}

                    {!isSelf && (
                      <>
                        <div className="my-1 border-t border-[#1e1e1e]" />

                        {/* Disable / Enable toggle */}
                        {user.isDisabled ? (
                          <button
                            type="button"
                            onClick={() => { setMenuOpen(false); onEnable(user); }}
                            className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-emerald-400 transition-colors hover:bg-emerald-400/5"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Enable Account
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => { setMenuOpen(false); onDisable(user); }}
                            className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-yellow-400 transition-colors hover:bg-yellow-400/5"
                          >
                            <Ban className="h-3.5 w-3.5" /> Disable Account
                          </button>
                        )}

                        {/* Delete / Archive */}
                        <button
                          type="button"
                          onClick={() => { setMenuOpen(false); onDeleteOrArchive(user); }}
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-red-400 transition-colors hover:bg-red-400/5"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete / Archive
                        </button>
                      </>
                    )}
                  </>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Skeleton row */
function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#1e1e1e] bg-[#0d0d0d] px-4 py-3">
      <div className="h-9 w-9 animate-pulse rounded-full bg-[#1e1e1e]" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 w-36 animate-pulse rounded bg-[#1e1e1e]" />
        <div className="h-3 w-48 animate-pulse rounded bg-[#1a1a1a]" />
      </div>
      <div className="h-5 w-16 animate-pulse rounded-full bg-[#1a1a1a]" />
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  role,
}: {
  label: string;
  value: number;
  role: UserRole;
}) {
  const Icon = ROLE_ICONS[role];
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] px-4 py-3">
      <div className="flex items-center gap-1.5">
        <Icon className={cn('h-3.5 w-3.5', {
          'text-[#fbbf24]':   role === 'ADMIN',
          'text-blue-400':    role === 'EMPLOYEE',
          'text-emerald-400': role === 'CLIENT',
          'text-purple-400':  role === 'LEAD',
        })} />
        <p className="text-[10px] font-medium uppercase tracking-wide text-[#555]">{label}</p>
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const router            = useRouter();
  const { user: me, isAdmin, isLoading: authLoading } = useAuth();
  const qc                = useQueryClient();

  // ── View tabs ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const isArchiveView = activeTab === 'archived';

  // ── Filters ───────────────────────────────────────────────────────────────
  const [page,        setPage]        = useState(1);
  const [search,      setSearch]      = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [roleFilter,  setRoleFilter]  = useState<UserRole | 'ALL'>('ALL');

  // ── Modal state ───────────────────────────────────────────────────────────
  const [createOpen,        setCreateOpen]        = useState(false);
  const [changeRoleUser,    setChangeRoleUser]    = useState<User | null>(null);
  const [promoteUser,       setPromoteUser]       = useState<User | null>(null);
  const [reassignUser,      setReassignUser]      = useState<User | null>(null);
  const [deleteOrArchUser,  setDeleteOrArchUser]  = useState<User | null>(null);
  const [toEmployeeId,      setToEmployeeId]      = useState('');
  const [apiError,          setApiError]          = useState('');
  const [editUser,          setEditUser]          = useState<User | null>(null);
  const [resetPassUser,     setResetPassUser]     = useState<User | null>(null);

  // ── Auth guard ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.replace('/erp');
    }
  }, [authLoading, isAdmin, router]);

  // ── Debounce search ───────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset page when tab changes
  useEffect(() => { setPage(1); setSearch(''); setSearchInput(''); setRoleFilter('ALL'); }, [activeTab]);

  // ── Data fetch ────────────────────────────────────────────────────────────
  // Send isArchived as a string ('true'/'false') so Axios never drops it.
  // Axios silently omits boolean `false` query params; strings are always sent.
  const queryParams = {
    page,
    limit: 20,
    isArchived: isArchiveView ? 'true' : 'false',
    ...(roleFilter !== 'ALL' && { role: roleFilter }),
    ...(search && { search }),
  };

  const { data, isLoading, isError } = useQuery<PaginatedUsers>({
    queryKey: ['users', queryParams],
    queryFn:  () =>
      usersApi.getUsers(queryParams).then(r => r.data.data),
    placeholderData: (prev) => prev,
    enabled: !!me,
  });

  // Role-count stat queries (active users only) — always 'false' as string
  const adminQ    = useQuery<PaginatedUsers>({ queryKey: ['users', { page:1, limit:1, role:'ADMIN',    isArchived:'false' }], queryFn: () => usersApi.getUsers({ page:1, limit:1, role:'ADMIN',    isArchived:'false' }).then(r => r.data.data), enabled: !!me });
  const employeeQ = useQuery<PaginatedUsers>({ queryKey: ['users', { page:1, limit:1, role:'EMPLOYEE', isArchived:'false' }], queryFn: () => usersApi.getUsers({ page:1, limit:1, role:'EMPLOYEE', isArchived:'false' }).then(r => r.data.data), enabled: !!me });
  const clientQ   = useQuery<PaginatedUsers>({ queryKey: ['users', { page:1, limit:1, role:'CLIENT',   isArchived:'false' }], queryFn: () => usersApi.getUsers({ page:1, limit:1, role:'CLIENT',   isArchived:'false' }).then(r => r.data.data), enabled: !!me });
  const leadQ     = useQuery<PaginatedUsers>({ queryKey: ['users', { page:1, limit:1, role:'LEAD',     isArchived:'false' }], queryFn: () => usersApi.getUsers({ page:1, limit:1, role:'LEAD',     isArchived:'false' }).then(r => r.data.data), enabled: !!me });

  // ── Mutations ─────────────────────────────────────────────────────────────

  const invalidate = () => qc.invalidateQueries({ queryKey: ['users'] });

  const createMut = useMutation({
    mutationFn: (data: CreateUserForm) => usersApi.createUser(data),
    onSuccess:  () => { invalidate(); setCreateOpen(false); createForm.reset(); },
    onError:    (e: any) => setApiError(e.response?.data?.message ?? 'Failed to create user'),
  });

  const changeRoleMut = useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) =>
      usersApi.updateRole(id, { role }),
    onSuccess:  () => { invalidate(); setChangeRoleUser(null); },
    onError:    (e: any) => setApiError(e.response?.data?.message ?? 'Failed to update role'),
  });

  const promoteMut = useMutation({
    mutationFn: (leadId: string) => usersApi.promoteLead(leadId),
    onSuccess:  () => { invalidate(); setPromoteUser(null); },
    onError:    (e: any) => setApiError(e.response?.data?.message ?? 'Failed to promote'),
  });

  const reassignMut = useMutation({
    mutationFn: ({ fromId, toId }: { fromId: string; toId: string }) =>
      usersApi.reassignOwnership(fromId, toId),
    onSuccess:  () => { invalidate(); setReassignUser(null); setToEmployeeId(''); },
    onError:    (e: any) => setApiError(e.response?.data?.message ?? 'Failed to reassign'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => usersApi.deleteUser(id),
    onSuccess:  () => { invalidate(); setDeleteOrArchUser(null); },
    onError:    (e: any) => setApiError(e.response?.data?.message ?? 'Failed to delete'),
  });

  const archiveMut = useMutation({
    mutationFn: (id: string) => usersApi.archiveUser(id),
    onSuccess:  () => { invalidate(); setDeleteOrArchUser(null); },
    onError:    (e: any) => setApiError(e.response?.data?.message ?? 'Failed to archive'),
  });

  const unarchiveMut = useMutation({
    mutationFn: (id: string) => usersApi.unarchiveUser(id),
    onSuccess:  () => { invalidate(); },
    onError:    (e: any) => setApiError(e.response?.data?.message ?? 'Failed to restore'),
  });

  const disableMut = useMutation({
    mutationFn: (id: string) => usersApi.disableUser(id),
    onSuccess:  () => { invalidate(); },
    onError:    (e: any) => setApiError(e.response?.data?.message ?? 'Failed to disable'),
  });

  const enableMut = useMutation({
    mutationFn: (id: string) => usersApi.enableUser(id),
    onSuccess:  () => { invalidate(); },
    onError:    (e: any) => setApiError(e.response?.data?.message ?? 'Failed to enable'),
  });

  const editUserMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name: string; email: string } }) =>
      usersApi.updateUser(id, data),
    onSuccess: () => { invalidate(); setEditUser(null); editUserForm.reset(); },
    onError:   (e: any) => {
      const msg = e?.response?.data?.message;
      setApiError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Failed to update user'));
    },
  });

  const resetPassMut = useMutation({
    mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) =>
      usersApi.resetPassword(id, { newPassword }),
    onSuccess: () => { setResetPassUser(null); resetPassForm.reset(); },
    onError:   (e: any) => {
      const msg = e?.response?.data?.message;
      setApiError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Failed to reset password'));
    },
  });

  // ── Forms ─────────────────────────────────────────────────────────────────

  const createForm = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { email: '', name: '', password: '', role: 'EMPLOYEE' },
  });

  const changeRoleForm = useForm<ChangeRoleForm>({
    resolver: zodResolver(changeRoleSchema),
  });

  const editUserSchema = z.object({
    name:  z.string().min(2, 'Min 2 characters').max(100),
    email: z.string().email('Valid email required'),
  });
  type EditUserForm = z.infer<typeof editUserSchema>;

  const resetPasswordSchema = z.object({
    newPassword:     z.string().min(8, 'Min 8 characters').max(64)
                       .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Must contain upper, lower and digit'),
    confirmPassword: z.string(),
  }).refine(d => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
  type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

  const editUserForm = useForm<EditUserForm>({ resolver: zodResolver(editUserSchema) });
  const resetPassForm = useForm<ResetPasswordForm>({ resolver: zodResolver(resetPasswordSchema) });

  useEffect(() => {
    if (changeRoleUser) {
      changeRoleForm.setValue('role', changeRoleUser.role as UserRole);
    }
  }, [changeRoleUser]);

  useEffect(() => {
    if (editUser) {
      editUserForm.reset({ name: editUser.name, email: editUser.email });
      setApiError('');
    }
  }, [editUser]);

  useEffect(() => {
    if (resetPassUser) {
      resetPassForm.reset();
      setApiError('');
    }
  }, [resetPassUser]);

  // Clear API errors when modals open
  useEffect(() => {
    setApiError('');
  }, [createOpen, changeRoleUser, promoteUser, reassignUser, deleteOrArchUser, editUser, resetPassUser]);

  // ── Render ────────────────────────────────────────────────────────────────

  const users  = data?.users ?? [];
  const total  = data?.total ?? 0;
  const pages  = data?.pages ?? 1;

  return (
    <div className="flex h-full flex-col overflow-hidden">

      {/* ═══════ PAGE HEADER ═══════ */}
      <div className="flex-shrink-0 border-b border-white/[0.06] bg-[#0c0c0c] px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#fbbf24]/10 border border-[#fbbf24]/20">
                <Users className="h-4 w-4 text-[#fbbf24]" />
              </span>
              <h1 className="text-base font-semibold text-white">Users</h1>
              <span className="rounded-full border border-[#fbbf24]/20 bg-[#fbbf24]/5 px-2 py-0.5 text-[10px] text-[#fbbf24]">
                {total} {isArchiveView ? 'archived' : 'active'}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[#555]">
              Create, manage, and assign roles to system users.
            </p>
          </div>
          {!isArchiveView && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-[#fbbf24]/30 bg-[#fbbf24]/10 px-3 py-2 text-xs font-medium text-[#fbbf24] transition-all hover:bg-[#fbbf24]/20"
            >
              <Plus className="h-3.5 w-3.5" />
              New User
            </button>
          )}
        </div>

        {/* Stats grid */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard label="Admins"    value={adminQ.data?.total    ?? 0} role="ADMIN"    />
          <StatCard label="Employees" value={employeeQ.data?.total ?? 0} role="EMPLOYEE" />
          <StatCard label="Clients"   value={clientQ.data?.total   ?? 0} role="CLIENT"   />
          <StatCard label="Leads"     value={leadQ.data?.total     ?? 0} role="LEAD"     />
        </div>
      </div>

      {/* ═══════ TAB BAR ═══════ */}
      <div className="flex-shrink-0 border-b border-white/[0.06] bg-[#0c0c0c] px-6 pt-3">
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('active')}
            className={cn(
              'pb-2.5 text-xs font-medium border-b-2 transition-colors',
              activeTab === 'active'
                ? 'border-[#fbbf24] text-[#fbbf24]'
                : 'border-transparent text-[#555] hover:text-[#aaa]',
            )}
          >
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Active Users
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('archived')}
            className={cn(
              'pb-2.5 text-xs font-medium border-b-2 transition-colors',
              activeTab === 'archived'
                ? 'border-orange-400 text-orange-400'
                : 'border-transparent text-[#555] hover:text-[#aaa]',
            )}
          >
            <span className="flex items-center gap-1.5">
              <Archive className="h-3.5 w-3.5" /> Archive
            </span>
          </button>
        </div>
      </div>

      {/* ═══════ FILTER BAR ═══════ */}
      <div className="flex-shrink-0 border-b border-white/[0.06] bg-[#0c0c0c] px-6 py-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#444]" />
            <input
              type="text"
              placeholder="Search name or email…"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="h-9 w-full rounded-xl border border-[#1e1e1e] bg-[#141414] pl-9 pr-3 text-xs text-white placeholder-[#444] focus:border-[#fbbf24]/40 focus:outline-none"
            />
          </div>

          {/* Role filter pills */}
          <div className="flex flex-wrap gap-1.5">
            {ROLE_FILTERS.map(f => (
              <button
                key={f.value}
                type="button"
                onClick={() => { setRoleFilter(f.value); setPage(1); }}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                  roleFilter === f.value
                    ? 'border border-[#fbbf24]/30 bg-[#fbbf24]/10 text-[#fbbf24]'
                    : 'border border-[#1e1e1e] bg-[#141414] text-[#666] hover:text-white',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════ USER LIST ═══════ */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {/* Archive view banner */}
        {isArchiveView && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-orange-500/20 bg-orange-500/5 px-4 py-3">
            <Archive className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-400" />
            <div>
              <p className="text-xs font-semibold text-orange-300">Archive View</p>
              <p className="mt-0.5 text-[11px] text-[#666]">
                Archived users cannot log in but all their records — invoices, projects, clients, conversations — are fully preserved. Use "Restore from Archive" to re-activate an account.
              </p>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <AlertTriangle className="h-8 w-8 text-red-400" />
            <p className="text-sm text-[#666]">Failed to load users. Try refreshing.</p>
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            {isArchiveView ? (
              <Archive className="h-8 w-8 text-[#333]" />
            ) : (
              <Users className="h-8 w-8 text-[#333]" />
            )}
            <p className="text-sm font-medium text-[#555]">
              {isArchiveView ? 'No archived users' : 'No users found'}
            </p>
            <p className="text-xs text-[#333]">
              {isArchiveView
                ? 'Archived users will appear here.'
                : search || roleFilter !== 'ALL'
                  ? 'Try adjusting your filters.'
                  : 'Create your first user to get started.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {users.map(u => (
              <UserRow
                key={u.id}
                user={u}
                currentUserId={me?.id ?? ''}
                isArchiveView={isArchiveView}
                onEdit={(u) => { setApiError(''); setEditUser(u); }}
                onResetPassword={(u) => { setApiError(''); setResetPassUser(u); }}
                onChangeRole={setChangeRoleUser}
                onPromote={setPromoteUser}
                onReassign={setReassignUser}
                onDeleteOrArchive={setDeleteOrArchUser}
                onDisable={u => { setApiError(''); disableMut.mutate(u.id); }}
                onEnable={u => { setApiError(''); enableMut.mutate(u.id); }}
                onUnarchive={u => { setApiError(''); unarchiveMut.mutate(u.id); }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ═══════ PAGINATION ═══════ */}
      {pages > 1 && (
        <div className="flex-shrink-0 border-t border-white/[0.06] bg-[#0c0c0c] px-6 py-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#555]">
              Page {page} of {pages} — {total} users
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#1e1e1e] bg-[#141414] text-[#666] transition-all hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={page >= pages}
                onClick={() => setPage(p => p + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#1e1e1e] bg-[#141414] text-[#666] transition-all hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODALS
      ══════════════════════════════════════════════════════════════════════ */}

      {/* ─── Create User Modal ───────────────────────────────────────────── */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create New User">
        <form
          onSubmit={createForm.handleSubmit(data => {
            setApiError('');
            createMut.mutate(data);
          })}
          className="space-y-4"
        >
          {/* Email */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#aaa]">Email</label>
            <input
              {...createForm.register('email')}
              type="email"
              placeholder="user@example.com"
              className="h-9 w-full rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] px-3 text-xs text-white placeholder-[#444] focus:border-[#fbbf24]/40 focus:outline-none"
            />
            <FieldError msg={createForm.formState.errors.email?.message} />
          </div>

          {/* Name */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#aaa]">Full Name</label>
            <input
              {...createForm.register('name')}
              placeholder="Jane Smith"
              className="h-9 w-full rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] px-3 text-xs text-white placeholder-[#444] focus:border-[#fbbf24]/40 focus:outline-none"
            />
            <FieldError msg={createForm.formState.errors.name?.message} />
          </div>

          {/* Password */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#aaa]">
              Temporary Password
            </label>
            <input
              {...createForm.register('password')}
              type="password"
              placeholder="Min 8 chars, upper + lower + digit"
              className="h-9 w-full rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] px-3 text-xs text-white placeholder-[#444] focus:border-[#fbbf24]/40 focus:outline-none"
            />
            <FieldError msg={createForm.formState.errors.password?.message} />
          </div>

          {/* Role */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#aaa]">Role</label>
            <select
              {...createForm.register('role')}
              className="h-9 w-full rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] px-3 text-xs text-white focus:border-[#fbbf24]/40 focus:outline-none"
            >
              {(['ADMIN', 'EMPLOYEE', 'CLIENT', 'LEAD'] as UserRole[]).map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <FieldError msg={createForm.formState.errors.role?.message} />
          </div>

          {/* API error */}
          {apiError && (
            <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {apiError}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded-xl border border-[#2a2a2a] px-4 py-2 text-xs text-[#666] hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMut.isPending}
              className="flex items-center gap-2 rounded-xl border border-[#fbbf24]/30 bg-[#fbbf24]/10 px-4 py-2 text-xs font-medium text-[#fbbf24] hover:bg-[#fbbf24]/20 disabled:opacity-60"
            >
              {createMut.isPending ? 'Creating…' : 'Create User'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ─── Change Role Modal ───────────────────────────────────────────── */}
      <Modal
        open={!!changeRoleUser}
        onClose={() => setChangeRoleUser(null)}
        title="Change Role"
      >
        {changeRoleUser && (
          <form
            onSubmit={changeRoleForm.handleSubmit(data => {
              setApiError('');
              changeRoleMut.mutate({ id: changeRoleUser.id, role: data.role });
            })}
            className="space-y-4"
          >
            <p className="text-xs text-[#666]">
              Changing role for{' '}
              <span className="font-semibold text-white">{changeRoleUser.name}</span>
              {' '}({changeRoleUser.email})
            </p>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#aaa]">New Role</label>
              <select
                {...changeRoleForm.register('role')}
                className="h-9 w-full rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] px-3 text-xs text-white focus:border-[#fbbf24]/40 focus:outline-none"
              >
                {(['ADMIN', 'EMPLOYEE', 'CLIENT', 'LEAD'] as UserRole[]).map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            {changeRoleUser.role === 'ADMIN' && (
              <p className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-3 py-2 text-[11px] text-yellow-400">
                ⚠ ADMIN role cannot be changed via this endpoint. Only same-role re-affirmation is allowed.
              </p>
            )}
            {apiError && (
              <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                {apiError}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setChangeRoleUser(null)} className="rounded-xl border border-[#2a2a2a] px-4 py-2 text-xs text-[#666] hover:text-white">
                Cancel
              </button>
              <button type="submit" disabled={changeRoleMut.isPending} className="rounded-xl border border-[#fbbf24]/30 bg-[#fbbf24]/10 px-4 py-2 text-xs font-medium text-[#fbbf24] hover:bg-[#fbbf24]/20 disabled:opacity-60">
                {changeRoleMut.isPending ? 'Saving…' : 'Update Role'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* ─── Promote Lead → Client Dialog ───────────────────────────────── */}
      <Modal
        open={!!promoteUser}
        onClose={() => setPromoteUser(null)}
        title="Promote Lead to Client"
      >
        {promoteUser && (
          <div className="space-y-4">
            <p className="text-xs text-[#666]">
              Promote{' '}
              <span className="font-semibold text-white">{promoteUser.name}</span>
              {' '}from <RoleBadge role="LEAD" /> to <RoleBadge role="CLIENT" />?
            </p>
            <p className="rounded-lg border border-purple-500/20 bg-purple-500/5 px-3 py-2 text-[11px] text-purple-300">
              This action will grant the user CLIENT-level access to the dashboard.
            </p>
            {apiError && (
              <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                {apiError}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setPromoteUser(null)} className="rounded-xl border border-[#2a2a2a] px-4 py-2 text-xs text-[#666] hover:text-white">
                Cancel
              </button>
              <button
                type="button"
                disabled={promoteMut.isPending}
                onClick={() => { setApiError(''); promoteMut.mutate(promoteUser.id); }}
                className="rounded-xl border border-purple-400/30 bg-purple-400/10 px-4 py-2 text-xs font-medium text-purple-400 hover:bg-purple-400/20 disabled:opacity-60"
              >
                {promoteMut.isPending ? 'Promoting…' : 'Promote to Client'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── Reassign Ownership Dialog ───────────────────────────────────── */}
      <Modal
        open={!!reassignUser}
        onClose={() => { setReassignUser(null); setToEmployeeId(''); }}
        title="Reassign Ownership"
      >
        {reassignUser && (
          <div className="space-y-4">
            <p className="text-xs text-[#666]">
              Bulk-reassign all ERP records currently owned by{' '}
              <span className="font-semibold text-white">{reassignUser.name}</span>
              {' '}to another employee.
            </p>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#aaa]">
                New Owner (Employee UUID)
              </label>
              <input
                type="text"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={toEmployeeId}
                onChange={e => setToEmployeeId(e.target.value)}
                className="h-9 w-full rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] px-3 text-xs text-white placeholder-[#444] focus:border-[#fbbf24]/40 focus:outline-none"
              />
              <p className="mt-1 text-[10px] text-[#444]">
                Target user must have EMPLOYEE role.
              </p>
            </div>
            {apiError && (
              <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                {apiError}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => { setReassignUser(null); setToEmployeeId(''); }} className="rounded-xl border border-[#2a2a2a] px-4 py-2 text-xs text-[#666] hover:text-white">
                Cancel
              </button>
              <button
                type="button"
                disabled={reassignMut.isPending || !toEmployeeId.trim()}
                onClick={() => {
                  setApiError('');
                  reassignMut.mutate({ fromId: reassignUser.id, toId: toEmployeeId.trim() });
                }}
                className="rounded-xl border border-blue-400/30 bg-blue-400/10 px-4 py-2 text-xs font-medium text-blue-400 hover:bg-blue-400/20 disabled:opacity-60"
              >
                {reassignMut.isPending ? 'Reassigning…' : 'Reassign'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── Edit User Modal ──────────────────────────────────────────── */}
      <Modal open={!!editUser} onClose={() => setEditUser(null)} title="Edit User">
        {editUser && (
          <form
            onSubmit={editUserForm.handleSubmit(data => {
              setApiError('');
              editUserMut.mutate({ id: editUser.id, data });
            })}
            className="space-y-4"
          >
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#aaa]">Full Name</label>
              <input
                {...editUserForm.register('name')}
                className="h-9 w-full rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] px-3 text-xs text-white placeholder-[#444] focus:border-[#fbbf24]/40 focus:outline-none"
              />
              <FieldError msg={editUserForm.formState.errors.name?.message} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#aaa]">Email</label>
              <input
                {...editUserForm.register('email')}
                type="email"
                className="h-9 w-full rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] px-3 text-xs text-white placeholder-[#444] focus:border-[#fbbf24]/40 focus:outline-none"
              />
              <FieldError msg={editUserForm.formState.errors.email?.message} />
            </div>
            {apiError && (
              <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">{apiError}</p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setEditUser(null)}
                className="rounded-xl border border-[#2a2a2a] px-4 py-2 text-xs text-[#666] hover:text-white">
                Cancel
              </button>
              <button type="submit" disabled={editUserMut.isPending}
                className="flex items-center gap-2 rounded-xl border border-[#fbbf24]/30 bg-[#fbbf24]/10 px-4 py-2 text-xs font-medium text-[#fbbf24] hover:bg-[#fbbf24]/20 disabled:opacity-60">
                {editUserMut.isPending ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* ─── Reset Password Modal ────────────────────────────────────────── */}
      <Modal open={!!resetPassUser} onClose={() => setResetPassUser(null)} title="Reset Password">
        {resetPassUser && (
          <form
            onSubmit={resetPassForm.handleSubmit(data => {
              setApiError('');
              resetPassMut.mutate({ id: resetPassUser.id, newPassword: data.newPassword });
            })}
            className="space-y-4"
          >
            <p className="text-xs text-[#666]">
              Set a new password for <span className="font-semibold text-white">{resetPassUser.name}</span>.
            </p>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#aaa]">New Password</label>
              <input
                {...resetPassForm.register('newPassword')}
                type="password"
                placeholder="Min 8 chars · upper + lower + digit"
                className="h-9 w-full rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] px-3 text-xs text-white placeholder-[#444] focus:border-[#fbbf24]/40 focus:outline-none"
              />
              <FieldError msg={resetPassForm.formState.errors.newPassword?.message} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#aaa]">Confirm Password</label>
              <input
                {...resetPassForm.register('confirmPassword')}
                type="password"
                placeholder="Repeat the new password"
                className="h-9 w-full rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] px-3 text-xs text-white placeholder-[#444] focus:border-[#fbbf24]/40 focus:outline-none"
              />
              <FieldError msg={resetPassForm.formState.errors.confirmPassword?.message} />
            </div>
            {apiError && (
              <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">{apiError}</p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setResetPassUser(null)}
                className="rounded-xl border border-[#2a2a2a] px-4 py-2 text-xs text-[#666] hover:text-white">
                Cancel
              </button>
              <button type="submit" disabled={resetPassMut.isPending}
                className="flex items-center gap-2 rounded-xl border border-[#fbbf24]/30 bg-[#fbbf24]/10 px-4 py-2 text-xs font-medium text-[#fbbf24] hover:bg-[#fbbf24]/20 disabled:opacity-60">
                <KeyRound className="h-3.5 w-3.5" />
                {resetPassMut.isPending ? 'Resetting…' : 'Reset Password'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* ─── Delete / Archive Choice Modal ──────────────────────────────── */}
      <Modal
        open={!!deleteOrArchUser}
        onClose={() => setDeleteOrArchUser(null)}
        title="Remove User"
        maxWidth="max-w-lg"
      >
        {deleteOrArchUser && (
          <div className="space-y-4">
            <p className="text-xs text-[#888]">
              Choose what to do with{' '}
              <span className="font-semibold text-white">{deleteOrArchUser.name}</span>
              {' '}({deleteOrArchUser.email}):
            </p>

            {/* Archive option */}
            <button
              type="button"
              disabled={archiveMut.isPending || deleteMut.isPending}
              onClick={() => { setApiError(''); archiveMut.mutate(deleteOrArchUser.id); }}
              className="group w-full rounded-xl border border-orange-500/25 bg-orange-500/5 p-4 text-left transition-all hover:border-orange-500/50 hover:bg-orange-500/10 disabled:opacity-60"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-orange-500/30 bg-orange-500/10">
                  <Archive className="h-4 w-4 text-orange-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-orange-300">
                    {archiveMut.isPending ? 'Archiving…' : 'Archive User'}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#666]">
                    Hides the user from active lists and blocks their login.
                    <span className="text-[#888]"> All records are preserved — invoices,
                    projects, clients, conversations remain fully accessible
                    in the Archive view.</span>
                  </p>
                  <p className="mt-1.5 text-[10px] font-medium text-orange-400/70">
                    ✓ Records kept  ✓ Reversible  ✓ Login blocked
                  </p>
                </div>
              </div>
            </button>

            {/* Permanent delete option */}
            <button
              type="button"
              disabled={archiveMut.isPending || deleteMut.isPending}
              onClick={() => { setApiError(''); deleteMut.mutate(deleteOrArchUser.id); }}
              className="group w-full rounded-xl border border-red-500/25 bg-red-500/5 p-4 text-left transition-all hover:border-red-500/50 hover:bg-red-500/10 disabled:opacity-60"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10">
                  <Trash2 className="h-4 w-4 text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-red-300">
                    {deleteMut.isPending ? 'Deleting…' : 'Delete Permanently'}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#666]">
                    Completely removes the user from the database.
                    <span className="text-red-400/70"> This cannot be undone. All linked records
                    (invoices, projects, conversations) will also be removed.</span>
                  </p>
                  <p className="mt-1.5 text-[10px] font-medium text-red-400/70">
                    ✗ Records lost  ✗ Irreversible
                  </p>
                </div>
              </div>
            </button>

            {apiError && (
              <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                {apiError}
              </p>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setDeleteOrArchUser(null)}
                className="rounded-xl border border-[#2a2a2a] px-4 py-2 text-xs text-[#666] hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
