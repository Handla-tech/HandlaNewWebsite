'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/useDebounce';
import { useDropdown, DropdownPortal } from '@/components/ui/DropdownPortal';
import {
  Bot, Plus, Loader2, MoreVertical, Search, X, Edit2, Trash2,
  ChevronLeft, ChevronRight, AlertCircle, CheckCircle2, BookOpen,
  MessageSquare, UserCheck, RotateCcw, ShieldAlert, Tag, Star, Power,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { aiApi, chatApi } from '@/lib/api';
import type {
  KnowledgeEntry, PaginatedKnowledge, KnowledgeCategory, LeadStatus,
  ConversationAiState, Conversation,
} from '@/types';
import { cn } from '@/lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const KB_CATEGORIES: KnowledgeCategory[] = [
  'COMPANY', 'PRODUCT', 'PRICING', 'PROCESS', 'FAQ', 'POLICY', 'OTHER',
];

const CATEGORY_BADGE: Record<KnowledgeCategory, string> = {
  COMPANY: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400',
  PRODUCT: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
  PRICING: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  PROCESS: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400',
  FAQ:     'border-amber-500/30 bg-amber-500/10 text-amber-400',
  POLICY:  'border-rose-500/30 bg-rose-500/10 text-rose-400',
  OTHER:   'border-white/15 bg-white/5 text-white/50',
};

const LEAD_BADGE: Record<LeadStatus, string> = {
  NEW:          'border-white/15 bg-white/5 text-white/50',
  QUALIFYING:   'border-blue-500/30 bg-blue-500/10 text-blue-400',
  QUALIFIED:    'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  DISQUALIFIED: 'border-red-500/30 bg-red-500/10 text-red-400',
  CONVERTED:    'border-[#fbbf24]/40 bg-[#fbbf24]/10 text-[#fbbf24]',
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
function personName(u?: { name?: string | null; email?: string } | null) {
  if (!u) return 'Unknown';
  return (u.name && u.name.trim()) || u.email || 'Unknown';
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'knowledge' | 'leads';

export default function AiPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  const [tab, setTab] = useState<Tab>('knowledge');

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-[#fbbf24]/10 border border-[#fbbf24]/20 grid place-items-center">
          <Bot className="w-5 h-5 text-[#fbbf24]" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">AI Assistant</h1>
          <p className="text-sm text-white/40">
            KB-grounded chatbot &amp; lead qualification. The assistant answers only from the Knowledge Base.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10">
        <TabBtn active={tab === 'knowledge'} onClick={() => setTab('knowledge')} icon={BookOpen} label="Knowledge Base" />
        <TabBtn active={tab === 'leads'} onClick={() => setTab('leads')} icon={MessageSquare} label="Lead Panel" />
      </div>

      {tab === 'knowledge' ? <KnowledgeTab isAdmin={isAdmin} /> : <LeadsTab />}
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-all',
        active ? 'border-[#fbbf24] text-white' : 'border-transparent text-white/40 hover:text-white/70',
      )}
    >
      <Icon className="w-4 h-4" /> {label}
    </button>
  );
}

// ─── Knowledge Base Tab ─────────────────────────────────────────────────────────

