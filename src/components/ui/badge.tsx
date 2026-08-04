import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary/15 text-primary',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        success: 'border-transparent bg-success/15 text-success',
        warning: 'border-transparent bg-warning/20 text-brass-deep',
        destructive: 'border-transparent bg-destructive/15 text-destructive',
        outline: 'text-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

/**
 * The tones a Badge can take.
 *
 * Exported so the `statusVariant(...)`-style helpers scattered across the
 * screens can be TYPED against it instead of returning `string` and being
 * forced in with `as never` at every call site (AMH-050). A helper that
 * returns a colour the Badge does not have is then a compile error rather
 * than a badge that silently renders with no styling.
 */
export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>;

export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
export { badgeVariants };
