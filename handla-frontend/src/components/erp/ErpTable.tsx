'use client';

/**
 * ErpTable — generic sortable glassmorphism table wrapper.
 *
 * Features:
 *  - sticky header
 *  - hover row highlight
 *  - horizontal scroll on mobile (no overflow)
 *  - full ARIA roles (table / row / cell / columnheader)
 *
 * Usage:
 *   <ErpTable
 *     columns={[
 *       { key: 'name',   label: 'Name',   sortable: true },
 *       { key: 'status', label: 'Status' },
 *     ]}
 *     sortKey="name"
 *     sortDir="asc"
 *     onSort={(key) => …}
 *   >
 *     {rows.map(row => (
 *       <tr key={row.id} className="…">
 *         <td>…</td>
 *       </tr>
 *     ))}
 *   </ErpTable>
 */

import React from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TableColumn {
  key:      string;
  label:    string;
  sortable?: boolean;
  className?: string;
}

interface ErpTableProps {
  columns:    TableColumn[];
  sortKey?:   string;
  sortDir?:   'asc' | 'desc';
  onSort?:    (key: string) => void;
  children:   React.ReactNode;
  className?: string;
  caption?:   string;
}

export default function ErpTable({
  columns,
  sortKey,
  sortDir,
  onSort,
  children,
  className,
  caption,
}: ErpTableProps) {
  return (
    <div
      className={cn(
        'w-full overflow-x-auto rounded-xl border border-[#1a1a1a] bg-white/[0.02] backdrop-blur-sm',
        className,
      )}
    >
      <table className="w-full min-w-[600px] text-sm" role="table">
        {caption && (
          <caption className="sr-only">{caption}</caption>
        )}
        <thead className="sticky top-0 z-10 border-b border-[#1a1a1a] bg-[#0d0d0d]">
          <tr role="row">
            {columns.map((col) => {
              const isActive = sortKey === col.key;
              return (
                <th
                  key={col.key}
                  scope="col"
                  role="columnheader"
                  aria-sort={
                    isActive
                      ? sortDir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : col.sortable
                      ? 'none'
                      : undefined
                  }
                  className={cn(
                    'whitespace-nowrap px-4 py-3 text-left font-medium text-[#888]',
                    col.sortable && 'cursor-pointer select-none hover:text-[#fbbf24] transition-colors',
                    col.className,
                  )}
                  onClick={col.sortable ? () => onSort?.(col.key) : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.sortable && (
                      <span className="opacity-60" aria-hidden="true">
                        {isActive ? (
                          sortDir === 'asc' ? (
                            <ChevronUp className="h-3 w-3 text-[#fbbf24]" />
                          ) : (
                            <ChevronDown className="h-3 w-3 text-[#fbbf24]" />
                          )
                        ) : (
                          <ChevronsUpDown className="h-3 w-3" />
                        )}
                      </span>
                    )}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody role="rowgroup" className="divide-y divide-[#1a1a1a]">
          {children}
        </tbody>
      </table>
    </div>
  );
}
