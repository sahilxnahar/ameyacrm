'use client';
import { toast } from 'sonner';
import { undoDelete } from '@/server/actions/undo';

/**
 * "Deleted. Undo?" (AMH-033)
 *
 * The affordance matters as much as the mechanism. A recycle bin somebody has
 * to go and find is used by nobody — the moment you need undo is the second
 * after you press delete, and if the offer is not on screen then, the feature
 * may as well not exist. Which is roughly what the audit found: undo existed on
 * 3 of ~120 destructive surfaces, and two of those were buried.
 *
 * So the offer rides on the confirmation toast, and the toast stays up longer
 * than a normal one — long enough to read what happened and decide, short
 * enough not to stack up behind real work.
 *
 *     const r = await deleteReminder(id);
 *     if ('error' in r) { toast.error(r.error); return; }
 *     toastWithUndo('Reminder deleted', r.undo, refreshTheList);
 *
 * `undo` is null when the deletion could not be recorded — the delete itself
 * still happened, so the toast appears without the button rather than offering
 * an undo that would fail.
 */
export function toastWithUndo(
  message: string,
  undo: { id: string; label: string } | null | undefined,
  onRestored?: () => void,
): void {
  if (!undo) {
    toast.success(message);
    return;
  }
  toast.success(message, {
    duration: 10_000,
    action: {
      label: 'Undo',
      onClick: () => {
        // Deliberately not awaited: the toast closes on click, so there is
        // nowhere left to show a spinner. The result gets its own toast.
        void undoDelete(undo.id).then((r) => {
          if ('error' in r) { toast.error(r.error); return; }
          toast.success(r.message);
          onRestored?.();
        }).catch(() => {
          toast.error('Could not reach the server, so nothing was restored. Try again.');
        });
      },
    },
  });
}
