'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

/**
 * "Confirm your password" — asked properly.
 *
 * AMH-071. The sibling of `ReasonDialog`, and it exists for the same reason:
 * `window.prompt` is blocked outright in sandboxed frames and by Chrome's and
 * Safari's "prevent this page from creating additional dialogs" checkbox, is
 * not announced to screen readers, and blocks the main thread.
 *
 * When it is suppressed the caller silently receives nothing — and the two
 * places this app used it for a password were **disabling two-factor** and
 * **erasing personal data**. Both then did nothing at all, with no error, which
 * reads to the user as "the button is broken" and to an administrator as "the
 * control is optional".
 *
 * A password field, not a text field: no autocomplete leak into the browser's
 * saved-form values, and the characters do not sit on screen in an office.
 */
export function PasswordDialog({
  open,
  title,
  description,
  confirmLabel,
  destructive = false,
  pending = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  destructive?: boolean;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: (password: string) => void;
}) {
  const [password, setPassword] = React.useState('');
  // Cleared on every open AND on close: a password must not survive in React
  // state after the dialog goes away.
  React.useEffect(() => { setPassword(''); }, [open]);

  const empty = password.length === 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <form
          onSubmit={(e) => { e.preventDefault(); if (!empty && !pending) onConfirm(password); }}
          className="space-y-3"
        >
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
          <div className="space-y-1">
            <Label htmlFor="password-dialog-input">Your password</Label>
            <Input
              id="password-dialog-input"
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>Cancel</Button>
            <Button type="submit" variant={destructive ? 'destructive' : 'default'} disabled={empty || pending}>
              {confirmLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
