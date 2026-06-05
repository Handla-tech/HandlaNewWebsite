'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  TrendingUp, TrendingDown, DollarSign, AlertCircle,
  Plus, Loader2, MoreVertical, Search, X, Edit2, Trash2,
  ChevronLeft, ChevronRight, FileText, ArrowUpCircle, ArrowDownCircle,
  Wallet,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '@/store/authStore';
import { expensesApi } from '@/lib/api';
import type { Expense, ExpenseType, FinancialSummary, PaginatedExpenses } from '@/types';
import { cn } from '@/lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_BADGE: Record<ExpenseType, string> = {
  INCOME:  'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  EXPENSE: 'border-red-500/30 bg-red-500/10 text-red-400',
};

const CATEGORIES_INCOME  = ['Invoice Payment', 'Consulting', 'Sales', 'Grant', 'Other Income'];
const CATEGORIES_EXPENSE = ['Software', 'Payroll', 'Marketing', 'Travel', 'Utilities', 'Rent', 'Hardware', 'Other'];

type ActiveTab = 'all' | 'income' | 'expense';

// ─── Zod schema ───────────────────────────────────────────────────────────────

const entrySchema = z.object({
  type:        z.enum(['INCOME', 'EXPENSE']),
  category:    z.string().min(2).max(100),
  amount:      z.number({ invalid_type_error: 'Amount required' }).min(0.01),
  description: z.string().optional(),
  expenseDate: z.string().optional(),
});
type EntryForm = z.infer<typeof entrySchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number, currency = 'USD') {
  return `${currency} ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ─── Summary Cards ────────────────────────────────────────────────────────────

function SummaryCards({ summary }: { summary: FinancialSummary }) {
  const netPositive = summary.netBalance >= 0;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-semibold text-white/25 uppercase tracking-wide">Total Income</p>
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          </div>
        </div>
        <p className="text-xl font-bold text-emerald-400">{fmt(summary.totalIncome)}</p>
        <p className="text-[11px] text-white/25 mt-1">Manual: {fmt(summary.manualIncome)}</p>
      </div>

      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-semibold text-white/25 uppercase tracking-wide">Total Expenses</p>
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/20">
            <TrendingDown className="w-3.5 h-3.5 text-red-400" />
          </div>
        </div>
        <p className="text-xl font-bold text-red-400">{fmt(summary.totalExpenses)}</p>
      </div>

      <div className={cn('rounded-2xl border p-4', netPositive ? 'border-[#fbbf24]/20 bg-[#fbbf24]/5' : 'border-red-500/20 bg-red-500/5')}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-semibold text-white/25 uppercase tracking-wide">Net Balance</p>
          <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg', netPositive ? 'bg-[#fbbf24]/20' : 'bg-red-500/20')}>
            <Wallet className={cn('w-3.5 h-3.5', netPositive ? 'text-[#fbbf24]' : 'text-red-400')} />
          </div>
        </div>
        <p className={cn('text-xl font-bold', netPositive ? 'text-[#fbbf24]' : 'text-red-400')}>
          {netPositive ? '+' : ''}{fmt(summary.netBalance)}
        </p>
      </div>

      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-semibold text-white/25 uppercase tracking-wide">Outstanding</p>
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
          </div>
        </div>
        <p className="text-xl font-bold text-amber-400">{fmt(summary.outstandingInvoices)}</p>
        <p className="text-[11px] text-white/25 mt-1">Unpaid + Overdue invoices</p>
      </div>
    </div>
  );
}

// ─── Expense Row ──────────────────────────────────────────────────────────────

function ExpenseRow({ expense, isAdmin, onEdit, onDelete }: {
  expense: Expense; isAdmin: boolean; onEdit: (e: Expense) => void; onDelete: (e: Expense) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isInvoiceLinked = expense.invoiceId !== null;
  const isIncome        = expense.type === 'INCOME';

  return (
    <div className={cn(
      'group flex items-start justify-between gap-3 rounded-xl border p-4 transition-all',
      isIncome
        ? 'border-emerald-500/10 bg-emerald-500/[0.03] hover:bg-emerald-500/[0.05]'
        : 'border-red-500/10 bg-red-500/[0.03] hover:bg-red-500/[0.05]',
    )}>
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className={cn('mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border',
          isIncome ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-red-500/20 bg-red-500/10')}>
          {isIncome
            ? <ArrowUpCircle className="w-4 h-4 text-emerald-400" />
            : <ArrowDownCircle className="w-4 h-4 text-red-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-semibold border flex-shrink-0', TYPE_BADGE[expense.type])}>
              {expense.type}
            </span>
            <span className="text-sm font-semibold text-white truncate">{expense.category}</span>
            {isInvoiceLinked && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border border-blue-500/30 bg-blue-500/10 text-blue-400 flex-shrink-0">
                <FileText className="w-2.5 h-2.5" /> Auto-Invoice
              </span>
            )}
          </div>
          {expense.description && <p className="mt-0.5 text-[11px] text-white/35 line-clamp-1">{expense.description}</p>}
          <div className="mt-1.5 flex items-center gap-3 text-[11px] text-white/25">
            <span>{fmtDate(expense.expenseDate)}</span>
            {expense.owner && <span>· {expense.owner.name}</span>}
            {expense.invoice && <span className="text-blue-400">· {expense.invoice.invoiceNumber}</span>}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={cn('text-base font-bold', isIncome ? 'text-emerald-400' : 'text-red-400')}>
          {isIncome ? '+' : '-'}{fmt(expense.amount, expense.currency)}
        </span>
        {!isInvoiceLinked && (
          <div className="relative">
            <button onClick={() => setMenuOpen(!menuOpen)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/25 hover:text-white hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100">
              <MoreVertical className="w-4 h-4" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-9 z-[9999] w-40 rounded-xl border border-white/10 bg-[#161616] shadow-2xl py-1.5">
                  <button onClick={() => { onEdit(expense); setMenuOpen(false); }}
                    className="flex items-center gap-2.5 w-full px-3.5 py-2 text-xs text-white/70 hover:bg-white/[0.06] hover:text-white transition-colors">
                    <Edit2 className="w-3.5 h-3.5" /> Edit
                  </button>
                  {isAdmin && (
                    <>
                      <div className="my-1 border-t border-white/[0.06]" />
                      <button onClick={() => { onDelete(expense); setMenuOpen(false); }}
                        className="flex items-center gap-2.5 w-full px-3.5 py-2 text-xs text-red-400 hover:bg-red-400/10 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Create / Edit Modal ──────────────────────────────────────────────────────

function EntryModal({ isOpen, onClose, editExpense }: { isOpen: boolean; onClose: () => void; editExpense: Expense | null }) {
  const qc     = useQueryClient();
  const isEdit = editExpense !== null;
  const sharedInput = 'w-full rounded-xl border border-white/10 bg-[#0f0f0f] text-white px-3 py-2.5 text-sm focus:outline-none focus:border-[#fbbf24]/50 focus:bg-white/[0.04] transition-all';

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<EntryForm>({
    resolver: zodResolver(entrySchema),
    defaultValues: { type: 'EXPENSE', category: '', amount: undefined, description: '', expenseDate: new Date().toISOString().slice(0, 10) },
  });

  useEffect(() => {
    if (isEdit && editExpense) {
      reset({ type: editExpense.type, category: editExpense.category, amount: Number(editExpense.amount), description: editExpense.description ?? '', expenseDate: editExpense.expenseDate });
    } else {
      reset({ type: 'EXPENSE', category: '', amount: undefined, description: '', expenseDate: new Date().toISOString().slice(0, 10) });
    }
  }, [isEdit, editExpense, reset, isOpen]);

  const mutation = useMutation({
    mutationFn: (data: EntryForm) => isEdit ? expensesApi.updateExpense(editExpense!.id, data) : expensesApi.createExpense(data),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['erp-expenses'] }); qc.invalidateQueries({ queryKey: ['erp-expenses-summary'] }); onClose(); },
  });

  const watchedType = watch('type');
  const categories  = watchedType === 'INCOME' ? CATEGORIES_INCOME : CATEGORIES_EXPENSE;

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#111] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-white">{isEdit ? 'Edit Entry' : 'New Entry'}</h2>
            <p className="text-xs text-white/30">{isEdit ? 'Update this manual entry.' : 'Add a manual income or expense record.'}</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="p-5 space-y-4">
          {/* Type */}
          <div>
            <label className="block text-xs font-medium text-white/50 mb-2">Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(['INCOME', 'EXPENSE'] as ExpenseType[]).map(t => (
                <label key={t} className={cn(
                  'flex items-center justify-center gap-2 px-3 py-3 rounded-xl border cursor-pointer text-sm font-semibold transition-all',
                  watchedType === t
                    ? t === 'INCOME' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' : 'border-red-500/40 bg-red-500/10 text-red-400'
                    : 'border-white/10 text-white/35 hover:border-white/20 hover:text-white/60',
                )}>
                  <input type="radio" value={t} {...register('type')} className="sr-only" />
                  {t === 'INCOME' ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  {t}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Category</label>
            <select {...register('category')} className={cn(sharedInput)}>
              <option value="">Select category…</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {errors.category && <p className="mt-1 text-xs text-red-400">{errors.category.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Amount (USD)</label>
            <input type="number" step="0.01" min="0.01" placeholder="0.00"
              {...register('amount', { valueAsNumber: true })} className={sharedInput} />
            {errors.amount && <p className="mt-1 text-xs text-red-400">{errors.amount.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Date</label>
            <input type="date" {...register('expenseDate')} className={sharedInput} />
          </div>

          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Description (optional)</label>
            <textarea rows={2} placeholder="Brief note…" {...register('description')}
              className={cn(sharedInput, 'resize-none')} />
          </div>

          {mutation.isError && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {(mutation.error as any)?.response?.data?.message ?? 'Failed to save entry'}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white text-sm min-h-[44px] transition-colors">Cancel</button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#fbbf24] text-black font-semibold hover:bg-[#f59e0b] text-sm disabled:opacity-50 min-h-[44px] transition-colors">
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {mutation.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteModal({ isOpen, expense, onClose }: { isOpen: boolean; expense: Expense | null; onClose: () => void }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => expensesApi.deleteExpense(expense!.id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['erp-expenses'] }); qc.invalidateQueries({ queryKey: ['erp-expenses-summary'] }); onClose(); },
  });

  if (!isOpen || !expense) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#111] shadow-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20">
            <Trash2 className="w-4.5 h-4.5 text-red-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Delete Entry</h2>
            <p className="text-xs text-white/30">This cannot be undone.</p>
          </div>
        </div>
        <p className="text-sm text-white/60">
          Permanently delete <strong className="text-white">{expense.category}</strong> ({fmt(expense.amount)})?
        </p>
        {mutation.isError && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {(mutation.error as any)?.response?.data?.message ?? 'Failed to delete'}
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white text-sm min-h-[44px] transition-colors">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
            className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 text-sm disabled:opacity-50 min-h-[44px] transition-colors">
            {mutation.isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { user } = useAuthStore();
  const isAdmin    = user?.role === 'ADMIN';
  const isEmployee = user?.role === 'EMPLOYEE';

  const [activeTab,   setActiveTab]   = useState<ActiveTab>('all');
  const [search,      setSearch]      = useState('');
  const [dateFrom,    setDateFrom]    = useState('');
  const [dateTo,      setDateTo]      = useState('');
  const [page,        setPage]        = useState(1);
  const [showModal,   setShowModal]   = useState(false);
  const [editEntry,   setEditEntry]   = useState<Expense | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<Expense | null>(null);

  const { data: summaryData } = useQuery({
    queryKey: ['erp-expenses-summary', dateFrom, dateTo],
    queryFn:  () => expensesApi.getSummary({ dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }).then(r => r.data.data as FinancialSummary),
    staleTime: 30_000, enabled: mounted,
  });

  const params = {
    page, limit: 20,
    ...(activeTab !== 'all' && { type: activeTab.toUpperCase() }),
    ...(search   && { category: search }),
    ...(dateFrom && { dateFrom }),
    ...(dateTo   && { dateTo }),
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['erp-expenses', params],
    queryFn:  () => expensesApi.getExpenses(params).then(r => r.data.data as PaginatedExpenses),
    staleTime: 15_000, enabled: mounted,
  });

  const expenses   = data?.expenses  ?? [];
  const totalPages = data?.pages     ?? 1;
  const summary    = summaryData;

  function openCreate() { setEditEntry(null); setShowModal(true); }
  function openEdit(e: Expense) { setEditEntry(e); setShowModal(true); }

  if (!mounted) return null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <DollarSign className="w-4.5 h-4.5 text-emerald-400" />
            </span>
            Expenses & Income
          </h1>
          <p className="text-sm text-white/30 mt-1 ml-11">
            {isAdmin ? 'Track all income and expenses.' : 'Track your income and expenses.'}
          </p>
        </div>
        {(isAdmin || isEmployee) && (
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#fbbf24] text-black font-semibold hover:bg-[#f59e0b] transition-colors text-sm min-h-[44px]">
            <Plus className="w-4 h-4" /> New Entry
          </button>
        )}
      </div>

      {/* Financial Summary Cards */}
      {summary ? <SummaryCards summary={summary} /> : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 animate-pulse h-24" />)}
        </div>
      )}

      {/* Date Range Filter */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <span className="text-xs font-medium text-white/30">Period:</span>
        <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
          className="rounded-lg border border-white/10 bg-[#0f0f0f] text-white px-3 py-1.5 text-xs focus:outline-none focus:border-[#fbbf24]/50 transition-all" />
        <span className="text-xs text-white/25">to</span>
        <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
          className="rounded-lg border border-white/10 bg-[#0f0f0f] text-white px-3 py-1.5 text-xs focus:outline-none focus:border-[#fbbf24]/50 transition-all" />
        {(dateFrom || dateTo) && (
          <button onClick={() => { setDateFrom(''); setDateTo(''); setPage(1); }}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          {(['all', 'income', 'expense'] as ActiveTab[]).map(t => (
            <button key={t} onClick={() => { setActiveTab(t); setPage(1); }}
              className={cn('px-4 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize',
                activeTab === t ? 'bg-[#fbbf24] text-black shadow-sm' : 'text-white/35 hover:text-white')}>
              {t === 'all' ? 'All Entries' : t === 'income' ? 'Income' : 'Expenses'}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
          <input placeholder="Search category…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="pl-8 pr-4 py-2 rounded-lg border border-white/10 bg-white/[0.04] text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#fbbf24]/40 focus:bg-white/[0.06] w-52 transition-all" />
        </div>
      </div>

      {/* List */}
      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4 animate-pulse h-20" />)}
        </div>
      )}

      {isError && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-red-400/50 mx-auto" />
            <p className="text-sm text-white/30">Failed to load entries.</p>
            <button onClick={() => refetch()} className="px-4 py-2 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-xs text-white/50 transition-colors">Retry</button>
          </div>
        </div>
      )}

      {!isLoading && !isError && expenses.length === 0 && (
        <div className="flex items-center justify-center py-16">
          <div className="text-center space-y-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] mx-auto">
              <DollarSign className="w-7 h-7 text-white/15" />
            </div>
            <p className="text-sm text-white/30">No entries found.</p>
            {(isAdmin || isEmployee) && (
              <button onClick={openCreate} className="px-4 py-2 rounded-xl border border-[#fbbf24]/30 bg-[#fbbf24]/10 text-[#fbbf24] text-xs font-semibold hover:bg-[#fbbf24]/20 transition-colors">
                Add first entry
              </button>
            )}
          </div>
        </div>
      )}

      {!isLoading && !isError && expenses.length > 0 && (
        <div className="space-y-2">
          {expenses.map(e => <ExpenseRow key={e.id} expense={e} isAdmin={isAdmin} onEdit={openEdit} onDelete={setDeleteEntry} />)}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/40 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-white/30">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/40 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Modals */}
      <EntryModal isOpen={showModal} onClose={() => { setShowModal(false); setEditEntry(null); }} editExpense={editEntry} />
      <DeleteModal isOpen={deleteEntry !== null} expense={deleteEntry} onClose={() => setDeleteEntry(null)} />
    </div>
  );
}
