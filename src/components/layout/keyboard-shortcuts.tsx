'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

/**
 * App-wide keyboard navigation: `/` to search, `g` then a letter to jump.
 *
 * Three things this has to get right, each of which was got wrong first time:
 *
 *  1. **The listener registers once.** Holding the pending-`g` state in React
 *     state re-ran the effect on every keystroke, and the cleanup cancelled the
 *     expiry timer the moment it was armed — so a stray `g` waited forever and
 *     silently ate the next key. Both the pending flag and the timer live in
 *     refs, so the effect has no reactive dependencies at all.
 *
 *  2. **It yields to screens that own the keyboard.** Ameya Tally binds bare
 *     letters (`g` for GST, `d` for Day Book) and the Launchpad binds `/`. A
 *     screen marks itself with `data-keyboard-owner` and these bindings stand
 *     down rather than firing twice.
 *
 *  3. **It never fires while somebody is typing.** An `s` in a narration field
 *     is an `s`.
 *
 * `?` is deliberately NOT handled here — `ShortcutsHelp` already owns it, and
 * two listeners meant two dialogs stacked on top of each other.
 */
export const GOTO: Record<string, { href: string; label: string }> = {
  h: { href: '/home', label: 'Home' },
  t: { href: '/today', label: "Today's priorities" },
  s: { href: '/sales', label: 'Sales' },
  i: { href: '/inventory', label: 'Inventory' },
  f: { href: '/finance', label: 'Finance' },
  b: { href: '/tally', label: 'Ameya Tally (books)' },
  d: { href: '/documents', label: 'Documents' },
  o: { href: '/site-ops', label: 'Site Ops' },
  m: { href: '/chat', label: 'Messages' },
};

/** Where a guest goes instead — the real routes would bounce them out of the demo. */
const GOTO_DEMO: Record<string, { href: string; label: string }> = {
  h: { href: '/demo', label: 'Overview' },
  t: { href: '/demo/tasks', label: 'Tasks' },
  s: { href: '/demo/sales', label: 'Sales' },
  i: { href: '/demo/inventory', label: 'Inventory' },
  b: { href: '/demo/tally', label: 'Books' },
};

function isTyping(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ||
    el.isContentEditable === true || el.closest?.('[contenteditable="true"]') != null;
}

/** Has the screen on show claimed bare-letter keys for itself? */
function screenOwnsKeyboard(): boolean {
  return document.querySelector('[data-keyboard-owner]') !== null;
}

export function KeyboardShortcuts({
  onOpenSearch,
  isGuest = false,
}: { onOpenSearch?: () => void; isGuest?: boolean } = {}) {
  const router = useRouter();
  const [hint, setHint] = React.useState(false);

  // Refs, not state: the effect must not re-run, or it destroys its own timer.
  const pending = React.useRef(false);
  const timer = React.useRef<number | null>(null);
  const search = React.useRef(onOpenSearch);
  const guest = React.useRef(isGuest);
  search.current = onOpenSearch;
  guest.current = isGuest;

  React.useEffect(() => {
    const disarm = () => {
      pending.current = false;
      setHint(false);
      if (timer.current) { window.clearTimeout(timer.current); timer.current = null; }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping(e.target)) return;

      if (e.key === 'Escape') { disarm(); return; }

      if (pending.current) {
        disarm();
        const map = guest.current ? GOTO_DEMO : GOTO;
        const dest = map[e.key.toLowerCase()];
        if (dest) { e.preventDefault(); router.push(dest.href); }
        return;
      }

      // Screens that drive themselves from the keyboard keep their own keys.
      if (screenOwnsKeyboard()) return;

      if (e.key === 'g') {
        pending.current = true;
        setHint(true);
        timer.current = window.setTimeout(disarm, 1500);
        return;
      }

      if (e.key === '/') {
        e.preventDefault();
        if (search.current) search.current();
        else window.dispatchEvent(new CustomEvent('amh:open-palette'));
      }
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (timer.current) window.clearTimeout(timer.current);
    };
    // Intentionally empty: everything mutable is held in a ref, so this
    // listener is attached once for the life of the shell.
  }, [router]);

  if (!hint) return null;
  const map = isGuest ? GOTO_DEMO : GOTO;
  return (
    <div className="fixed bottom-4 left-1/2 z-toast -translate-x-1/2 rounded-md border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-lg">
      Go to…{' '}
      <span className="text-muted-foreground">
        {Object.entries(map).map(([k, v]) => `${k} ${v.label.toLowerCase()}`).join(' · ')}
      </span>
    </div>
  );
}
