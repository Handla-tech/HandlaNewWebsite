'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDropdown, DropdownPortal } from '@/components/ui/DropdownPortal';
import {
  BookOpen, Plus, Loader2, MoreVertical, X, Edit2, Trash2, AlertCircle,
  CheckCircle2, ArrowUpCircle, ArrowDownCircle, ChevronLeft, ChevronRight, Landmark,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { accountingApi } from '@/lib/api';
import type {
  Account, AccountType, LedgerEntry, PaginatedLedger, LedgerDirection,
} from '@/types';
import { cn } from '@/lib/utils';

const ACCOUNT_TYPES: AccountType[] = ['ASSET', 'LIABILITY', 'INCOME', 'EXPENSE', 'EQUITY'];

const TYPE_BADGE: Record<AccountType, string> = {
  ASSET:     'border-blue-500/30 bg-blue-500/10 text-blue-400',
  LIABILITY: 'border-orange-500/30 bg-orange-500/10 text-orange-400',
  INCOME:    'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  EXPENSE:   'border-red-500/30 bg-red-500/10 text-red-400',
  EQUITY:    'border-purple-500/30 bg-purple-500/10 text-purple-400',
};

const sharedInput =
  'w-full rounded-xl border border-white/10 bg-[#0f0f0f] text-white px-3 py-2.5 text-sm focus:outline-none focus:border-[#fbbf24]/50 focus:bg-white/[0.04] transition-all';

function fmt(n: number | undefined, currency?: string | null) {
  const c = currency || '';
  return `${c ? c + ' ' : ''}${Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ═══════════════════════════════════════════════════════════════════════════
// CHART OF ACCOUNTS
// ═══════════════════════════════════════════════════════════════════════════

function AccountModal({ isOpen, onClose, editAccount }: { isOpen: boolean; onClose: () => void; editAccount: Account | null }) {
  const qc = useQueryClient();
  const isEdit = editAccount !== null;
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('EXPENSE');
  const [currency, setCurrency] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    if (isEdit && editAccount) {
      setCode(editAccount.code); setName(editAccount.name); setType(editAccount.type);
      setCurrency(editAccount.currency ?? ''); setDescription(editAccount.description ?? ''); setIsActive(editAccount.isActive);
    } else {
      setCode(''); setName(''); setType('EXPENSE'); setCurrency(''); setDescription(''); setIsActive(true);
    }
  }, [isOpen, isEdit, editAccount]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload: any = { code, name, type, isActive };
      if (currency.trim()) payload.currency = currency.trim().toUpperCase();
      if (description.trim()) payload.description = description.trim();
      // On edit, code/type are usually immutable for system accounts — send anyway; backend guards.
      return isEdit ? accountingApi.updateAccount(editAccount!.id, payload) : accountingApi.createAccount(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['erp-accounts'] }); onClose(); },
  });

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#111] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-white">{isEdit ? 'Edit Account' : 'New Account'}</h2>
            <p className="text-xs text-white/30">Chart of accounts entry.</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Code *</label>
              <input value={code} onChange={e => setCode(e.target.value)} placeholder="4000" className={sharedInput} />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Type *</label>
              <select value={type} onChange={e => setType(e.target.value as AccountType)} className={sharedInput}>
                {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Sales Revenue" className={sharedInput} />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Currency (optional)</label>
            <input value={currency} onChange={e => setCurrency(e.target.value)} maxLength={3} placeholder="USD" className={cn(sharedInput, 'uppercase')} />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Description (optional)</label>
            <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} className={cn(sharedInput, 'resize-none')} />
          </div>
          <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer">
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="h-4 w-4 rounded border-white/20 bg-[#0f0f0f] accent-[#fbbf24]" />
            Active
          </label>

          {mutation.isError && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {(mutation.error as any)?.response?.data?.message ?? 'Failed to save account'}
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white text-sm min-h-[44px] transition-colors">Cancel</button>
            <button type="button" disabled={mutation.isPending || !code || !name} onClick={() => mutation.mutate()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#fbbf24] text-black font-semibold hover:bg-[#f59e0b] text-sm disabled:opacity-50 min-h-[44px] transition-colors">
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {mutation.isPending ? 'Saving…' : isEdit ? 'Save' : 'Add Account'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeleteAccountModal({ isOpen, account, onClose }: { isOpen: boolean; account: Account | null; onClose: () => void }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => accountingApi.deleteAccount(account!.id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['erp-accounts'] }); onClose(); },
  });
  if (!isOpen || !account) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#111] shadow-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20"><Trash2 className="w-4.5 h-4.5 text-red-400" /></div>
          <div><h2 className="text-base font-bold text-white">Delete Account</h2><p className="text-xs text-white/30">Only unused accounts can be deleted.</p></div>
        </div>
        <p className="text-sm text-white/60">Delete <strong className="text-white">{account.code} — {account.name}</strong>?</p>
        {mutation.isError && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {(mutation.error as any)?.response?.data?.message ?? 'Failed to delete'}
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white text-sm min-h-[44px] transition-colors">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 text-sm disabled:opacity-50 min-h-[44px] transition-colors">{mutation.isPending ? 'Deleting…' : 'Delete'}</button>
        </div>
      </div>
    </div>
  );
}

function AccountsTab({ isAdmin }: { isAdmin: boolean }) {
  const [showModal, setShowModal] = useState(false);
  const [editEntry, setEditEntry] = useState<Account | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<Account | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['erp-accounts'],
    queryFn:  () => accountingApi.getAccounts({ includeInactive: 'true' }).then(r => r.data.data as Account[]),
    staleTime: 30_000,
  });
  const accounts = data ?? [];

  // group by type
  const grouped = ACCOUNT_TYPES.map(t => ({ type: t, items: accounts.filter(a => a.type === t) })).filter(g => g.items.length > 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => { setEditEntry(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#fbbf24] text-black font-semibold hover:bg-[#f59e0b] transition-colors text-sm">
          <Plus className="w-4 h-4" /> New Account
        </button>
      </div>

      {isLoading && <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4 animate-pulse h-14" />)}</div>}
      {isError && (
        <div className="text-center py-10 space-y-3">
          <AlertCircle className="w-8 h-8 text-red-400/50 mx-auto" />
          <button onClick={() => refetch()} className="px-4 py-2 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-xs text-white/50">Retry</button>
        </div>
      )}
      {!isLoading && !isError && accounts.length === 0 && (
        <div className="text-center py-16 space-y-3">
          <Landmark className="w-8 h-8 text-white/15 mx-auto" />
          <p className="text-sm text-white/30">No accounts yet.</p>
        </div>
      )}

      {grouped.map(({ type, items }) => (
        <div key={type} className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25 px-1">{type}</p>
          {items.map(a => (
            <AccountRow key={a.id} account={a} isAdmin={isAdmin}
              onEdit={(acc) => { setEditEntry(acc); setShowModal(true); }} onDelete={setDeleteEntry} />
          ))}
        </div>
      ))}

      <AccountModal isOpen={showModal} onClose={() => { setShowModal(false); setEditEntry(null); }} editAccount={editEntry} />
      <DeleteAccountModal isOpen={deleteEntry !== null} account={deleteEntry} onClose={() => setDeleteEntry(null)} />
    </div>
  );
}

function AccountRow({ account: a, isAdmin, onEdit, onDelete }: {
  account: Account; isAdmin: boolean; onEdit: (a: Account) => void; onDelete: (a: Account) => void;
}) {
  const menu = useDropdown('right');
  return (
    <div className="group flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 hover:bg-white/[0.04] transition-all">
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-mono text-xs text-white/40 w-14">{a.code}</span>
        <span className="text-sm font-medium text-white truncate">{a.name}</span>
        <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold border', TYPE_BADGE[a.type])}>{a.type}</span>
        {a.isSystem && <span className="px-2 py-0.5 rounded-full text-[10px] border border-white/10 bg-white/5 text-white/40">system</span>}
        {!a.isActive && <span className="px-2 py-0.5 rounded-full text-[10px] border border-white/10 bg-white/5 text-white/40">inactive</span>}
      </div>
      {!a.isSystem && (
        <div ref={menu.triggerRef} className="relative flex-shrink-0">
          <button onClick={menu.toggle} className="flex h-8 w-8 items-center justify-center rounded-lg text-white/25 hover:text-white hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100"><MoreVertical className="w-4 h-4" /></button>
          <DropdownPortal isOpen={menu.isOpen} style={menu.dropdownStyle} onClose={menu.close} width={140}>
            <div className="rounded-xl border border-white/10 bg-[#161616] shadow-2xl py-1.5">
              <button onClick={() => { onEdit(a); menu.close(); }} className="flex items-center gap-2.5 w-full px-3.5 py-2 text-xs text-white/70 hover:bg-white/[0.06] hover:text-white transition-colors"><Edit2 className="w-3.5 h-3.5" /> Edit</button>
              {isAdmin && <>
                <div className="my-1 border-t border-white/[0.06]" />
                <button onClick={() => { onDelete(a); menu.close(); }} className="flex items-center gap-2.5 w-full px-3.5 py-2 text-xs text-red-400 hover:bg-red-400/10 transition-colors"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
              </>}
            </div>
          </DropdownPortal>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LEDGER
// ═══════════════════════════════════════════════════════════════════════════

function LedgerTab({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [dirFilter, setDirFilter] = useState<'all' | LedgerDirection>('all');
  const [showModal, setShowModal] = useState(false);

  const params = { page, limit: 25, ...(dirFilter !== 'all' && { direction: dirFilter }) };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['erp-ledger', params],
    queryFn:  () => accountingApi.getLedger(params).then(r => r.data.data as PaginatedLedger),
    staleTime: 15_000, placeholderData: (prev: any) => prev,
  });
  const entries    = data?.entries ?? [];
  const totalPages = data?.pages ?? 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          {(['all', 'IN', 'OUT'] as const).map(t => (
            <button key={t} onClick={() => { setDirFilter(t); setPage(1); }}
              className={cn('px-4 py-1.5 rounded-lg text-xs font-semibold transition-all',
                dirFilter === t ? 'bg-[#fbbf24] text-black shadow-sm' : 'text-white/35 hover:text-white')}>
              {t === 'all' ? 'All' : t === 'IN' ? 'Money In' : 'Money Out'}
            </button>
          ))}
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#fbbf24] text-black font-semibold hover:bg-[#f59e0b] transition-colors text-sm">
          <Plus className="w-4 h-4" /> Manual Entry
        </button>
      </div>

      {isLoading && <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 animate-pulse h-14" />)}</div>}
      {isError && (
        <div className="text-center py-10 space-y-3"><AlertCircle className="w-8 h-8 text-red-400/50 mx-auto" />
          <button onClick={() => refetch()} className="px-4 py-2 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-xs text-white/50">Retry</button></div>
      )}
      {!isLoading && !isError && entries.length === 0 && (
        <div className="text-center py-16 space-y-3"><BookOpen className="w-8 h-8 text-white/15 mx-auto" /><p className="text-sm text-white/30">No ledger entries yet.</p></div>
      )}

      {!isLoading && !isError && entries.length > 0 && (
        <div className="space-y-2">
          {entries.map(e => {
            const isIn = e.direction === 'IN';
            return (
              <div key={e.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  {isIn ? <ArrowUpCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" /> : <ArrowDownCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-white truncate">{e.description || e.sourceType}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] border border-white/10 bg-white/5 text-white/40">{e.sourceType}</span>
                      {e.account && <span className="text-[11px] text-white/30">{e.account.code} {e.account.name}</span>}
                    </div>
                    <div className="text-[11px] text-white/25 mt-0.5">{fmtDate(e.entryDate)}{e.client ? ` · ${e.client.company || e.client.user?.name || 'Client'}` : ''}</div>
                  </div>
                </div>
                <span className={cn('text-sm font-bold flex-shrink-0', isIn ? 'text-emerald-400' : 'text-red-400')}>
                  {isIn ? '+' : '-'}{fmt(e.amount, e.currency)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-white/30">{data?.total ?? 0} entries · page {page} of {totalPages}</p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/40 hover:text-white hover:border-white/20 disabled:opacity-30 transition-all"><ChevronLeft className="w-4 h-4" /></button>
            <span className="px-3 text-xs text-white/40">{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/40 hover:text-white hover:border-white/20 disabled:opacity-30 transition-all"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      <ManualEntryModal isOpen={showModal} onClose={() => { setShowModal(false); qc.invalidateQueries({ queryKey: ['erp-ledger'] }); }} />
    </div>
  );
}

function ManualEntryModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [accountId, setAccountId] = useState('');
  const [direction, setDirection] = useState<LedgerDirection>('OUT');
  const [amount, setAmount] = useState(0);
  const [currency, setCurrency] = useState('');
  const [description, setDescription] = useState('');

  const { data: accountsData } = useQuery({
    queryKey: ['erp-accounts'],
    queryFn:  () => accountingApi.getAccounts().then(r => r.data.data as Account[]),
    enabled:  isOpen, staleTime: 30_000,
  });
  const accounts = accountsData ?? [];

  useEffect(() => {
    if (isOpen) { setEntryDate(new Date().toISOString().slice(0, 10)); setAccountId(''); setDirection('OUT'); setAmount(0); setCurrency(''); setDescription(''); }
  }, [isOpen]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload: any = { entryDate, accountId, direction, amount: Number(amount) };
      if (currency.trim()) payload.currency = currency.trim().toUpperCase();
      if (description.trim()) payload.description = description.trim();
      return accountingApi.createLedgerEntry(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['erp-ledger'] }); onClose(); },
  });

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#111] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <h2 className="text-base font-bold text-white">Manual Ledger Entry</h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Date *</label>
              <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className={sharedInput} />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Direction *</label>
              <select value={direction} onChange={e => setDirection(e.target.value as LedgerDirection)} className={sharedInput}>
                <option value="IN">Money In</option>
                <option value="OUT">Money Out</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Account *</label>
            <select value={accountId} onChange={e => setAccountId(e.target.value)} className={sharedInput}>
              <option value="">Select account…</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Amount *</label>
              <input type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(parseFloat(e.target.value) || 0)} className={sharedInput} />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Currency (optional)</label>
              <input value={currency} onChange={e => setCurrency(e.target.value)} maxLength={3} placeholder="USD" className={cn(sharedInput, 'uppercase')} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Description</label>
            <input value={description} onChange={e => setDescription(e.target.value)} className={sharedInput} placeholder="Reference / memo" />
          </div>

          {mutation.isError && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {(mutation.error as any)?.response?.data?.message ?? 'Failed to save entry'}
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white text-sm min-h-[44px] transition-colors">Cancel</button>
            <button type="button" disabled={mutation.isPending || !accountId || !amount} onClick={() => mutation.mutate()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#fbbf24] text-black font-semibold hover:bg-[#f59e0b] text-sm disabled:opacity-50 min-h-[44px] transition-colors">
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {mutation.isPending ? 'Saving…' : 'Add Entry'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════

export default function AccountingPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  const [tab, setTab] = useState<'ledger' | 'accounts'>('ledger');

  if (!mounted) return null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#fbbf24]/10 border border-[#fbbf24]/20"><BookOpen className="w-4.5 h-4.5 text-[#fbbf24]" /></span>
          Accounting
        </h1>
        <p className="text-sm text-white/30 mt-1 ml-11">Chart of accounts and unified transaction ledger.</p>
      </div>

      <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06] w-fit">
        {(['ledger', 'accounts'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-5 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize',
              tab === t ? 'bg-[#fbbf24] text-black shadow-sm' : 'text-white/35 hover:text-white')}>
            {t === 'ledger' ? 'Ledger' : 'Chart of Accounts'}
          </button>
        ))}
      </div>

      {tab === 'ledger' ? <LedgerTab isAdmin={isAdmin} /> : <AccountsTab isAdmin={isAdmin} />}
    </div>
  );
}
