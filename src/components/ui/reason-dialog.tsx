'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

/**
 * "Why?" — asked properly.
 *
 * This replaces `window.prompt`, which is blocked outright in sandboxed frames
 * and by Chrome's "prevent this page from creating additional dialogs", is not
 * announced to screen readers, and blocks the main thread. When it is
 * suppressed the caller silently receives nothing — and the reason a payment
 * was turned down is shown to the person who raised it, so losing it is a data
 * problem, not a cosmetic one.
 */
export function ReasonDialog({
  open, title, description, label, confirmLabel, destructive = true, minLength = 3, pending = false, onCancel, onConfirm,
}: {
  open: boolean;
  title: string;
  description?: string;
  label: string;
  confirmLabel: string;
  destructive?: boolean;
  minLength?: number;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = React.useState('');
  React.useEffect(() => { if (open) setReason(''); }, [open]);

  const tooShort = reason.trim().length < minLength;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <form
          onSubmit={(e) => { e.preventDefault(); if (!tooShort && !pending) onConfirm(reason.trim()); }}
          className="space-y-3"
        >
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
          <div className="space-y-1">
            <Label htmlFor="reason-dialog-input">{label}</Label>
            <textarea
              id="reason-dialog-input"
              autoFocus
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="focus-ring w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>Cancel</Button>
            <Button type="submit" variant={destructive ? 'destructive' : 'default'} disabled={tooShort || pending}>
              {confirmLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
