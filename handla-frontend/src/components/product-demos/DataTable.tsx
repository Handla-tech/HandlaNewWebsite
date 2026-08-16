'use client';

/**
 * DataTable — a compact, view-only table used across the ERP demos.
 * Rows are Inert (clicking shows the view-only toast). Header actions too.
 */

import React from 'react';
import { DemoTheme, Inert } from './demo-shared';

export interface Column {
  key: string;
  label: string;
  align?: 'start' | 'end' | 'center';
  render?: (row: Record<string, React.ReactNode>) => React.ReactNode;
}

export function DataTable({
  theme,
  columns,
  rows,
}: {
  theme: DemoTheme;
  columns: Column[];
  rows: Record<string, React.ReactNode>[];
}) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                style={{
                  textAlign: (c.align ?? 'start') as React.CSSProperties['textAlign'],
                  padding: '10px 14px',
                  fontSize: 11.5,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                  color: theme.inkFaint,
                  borderBottom: `1px solid ${theme.border}`,
                  whiteSpace: 'nowrap',
                }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <Inert
              as="tr"
              key={i}
              style={{
                borderBottom: `1px solid ${theme.border}`,
              }}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  style={{
                    textAlign: (c.align ?? 'start') as React.CSSProperties['textAlign'],
                    padding: '11px 14px',
                    color: theme.inkMuted,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </Inert>
          ))}
        </tbody>
      </table>
    </div>
  );
}
