'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/useDebounce';
import {
  LifeBuoy, Plus, Loader2, Search, X, AlertCircle, CheckCircle2, Send,
  ChevronLeft, ChevronRight, MessageSquare, Clock, Key, Copy, Trash2, ShieldAlert,
  Lock,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { supportApi, clientsApi } from '@/lib/api';
import type {
  Ticket, PaginatedTickets, TicketStatus, TicketPriority, TicketCategory,
  TicketReply, ClientApiKey, PaginatedClients,
} from '@/types';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';

type TFn = (key: string, params?: Record<string, any>) => string;

const STATUS_BADGE: Record<TicketStatus, string> = {
  OPEN:             'border-blue-500/30 bg-blue-500/10 text-blue-400',
  IN_PROGRESS:      'border-[#fbbf24]/30 bg-[#fbbf24]/10 text-[#fbbf24]',
  WAITING_CUSTOMER: 'border-purple-500/30 bg-purple-500/10 text-purple-400',
  RESOLVED:         'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  CLOSED:           'border-white/15 bg-white/5 text-white/40',
};
const PRIORITY_BADGE: Record<TicketPriority, string> = {
  LOW:    'border-white/15 bg-white/5 text-white/50',
  MEDIUM: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
  HIGH:   'border-orange-500/30 bg-orange-500/10 text-orange-400',
  URGENT: 'border-red-500/30 bg-red-500/10 text-red-400',
};
const STATUSES:  (TicketStatus | 'all')[]  = ['all', 'OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED'];
const PRIORITIES: TicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const CATEGORIES: TicketCategory[] = ['BUG', 'FEATURE', 'QUESTION', 'BILLING', 'OTHER'];

const sharedInput =
  'w-full rounded-xl border border-white/10 bg-[#0f0f0f] text-white px-3 py-2.5 text-sm focus:outline-none focus:border-[#fbbf24]/50 focus:bg-white/[0.04] transition-all';

function fmtDateTime(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function clientLabel(c: { company?: string | null; user?: { name?: string } } | null | undefined, t: TFn) {
  if (!c) return '—';
  return c.user?.name || c.company || t('erp.support.clientFallback');
}

// ═══════════════════════════════════════════════════════════════════════════
// STATS
// ═══════════════════════════════════════════════════════════════════════════

function StatsBar({ isStaff }: { isStaff: boolean }) {
  const { t } = useTranslation();
  const { data } = useQuery({
    queryKey: ['erp-support-stats'],
    queryFn:  () => supportApi.getStats().then(r => r.data.data as any),
    enabled:  isStaff, staleTime: 30_000,
  });
  if (!isStaff || !data) return null;
  const cards = [
    { label: t('erp.support.stats.total'), value: data.total ?? 0, cls: 'border-white/[0.06] bg-white/[0.03] text-white' },
    { label: t('erp.support.stats.open'), value: data.open ?? 0, cls: 'border-blue-500/20 bg-blue-500/5 text-blue-400' },
    { label: t('erp.support.stats.slaBreached'), value: data.slaBreached ?? 0, cls: 'border-red-500/20 bg-red-500/5 text-red-400' },
    { label: t('erp.support.stats.resolved'), value: data.byStatus?.RESOLVED ?? 0, cls: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400' },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map(c => (
        <div key={c.label} className={cn('rounded-2xl border p-4', c.cls)}>
          <p className="text-[10px] font-semibold text-white/25 uppercase tracking-wide">{c.label}</p>
          <p className="text-2xl font-bold mt-1">{c.value}</p>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TICKET DETAIL DRAWER
// ═══════════════════════════════════════════════════════════════════════════

function TicketDetail({ ticketId, isStaff, onClose }: { ticketId: string; isStaff: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { t } = useTranslation();
  const [replyBody, setReplyBody] = useState('');
  const [isInternal, setIsInternal] = useState(false);

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['erp-ticket', ticketId],
    queryFn:  () => supportApi.getTicket(ticketId).then(r => r.data.data as Ticket),
  });

  const replyMutation = useMutation({
    mutationFn: () => supportApi.addReply(ticketId, { body: replyBody, ...(isStaff && { isInternal }) }),
    onSuccess:  () => {
      setReplyBody(''); setIsInternal(false);
      qc.invalidateQueries({ queryKey: ['erp-ticket', ticketId] });
      qc.invalidateQueries({ queryKey: ['erp-tickets'] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: (patch: any) => supportApi.updateTicket(ticketId, patch),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['erp-ticket', ticketId] });
      qc.invalidateQueries({ queryKey: ['erp-tickets'] });
      qc.invalidateQueries({ queryKey: ['erp-support-stats'] });
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-[#0c0c0c] border-l border-white/10 h-full overflow-y-auto">
        {isLoading || !ticket ? (
          <div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 text-[#fbbf24] animate-spin" /></div>
        ) : (
          <div className="flex flex-col min-h-full">
            {/* Header */}
            <div className="border-b border-white/[0.06] p-5 sticky top-0 bg-[#0c0c0c] z-10">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-white/30">{ticket.ticketNumber}</p>
                  <h2 className="text-base font-bold text-white mt-0.5">{ticket.subject}</h2>
                </div>
                <button onClick={onClose} className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors"><X className="w-4 h-4" /></button>
              </div>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold border', STATUS_BADGE[ticket.status])}>{t(`erp.support.status.${ticket.status}`)}</span>
                <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold border', PRIORITY_BADGE[ticket.priority])}>{t(`erp.support.priority.${ticket.priority}`)}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] border border-white/10 bg-white/5 text-white/40">{t(`erp.support.category.${ticket.category}`)}</span>
                {ticket.slaBreached && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border border-red-500/30 bg-red-500/10 text-red-400 flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> SLA</span>}
              </div>
              <div className="mt-2 text-[11px] text-white/30 flex flex-wrap gap-x-3">
                <span>{clientLabel(ticket.client, t)}</span>
                {ticket.project && <span>· {ticket.project.title ?? t('erp.support.detail.projectFallback')}</span>}
                <span>· {t('erp.support.detail.opened', { date: fmtDateTime(ticket.createdAt) })}</span>
              </div>

              {/* Staff controls */}
              {isStaff && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <select value={ticket.status} onChange={e => statusMutation.mutate({ status: e.target.value })} className={cn(sharedInput, 'py-1.5 text-xs')}>
                    {(['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED'] as TicketStatus[]).map(s => <option key={s} value={s}>{t(`erp.support.status.${s}`)}</option>)}
                  </select>
                  <select value={ticket.priority} onChange={e => statusMutation.mutate({ priority: e.target.value })} className={cn(sharedInput, 'py-1.5 text-xs')}>
                    {PRIORITIES.map(p => <option key={p} value={p}>{t(`erp.support.priority.${p}`)}</option>)}
                  </select>
                </div>
              )}
            </div>

            {/* Body + thread */}
            <div className="flex-1 p-5 space-y-4">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="text-xs text-white/30 mb-1">{t('erp.support.detail.description')}</p>
                <p className="text-sm text-white/70 whitespace-pre-wrap">{ticket.description}</p>
              </div>

              {(ticket.replies ?? []).map((r: TicketReply) => (
                <div key={r.id} className={cn('rounded-xl border p-4',
                  r.isInternal ? 'border-amber-500/20 bg-amber-500/[0.04]' : 'border-white/[0.06] bg-white/[0.02]')}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-white/80">{r.authorName ?? t('erp.support.detail.userFallback')}</span>
                    {r.isInternal && <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold border border-amber-500/30 bg-amber-500/10 text-amber-400 flex items-center gap-1"><Lock className="w-2.5 h-2.5" /> {t('erp.support.detail.internal')}</span>}
                    <span className="text-[10px] text-white/25 ml-auto">{fmtDateTime(r.createdAt)}</span>
                  </div>
                  <p className="text-sm text-white/70 whitespace-pre-wrap">{r.body}</p>
                </div>
              ))}
            </div>

            {/* Reply box */}
            <div className="border-t border-white/[0.06] p-4 sticky bottom-0 bg-[#0c0c0c]">
              <textarea rows={3} value={replyBody} onChange={e => setReplyBody(e.target.value)} placeholder={t('erp.support.detail.replyPlaceholder')} className={cn(sharedInput, 'resize-none')} />
              <div className="mt-2 flex items-center justify-between">
                {isStaff ? (
                  <label className="flex items-center gap-2 text-xs text-white/50 cursor-pointer">
                    <input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)} className="h-3.5 w-3.5 rounded border-white/20 bg-[#0f0f0f] accent-amber-400" />
                    {t('erp.support.detail.internalNote')}
                  </label>
                ) : <span />}
                <button onClick={() => replyBody.trim() && replyMutation.mutate()} disabled={replyMutation.isPending || !replyBody.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#fbbf24] text-black font-semibold hover:bg-[#f59e0b] text-sm disabled:opacity-50 transition-colors">
                  {replyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} {t('erp.support.detail.reply')}
                </button>
              </div>
              {replyMutation.isError && <p className="mt-2 text-xs text-red-400">{(replyMutation.error as any)?.response?.data?.message ?? t('erp.support.detail.replyFailed')}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CREATE TICKET MODAL
// ═══════════════════════════════════════════════════════════════════════════

function CreateTicketModal({ isOpen, onClose, isStaff }: { isOpen: boolean; onClose: () => void; isStaff: boolean }) {
  const qc = useQueryClient();
  const { t } = useTranslation();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [clientId, setClientId] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('MEDIUM');
  const [category, setCategory] = useState<TicketCategory>('QUESTION');

  const { data: clientsData } = useQuery({
    queryKey: ['erp-clients-select'],
    queryFn:  () => clientsApi.getClients({ limit: 100 }).then(r => r.data.data as PaginatedClients),
    enabled:  isOpen && isStaff, staleTime: 60_000,
  });
  const clients = clientsData?.clients ?? [];

  useEffect(() => {
    if (isOpen) { setSubject(''); setDescription(''); setClientId(''); setPriority('MEDIUM'); setCategory('QUESTION'); }
  }, [isOpen]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload: any = { subject, description, priority, category };
      if (isStaff && clientId) payload.clientId = clientId;
      return supportApi.createTicket(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['erp-tickets'] }); qc.invalidateQueries({ queryKey: ['erp-support-stats'] }); onClose(); },
  });

  const canSubmit = subject.trim() && description.trim() && (!isStaff || clientId);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#111] shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4 sticky top-0 bg-[#111] z-10">
          <h2 className="text-base font-bold text-white">{t('erp.support.create.title')}</h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          {isStaff && (
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">{t('erp.support.create.client')}</label>
              <select value={clientId} onChange={e => setClientId(e.target.value)} className={sharedInput}>
                <option value="">{t('erp.support.create.selectClient')}</option>
                {clients.map(c => <option key={c.id} value={c.id}>{clientLabel(c, t)}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">{t('erp.support.create.subject')}</label>
            <input value={subject} onChange={e => setSubject(e.target.value)} className={sharedInput} placeholder={t('erp.support.create.subjectPlaceholder')} />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">{t('erp.support.create.description')}</label>
            <textarea rows={4} value={description} onChange={e => setDescription(e.target.value)} className={cn(sharedInput, 'resize-none')} placeholder={t('erp.support.create.descriptionPlaceholder')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">{t('erp.support.create.priority')}</label>
              <select value={priority} onChange={e => setPriority(e.target.value as TicketPriority)} className={sharedInput}>
                {PRIORITIES.map(p => <option key={p} value={p}>{t(`erp.support.priority.${p}`)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">{t('erp.support.create.category')}</label>
              <select value={category} onChange={e => setCategory(e.target.value as TicketCategory)} className={sharedInput}>
                {CATEGORIES.map(c => <option key={c} value={c}>{t(`erp.support.category.${c}`)}</option>)}
              </select>
            </div>
          </div>
          {mutation.isError && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{(mutation.error as any)?.response?.data?.message ?? t('erp.support.create.createFailed')}
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white text-sm min-h-[44px] transition-colors">{t('erp.common.cancel')}</button>
            <button type="button" disabled={mutation.isPending || !canSubmit} onClick={() => mutation.mutate()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#fbbf24] text-black font-semibold hover:bg-[#f59e0b] text-sm disabled:opacity-50 min-h-[44px] transition-colors">
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}{mutation.isPending ? t('erp.support.create.creating') : t('erp.support.create.submit')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// API KEYS MODAL (staff)
// ═══════════════════════════════════════════════════════════════════════════

function ApiKeysModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { t } = useTranslation();
  const [clientId, setClientId] = useState('');
  const [label, setLabel] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);

  const { data: clientsData } = useQuery({
    queryKey: ['erp-clients-select'],
    queryFn:  () => clientsApi.getClients({ limit: 100 }).then(r => r.data.data as PaginatedClients),
    enabled:  isOpen, staleTime: 60_000,
  });
  const clients = clientsData?.clients ?? [];

  const { data: keysData } = useQuery({
    queryKey: ['erp-api-keys'],
    queryFn:  () => supportApi.listApiKeys().then(r => r.data.data as ClientApiKey[] | { keys: ClientApiKey[] }),
    enabled:  isOpen, staleTime: 15_000,
  });
  const keys: ClientApiKey[] = Array.isArray(keysData) ? keysData : (keysData as any)?.keys ?? [];

  const createMutation = useMutation({
    mutationFn: () => supportApi.createApiKey({ clientId, ...(label.trim() && { label: label.trim() }) }),
    onSuccess:  (r) => {
      const data = r.data.data as ClientApiKey;
      setNewKey(data.plaintext ?? null);
      setLabel('');
      qc.invalidateQueries({ queryKey: ['erp-api-keys'] });
    },
  });
  const revokeMutation = useMutation({
    mutationFn: (id: string) => supportApi.revokeApiKey(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['erp-api-keys'] }),
  });

  useEffect(() => { if (isOpen) { setClientId(''); setLabel(''); setNewKey(null); } }, [isOpen]);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#111] shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4 sticky top-0 bg-[#111] z-10">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2"><Key className="w-4 h-4 text-[#fbbf24]" /> {t('erp.support.keys.title')}</h2>
            <p className="text-xs text-white/30">{t('erp.support.keys.subtitle')}</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          {newKey && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-2">
              <p className="text-xs text-emerald-300 font-semibold">{t('erp.support.keys.createdNotice')}</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs text-white bg-black/40 rounded-lg px-3 py-2 break-all font-mono">{newKey}</code>
                <button onClick={() => navigator.clipboard?.writeText(newKey)} className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-colors"><Copy className="w-4 h-4" /></button>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
            <p className="text-xs font-semibold text-white/50">{t('erp.support.keys.generateNew')}</p>
            <select value={clientId} onChange={e => setClientId(e.target.value)} className={sharedInput}>
              <option value="">{t('erp.support.keys.selectClient')}</option>
              {clients.map(c => <option key={c.id} value={c.id}>{clientLabel(c, t)}</option>)}
            </select>
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder={t('erp.support.keys.labelPlaceholder')} className={sharedInput} />
            <button onClick={() => clientId && createMutation.mutate()} disabled={createMutation.isPending || !clientId}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#fbbf24] text-black font-semibold hover:bg-[#f59e0b] text-sm disabled:opacity-50 transition-colors">
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} {t('erp.support.keys.generate')}
            </button>
            {createMutation.isError && <p className="text-xs text-red-400">{(createMutation.error as any)?.response?.data?.message ?? t('erp.support.keys.createFailed')}</p>}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-white/50">{t('erp.support.keys.existing')}</p>
            {keys.length === 0 && <p className="text-xs text-white/25">{t('erp.support.keys.noKeys')}</p>}
            {keys.map(k => (
              <div key={k.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono text-white/70">{k.prefix}…</code>
                    {!k.isActive && <span className="px-1.5 py-0.5 rounded text-[9px] border border-white/10 bg-white/5 text-white/40">{t('erp.support.keys.revoked')}</span>}
                  </div>
                  <p className="text-[11px] text-white/30">{k.label || t('erp.support.keys.unlabeled')}{k.lastUsedAt ? ` ${t('erp.support.keys.lastUsed', { date: fmtDateTime(k.lastUsedAt) })}` : ''}</p>
                </div>
                {k.isActive && (
                  <button onClick={() => revokeMutation.mutate(k.id)} disabled={revokeMutation.isPending}
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-white/25 hover:text-red-400 hover:bg-red-400/10 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════

export default function SupportPage() {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { user } = useAuthStore();
  const isStaff = user?.role === 'ADMIN' || user?.role === 'EMPLOYEE';

  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 300);
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const [openTicket, setOpenTicket] = useState<string | null>(null);

  const params = { page, limit: 12, ...(statusFilter !== 'all' && { status: statusFilter }), ...(search && { search }) };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['erp-tickets', params],
    queryFn:  () => supportApi.getTickets(params).then(r => r.data.data as PaginatedTickets),
    staleTime: 15_000, enabled: mounted, placeholderData: (prev: any) => prev,
  });
  const tickets    = data?.tickets ?? [];
  const totalPages = data?.pages ?? 1;

  if (!mounted) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#fbbf24]/10 border border-[#fbbf24]/20"><LifeBuoy className="w-4.5 h-4.5 text-[#fbbf24]" /></span>
            {t('erp.support.title')}
          </h1>
          <p className="text-sm text-white/30 mt-1 ml-11">{t('erp.support.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {isStaff && (
            <button onClick={() => setShowKeys(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white text-sm min-h-[44px] transition-colors">
              <Key className="w-4 h-4" /> {t('erp.support.apiKeys')}
            </button>
          )}
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#fbbf24] text-black font-semibold hover:bg-[#f59e0b] transition-colors text-sm min-h-[44px]">
            <Plus className="w-4 h-4" /> {t('erp.support.newTicket')}
          </button>
        </div>
      </div>

      <StatsBar isStaff={isStaff} />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06] flex-wrap">
          {STATUSES.map(st => (
            <button key={st} onClick={() => { setStatusFilter(st); setPage(1); }}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                statusFilter === st ? 'bg-[#fbbf24] text-black shadow-sm' : 'text-white/35 hover:text-white')}>
              {st === 'all' ? t('erp.ui.all') : t(`erp.support.status.${st}`)}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
          <input placeholder={t('erp.support.searchPlaceholder')} value={searchInput} onChange={e => { setSearchInput(e.target.value); setPage(1); }} className="pl-8 pr-4 py-2 rounded-lg border border-white/10 bg-white/[0.04] text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#fbbf24]/40 focus:bg-white/[0.06] w-52 transition-all" />
        </div>
      </div>

      {isLoading && <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4 animate-pulse h-20" />)}</div>}
      {isError && (
        <div className="text-center py-12 space-y-3"><AlertCircle className="w-8 h-8 text-red-400/50 mx-auto" /><p className="text-sm text-white/30">{t('erp.support.loadFailed')}</p>
          <button onClick={() => refetch()} className="px-4 py-2 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-xs text-white/50">{t('erp.common.retry')}</button></div>
      )}
      {!isLoading && !isError && tickets.length === 0 && (
        <div className="text-center py-16 space-y-4"><div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] mx-auto"><LifeBuoy className="w-7 h-7 text-white/15" /></div><p className="text-sm text-white/30">{t('erp.support.empty')}</p></div>
      )}
      {!isLoading && !isError && tickets.length > 0 && (
        <div className="space-y-2">
          {tickets.map(tk => (
            <button key={tk.id} onClick={() => setOpenTicket(tk.id)}
              className="group w-full text-left flex items-start justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition-all hover:bg-white/[0.04]">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03]"><MessageSquare className="w-4 h-4 text-white/40" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-white/30">{tk.ticketNumber}</span>
                    <span className="text-sm font-semibold text-white truncate">{tk.subject}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold border', STATUS_BADGE[tk.status])}>{t(`erp.support.status.${tk.status}`)}</span>
                    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold border', PRIORITY_BADGE[tk.priority])}>{t(`erp.support.priority.${tk.priority}`)}</span>
                    {isStaff && <span className="text-[11px] text-white/30">{clientLabel(tk.client, t)}</span>}
                    {tk.slaBreached && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border border-red-500/30 bg-red-500/10 text-red-400 flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> SLA</span>}
                  </div>
                </div>
              </div>
              <span className="text-[11px] text-white/25 flex-shrink-0 flex items-center gap-1"><Clock className="w-3 h-3" />{fmtDateTime(tk.updatedAt)}</span>
            </button>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-white/30">{t('erp.support.pageInfo', { total: data?.total ?? 0, page, totalPages })}</p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/40 hover:text-white hover:border-white/20 disabled:opacity-30 transition-all"><ChevronLeft className="w-4 h-4" /></button>
            <span className="px-3 text-xs text-white/40">{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/40 hover:text-white hover:border-white/20 disabled:opacity-30 transition-all"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {openTicket && <TicketDetail ticketId={openTicket} isStaff={isStaff} onClose={() => setOpenTicket(null)} />}
      <CreateTicketModal isOpen={showCreate} onClose={() => setShowCreate(false)} isStaff={isStaff} />
      {isStaff && <ApiKeysModal isOpen={showKeys} onClose={() => setShowKeys(false)} />}
    </div>
  );
}
