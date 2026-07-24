import * as React from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * A table that behaves on a phone.
 *
 * On a narrow screen it bleeds to the screen edges and scrolls sideways with
 * momentum, instead of squeezing columns until a heading like "NEXT FOLLOW UP"
 * stacks into three lines and the last column falls off.
 */
export const Table = ({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) => (
  <div className="relative -mx-3 w-[calc(100%+1.5rem)] overflow-x-auto overscroll-x-contain px-3 sm:mx-0 sm:w-full sm:px-0 [-webkit-overflow-scrolling:touch]">
    <table className={cn('w-full caption-bottom text-sm', className)} {...props} />
  </div>
);
export const TableHeader = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <thead className={cn('[&_tr]:border-b', className)} {...props} />
);
export const TableBody = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />
);
export const TableRow = ({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr className={cn('border-b transition-colors hover:bg-muted/50', className)} {...props} />
);
export const TableHead = ({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  // Headings never wrap: a two-word heading breaking across three lines makes
  // the whole row taller than the data underneath it.
  <th className={cn('h-10 whitespace-nowrap px-3 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground', className)} {...props} />
);
export const TableCell = ({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cn('p-3 align-middle', className)} {...props} />
);
