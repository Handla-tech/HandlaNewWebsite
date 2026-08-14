'use client';

/**
 * DataTable — reusable table for ERP module list views.
 *
 * Renders a set of records as rows in a table (replacing the old card grids).
 * Theme-aware: uses the same hardcoded-dark utility classes that the light
 * class-remap layer in globals.css already overrides, so it flips with the
 * light/dark toggle automatically.
 *
 * Design goals:
 *  - column definitions with custom cell renderers
 *  - optional row click (navigate to detail)
 *  - optional actions column (edit / delete / custom) via a kebab menu
 *  - responsive: horizontal scroll on small screens
 *  - loading skeleton + empty state handled by the caller
 */

import { useState } from 'react';
import { MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDropdown, DropdownPortal } from '@/components/ui/DropdownPortal';

export interface Column<T> {
  /** unique key for the column */
  key: string;
  /** header label */
  header: string;
  /** cell renderer — receives the whole row */
  cell: (row: T) => React.ReactNode;
  /** optional extra classes on the <td>/<th> (e.g. width, alignment) */
  className?: string;
  /** hide on small screens */
  hideOnMobile?: boolean;
  /** align cell content */
  align?: 'left' | 'center' | 'right';
}

export interface RowAction<T> {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: (row: T) => void;
  /** danger styling (red) */
  danger?: boolean;
  /** show this action only when predicate returns true */
  show?: (row: T) => boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  actions?: RowAction<T>[];
  /** optional caption / empty message when rows is empty (caller usually handles empty separately) */
  emptyLabel?: string;
}

function alignClass(align?: 'left' | 'center' | 'right') {
  if (align === 'center') return 'text-center';
  if (align === 'right') return 'text-right';
  return 'text-left';
}

function RowActionsMenu<T>({ row, actions }: { row: T; actions: RowAction<T>[] }) {
  const menu = useDropdown('right');
  const visible = actions.filter((a) => (a.show ? a.show(row) : true));
  if (visible.length === 0) return null;

  return (
    <div
      ref={menu.triggerRef}
      className="relative inline-flex"
      onClick={(e) => {
        e.stopPropagation();
        menu.toggle();
      }}
    >
      <button
        className="flex h-8 w-8 items-center justify-center rounded-lg text-white/25 hover:text-white hover:bg-white/10 transition-colors"
        aria-label="Row actions"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      <DropdownPortal isOpen={menu.isOpen} style={menu.dropdownStyle} onClose={menu.close}>
        <div
          className="rounded-xl border border-white/10 bg-[#161616] shadow-2xl overflow-hidden py-1.5 min-w-[160px]"
          onClick={(e) => e.stopPropagation()}
        >
          {visible.map((a, i) => {
            const Icon = a.icon;
            return (
              <div key={a.label}>
                {a.danger && i > 0 && <div className="my-1 border-t border-white/[0.06]" />}
                <button
                  onClick={() => {
                    menu.close();
                    a.onClick(row);
                  }}
                  className={cn(
                    'flex items-center gap-2.5 w-full px-3.5 py-2 text-sm transition-colors min-h-[40px]',
                    a.danger
                      ? 'text-red-400 hover:bg-red-400/10'
                      : 'text-white/70 hover:bg-white/[0.06] hover:text-white',
                  )}
                >
                  {Icon && <Icon className="w-3.5 h-3.5" />} {a.label}
                </button>
              </div>
            );
          })}
        </div>
      </DropdownPortal>
    </div>
  );
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  actions,
}: DataTableProps<T>) {
  const hasActions = !!actions && actions.length > 0;

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/[0.06] bg-[#0f0f0f]">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-white/[0.06]">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-white/40 whitespace-nowrap',
                  alignClass(col.align),
                  col.hideOnMobile && 'hidden md:table-cell',
                  col.className,
                )}
              >
                {col.header}
              </th>
            ))}
            {hasActions && <th className="px-4 py-3 w-12" aria-label="Actions" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                'border-b border-white/[0.04] last:border-0 transition-colors',
                onRowClick && 'cursor-pointer hover:bg-white/[0.03]',
              )}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(
                    'px-4 py-3 align-middle text-white/80',
                    alignClass(col.align),
                    col.hideOnMobile && 'hidden md:table-cell',
                    col.className,
                  )}
                >
                  {col.cell(row)}
                </td>
              ))}
              {hasActions && (
                <td
                  className="px-4 py-3 align-middle text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  <RowActionsMenu row={row} actions={actions!} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A tiny loading skeleton that matches the table shell. */
export function TableSkeleton({ cols = 5, rows = 6 }: { cols?: number; rows?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0f0f0f]">
      <div className="border-b border-white/[0.06] px-4 py-3 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-3 flex-1 rounded bg-white/[0.06]" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="border-b border-white/[0.04] last:border-0 px-4 py-3.5 flex gap-4 animate-pulse">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="h-3.5 flex-1 rounded bg-white/[0.04]" />
          ))}
        </div>
      ))}
    </div>
  );
}
