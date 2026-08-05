'use client';
import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-popover bg-black/60 backdrop-blur-sm data-[state=open]:animate-fade-in" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // On phones this behaves as a bottom sheet: full width, rounded top only,
        // and never taller than the screen so the buttons stay reachable.
        'fixed z-popover grid gap-4 border bg-card shadow-lg data-[state=open]:animate-fade-in',
        'inset-x-0 bottom-0 max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]',
        // On a desktop it is a centred panel. The width and height caps here are
        // deliberately expressed against the viewport rather than as fixed sizes,
        // because call sites routinely ask for `max-w-2xl` (672px) and `max-h-[92vh]`
        // — which is wider than the window between 640 and 704px, and on an 800px
        // laptop leaves 32px of breathing room, so a long form's buttons ended up
        // pressed against the bottom edge of the screen. These two caps win over
        // whatever a call site asks for, so no dialog can outgrow the display it
        // is on.
        // On a desktop it is a centred panel. The width is capped against the
        // viewport as well as by the call site's `max-w-*`, because call sites
        // routinely ask for `max-w-2xl` (672px) — wider than the window itself
        // between 640 and 704px, where the panel then ran off both edges. The
        // height cap uses dvh and wins over the call site's, so a long form on an
        // 800px laptop cannot push its own buttons past the bottom of the screen.
        'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:p-6 sm:pb-6',
        'sm:w-[calc(100vw-3rem)] sm:!max-h-[88dvh]',
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="focus-ring absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = 'DialogContent';

export const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5 text-left', className)} {...props} />
);
export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn('font-display text-lg font-semibold', className)} {...props} />
));
DialogTitle.displayName = 'DialogTitle';
export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
));
DialogDescription.displayName = 'DialogDescription';
