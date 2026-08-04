'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Warn before a half-filled form is thrown away.
 *
 * ── Why ─────────────────────────────────────────────────────────────────────
 *
 * Several forms in this product are long: the RA bill, the daily site log, the
 * company statutory details, the vendor bill with its line items. Nothing
 * anywhere warned before losing one. Closing the tab, hitting the browser back
 * button, or clicking a sidebar link discarded twenty minutes of typing with no
 * prompt, and there is no draft to recover — the work is simply gone.
 *
 * The people this hurts most are the ones on site filling in a daily log on a
 * phone, where a stray back-swipe is easy and retyping it is slow.
 *
 * ── What it does and does not cover ─────────────────────────────────────────
 *
 * `beforeunload` covers leaving the site, closing the tab and reloading. The
 * browser shows its own wording — a page cannot customise it, and has not been
 * able to for years, so this deliberately does not try.
 *
 * It does NOT cover an in-app navigation: the App Router has no documented
 * navigation-blocking hook, and the ways of forcing one all break the router's
 * own back/forward handling in a way that is worse than the problem. Clicking a
 * link in the sidebar therefore still discards. That is an honest limitation,
 * not an oversight — say so rather than let the guard imply a cover it has not
 * got.
 *
 * ── Using it ────────────────────────────────────────────────────────────────
 *
 *     const [dirty, setDirty] = useState(false);
 *     useUnsavedChanges(dirty);
 *     <form onChange={() => setDirty(true)} onSubmit={…}>
 *
 * Turn it off the moment the save succeeds — a guard that fires after a
 * successful save trains people to click through it, and then it protects
 * nothing.
 */
export function useUnsavedChanges(dirty: boolean): void {
  // Read through a ref so the listener is attached once rather than being
  // removed and re-added on every keystroke.
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      // Legacy browsers need returnValue set to something; the string is never
      // shown. Chrome and Firefox both display their own fixed wording.
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);
}

/**
 * The common case: mark a form dirty on the first edit, clean on save.
 *
 * Spread `formProps` onto the `<form>` and call `saved()` when the action comes
 * back OK. `onInput` as well as `onChange` because a text input does not fire
 * `change` until it loses focus, and someone who types and immediately closes
 * the tab is exactly the person this is for.
 */
export function useFormGuard(): {
  formProps: { onChange: () => void; onInput: () => void };
  dirty: boolean;
  saved: () => void;
} {
  const [dirty, setDirty] = useState(false);
  useUnsavedChanges(dirty);
  const markDirty = useCallback(() => setDirty(true), []);
  const saved = useCallback(() => setDirty(false), []);
  return { formProps: { onChange: markDirty, onInput: markDirty }, dirty, saved };
}
