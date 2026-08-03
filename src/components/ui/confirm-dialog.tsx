'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

/**
 * "Are you sure?" — asked properly, and with the numbers in it.
 *
 * `window.confirm` is blocked in sandboxed frames and by Chrome's "prevent
 * additional dialogs", and when it is blocked it returns false silently. Worse,
 * it cannot show the amount, the payee or what the action will do — and the
 * things it guards here move real money.
 */
export function ConfirmDialog({
  open, title, body, confirmLabel, cancelLabel = 'Cancel', destructive = false, pending = false, onCancel, onConfirm,
}: {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        {body && <p className="text-sm text-muted-foreground">{body}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>{cancelLabel}</Button>
          <Button type="button" variant={destructive ? 'destructive' : 'default'} onClick={onConfirm} disabled={pending} autoFocus>
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
