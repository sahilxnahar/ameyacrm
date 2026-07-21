import * as React from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * A styled native `<select>` matching `<Input>`. Native on purpose: it is
 * accessible, works on every phone, and needs no JavaScript. The searchable
 * combobox for long lists is batch 17; this is the everyday control.
 */
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = 'Select';
