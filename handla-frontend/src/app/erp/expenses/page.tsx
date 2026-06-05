'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  TrendingUp, TrendingDown, DollarSign, AlertCircle,
  Plus, Loader2, MoreVertical, Search, X, Edit2, Trash2,
  ChevronLeft, ChevronRight, FileText, ArrowUpCircle, ArrowDownCircle,
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
  INCOME:  'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  EXPENSE: 'bg-red-500/20 text-red-300 border border-red-500/30',
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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <p className="text-xs text-white/40 uppercase tracking-wide">Total Income</p>
        </div>
        <p className="text-xl font-bold text-emerald-300">{fmt(summary.totalIncome)}</p>
        <p className="text-xs text-white/30 mt-1">Manual: {fmt(summary.manualIncome)}</p>
      </div>

      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
        <div className="flex items-center gap-2 mb-1">
          <TrendingDown className="w-4 h-4 text-red-400" />
          <p className="text-xs text-white/40 uppercase tracking-wide">Total Expenses</p>
        </div>
        <p className="text-xl font-bold text-red-300">{fmt(summary.totalExpenses)}</p>
      </div>

      <div className={cn(
        'rounded-2xl border p-4',
        netPositive
          ? 'border-[#fbbf24]/20 bg-[#fbbf24]/5'
          : 'border-red-500/20 bg-red-500/5',
      )}>
        <div className="flex items-center gap-2 mb-1">
          <DollarSign className={cn('w-4 h-4', netPositive ? 'text-[#fbbf24]' : 'text-red-400')} />
          <p className="text-xs text-white/40 uppercase tracking-wide">Net Balance</p>
        </div>
        <p className={cn('text-xl font-bold', netPositive ? 'text-[#fbbf24]' : 'text-red-300')}>
          {netPositive ? '+' : ''}{fmt(summary.netBalance)}
        </p>
      </div>

      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
        <div className="flex items-center gap-2 mb-1">
          <AlertCircle className="w-4 h-4 text-amber-400" />
          <p className="text-xs text-white/40 uppercase tracking-wide">Outstanding</p>
        </div>
        <p className="text-xl font-bold text-amber-300">{fmt(summary.outstandingInvoices)}</p>
        <p className="text-xs text-white/30 mt-1">Unpaid + Overdue invoices</p>
      </div>
    </div>
  );
}

// ─── Expense Row ──────────────────────────────────────────────────────────────

