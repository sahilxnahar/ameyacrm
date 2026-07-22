'use client';
import * as React from 'react';

/**
 * Run `fn` on an interval, but only while the browser tab is visible.
 *
 * When the tab is hidden (another tab, minimised, phone asleep) the timer is
 * cleared, so a backgrounded page stops making needless server calls. The moment
 * it becomes visible again `fn` runs once immediately — so you see fresh data at
 * a glance — and the interval resumes. On mount it fires once if the tab is
 * already visible, which replaces the usual "load, then poll" pair.
 *
 * This is the "calm polling" that takes the constant chatter out of the app.
 */
export function useVisiblePoll(fn: () => void, intervalMs: number, deps: React.DependencyList = []) {
  const fnRef = React.useRef(fn);
  fnRef.current = fn;

  React.useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const tick = () => fnRef.current();
    const start = () => { if (timer === null) timer = setInterval(tick, intervalMs); };
    const stop = () => { if (timer !== null) { clearInterval(timer); timer = null; } };

    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.hidden) stop();
      else { tick(); start(); }
    };

    if (typeof document === 'undefined' || !document.hidden) { tick(); start(); }
    document.addEventListener('visibilitychange', onVisibility);
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, ...deps]);
}
