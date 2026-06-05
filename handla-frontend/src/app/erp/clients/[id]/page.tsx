'use client';

/**
 * ERP — Client Detail Page (/erp/clients/[id])
 * Tabs: Overview | Projects | Contracts | Invoices
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  ArrowLeft,
  Briefcase,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Building2,
  Mail,
  Calendar,
  User,
  StickyNote,
  FolderOpen,
  FileText,
  Receipt,
  Clock,
  CircleDot,
  PauseCircle,
  Ban,
  Send,
  PenLine,
  DollarSign,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { clientsApi, projectsApi, contractsApi, invoicesApi } from '@/lib/api';
import { cn, getInitials, getAvatarColor } from '@/lib/utils';
import type {
  Client,
  Project,
  ProjectStatus,
  PaginatedProjects,
  Contract,
  ContractStatus,
  PaginatedContracts,
  Invoice,
  InvoicePaymentStatus,
  PaginatedInvoices,
} from '@/types';

// ─── Status helpers ────────────────────────────────────────────────────────────

type ClientStatus = 'ACTIVE' | 'INACTIVE' | 'CHURNED';

const CLIENT_STATUS_BADGE: Record<ClientStatus, string> = {
  ACTIVE:   'border-emerald-400/30 bg-emerald-400/10 text-emerald-400',
  INACTIVE: 'border-gray-400/30    bg-gray-400/10    text-gray-400',
  CHURNED:  'border-red-400/30     bg-red-400/10     text-red-400',
};
const CLIENT_STATUS_ICON: Record<ClientStatus, React.ComponentType<{ className?: string }>> = {
  ACTIVE:   CheckCircle2,
  INACTIVE: AlertCircle,
  CHURNED:  XCircle,
};

// Project status
const PROJECT_BADGE: Record<ProjectStatus, string> = {
  PLANNING:  'border-blue-400/30   bg-blue-400/10   text-blue-400',
  ACTIVE:    'border-emerald-400/30 bg-emerald-400/10 text-emerald-400',
  ON_HOLD:   'border-yellow-400/30 bg-yellow-400/10 text-yellow-400',
  COMPLETED: 'border-purple-400/30 bg-purple-400/10 text-purple-400',
  CANCELLED: 'border-red-400/30    bg-red-400/10    text-red-400',
};
const PROJECT_ICON: Record<ProjectStatus, React.ComponentType<{ className?: string }>> = {
  PLANNING:  CircleDot,
  ACTIVE:    CheckCircle2,
  ON_HOLD:   PauseCircle,
  COMPLETED: CheckCircle2,
  CANCELLED: Ban,
};

// Contract status
const CONTRACT_BADGE: Record<ContractStatus, string> = {
  DRAFT:    'border-gray-400/30   bg-gray-400/10   text-gray-400',
  SENT:     'border-blue-400/30   bg-blue-400/10   text-blue-400',
  SIGNED:   'border-emerald-400/30 bg-emerald-400/10 text-emerald-400',
  REJECTED: 'border-red-400/30    bg-red-400/10    text-red-400',
};
const CONTRACT_ICON: Record<ContractStatus, React.ComponentType<{ className?: string }>> = {
  DRAFT:    PenLine,
  SENT:     Send,
  SIGNED:   CheckCircle2,
  REJECTED: XCircle,
};

// Invoice payment status
const INVOICE_BADGE: Record<InvoicePaymentStatus, string> = {
  UNPAID:  'border-yellow-400/30 bg-yellow-400/10 text-yellow-400',
  PAID:    'border-emerald-400/30 bg-emerald-400/10 text-emerald-400',
  OVERDUE: 'border-red-400/30    bg-red-400/10    text-red-400',
};
const INVOICE_ICON: Record<InvoicePaymentStatus, React.ComponentType<{ className?: string }>> = {
  UNPAID:  Clock,
  PAID:    CheckCircle2,
  OVERDUE: AlertCircle,
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-[#1a1a1a] rounded" />
      <div className="h-28 bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl" />
      <div className="h-40 bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl" />
    </div>
  );
}

function TabSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-16 bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl" />
      ))}
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = ['Overview', 'Projects', 'Contracts', 'Invoices'] as const;
type Tab = typeof TABS[number];

const formatDate = (d: string | null | undefined) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatCurrency = (amount: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

// ─── Sub-tabs: Projects ───────────────────────────────────────────────────────

function ProjectsTab({ clientId }: { clientId: string }) {
  const { data, isLoading } = useQuery<PaginatedProjects>({
    queryKey: ['erp-client-projects', clientId],
    queryFn: () =>
      projectsApi.getProjects({ clientId, limit: 50 }).then(r => r.data.data as PaginatedProjects),
    staleTime: 30_000,
    enabled: !!clientId,
  });

  if (isLoading) return <TabSkeleton />;

  const projects: Project[] = data?.projects ?? [];

  if (projects.length === 0) {
    return (
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl p-10 flex flex-col items-center gap-3 text-center">
        <FolderOpen className="w-10 h-10 text-gray-700" />
        <p className="text-gray-500 text-sm">No projects yet for this client.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {projects.map(project => {
        const Icon = PROJECT_ICON[project.status] ?? CircleDot;
        return (
          <Link
            key={project.id}
            href={`/erp/projects/${project.id}`}
            className="block bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-4 hover:border-[#2a2a2a] transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{project.title}</p>
                {project.description && (
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{project.description}</p>
                )}
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                  {project.startDate && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {formatDate(project.startDate)}
                    </span>
                  )}
                  {project.endDate && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Due {formatDate(project.endDate)}
                    </span>
                  )}
                  {project.owner && (
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" /> {project.owner.name}
                    </span>
                  )}
                </div>
              </div>
              <span
                className={cn(
                  'flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full border shrink-0',
                  PROJECT_BADGE[project.status],
                )}
              >
                <Icon className="w-3 h-3" />
                {project.status.replace('_', ' ')}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// ─── Sub-tabs: Contracts ──────────────────────────────────────────────────────

function ContractsTab({ clientId }: { clientId: string }) {
  const { data, isLoading } = useQuery<PaginatedContracts>({
    queryKey: ['erp-client-contracts', clientId],
    queryFn: () =>
      contractsApi.getContracts({ clientId, limit: 50 }).then(r => r.data.data as PaginatedContracts),
    staleTime: 30_000,
    enabled: !!clientId,
  });

  if (isLoading) return <TabSkeleton />;

  const contracts: Contract[] = data?.contracts ?? [];

  if (contracts.length === 0) {
    return (
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl p-10 flex flex-col items-center gap-3 text-center">
        <FileText className="w-10 h-10 text-gray-700" />
        <p className="text-gray-500 text-sm">No contracts yet for this client.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {contracts.map(contract => {
        const Icon = CONTRACT_ICON[contract.status] ?? FileText;
        return (
          <Link
            key={contract.id}
            href={`/erp/contracts/${contract.id}`}
            className="block bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-4 hover:border-[#2a2a2a] transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{contract.title}</p>
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Created {formatDate(contract.createdAt)}
                  </span>
                  {contract.sentAt && (
                    <span className="flex items-center gap-1">
                      <Send className="w-3 h-3" /> Sent {formatDate(contract.sentAt)}
                    </span>
                  )}
                  {contract.signedAt && (
                    <span className="flex items-center gap-1">
                      <PenLine className="w-3 h-3" /> Signed {formatDate(contract.signedAt)}
                    </span>
                  )}
                  {contract.owner && (
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" /> {contract.owner.name}
                    </span>
                  )}
                </div>
              </div>
              <span
                className={cn(
                  'flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full border shrink-0',
                  CONTRACT_BADGE[contract.status],
                )}
              >
                <Icon className="w-3 h-3" />
                {contract.status}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// ─── Sub-tabs: Invoices ───────────────────────────────────────────────────────

function InvoicesTab({ clientId }: { clientId: string }) {
  const { data, isLoading } = useQuery<PaginatedInvoices>({
    queryKey: ['erp-client-invoices', clientId],
    queryFn: () =>
      invoicesApi.getInvoices({ clientId, limit: 50 }).then(r => r.data.data as PaginatedInvoices),
    staleTime: 30_000,
    enabled: !!clientId,
  });

  if (isLoading) return <TabSkeleton />;

  const invoices: Invoice[] = data?.invoices ?? [];

  if (invoices.length === 0) {
    return (
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl p-10 flex flex-col items-center gap-3 text-center">
        <Receipt className="w-10 h-10 text-gray-700" />
        <p className="text-gray-500 text-sm">No invoices yet for this client.</p>
      </div>
    );
  }

  // Totals summary
  const totalPaid    = invoices.filter(i => i.paymentStatus === 'PAID').reduce((s, i) => s + i.total, 0);
  const totalUnpaid  = invoices.filter(i => i.paymentStatus === 'UNPAID').reduce((s, i) => s + i.total, 0);
  const totalOverdue = invoices.filter(i => i.paymentStatus === 'OVERDUE').reduce((s, i) => s + i.total, 0);
  const currency = invoices[0]?.currency ?? 'USD';

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Paid',    amount: totalPaid,    cls: 'text-emerald-400' },
          { label: 'Unpaid',  amount: totalUnpaid,  cls: 'text-yellow-400'  },
          { label: 'Overdue', amount: totalOverdue, cls: 'text-red-400'     },
        ].map(({ label, amount, cls }) => (
          <div key={label} className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className={cn('text-sm font-semibold', cls)}>{formatCurrency(amount, currency)}</p>
          </div>
        ))}
      </div>

      {/* Invoice rows */}
      <div className="space-y-3">
        {invoices.map(invoice => {
          const Icon = INVOICE_ICON[invoice.paymentStatus] ?? Clock;
          return (
            <Link
              key={invoice.id}
              href={`/erp/invoices/${invoice.id}`}
              className="block bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-4 hover:border-[#2a2a2a] transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white">{invoice.invoiceNumber}</p>
                    <span
                      className={cn(
                        'flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border',
                        INVOICE_BADGE[invoice.paymentStatus],
                      )}
                    >
                      <Icon className="w-3 h-3" />
                      {invoice.paymentStatus}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Issued {formatDate(invoice.createdAt)}
                    </span>
                    {invoice.dueDate && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Due {formatDate(invoice.dueDate)}
                      </span>
                    )}
                    {invoice.paidAt && (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Paid {formatDate(invoice.paidAt)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-white flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-[#fbbf24]" />
                    {formatCurrency(invoice.total, invoice.currency)}
                  </p>
                  {invoice.taxRate > 0 && (
                    <p className="text-xs text-gray-600 mt-0.5">incl. {invoice.taxRate}% tax</p>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClientDetailPage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();
  useAuth();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('Overview');

  useEffect(() => { setMounted(true); }, []);

  const { data, isLoading, isError } = useQuery<{ client: Client }>({
    queryKey: ['erp-client', id],
    queryFn:  () => clientsApi.getClient(id).then(r => r.data.data as { client: Client }),
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
    enabled: !!id,
  });

  if (!mounted) return null;

  const client = data?.client;

  if (isLoading) return <DetailSkeleton />;

  if (isError || !client) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <Briefcase className="w-12 h-12 text-gray-700" />
        <p className="text-gray-400">Client not found or you don&apos;t have access.</p>
        <button
          onClick={() => router.push('/erp/clients')}
          className="px-4 py-2 bg-[#1a1a1a] text-gray-300 rounded-xl text-sm hover:bg-[#222] transition-colors"
        >
          Back to Clients
        </button>
      </div>
    );
  }

  const StatusIcon = CLIENT_STATUS_ICON[client.status as ClientStatus] ?? AlertCircle;
  const name = client.user?.name ?? 'Unknown';
  const email = client.user?.email ?? '';
  const initials = getInitials(name);
  const avatarColor = getAvatarColor(name);
  const ownerName = client.owner?.name ?? 'Unassigned';

  return (
    <div className="space-y-6">
      {/* ─── Breadcrumb ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Link href="/erp/clients" className="flex items-center gap-1 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Clients
        </Link>
        <span>/</span>
        <span className="text-white">{name}</span>
      </div>

      {/* ─── Header card ───────────────────────────────────────────────────── */}
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Avatar */}
        <div
          className={cn(
            'w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold shrink-0',
            avatarColor,
          )}
        >
          {initials}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-white">{name}</h1>
            <span
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full border',
                CLIENT_STATUS_BADGE[client.status as ClientStatus],
              )}
            >
              <StatusIcon className="w-3 h-3" />
              {client.status}
            </span>
          </div>
          {client.company && (
            <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5" /> {client.company}
            </p>
          )}
          <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Mail className="w-3.5 h-3.5" /> {email}
            </span>
            <span className="flex items-center gap-1">
              <User className="w-3.5 h-3.5" /> Owner: {ownerName}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Created {formatDate(client.createdAt)}
            </span>
          </div>
        </div>
      </div>

      {/* ─── Tabs ──────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-[#1a1a1a]">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px min-h-[44px]',
              activeTab === tab
                ? 'border-[#fbbf24] text-[#fbbf24]'
                : 'border-transparent text-gray-400 hover:text-white',
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ─── Tab content ───────────────────────────────────────────────────── */}
      {activeTab === 'Overview' && (
        <div className="grid sm:grid-cols-2 gap-4">
          {/* Notes */}
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <StickyNote className="w-4 h-4 text-[#fbbf24]" /> Notes
            </h3>
            {client.notes ? (
              <p className="text-sm text-gray-300 whitespace-pre-wrap">{client.notes}</p>
            ) : (
              <p className="text-sm text-gray-500 italic">No notes for this client.</p>
            )}
          </div>

          {/* Metadata */}
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Details</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Status</dt>
                <dd className={cn('font-medium', CLIENT_STATUS_BADGE[client.status as ClientStatus].split(' ').pop())}>{client.status}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Company</dt>
                <dd className="text-gray-300">{client.company ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Owner</dt>
                <dd className="text-gray-300">{ownerName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Created</dt>
                <dd className="text-gray-300">{formatDate(client.createdAt)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Updated</dt>
                <dd className="text-gray-300">{formatDate(client.updatedAt)}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      {activeTab === 'Projects'  && <ProjectsTab  clientId={client.id} />}
      {activeTab === 'Contracts' && <ContractsTab clientId={client.id} />}
      {activeTab === 'Invoices'  && <InvoicesTab  clientId={client.id} />}
    </div>
  );
}