function ExpenseRow({
  expense,
  isAdmin,
  onEdit,
  onDelete,
}: {
  expense: Expense;
  isAdmin: boolean;
  onEdit: (e: Expense) => void;
  onDelete: (e: Expense) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isInvoiceLinked = expense.invoiceId !== null;
  const isIncome = expense.type === 'INCOME';

  return (
    <div className={cn(
      'group flex items-start justify-between gap-3 rounded-xl border p-4 transition-colors',
      isIncome
        ? 'border-emerald-500/10 bg-emerald-500/3 hover:bg-emerald-500/6'
        : 'border-red-500/10 bg-red-500/3 hover:bg-red-500/6',
    )}>
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className={cn(
          'mt-0.5 flex-shrink-0 rounded-full p-1.5',
          isIncome ? 'bg-emerald-500/10' : 'bg-red-500/10',
        )}>
          {isIncome
            ? <ArrowUpCircle className="w-4 h-4 text-emerald-400" />
            : <ArrowDownCircle className="w-4 h-4 text-red-400" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0', TYPE_BADGE[expense.type])}>
              {expense.type}
            </span>
            <span className="text-sm font-semibold text-white truncate">{expense.category}</span>
            {isInvoiceLinked && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-blue-500/30 bg-blue-500/10 text-blue-300 flex-shrink-0">
                <FileText className="w-3 h-3" />
                Auto-Invoice
              </span>
            )}
          </div>
          {expense.description && (
            <p className="mt-0.5 text-xs text-white/40 line-clamp-1">{expense.description}</p>
          )}
          <div className="mt-1 flex items-center gap-3 text-xs text-white/30">
            <span>{fmtDate(expense.expenseDate)}</span>
            {expense.owner && <span>· {expense.owner.name}</span>}
            {expense.invoice && (
              <span className="text-blue-400">· {expense.invoice.invoiceNumber}</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={cn(
          'text-base font-bold',
          isIncome ? 'text-emerald-300' : 'text-red-300',
        )}>
          {isIncome ? '+' : '-'}{fmt(expense.amount, expense.currency)}
        </span>

        {/* Action menu — only for manual entries */}
        {!isInvoiceLinked && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-8 z-20 w-40 rounded-xl border border-white/10 bg-[#0d0d0d] shadow-2xl py-1">
                  <button
                    onClick={() => { onEdit(expense); setMenuOpen(false); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-white/70 hover:bg-white/5 hover:text-white transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Edit
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => { onDelete(expense); setMenuOpen(false); }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-400 hover:bg-red-400/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
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

function EntryModal({
  isOpen,
  onClose,
  editExpense,
}: {
  isOpen: boolean;
  onClose: () => void;
  editExpense: Expense | null;
}) {
  const qc = useQueryClient();
  const isEdit = editExpense !== null;

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<EntryForm>({
    resolver: zodResolver(entrySchema),
    defaultValues: {
      type:        'EXPENSE',
      category:    '',
      amount:      undefined,
      description: '',
      expenseDate: new Date().toISOString().slice(0, 10),
    },
  });

  useEffect(() => {
    if (isEdit && editExpense) {
      reset({
        type:        editExpense.type,
        category:    editExpense.category,
        amount:      Number(editExpense.amount),
        description: editExpense.description ?? '',
        expenseDate: editExpense.expenseDate,
      });
    } else {
      reset({
        type:        'EXPENSE',
        category:    '',
        amount:      undefined,
        description: '',
        expenseDate: new Date().toISOString().slice(0, 10),
      });
    }
  }, [isEdit, editExpense, reset, isOpen]);

  const mutation = useMutation({
    mutationFn: (data: EntryForm) =>
      isEdit
        ? expensesApi.updateExpense(editExpense!.id, data)
        : expensesApi.createExpense(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['erp-expenses'] });
      qc.invalidateQueries({ queryKey: ['erp-expenses-summary'] });
      onClose();
    },
  });

  const watchedType = watch('type');
  const categories  = watchedType === 'INCOME' ? CATEGORIES_INCOME : CATEGORIES_EXPENSE;

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0d0d0d] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-white">{isEdit ? 'Edit Entry' : 'New Entry'}</h2>
            <p className="text-xs text-white/40">{isEdit ? 'Update this manual entry.' : 'Add a manual income or expense record.'}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="p-6 space-y-4">
          {/* Type */}
          <div>
            <label className="block text-xs text-white/50 mb-1.5">Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(['INCOME', 'EXPENSE'] as ExpenseType[]).map(t => (
                <label key={t} className={cn(
                  'flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer text-sm font-medium transition-colors',
                  watchedType === t
                    ? t === 'INCOME'
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                      : 'border-red-500/40 bg-red-500/10 text-red-300'
                    : 'border-white/10 text-white/40 hover:border-white/20',
                )}>
                  <input type="radio" value={t} {...register('type')} className="sr-only" />
                  {t === 'INCOME' ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  {t}
                </label>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs text-white/50 mb-1.5">Category</label>
            <select
              {...register('category')}
              className="w-full rounded-lg border border-white/10 bg-[#111] text-white px-3 py-2.5 text-sm focus:outline-none focus:border-[#fbbf24]/50"
            >
              <option value="">Select category…</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {errors.category && <p className="mt-1 text-xs text-red-400">{errors.category.message}</p>}
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs text-white/50 mb-1.5">Amount (USD)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              {...register('amount', { valueAsNumber: true })}
              className="w-full rounded-lg border border-white/10 bg-[#111] text-white px-3 py-2.5 text-sm focus:outline-none focus:border-[#fbbf24]/50"
            />
            {errors.amount && <p className="mt-1 text-xs text-red-400">{errors.amount.message}</p>}
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs text-white/50 mb-1.5">Date</label>
            <input
              type="date"
              {...register('expenseDate')}
              className="w-full rounded-lg border border-white/10 bg-[#111] text-white px-3 py-2.5 text-sm focus:outline-none focus:border-[#fbbf24]/50"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-white/50 mb-1.5">Description (optional)</label>
            <textarea
              rows={2}
              placeholder="Brief note…"
              {...register('description')}
              className="w-full rounded-lg border border-white/10 bg-[#111] text-white px-3 py-2.5 text-sm focus:outline-none focus:border-[#fbbf24]/50 resize-none"
            />
          </div>

          {mutation.isError && (
            <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {(mutation.error as any)?.response?.data?.message ?? 'Failed to save entry'}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-white/70 hover:bg-white/5 text-sm min-h-[44px]">
              Cancel
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#fbbf24] text-black font-semibold hover:bg-[#f59e0b] text-sm disabled:opacity-50 min-h-[44px]">
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

function DeleteModal({
  isOpen,
  expense,
  onClose,
}: {
  isOpen: boolean;
  expense: Expense | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => expensesApi.deleteExpense(expense!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['erp-expenses'] });
      qc.invalidateQueries({ queryKey: ['erp-expenses-summary'] });
      onClose();
    },
  });

  if (!isOpen || !expense) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#0d0d0d] shadow-2xl p-6 space-y-4">
        <h2 className="text-base font-semibold text-white">Delete Entry</h2>
        <p className="text-sm text-white/60">
          Permanently delete <strong className="text-white">{expense.category}</strong> ({fmt(expense.amount)})?
          This cannot be undone.
        </p>
        {mutation.isError && (
          <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            {(mutation.error as any)?.response?.data?.message ?? 'Failed to delete'}
          </p>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-white/70 hover:bg-white/5 text-sm min-h-[44px]">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
            className="flex-1 px-4 py-2.5 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 text-sm disabled:opacity-50 min-h-[44px]">
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

  // Summary query
  const { data: summaryData } = useQuery({
    queryKey: ['erp-expenses-summary', dateFrom, dateTo],
    queryFn:  () => expensesApi.getSummary({ dateFrom: dateFrom || undefined, dateTo: dateTo || undefined })
      .then(r => r.data.data as FinancialSummary),
    staleTime: 30_000,
    enabled: mounted,
  });

  // List query
  const params = {
    page,
    limit: 20,
    ...(activeTab !== 'all' && { type: activeTab.toUpperCase() }),
    ...(search    && { category: search }),
    ...(dateFrom  && { dateFrom }),
    ...(dateTo    && { dateTo }),
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['erp-expenses', params],
    queryFn:  () => expensesApi.getExpenses(params).then(r => r.data.data as PaginatedExpenses),
    staleTime: 15_000,
    enabled: mounted,
  });

  const expenses  = data?.expenses ?? [];
  const totalPages = data?.pages ?? 1;
  const summary   = summaryData;

  function openCreate() { setEditEntry(null); setShowModal(true); }
  function openEdit(e: Expense) { setEditEntry(e); setShowModal(true); }

  if (!mounted) return null;

  return (
    <div className="min-h-full bg-[#050505] p-4 sm:p-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Expenses & Income</h1>
          <p className="text-sm text-white/40 mt-0.5">
            {isAdmin ? 'Track all income and expenses.' : 'Track your income and expenses.'}
          </p>
        </div>
        {(isAdmin || isEmployee) && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#fbbf24] text-black font-semibold hover:bg-[#f59e0b] transition-colors text-sm min-h-[44px]"
          >
            <Plus className="w-4 h-4" /> New Entry
          </button>
        )}
      </div>

      {/* Financial Summary Cards */}
      {summary && <SummaryCards summary={summary} />}
      {!summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-white/5 bg-white/3 p-4 animate-pulse h-24" />
          ))}
        </div>
      )}

      {/* Date Range Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-white/40">
          <span>Period:</span>
          <input
            type="date"
            value={dateFrom}
            onChange={e => { setDateFrom(e.target.value); setPage(1); }}
            className="rounded-lg border border-white/10 bg-[#0d0d0d] text-white px-2 py-1.5 text-xs focus:outline-none focus:border-[#fbbf24]/50"
          />
          <span>to</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => { setDateTo(e.target.value); setPage(1); }}
            className="rounded-lg border border-white/10 bg-[#0d0d0d] text-white px-2 py-1.5 text-xs focus:outline-none focus:border-[#fbbf24]/50"
          />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); setPage(1); }}
              className="p-1 text-white/30 hover:text-white/60">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* Type tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-white/3 border border-white/5">
          {(['all', 'income', 'expense'] as ActiveTab[]).map(t => (
            <button
              key={t}
              onClick={() => { setActiveTab(t); setPage(1); }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize',
                activeTab === t
                  ? 'bg-[#fbbf24] text-black'
                  : 'text-white/40 hover:text-white',
              )}
            >
              {t === 'all' ? 'All Entries' : t === 'income' ? 'Income' : 'Expenses'}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <input
            placeholder="Search category…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="pl-8 pr-4 py-2 rounded-lg border border-white/10 bg-[#0d0d0d] text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#fbbf24]/40 w-52"
          />
        </div>
      </div>

      {/* List */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-white/5 bg-white/3 p-4 animate-pulse h-20" />
          ))}
        </div>
      )}

      {isError && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
            <p className="text-sm text-white/50">Failed to load entries.</p>
            <button onClick={() => refetch()} className="px-4 py-2 rounded-lg border border-white/10 hover:bg-white/5 text-xs text-white/60">Retry</button>
          </div>
        </div>
      )}

      {!isLoading && !isError && expenses.length === 0 && (
        <div className="flex items-center justify-center py-16">
          <div className="text-center space-y-3">
            <DollarSign className="w-12 h-12 text-white/10 mx-auto" />
            <p className="text-sm text-white/40">No entries found.</p>
            {(isAdmin || isEmployee) && (
              <button onClick={openCreate} className="px-4 py-2 rounded-xl border border-[#fbbf24]/30 text-[#fbbf24] text-xs hover:bg-[#fbbf24]/10 transition-colors">
                Add first entry
              </button>
            )}
          </div>
        </div>
      )}

      {!isLoading && !isError && expenses.length > 0 && (
        <div className="space-y-2">
          {expenses.map(e => (
            <ExpenseRow
              key={e.id}
              expense={e}
              isAdmin={isAdmin}
              onEdit={openEdit}
              onDelete={setDeleteEntry}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded-lg border border-white/10 text-white/50 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-white/40">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-2 rounded-lg border border-white/10 text-white/50 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Modals */}
      <EntryModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditEntry(null); }}
        editExpense={editEntry}
      />
      <DeleteModal
        isOpen={deleteEntry !== null}
        expense={deleteEntry}
        onClose={() => setDeleteEntry(null)}
      />
    </div>
  );
}