function KnowledgeTab({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<KnowledgeCategory | ''>('');
  const [activeFilter, setActiveFilter] = useState<'' | 'true' | 'false'>('');
  const debouncedSearch = useDebounce(search, 350);

  const [editing, setEditing] = useState<KnowledgeEntry | null>(null);
  const [creating, setCreating] = useState(false);

  const params = useMemo(() => {
    const p: Record<string, unknown> = { page, limit: 20 };
    if (debouncedSearch) p.search = debouncedSearch;
    if (category) p.category = category;
    if (activeFilter) p.isActive = activeFilter;
    return p;
  }, [page, debouncedSearch, category, activeFilter]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['ai-knowledge', params],
    queryFn: async () => (await aiApi.getKnowledge(params)).data.data as PaginatedKnowledge,
    placeholderData: (prev) => prev,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => aiApi.deleteKnowledge(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-knowledge'] }),
  });

  const entries = data?.entries ?? [];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search titles, content, tags…"
            className={cn(sharedInput, 'pl-9')}
          />
        </div>
        <select
          value={category}
          onChange={(e) => { setCategory(e.target.value as KnowledgeCategory | ''); setPage(1); }}
          className={cn(sharedInput, 'w-auto')}
        >
          <option value="">All categories</option>
          {KB_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={activeFilter}
          onChange={(e) => { setActiveFilter(e.target.value as any); setPage(1); }}
          className={cn(sharedInput, 'w-auto')}
        >
          <option value="">Active + inactive</option>
          <option value="true">Active only</option>
          <option value="false">Inactive only</option>
        </select>
        {isAdmin && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 rounded-xl bg-[#fbbf24] px-4 py-2.5 text-sm font-semibold text-black hover:bg-[#fbbf24]/90 transition-all"
          >
            <Plus className="w-4 h-4" /> New Entry
          </button>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="grid place-items-center py-20"><Loader2 className="w-6 h-6 text-white/30 animate-spin" /></div>
      ) : isError ? (
        <ErrorBox message={errMsg(error, 'Failed to load knowledge base')} />
      ) : entries.length === 0 ? (
        <EmptyBox icon={BookOpen} title="No knowledge entries" hint={isAdmin ? 'Create your first entry — the assistant answers only from active entries.' : 'No entries yet.'} />
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <KnowledgeRow
              key={e.id}
              entry={e}
              isAdmin={isAdmin}
              onEdit={() => setEditing(e)}
              onDelete={() => {
                if (confirm(`Delete "${e.title}"? This cannot be undone.`)) deleteMut.mutate(e.id);
              }}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.pages > 1 && (
        <Pager page={page} pages={data.pages} total={data.total} onPage={setPage} />
      )}

      {(creating || editing) && (
        <KnowledgeModal
          entry={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

function KnowledgeRow({ entry, isAdmin, onEdit, onDelete }: {
  entry: KnowledgeEntry; isAdmin: boolean; onEdit: () => void; onDelete: () => void;
}) {
  const menu = useDropdown('right');
  return (
    <div className="group rounded-2xl border border-white/10 bg-white/[0.02] p-4 hover:border-white/20 transition-all">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold', CATEGORY_BADGE[entry.category])}>
              {entry.category}
            </span>
            {!entry.isActive && (
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] font-semibold text-white/30">
                INACTIVE
              </span>
            )}
            {entry.priority > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] text-[#fbbf24]/70">
                <Star className="w-3 h-3" /> {entry.priority}
              </span>
            )}
            {entry.product && (
              <span className="inline-flex items-center gap-1 text-[10px] text-white/40">
                <Tag className="w-3 h-3" /> {entry.product}
              </span>
            )}
          </div>
          <h3 className="mt-1.5 text-sm font-medium text-white truncate">{entry.title}</h3>
          <p className="mt-1 text-xs text-white/40 line-clamp-2">{entry.content}</p>
          <p className="mt-1.5 text-[10px] text-white/25">Updated {fmtDate(entry.updatedAt)}</p>
        </div>

        {isAdmin && (
          <div ref={menu.triggerRef} className="relative">
            <button onClick={menu.toggle} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-all">
              <MoreVertical className="w-4 h-4" />
            </button>
            <DropdownPortal isOpen={menu.isOpen} style={menu.dropdownStyle} onClose={menu.close} width={160}>
              <div className="rounded-xl border border-white/10 bg-[#161616] shadow-2xl py-1.5">
                <button onClick={() => { onEdit(); menu.close(); }} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-xs text-white/70 hover:bg-white/[0.06] hover:text-white transition-colors">
                  <Edit2 className="w-3.5 h-3.5" /> Edit
                </button>
                <div className="my-1 border-t border-white/[0.06]" />
                <button onClick={() => { onDelete(); menu.close(); }} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-xs text-red-400 hover:bg-red-400/10 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </DropdownPortal>
          </div>
        )}
      </div>
    </div>
  );
}

function KnowledgeModal({ entry, onClose }: { entry: KnowledgeEntry | null; onClose: () => void }) {
  const qc = useQueryClient();
  const isEdit = !!entry;
  const [title, setTitle] = useState(entry?.title ?? '');
  const [content, setContent] = useState(entry?.content ?? '');
  const [category, setCategory] = useState<KnowledgeCategory>(entry?.category ?? 'OTHER');
  const [tags, setTags] = useState(entry?.tags ?? '');
  const [product, setProduct] = useState(entry?.product ?? '');
  const [priority, setPriority] = useState<number>(entry?.priority ?? 0);
  const [isActive, setIsActive] = useState<boolean>(entry?.isActive ?? true);

  const mut = useMutation({
    mutationFn: () => {
      const payload = {
        title: title.trim(),
        content: content.trim(),
        category,
        tags: tags.trim() || undefined,
        product: product.trim() || undefined,
        priority: Number.isFinite(priority) ? priority : 0,
        isActive,
      };
      return isEdit ? aiApi.updateKnowledge(entry!.id, payload) : aiApi.createKnowledge(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-knowledge'] });
      onClose();
    },
  });

  const canSave = title.trim().length >= 2 && content.trim().length >= 2 && !mut.isPending;

  return (
    <ModalShell title={isEdit ? 'Edit knowledge entry' : 'New knowledge entry'} onClose={onClose} wide>
      <div className="space-y-4">
        <Field label="Title *">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. What is Handla Mudar?" className={sharedInput} />
        </Field>
        <Field label="Content * (the assistant may not go beyond this)">
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={6} placeholder="The authoritative answer…" className={cn(sharedInput, 'resize-y')} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Category">
            <select value={category} onChange={(e) => setCategory(e.target.value as KnowledgeCategory)} className={sharedInput}>
              {KB_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Product (optional)">
            <input value={product} onChange={(e) => setProduct(e.target.value)} placeholder="mudar / matjari / manara" className={sharedInput} />
          </Field>
        </div>
        <Field label="Tags (comma-separated, boosts retrieval)">
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="pricing, onboarding, refund" className={sharedInput} />
        </Field>
        <div className="grid grid-cols-2 gap-4 items-end">
          <Field label="Priority (higher wins ties)">
            <input
              type="number" min={0} value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value, 10) || 0)}
              className={sharedInput}
            />
          </Field>
          <label className="flex items-center gap-2.5 py-2.5 cursor-pointer select-none">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4 accent-[#fbbf24]" />
            <span className="text-sm text-white/70">Active (visible to the assistant)</span>
          </label>
        </div>

        {mut.isError && <ErrorBox message={errMsg(mut.error, 'Save failed')} />}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70 hover:bg-white/5 transition-all">Cancel</button>
          <button
            onClick={() => mut.mutate()}
            disabled={!canSave}
            className="flex items-center gap-2 rounded-xl bg-[#fbbf24] px-5 py-2.5 text-sm font-semibold text-black hover:bg-[#fbbf24]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {mut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? 'Save changes' : 'Create entry'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ─── Lead Panel Tab ──────────────────────────────────────────────────────────────

function LeadsTab() {
  const [selected, setSelected] = useState<Conversation | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['ai-lead-conversations'],
    queryFn: async () => {
      const res = (await chatApi.getConversations()).data.data;
      // getConversations returns paginated { conversations, ... } — be defensive.
      const list: Conversation[] = res?.conversations ?? res?.data ?? (Array.isArray(res) ? res : []);
      return list;
    },
    placeholderData: (prev) => prev,
  });

  const conversations = data ?? [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-4">
      {/* Conversation list */}
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-white/30 px-1">Conversations</p>
        {isLoading ? (
          <div className="grid place-items-center py-16"><Loader2 className="w-6 h-6 text-white/30 animate-spin" /></div>
        ) : isError ? (
          <ErrorBox message={errMsg(error, 'Failed to load conversations')} />
        ) : conversations.length === 0 ? (
          <EmptyBox icon={MessageSquare} title="No conversations" hint="Leads appear here as clients chat with the assistant." />
        ) : (
          conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelected(c)}
              className={cn(
                'w-full text-left rounded-2xl border p-3.5 transition-all',
                selected?.id === c.id ? 'border-[#fbbf24]/50 bg-[#fbbf24]/[0.06]' : 'border-white/10 bg-white/[0.02] hover:border-white/20',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-white truncate">{personName(c.client)}</span>
                <span className="text-[10px] text-white/30 shrink-0">{fmtDate(c.lastMessageAt)}</span>
              </div>
              <p className="mt-1 text-xs text-white/40 truncate">{c.lastMessage?.content ?? 'No messages yet'}</p>
            </button>
          ))
        )}
      </div>

      {/* Lead detail / AI state */}
      <div>
        {selected ? (
          <LeadDetail conversation={selected} />
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] grid place-items-center py-24">
            <div className="text-center space-y-2">
              <MessageSquare className="w-7 h-7 text-white/20 mx-auto" />
              <p className="text-sm text-white/30">Select a conversation to see its AI state.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LeadDetail({ conversation }: { conversation: Conversation }) {
  const qc = useQueryClient();
  const [note, setNote] = useState('');

  const { data: state, isLoading, isError, error } = useQuery({
    queryKey: ['ai-state', conversation.id],
    queryFn: async () => (await aiApi.getState(conversation.id)).data.data.state as ConversationAiState,
  });

  const takeoverMut = useMutation({
    mutationFn: () => aiApi.takeover(conversation.id, note.trim() ? { note: note.trim() } : {}),
    onSuccess: () => { setNote(''); qc.invalidateQueries({ queryKey: ['ai-state', conversation.id] }); },
  });
  const returnMut = useMutation({
    mutationFn: () => aiApi.returnToAi(conversation.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-state', conversation.id] }),
  });

  if (isLoading) return <div className="rounded-2xl border border-white/10 bg-white/[0.02] grid place-items-center py-24"><Loader2 className="w-6 h-6 text-white/30 animate-spin" /></div>;
  if (isError || !state) return <ErrorBox message={errMsg(error, 'Failed to load AI state')} />;

  const isHuman = state.controlMode === 'HUMAN';
  const leadData = state.leadData ?? {};
  const leadKeys = Object.keys(leadData);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-white">{personName(conversation.client)}</h3>
          <p className="text-xs text-white/30">Conversation {conversation.id.slice(0, 8)}…</p>
        </div>
        <span className={cn('rounded-full border px-2.5 py-1 text-[11px] font-semibold', LEAD_BADGE[state.leadStatus])}>
          {state.leadStatus}
        </span>
      </div>

      {/* Escalation banner */}
      {state.needsHuman && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <div className="text-xs text-amber-200/80">
            <span className="font-semibold text-amber-300">Human requested.</span>{' '}
            {state.escalationReason || 'The assistant flagged this conversation for a human.'}
          </div>
        </div>
      )}

      {/* Control mode + takeover toggle */}
      <div className="rounded-xl border border-white/10 bg-[#0f0f0f] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Power className={cn('w-4 h-4', isHuman ? 'text-amber-400' : 'text-emerald-400')} />
            <span className="text-sm text-white/80">
              Control: <span className={cn('font-semibold', isHuman ? 'text-amber-400' : 'text-emerald-400')}>{isHuman ? 'HUMAN' : 'AI'}</span>
            </span>
          </div>
          {isHuman ? (
            <button
              onClick={() => returnMut.mutate()}
              disabled={returnMut.isPending}
              className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-40 transition-all"
            >
              {returnMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              Return to AI
            </button>
          ) : (
            <button
              onClick={() => takeoverMut.mutate()}
              disabled={takeoverMut.isPending}
              className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-sm font-semibold text-amber-400 hover:bg-amber-500/20 disabled:opacity-40 transition-all"
            >
              {takeoverMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
              Take over
            </button>
          )}
        </div>
        {!isHuman && (
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional takeover note…"
            className={cn(sharedInput, 'text-xs py-2')}
          />
        )}
        {isHuman && state.takenOverAt && (
          <p className="text-[11px] text-white/30">Taken over {fmtDate(state.takenOverAt)}</p>
        )}
        {(takeoverMut.isError || returnMut.isError) && (
          <ErrorBox message={errMsg(takeoverMut.error ?? returnMut.error, 'Action failed')} />
        )}
      </div>

      {/* Lead data */}
      <div>
        <p className="text-xs uppercase tracking-wide text-white/30 mb-2">Captured lead data</p>
        {leadKeys.length === 0 ? (
          <p className="text-sm text-white/30">Nothing captured yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {leadKeys.map((k) => (
              <div key={k}>
                <p className="text-[10px] uppercase tracking-wide text-white/25">{k}</p>
                <p className="text-sm text-white/80 break-words">{String((leadData as any)[k] ?? '—')}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Missing fields */}
      {state.missingFields && state.missingFields.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wide text-white/30 mb-2">Missing before qualified</p>
          <div className="flex flex-wrap gap-1.5">
            {state.missingFields.map((f) => (
              <span key={f} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/50">{f}</span>
            ))}
          </div>
        </div>
      )}

      {/* Running summary */}
      {state.runningSummary && (
        <div>
          <p className="text-xs uppercase tracking-wide text-white/30 mb-2">Running summary</p>
          <p className="text-sm text-white/60 leading-relaxed whitespace-pre-wrap">{state.runningSummary}</p>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-white/10 pt-3 text-[11px] text-white/30">
        <span>AI replies: {state.aiMessageCount}</span>
        <span>Updated {fmtDate(state.updatedAt)}</span>
      </div>
    </div>
  );
}

// ─── Shared UI primitives ────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-white/50">{label}</span>
      {children}
    </label>
  );
}

function ModalShell({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn('w-full rounded-3xl border border-white/10 bg-[#111] p-6 shadow-2xl max-h-[90vh] overflow-y-auto', wide ? 'max-w-lg' : 'max-w-md')}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5">
      <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
      <p className="text-xs text-red-300">{message}</p>
    </div>
  );
}

function EmptyBox({ icon: Icon, title, hint }: { icon: any; title: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] grid place-items-center py-16">
      <div className="text-center space-y-2 max-w-sm px-4">
        <Icon className="w-7 h-7 text-white/20 mx-auto" />
        <p className="text-sm font-medium text-white/50">{title}</p>
        <p className="text-xs text-white/30">{hint}</p>
      </div>
    </div>
  );
}

function Pager({ page, pages, total, onPage }: { page: number; pages: number; total: number; onPage: (p: number) => void }) {
  return (
    <div className="flex items-center justify-between pt-2">
      <p className="text-xs text-white/30">{total} total</p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPage(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="p-2 rounded-lg border border-white/10 text-white/60 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs text-white/50">Page {page} / {pages}</span>
        <button
          onClick={() => onPage(Math.min(pages, page + 1))}
          disabled={page >= pages}
          className="p-2 rounded-lg border border-white/10 text-white/60 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
