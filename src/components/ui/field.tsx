import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * A form field: label, the control, an optional hint and an optional error, with
 * the spacing owned once. Before this every screen wrote its own `Field` and a
 * bare `inputCls` string; a form is now a list of `<Field>`s, not forty lines of
 * Tailwind, and an inline error has one place to live (batch 7 builds on this).
 */
export function Field({
  label, hint, error, htmlFor, required, children, className,
}: {
  label?: string;
  hint?: string;
  error?: string | null;
  htmlFor?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1', className)}>
      {label && (
        <label htmlFor={htmlFor} className="block text-xs text-muted-foreground">
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}

/** A responsive grid for laying fields out — the pattern every add-form used. */
export function FormGrid({ cols = 3, children, className }: { cols?: 1 | 2 | 3; children: ReactNode; className?: string }) {
  return (
    <div className={cn('grid gap-3', cols === 2 && 'sm:grid-cols-2', cols === 3 && 'sm:grid-cols-3', className)}>
      {children}
    </div>
  );
}
