'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/useDebounce';
import { useDropdown, DropdownPortal } from '@/components/ui/DropdownPortal';
import {
  Server, Plus, Loader2, MoreVertical, Search, X, Edit2, Trash2,
  ChevronLeft, ChevronRight, AlertCircle, CheckCircle2, Package, Layers,
  PauseCircle, PlayCircle, Archive, RefreshCw, ArrowRightLeft, Globe,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useTranslation } from '@/hooks/useTranslation';
import { saasApi, clientsApi } from '@/lib/api';
import type {
  SaasProduct, SaasPlan, SaasTenant, TenantStatus, TenantDetail,
  PaginatedTenants, PaginatedClients,
} from '@/types';
import { cn } from '@/lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const TENANT_BADGE: Record<TenantStatus, string> = {
  PENDING:      'border-white/15 bg-white/5 text-white/50',
  PROVISIONING: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
  ACTIVE:       'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  SUSPENDED:    'border-amber-500/30 bg-amber-500/10 text-amber-400',
  FAILED:       'border-red-500/30 bg-red-500/10 text-red-400',
  ARCHIVED:     'border-white/10 bg-white/[0.03] text-white/30',
};
const PROV_BADGE: Record<string, string> = {
  QUEUED:    'border-white/15 bg-white/5 text-white/50',
  RUNNING:   'border-blue-500/30 bg-blue-500/10 text-blue-400',
  SUCCEEDED: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  FAILED:    'border-red-500/30 bg-red-500/10 text-red-400',
};

const sharedInput =
  'w-full rounded-xl border border-white/10 bg-[#0f0f0f] text-white px-3 py-2.5 text-sm focus:outline-none focus:border-[#fbbf24]/50 focus:bg-white/[0.04] transition-all';

