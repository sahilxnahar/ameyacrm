'use client';
import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export interface Column<T> {
  key: string;
  header: string;
  /** Cell content. */
  cell: (row: T) => React.ReactNode;
  /** Right-align numbers. */
  align?: 'left' | 'right';
  /** Hide from the card layout — useful for redundant or noisy columns. */
  hideOnMobile?: boolean;
  /** Show as the card's headline instead of a labelled row. */
  primary?: boolean;
}

/**
 * One data set, two presentations. A normal table from `sm` upward; on phones
 * each row becomes a card with the columns as labelled lines, because a
 * six-column table on a 390px screen is unreadable no matter how you scroll it.
 */
export function ResponsiveTable<T>({
  rows, columns, rowKey, empty = 'Nothing to show.', onRowClick, actions,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  empty?: string;
  onRowClick?: (row: T) => void;
  actions?: (row: T) => React.ReactNode;
}) {
  if (rows.length === 0) {
    return <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{empty}</p>;
  }

  const primary = columns.find((c) => c.primary) ?? columns[0];
  const rest = columns.filter((c) => c !== primary && !c.hideOnMobile);

  return (
    <>
      {/* Phones — cards */}
      <div className="space-y-2 sm:hidden">
        {rows.map((row) => (
          <div
            key={rowKey(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={cn('rounded-lg border bg-card p-3', onRowClick && 'active:bg-secondary')}
          >
            <div className="mb-1.5 text-sm font-medium">{primary.cell(row)}</div>
            <dl className="space-y-1">
              {rest.map((c) => (
                <div key={c.key} className="flex items-start justify-between gap-3 text-xs">
                  <dt className="shrink-0 text-muted-foreground">{c.header}</dt>
                  <dd className="min-w-0 text-right">{c.cell(row)}</dd>
                </div>
              ))}
            </dl>
            {actions && <div className="mt-2.5 flex flex-wrap gap-1.5 border-t pt-2.5">{actions(row)}</div>}
          </div>
        ))}
      </div>

      {/* Tablet and up — table */}
      <div className="table-scroll hidden sm:block">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={cn('whitespace-nowrap p-3', c.align === 'right' && 'text-right')}>{c.header}</th>
              ))}
              {actions && <th className="p-3" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn('border-b last:border-0', onRowClick && 'cursor-pointer hover:bg-secondary/50')}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn('p-3', c.align === 'right' && 'text-right')}>{c.cell(row)}</td>
                ))}
                {actions && <td className="p-3 text-right"><span className="flex justify-end gap-1.5">{actions(row)}</span></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
