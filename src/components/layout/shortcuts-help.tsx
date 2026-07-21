'use client';
import * as React from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

/**
 * Batch 16 (quality of life): a discoverable keyboard-shortcuts sheet, opened by
 * pressing `?` anywhere you are not typing. A power user should never have to
 * guess what the keyboard can do; this is where they find out.
 */
const SHORTCUTS: Array<{ keys: string[]; label: string }> = [
  { keys: ['⌘', 'K'], label: 'Open the command palette — jump to any page or search any record' },
  { keys: ['Ctrl', 'K'], label: 'Command palette (Windows / Linux)' },
  { keys: ['?'], label: 'Show this shortcuts help' },
  { keys: ['↑', '↓'], label: 'Move through results in the palette' },
  { keys: ['↵'], label: 'Open the highlighted result' },
  { keys: ['Esc'], label: 'Close a dialog, palette or menu' },
];

export function ShortcutsHelp() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '?') return;
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      setOpen(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogTitle>Keyboard shortcuts</DialogTitle>
        <ul className="mt-2 space-y-2">
          {SHORTCUTS.map((s, i) => (
            <li key={i} className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted-foreground">{s.label}</span>
              <span className="flex shrink-0 gap-1">
                {s.keys.map((k) => (
                  <kbd key={k} className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-medium text-foreground">{k}</kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