function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function errMsg(e: unknown, fallback: string) {
  return (e as any)?.response?.data?.message ?? fallback;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'tenants' | 'catalog';

export default function SaasPage() {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  const [tab, setTab] = useState<Tab>('tenants');

  if (!mounted) return null;

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-amber-400/60 mx-auto" />
          <p className="text-sm text-white/40">{t('erp.saas.adminOnly')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#fbbf24]/10 border border-[#fbbf24]/20">
              <Server className="w-4.5 h-4.5 text-[#fbbf24]" />
            </span>
            {t('erp.saas.title')}
          </h1>
          <p className="text-sm text-white/30 mt-1 ml-11">{t('erp.saas.subtitle')}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06] w-fit">
        {(['tenants', 'catalog'] as Tab[]).map(tb => (
          <button key={tb} onClick={() => setTab(tb)}
            className={cn('px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5',
              tab === tb ? 'bg-[#fbbf24] text-black shadow-sm' : 'text-white/35 hover:text-white')}>
            {tb === 'tenants' ? <Server className="w-3.5 h-3.5" /> : <Package className="w-3.5 h-3.5" />}
            {tb === 'tenants' ? t('erp.saas.tabs.tenants') : t('erp.saas.tabs.catalog')}
          </button>
        ))}
      </div>

      {tab === 'tenants' ? <TenantsTab /> : <CatalogTab />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  TENANTS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function TenantsTab() {
  const { t } = useTranslation();
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 300);
  const [statusFilter, setStatusFilter] = useState<'all' | TenantStatus>('all');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const params = {
    page, limit: 10,
    ...(statusFilter !== 'all' && { status: statusFilter }),
    ...(search && { search }),
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['saas-tenants', params],
    queryFn:  () => saasApi.getTenants(params).then(r => r.data.data as PaginatedTenants),
    staleTime: 10_000,
    placeholderData: (prev: any) => prev,
  });

  const tenants   = data?.tenants ?? [];
  const totalPages = data?.pages ?? 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value as any); setPage(1); }}
            className="rounded-lg border border-white/10 bg-white/[0.04] text-white text-xs px-3 py-2 focus:outline-none focus:border-[#fbbf24]/40">
            <option value="all">{t('erp.saas.tenants.allStatuses')}</option>
            {(['PENDING','PROVISIONING','ACTIVE','SUSPENDED','FAILED','ARCHIVED'] as TenantStatus[]).map(s => <option key={s} value={s}>{t(`erp.saas.tenantStatus.${s}`)}</option>)}
          </select>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
            <input placeholder={t('erp.saas.tenants.searchPlaceholder')} value={searchInput} onChange={e => { setSearchInput(e.target.value); setPage(1); }}
              className="pl-8 pr-4 py-2 rounded-lg border border-white/10 bg-white/[0.04] text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#fbbf24]/40 focus:bg-white/[0.06] w-56 transition-all" />
          </div>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#fbbf24] text-black font-semibold hover:bg-[#f59e0b] transition-colors text-sm min-h-[44px]">
          <Plus className="w-4 h-4" /> {t('erp.saas.tenants.provisionTenant')}
        </button>
      </div>

      {isLoading && (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4 animate-pulse h-20" />)}</div>
      )}
      {isError && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-red-400/50 mx-auto" />
            <p className="text-sm text-white/30">{t('erp.saas.tenants.loadError')}</p>
            <button onClick={() => refetch()} className="px-4 py-2 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-xs text-white/50 transition-colors">{t('erp.common.retry')}</button>
          </div>
        </div>
      )}
      {!isLoading && !isError && tenants.length === 0 && (
        <div className="flex items-center justify-center py-16">
          <div className="text-center space-y-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] mx-auto"><Server className="w-7 h-7 text-white/15" /></div>
            <p className="text-sm text-white/30">{t('erp.saas.tenants.empty')}</p>
            <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-xl border border-[#fbbf24]/30 bg-[#fbbf24]/10 text-[#fbbf24] text-xs font-semibold hover:bg-[#fbbf24]/20 transition-colors">{t('erp.saas.tenants.provisionFirst')}</button>
          </div>
        </div>
      )}
      {!isLoading && !isError && tenants.length > 0 && (
        <div className="space-y-2">
          {tenants.map(tn => <TenantRow key={tn.id} tenant={tn} onOpen={() => setDetailId(tn.id)} />)}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-white/30">{t('erp.saas.tenants.pagination', { total: data?.total ?? 0, page, totalPages })}</p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/40 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"><ChevronLeft className="w-4 h-4" /></button>
            <span className="px-3 text-xs text-white/40">{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/40 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      <CreateTenantModal isOpen={showCreate} onClose={() => setShowCreate(false)} />
      <TenantDetailDrawer tenantId={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}

function TenantRow({ tenant, onOpen }: { tenant: SaasTenant; onOpen: () => void }) {
  const { t } = useTranslation();
  const primaryDomain = tenant.domains?.find(d => d.isPrimary)?.domain ?? tenant.slug;
  return (
    <button onClick={onOpen}
      className="group w-full text-left flex items-start justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition-all hover:bg-white/[0.04]">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-[#fbbf24]/20 bg-[#fbbf24]/10">
          <Server className="w-4 h-4 text-[#fbbf24]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white truncate">{tenant.name}</span>
            <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold border', TENANT_BADGE[tenant.status])}>{t(`erp.saas.tenantStatus.${tenant.status}`)}</span>
            {tenant.product && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border border-white/10 bg-white/5 text-white/50">{tenant.product.code}</span>}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-white/40 truncate">
            <Globe className="w-3 h-3 flex-shrink-0" /> {primaryDomain}
          </div>
          {tenant.lastError && <div className="mt-1 text-[11px] text-red-400/70 truncate">⚠ {tenant.lastError}</div>}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 text-[11px] text-white/25">
        {tenant.externalTenantId ? <span className="font-mono">{tenant.externalTenantId}</span> : <span>{t('erp.saas.tenants.notProvisioned')}</span>}
        <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/40 transition-colors" />
      </div>
    </button>
  );
}

// ─── Create Tenant Modal ──────────────────────────────────────────────────────

function CreateTenantModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [clientId, setClientId] = useState('');
  const [productId, setProductId] = useState('');
  const [planId, setPlanId] = useState('');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [billingInterval, setBillingInterval] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');

  useEffect(() => {
    if (isOpen) { setClientId(''); setProductId(''); setPlanId(''); setName(''); setSlug(''); setBillingInterval('MONTHLY'); }
  }, [isOpen]);

  const { data: clientsData } = useQuery({
    queryKey: ['saas-clients-select'],
    queryFn:  () => clientsApi.getClients({ limit: 100 }).then(r => r.data.data as PaginatedClients),
    enabled:  isOpen, staleTime: 60_000,
  });
  const clients = clientsData?.clients ?? [];

  const { data: productsData } = useQuery({
    queryKey: ['saas-products'],
    queryFn:  () => saasApi.getProducts().then(r => r.data.data.products as SaasProduct[]),
    enabled:  isOpen, staleTime: 60_000,
  });
  const products = (productsData ?? []).filter(p => p.isActive);

  const { data: plans = [] } = useQuery({
    queryKey: ['saas-plans', productId],
    queryFn:  () => saasApi.getPlans(productId).then(r => r.data.data.plans as SaasPlan[]),
    enabled:  isOpen && !!productId, staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: () => saasApi.createTenant({
      clientId, productId, planId, name: name.trim(),
      ...(slug.trim() && { slug: slug.trim() }),
      billingInterval,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['saas-tenants'] }); onClose(); },
  });

  const canSubmit = clientId && productId && planId && name.trim();

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#111] shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4 sticky top-0 bg-[#111] z-10">
          <div>
            <h2 className="text-base font-bold text-white">{t('erp.saas.create.title')}</h2>
            <p className="text-xs text-white/30">{t('erp.saas.create.subtitle')}</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">{t('erp.saas.create.client')}</label>
            <select value={clientId} onChange={e => setClientId(e.target.value)} className={sharedInput}>
              <option value="">{t('erp.saas.create.selectClient')}</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.company || c.user?.name || c.user?.email || c.id}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">{t('erp.saas.create.product')}</label>
              <select value={productId} onChange={e => { setProductId(e.target.value); setPlanId(''); }} className={sharedInput}>
                <option value="">{t('erp.saas.create.selectProduct')}</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">{t('erp.saas.create.plan')}</label>
              <select value={planId} onChange={e => setPlanId(e.target.value)} className={sharedInput} disabled={!productId}>
                <option value="">{productId ? t('erp.saas.create.selectPlan') : t('erp.saas.create.pickProductFirst')}</option>
                {plans.map(pl => <option key={pl.id} value={pl.id}>{pl.name} {pl.trialDays > 0 ? t('erp.saas.create.trialSuffix', { days: pl.trialDays }) : ''}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">{t('erp.saas.create.name')}</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder={t('erp.saas.create.namePlaceholder')} className={sharedInput} />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">{t('erp.saas.create.subdomain')}</label>
              <input value={slug} onChange={e => setSlug(e.target.value.toLowerCase())} placeholder={t('erp.saas.create.subdomainPlaceholder')} className={sharedInput} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">{t('erp.saas.create.billingInterval')}</label>
            <select value={billingInterval} onChange={e => setBillingInterval(e.target.value as any)} className={sharedInput}>
              <option value="MONTHLY">{t('erp.saas.billingInterval.MONTHLY')}</option>
              <option value="YEARLY">{t('erp.saas.billingInterval.YEARLY')}</option>
            </select>
          </div>

          {mutation.isError && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {errMsg(mutation.error, t('erp.saas.create.error'))}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white text-sm min-h-[44px] transition-colors">{t('erp.common.cancel')}</button>
            <button type="button" disabled={mutation.isPending || !canSubmit} onClick={() => mutation.mutate()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#fbbf24] text-black font-semibold hover:bg-[#f59e0b] text-sm disabled:opacity-50 min-h-[44px] transition-colors">
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {mutation.isPending ? t('erp.saas.create.queuing') : t('erp.saas.create.provision')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tenant Detail Drawer (lifecycle actions + logs) ──────────────────────────

function TenantDetailDrawer({ tenantId, onClose }: { tenantId: string | null; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [showChangePlan, setShowChangePlan] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['saas-tenant', tenantId],
    queryFn:  () => saasApi.getTenant(tenantId!).then(r => r.data.data as TenantDetail),
    enabled:  !!tenantId,
    refetchInterval: (q) => {
      const s = (q.state.data as TenantDetail | undefined)?.tenant.status;
      return s === 'PENDING' || s === 'PROVISIONING' ? 3000 : false;
    },
  });

  const action = useMutation({
    mutationFn: (kind: 'suspend' | 'reactivate' | 'archive' | 'retry') => {
      if (kind === 'suspend')    return saasApi.suspendTenant(tenantId!);
      if (kind === 'reactivate') return saasApi.reactivateTenant(tenantId!);
      if (kind === 'archive')    return saasApi.archiveTenant(tenantId!);
      return saasApi.retryTenant(tenantId!);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saas-tenant', tenantId] });
      qc.invalidateQueries({ queryKey: ['saas-tenants'] });
    },
  });

  if (!tenantId) return null;
  const tn = data?.tenant;
  const next = data?.nextStates ?? [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md h-full bg-[#0e0e0e] border-l border-white/10 shadow-2xl overflow-y-auto">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4 sticky top-0 bg-[#0e0e0e] z-10">
          <h2 className="text-base font-bold text-white">{t('erp.saas.detail.title')}</h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors"><X className="w-4 h-4" /></button>
        </div>

        {isLoading || !tn ? (
          <div className="p-6 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-white/30" /></div>
        ) : (
          <div className="p-5 space-y-5">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-white">{tn.name}</h3>
                <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold border', TENANT_BADGE[tn.status])}>{t(`erp.saas.tenantStatus.${tn.status}`)}</span>
              </div>
              <p className="text-xs text-white/40 mt-1">{tn.product?.name} · {tn.slug}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <Info label={t('erp.saas.detail.externalId')} value={tn.externalTenantId ?? '—'} mono />
              <Info label={t('erp.saas.detail.client')} value={tn.client?.company ?? tn.client?.user?.name ?? tn.clientId} />
              <Info label={t('erp.saas.detail.created')} value={fmtDate(tn.createdAt)} />
              <Info label={t('erp.saas.detail.archived')} value={fmtDate(tn.archivedAt)} />
            </div>

            {tn.domains && tn.domains.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-white/50 mb-2">{t('erp.saas.detail.domains')}</p>
                <div className="space-y-1.5">
                  {tn.domains.map(d => (
                    <div key={d.id} className="flex items-center gap-2 text-xs text-white/60">
                      <Globe className="w-3 h-3 text-white/30" /> <span className="font-mono">{d.domain}</span>
                      {d.isPrimary && <span className="px-1.5 py-0.5 rounded text-[9px] bg-[#fbbf24]/10 text-[#fbbf24] border border-[#fbbf24]/20">{t('erp.saas.detail.primary')}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data?.subscription && (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 space-y-1.5">
                <p className="text-xs font-semibold text-white/50">{t('erp.saas.detail.subscription')}</p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/60">{data.subscription.plan?.name ?? data.subscription.planId}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border border-white/10 bg-white/5 text-white/50">{t(`erp.saas.subStatus.${data.subscription.status}`)}</span>
                </div>
                <p className="text-[11px] text-white/30">{data.subscription.billingInterval}{data.subscription.trialEndsAt ? ` · ${t('erp.saas.detail.trialEnds', { date: fmtDate(data.subscription.trialEndsAt) })}` : ''}</p>
              </div>
            )}

            {tn.lastError && (
              <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-400">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> <span className="break-words">{tn.lastError}</span>
              </div>
            )}

            {/* Lifecycle actions */}
            <div>
              <p className="text-xs font-semibold text-white/50 mb-2">{t('erp.saas.detail.lifecycleActions')}</p>
              <div className="flex flex-wrap gap-2">
                {next.includes('SUSPENDED') && (
                  <ActionBtn icon={PauseCircle} label={t('erp.saas.detail.suspend')} tone="amber" disabled={action.isPending} onClick={() => action.mutate('suspend')} />
                )}
                {next.includes('ACTIVE') && tn.status === 'SUSPENDED' && (
                  <ActionBtn icon={PlayCircle} label={t('erp.saas.detail.reactivate')} tone="emerald" disabled={action.isPending} onClick={() => action.mutate('reactivate')} />
                )}
                {tn.status === 'FAILED' && (
                  <ActionBtn icon={RefreshCw} label={t('erp.saas.detail.retry')} tone="blue" disabled={action.isPending} onClick={() => action.mutate('retry')} />
                )}
                {tn.status === 'ACTIVE' && (
                  <ActionBtn icon={ArrowRightLeft} label={t('erp.saas.detail.changePlan')} tone="neutral" disabled={action.isPending} onClick={() => setShowChangePlan(true)} />
                )}
                {next.includes('ARCHIVED') && (
                  <ActionBtn icon={Archive} label={t('erp.saas.detail.archiveAction')} tone="red" disabled={action.isPending} onClick={() => action.mutate('archive')} />
                )}
                {next.length === 0 && tn.status === 'ARCHIVED' && <span className="text-xs text-white/30">{t('erp.saas.detail.archivedTerminal')}</span>}
              </div>
              {action.isError && (
                <p className="mt-2 text-xs text-red-400">{errMsg(action.error, t('erp.saas.detail.actionFailed'))}</p>
              )}
            </div>

            {/* Provisioning logs */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-white/50">{t('erp.saas.detail.provisioningLogs')}</p>
                <button onClick={() => refetch()} className="text-[11px] text-white/30 hover:text-white/60 flex items-center gap-1"><RefreshCw className="w-3 h-3" /> {t('erp.saas.detail.refresh')}</button>
              </div>
              <div className="space-y-1.5">
                {(data?.logs ?? []).length === 0 && <p className="text-xs text-white/25">{t('erp.saas.detail.noLogs')}</p>}
                {(data?.logs ?? []).map(l => (
                  <div key={l.id} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-white/70">{l.action}</span>
                      <span className={cn('px-2 py-0.5 rounded-full text-[9px] font-semibold border', PROV_BADGE[l.status] ?? PROV_BADGE.QUEUED)}>{t(`erp.saas.provStatus.${l.status}`)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-white/30">
                      <span>{t('erp.saas.detail.attempt', { count: l.attempts })}</span>
                      <span>{fmtDate(l.finishedAt ?? l.startedAt ?? l.createdAt)}</span>
                    </div>
                    {l.errorMessage && <p className="mt-1 text-[10px] text-red-400/70 break-words">{l.errorMessage}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <ChangePlanModal isOpen={showChangePlan} tenant={tn ?? null} onClose={() => setShowChangePlan(false)} />
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-white/30">{label}</p>
      <p className={cn('text-xs text-white/70 truncate', mono && 'font-mono')}>{value}</p>
    </div>
  );
}

const TONE: Record<string, string> = {
  amber:   'border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20',
  emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20',
  blue:    'border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20',
  red:     'border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20',
  neutral: 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10',
};
function ActionBtn({ icon: Icon, label, tone, onClick, disabled }: {
  icon: React.ComponentType<{ className?: string }>; label: string; tone: string; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={cn('flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors disabled:opacity-50', TONE[tone])}>
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );
}

// ─── Change Plan Modal ────────────────────────────────────────────────────────

function ChangePlanModal({ isOpen, tenant, onClose }: { isOpen: boolean; tenant: SaasTenant | null; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [planId, setPlanId] = useState('');
  useEffect(() => { if (isOpen) setPlanId(''); }, [isOpen]);

  const { data: plans = [] } = useQuery({
    queryKey: ['saas-plans', tenant?.productId],
    queryFn:  () => saasApi.getPlans(tenant!.productId).then(r => r.data.data.plans as SaasPlan[]),
    enabled:  isOpen && !!tenant?.productId, staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: () => saasApi.changePlan(tenant!.id, { planId }),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['saas-tenant', tenant!.id] });
      qc.invalidateQueries({ queryKey: ['saas-tenants'] });
      onClose();
    },
  });

  if (!isOpen || !tenant) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#111] shadow-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20"><ArrowRightLeft className="w-4.5 h-4.5 text-blue-400" /></div>
          <div><h2 className="text-base font-bold text-white">{t('erp.saas.changePlan.title')}</h2><p className="text-xs text-white/30">{t('erp.saas.changePlan.subtitle')}</p></div>
        </div>
        <div>
          <label className="block text-xs font-medium text-white/50 mb-1.5">{t('erp.saas.changePlan.newPlan')}</label>
          <select value={planId} onChange={e => setPlanId(e.target.value)} className={sharedInput}>
            <option value="">{t('erp.saas.changePlan.selectPlan')}</option>
            {plans.map(pl => <option key={pl.id} value={pl.id}>{pl.name}</option>)}
          </select>
        </div>
        {mutation.isError && <p className="text-xs text-red-400">{errMsg(mutation.error, t('erp.saas.changePlan.error'))}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white text-sm min-h-[44px] transition-colors">{t('erp.common.cancel')}</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !planId}
            className="flex-1 px-4 py-2.5 rounded-xl bg-blue-500 text-white font-semibold hover:bg-blue-600 text-sm disabled:opacity-50 min-h-[44px] transition-colors">
            {mutation.isPending ? t('erp.saas.changePlan.saving') : t('erp.saas.changePlan.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CATALOG TAB (Products + Plans)
// ═══════════════════════════════════════════════════════════════════════════════

function CatalogTab() {
  const { t } = useTranslation();
  const [showProduct, setShowProduct] = useState(false);
  const [editProduct, setEditProduct] = useState<SaasProduct | null>(null);
  const [planProduct, setPlanProduct] = useState<SaasProduct | null>(null);

  const { data: products = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['saas-products'],
    queryFn:  () => saasApi.getProducts().then(r => r.data.data.products as SaasProduct[]),
    staleTime: 15_000,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/40">{t('erp.saas.catalog.subtitle')}</p>
        <button onClick={() => { setEditProduct(null); setShowProduct(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#fbbf24] text-black font-semibold hover:bg-[#f59e0b] transition-colors text-sm min-h-[44px]">
          <Plus className="w-4 h-4" /> {t('erp.saas.catalog.newProduct')}
        </button>
      </div>

      {isLoading && <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4 animate-pulse h-24" />)}</div>}
      {isError && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-red-400/50 mx-auto" />
            <button onClick={() => refetch()} className="px-4 py-2 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-xs text-white/50 transition-colors">{t('erp.common.retry')}</button>
          </div>
        </div>
      )}
      {!isLoading && !isError && products.length === 0 && (
        <div className="flex items-center justify-center py-16">
          <div className="text-center space-y-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] mx-auto"><Package className="w-7 h-7 text-white/15" /></div>
            <p className="text-sm text-white/30">{t('erp.saas.catalog.empty')}</p>
            <button onClick={() => { setEditProduct(null); setShowProduct(true); }} className="px-4 py-2 rounded-xl border border-[#fbbf24]/30 bg-[#fbbf24]/10 text-[#fbbf24] text-xs font-semibold hover:bg-[#fbbf24]/20 transition-colors">{t('erp.saas.catalog.createFirst')}</button>
          </div>
        </div>
      )}
      {!isLoading && !isError && products.length > 0 && (
        <div className="space-y-3">
          {products.map(p => (
            <ProductCard key={p.id} product={p}
              onEdit={() => { setEditProduct(p); setShowProduct(true); }}
              onManagePlans={() => setPlanProduct(p)} />
          ))}
        </div>
      )}

      <ProductModal isOpen={showProduct} product={editProduct} onClose={() => { setShowProduct(false); setEditProduct(null); }} />
      <PlansModal product={planProduct} onClose={() => setPlanProduct(null)} />
    </div>
  );
}

function ProductCard({ product, onEdit, onManagePlans }: { product: SaasProduct; onEdit: () => void; onManagePlans: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const menu = useDropdown('right');
  const del = useMutation({
    mutationFn: () => saasApi.deleteProduct(product.id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['saas-products'] }),
  });
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-[#fbbf24]/20 bg-[#fbbf24]/10">
            <Package className="w-4 h-4 text-[#fbbf24]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-white">{product.name}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border border-white/10 bg-white/5 text-white/50 font-mono">{product.code}</span>
              {!product.isActive && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border border-red-500/30 bg-red-500/10 text-red-400">{t('erp.saas.product.inactive')}</span>}
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border border-white/10 bg-white/5 text-white/40">{product.provisioner}</span>
            </div>
            {product.description && <p className="mt-1 text-xs text-white/40 line-clamp-2">{product.description}</p>}
            <p className="mt-1 text-[11px] text-white/25">{product.subdomainZone || `${product.code}.handla.tech`}{product.provisioningBaseUrl ? ` · ${product.provisioningBaseUrl}` : ''}</p>
          </div>
        </div>
        <div ref={menu.triggerRef} className="relative">
          <button onClick={menu.toggle} className="flex h-8 w-8 items-center justify-center rounded-lg text-white/25 hover:text-white hover:bg-white/10 transition-colors">
            <MoreVertical className="w-4 h-4" />
          </button>
          <DropdownPortal isOpen={menu.isOpen} style={menu.dropdownStyle} onClose={menu.close} width={180}>
            <div className="rounded-xl border border-white/10 bg-[#161616] shadow-2xl py-1.5">
              <button onClick={() => { onManagePlans(); menu.close(); }} className="flex items-center gap-2.5 w-full px-3.5 py-2 text-xs text-white/70 hover:bg-white/[0.06] hover:text-white transition-colors"><Layers className="w-3.5 h-3.5" /> {t('erp.saas.product.managePlans')}</button>
              <button onClick={() => { onEdit(); menu.close(); }} className="flex items-center gap-2.5 w-full px-3.5 py-2 text-xs text-white/70 hover:bg-white/[0.06] hover:text-white transition-colors"><Edit2 className="w-3.5 h-3.5" /> {t('erp.saas.product.edit')}</button>
              <div className="my-1 border-t border-white/[0.06]" />
              <button onClick={() => { if (confirm(t('erp.saas.product.deleteConfirm', { name: product.name }))) del.mutate(); menu.close(); }} className="flex items-center gap-2.5 w-full px-3.5 py-2 text-xs text-red-400 hover:bg-red-400/10 transition-colors"><Trash2 className="w-3.5 h-3.5" /> {t('erp.saas.product.delete')}</button>
            </div>
          </DropdownPortal>
        </div>
      </div>
      {del.isError && <p className="mt-2 text-xs text-red-400">{errMsg(del.error, t('erp.saas.product.deleteError'))}</p>}
    </div>
  );
}

function ProductModal({ isOpen, product, onClose }: { isOpen: boolean; product: SaasProduct | null; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const isEdit = product !== null;
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [subdomainZone, setSubdomainZone] = useState('');
  const [provisioner, setProvisioner] = useState('mock');
  const [provisioningBaseUrl, setProvisioningBaseUrl] = useState('');
  const [provisioningKey, setProvisioningKey] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    if (isEdit && product) {
      setCode(product.code); setName(product.name); setDescription(product.description ?? '');
      setSubdomainZone(product.subdomainZone ?? ''); setProvisioner(product.provisioner);
      setProvisioningBaseUrl(product.provisioningBaseUrl ?? ''); setProvisioningKey(''); setIsActive(product.isActive);
    } else {
      setCode(''); setName(''); setDescription(''); setSubdomainZone('');
      setProvisioner('mock'); setProvisioningBaseUrl(''); setProvisioningKey(''); setIsActive(true);
    }
  }, [isOpen, isEdit, product]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload: any = {
        name: name.trim(),
        ...(description.trim() && { description: description.trim() }),
        ...(subdomainZone.trim() && { subdomainZone: subdomainZone.trim() }),
        provisioner,
        ...(provisioningBaseUrl.trim() && { provisioningBaseUrl: provisioningBaseUrl.trim() }),
        ...(provisioningKey.trim() && { provisioningKey: provisioningKey.trim() }),
        isActive,
      };
      if (isEdit) return saasApi.updateProduct(product!.id, payload);
      return saasApi.createProduct({ code: code.trim(), ...payload });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['saas-products'] }); onClose(); },
  });

  const canSubmit = (isEdit || code.trim()) && name.trim();
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#111] shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4 sticky top-0 bg-[#111] z-10">
          <h2 className="text-base font-bold text-white">{isEdit ? t('erp.saas.product.titleEdit') : t('erp.saas.product.titleNew')}</h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">{t('erp.saas.product.code')}</label>
              <input value={code} onChange={e => setCode(e.target.value.toLowerCase())} disabled={isEdit} placeholder="mudar" className={cn(sharedInput, isEdit && 'opacity-60')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">{t('erp.saas.product.name')}</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Mudar" className={sharedInput} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">{t('erp.saas.product.description')}</label>
            <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} className={cn(sharedInput, 'resize-none')} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">{t('erp.saas.product.subdomainZone')}</label>
              <input value={subdomainZone} onChange={e => setSubdomainZone(e.target.value)} placeholder="mudar.handla.tech" className={sharedInput} />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">{t('erp.saas.product.provisioner')}</label>
              <select value={provisioner} onChange={e => setProvisioner(e.target.value)} className={sharedInput}>
                <option value="mock">{t('erp.saas.product.provisionerMock')}</option>
                <option value="http">{t('erp.saas.product.provisionerHttp')}</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">{t('erp.saas.product.baseUrl')}</label>
            <input value={provisioningBaseUrl} onChange={e => setProvisioningBaseUrl(e.target.value)} placeholder="https://api.mudar.example.com" className={sharedInput} />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">{t('erp.saas.product.key')} {isEdit && <span className="text-white/25">{t('erp.saas.product.keyKeep')}</span>}</label>
            <input type="password" value={provisioningKey} onChange={e => setProvisioningKey(e.target.value)} placeholder={t('erp.saas.product.keyPlaceholder')} className={sharedInput} />
          </div>
          <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="accent-[#fbbf24]" /> {t('erp.saas.product.active')}
          </label>

          {mutation.isError && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {errMsg(mutation.error, t('erp.saas.product.error'))}
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white text-sm min-h-[44px] transition-colors">{t('erp.common.cancel')}</button>
            <button type="button" disabled={mutation.isPending || !canSubmit} onClick={() => mutation.mutate()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#fbbf24] text-black font-semibold hover:bg-[#f59e0b] text-sm disabled:opacity-50 min-h-[44px] transition-colors">
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {mutation.isPending ? t('erp.saas.product.saving') : isEdit ? t('erp.saas.product.saveChanges') : t('erp.saas.product.createProduct')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Plans Modal (list + create/edit/delete plans for a product) ──────────────

function PlansModal({ product, onClose }: { product: SaasProduct | null; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<SaasPlan | null>(null);
  const [showForm, setShowForm] = useState(false);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['saas-plans', product?.id],
    queryFn:  () => saasApi.getPlans(product!.id).then(r => r.data.data.plans as SaasPlan[]),
    enabled:  !!product,
  });

  const del = useMutation({
    mutationFn: (id: string) => saasApi.deletePlan(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['saas-plans', product!.id] }),
  });

  if (!product) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#111] shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4 sticky top-0 bg-[#111] z-10">
          <div>
            <h2 className="text-base font-bold text-white">{t('erp.saas.plans.title', { name: product.name })}</h2>
            <p className="text-xs text-white/30">{t('erp.saas.plans.subtitle')}</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          {!showForm && (
            <button onClick={() => { setEditing(null); setShowForm(true); }}
              className="flex items-center gap-1.5 text-xs text-[#fbbf24] hover:text-[#f59e0b] transition-colors"><Plus className="w-3.5 h-3.5" /> {t('erp.saas.plans.addPlan')}</button>
          )}

          {showForm && (
            <PlanForm product={product} plan={editing} onDone={() => { setShowForm(false); setEditing(null); }} />
          )}

          {isLoading && <Loader2 className="w-5 h-5 animate-spin text-white/30" />}
          {!isLoading && plans.length === 0 && !showForm && <p className="text-xs text-white/25">{t('erp.saas.plans.empty')}</p>}
          <div className="space-y-2">
            {plans.map(pl => (
              <div key={pl.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white">{pl.name}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border border-white/10 bg-white/5 text-white/50 font-mono">{pl.code}</span>
                      {!pl.isActive && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border border-red-500/30 bg-red-500/10 text-red-400">{t('erp.saas.plans.inactive')}</span>}
                    </div>
                    <p className="mt-1 text-[11px] text-white/30">
                      {pl.currency || ''} {pl.priceMonthly ?? '—'}/mo · {pl.priceYearly ?? '—'}/yr · {t('erp.saas.plans.trial', { days: pl.trialDays })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => { setEditing(pl); setShowForm(true); }} className="flex h-7 w-7 items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => { if (confirm(t('erp.saas.plans.deleteConfirm', { name: pl.name }))) del.mutate(pl.id); }} className="flex h-7 w-7 items-center justify-center rounded-lg text-red-400/70 hover:text-red-400 hover:bg-red-400/10 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PlanForm({ product, plan, onDone }: { product: SaasProduct; plan: SaasPlan | null; onDone: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const isEdit = plan !== null;
  const [code, setCode] = useState(plan?.code ?? '');
  const [name, setName] = useState(plan?.name ?? '');
  const [priceMonthly, setPriceMonthly] = useState(plan?.priceMonthly ?? '');
  const [priceYearly, setPriceYearly] = useState(plan?.priceYearly ?? '');
  const [currency, setCurrency] = useState(plan?.currency ?? '');
  const [trialDays, setTrialDays] = useState(plan?.trialDays ?? 0);
  const [limitsText, setLimitsText] = useState(plan?.limits ? JSON.stringify(plan.limits, null, 2) : '');
  const [entitlementsText, setEntitlementsText] = useState(plan?.entitlements ? JSON.stringify(plan.entitlements, null, 2) : '');
  const [isActive, setIsActive] = useState(plan?.isActive ?? true);
  const [jsonErr, setJsonErr] = useState('');

  const mutation = useMutation({
    mutationFn: () => {
      let limits: any, entitlements: any;
      try { limits = limitsText.trim() ? JSON.parse(limitsText) : undefined; }
      catch { throw new Error(t('erp.saas.planForm.invalidLimits')); }
      try { entitlements = entitlementsText.trim() ? JSON.parse(entitlementsText) : undefined; }
      catch { throw new Error(t('erp.saas.planForm.invalidEntitlements')); }
      const payload: any = {
        name: name.trim(),
        ...(priceMonthly !== '' && { priceMonthly: String(priceMonthly) }),
        ...(priceYearly !== '' && { priceYearly: String(priceYearly) }),
        ...(currency.trim() && { currency: currency.trim().toUpperCase() }),
        ...(limits !== undefined && { limits }),
        ...(entitlements !== undefined && { entitlements }),
        trialDays: Number(trialDays) || 0,
        isActive,
      };
      if (isEdit) return saasApi.updatePlan(plan!.id, payload);
      return saasApi.createPlan(product.id, { code: code.trim(), ...payload });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['saas-plans', product.id] }); onDone(); },
    onError:   (e) => setJsonErr((e as any)?.message?.includes('JSON') ? (e as any).message : ''),
  });

  const canSubmit = (isEdit || code.trim()) && name.trim();
  return (
    <div className="rounded-xl border border-[#fbbf24]/20 bg-[#fbbf24]/[0.03] p-4 space-y-3">
      <p className="text-xs font-semibold text-[#fbbf24]">{isEdit ? t('erp.saas.planForm.titleEdit') : t('erp.saas.planForm.titleNew')}</p>
      <div className="grid grid-cols-2 gap-3">
        <input value={code} onChange={e => setCode(e.target.value.toLowerCase())} disabled={isEdit} placeholder={t('erp.saas.planForm.code')} className={cn(sharedInput, isEdit && 'opacity-60')} />
        <input value={name} onChange={e => setName(e.target.value)} placeholder={t('erp.saas.planForm.name')} className={sharedInput} />
        <input value={priceMonthly} onChange={e => setPriceMonthly(e.target.value)} placeholder={t('erp.saas.planForm.priceMonthly')} className={sharedInput} />
        <input value={priceYearly} onChange={e => setPriceYearly(e.target.value)} placeholder={t('erp.saas.planForm.priceYearly')} className={sharedInput} />
        <input value={currency} onChange={e => setCurrency(e.target.value)} maxLength={8} placeholder={t('erp.saas.planForm.currency')} className={cn(sharedInput, 'uppercase')} />
        <input type="number" min={0} value={trialDays} onChange={e => setTrialDays(Number(e.target.value) || 0)} placeholder={t('erp.saas.planForm.trialDays')} className={sharedInput} />
      </div>
      <div>
        <label className="block text-[11px] text-white/40 mb-1">{t('erp.saas.planForm.limits')}</label>
        <textarea rows={2} value={limitsText} onChange={e => setLimitsText(e.target.value)} placeholder='{ "seats": 10 }' className={cn(sharedInput, 'resize-none font-mono text-xs')} />
      </div>
      <div>
        <label className="block text-[11px] text-white/40 mb-1">{t('erp.saas.planForm.entitlements')}</label>
        <textarea rows={2} value={entitlementsText} onChange={e => setEntitlementsText(e.target.value)} placeholder='{ "reports": true }' className={cn(sharedInput, 'resize-none font-mono text-xs')} />
      </div>
      <label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer">
        <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="accent-[#fbbf24]" /> {t('erp.saas.planForm.active')}
      </label>
      {(jsonErr || mutation.isError) && <p className="text-xs text-red-400">{jsonErr || errMsg(mutation.error, t('erp.saas.planForm.error'))}</p>}
      <div className="flex gap-2">
        <button onClick={onDone} className="flex-1 px-3 py-2 rounded-lg border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08] text-xs transition-colors">{t('erp.common.cancel')}</button>
        <button onClick={() => { setJsonErr(''); mutation.mutate(); }} disabled={mutation.isPending || !canSubmit}
          className="flex-1 px-3 py-2 rounded-lg bg-[#fbbf24] text-black font-semibold hover:bg-[#f59e0b] text-xs disabled:opacity-50 transition-colors">
          {mutation.isPending ? t('erp.saas.planForm.saving') : isEdit ? t('erp.saas.planForm.save') : t('erp.saas.planForm.addPlan')}
        </button>
      </div>
    </div>
  );
}
