import { formatCompactCurrency, formatExactCurrency } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

/**
 * Money shown the way people say it (₹1.2 Cr), with the exact rupee on hover so
 * precision is one hover away. Use for headline figures; use `formatCurrency`
 * directly where the exact number must always be on screen (e.g. an invoice).
 */
export function Money({ value, className }: { value: number | string | null | undefined; className?: string }) {
  return (
    /*
     * `tabular-nums` is not decoration on a money figure.
     *
     * Inter's default figures are proportional: a 1 is narrower than a 0. In a
     * column of rupee amounts that means no two rows line up on the decimal, and
     * a figure that updates in place visibly shifts sideways as the digits
     * change. Fixed-width figures cost nothing and are the difference between a
     * ledger you can scan down and one you have to read.
     */
    <span className={cn('tabular-nums', className)} title={formatExactCurrency(value)}>
      {formatCompactCurrency(value)}
    </span>
  );
}
