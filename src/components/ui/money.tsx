import { formatCompactCurrency, formatExactCurrency } from '@/lib/utils/format';

/**
 * Money shown the way people say it (₹1.2 Cr), with the exact rupee on hover so
 * precision is one hover away. Use for headline figures; use `formatCurrency`
 * directly where the exact number must always be on screen (e.g. an invoice).
 */
export function Money({ value, className }: { value: number | string | null | undefined; className?: string }) {
  return (
    <span className={className} title={formatExactCurrency(value)}>
      {formatCompactCurrency(value)}
    </span>
  );
}
