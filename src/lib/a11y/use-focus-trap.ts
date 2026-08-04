'use client';
import { useEffect, useRef } from 'react';

/**
 * Keep the keyboard inside an open panel, and give focus back when it closes.
 *
 * ── Why (AMH-030) ───────────────────────────────────────────────────────────
 *
 * The shared `Dialog` is built on Radix, which handles all of this correctly.
 * Ten panels in this product are hand-rolled `fixed inset-0` overlays instead,
 * and none of them did any of it:
 *
 *   - Tab walked straight out of the panel and carried on through the page
 *     behind it, so a keyboard user ended up typing into a form they could not
 *     see, underneath a dimmed backdrop.
 *   - Escape did nothing, so the only way out was finding the X with the mouse.
 *   - On close, focus went back to `<body>`. A screen-reader user was returned
 *     to the top of the document with no idea where they had been.
 *
 * Panels that are hand-rolled usually got that way for a reason — a bespoke
 * layout, an animation, a bottom sheet — so this is a hook rather than a
 * component: it adds the behaviour without asking anyone to restructure markup
 * that already works.
 *
 * ── What it does NOT do ─────────────────────────────────────────────────────
 *
 * It does not hide the rest of the page from assistive technology (`inert` /
 * `aria-hidden` on siblings). Radix does; doing it properly means owning the
 * whole tree outside the panel, and getting it half right leaves the page
 * unusable rather than merely awkward. The three things above are the ones a
 * keyboard user actually hits.
 */
export function useFocusTrap<T extends HTMLElement>(
  open: boolean,
  onClose?: () => void,
): React.RefObject<T | null> {
  const ref = useRef<T>(null);
  // Captured before focus moves, so it can be handed back on close.
  const returnTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const node = ref.current;
    if (!node) return;

    returnTo.current = document.activeElement as HTMLElement | null;

    const focusable = () =>
      Array.from(
        node.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => {
        /*
         * Visibility, checked without layout.
         *
         * The first version of this filtered on `el.offsetParent !== null`,
         * which is wrong twice over: jsdom has no layout so it is always null
         * in tests, and — the part that matters — `offsetParent` is ALSO null
         * for anything inside a `position: fixed` ancestor. Every panel this
         * hook exists for is `fixed`, so that check found zero focusable
         * elements and the trap did nothing at all, in a real browser as much
         * as in a test.
         *
         * These three attributes are inspectable without layout and cover what
         * actually appears in these panels.
         */
        if (el.hasAttribute('hidden')) return false;
        if (el.getAttribute('aria-hidden') === 'true') return false;
        if (el.closest('[hidden],[aria-hidden="true"]')) return false;
        return true;
      });

    // Move focus in. The panel itself is the fallback, so focus is never left
    // behind on the page underneath even when there is nothing to focus inside.
    const first = focusable()[0];
    if (first) first.focus();
    else {
      node.setAttribute('tabindex', '-1');
      node.focus();
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      const items = focusable();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const firstItem = items[0]!;
      const lastItem = items[items.length - 1]!;
      const active = document.activeElement;

      // Wrap at both ends. Without this, Tab from the last control lands on the
      // browser chrome and then on the page behind the backdrop.
      if (e.shiftKey && (active === firstItem || !node.contains(active))) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && active === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      // Hand focus back to whatever opened the panel. `isConnected` because the
      // trigger may itself have been removed by the action just taken — focusing
      // a detached node silently sends focus to <body>, the thing this avoids.
      const back = returnTo.current;
      if (back && back.isConnected) back.focus();
    };
  }, [open, onClose]);

  return ref;
}
