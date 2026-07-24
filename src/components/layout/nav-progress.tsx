'use client';

import * as React from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * A thin bar across the top while the next page is being fetched.
 *
 * Server-rendered pages show nothing between the tap and the response, which
 * reads as "the app is broken" rather than "the app is thinking". This starts
 * the moment an internal link is tapped and finishes when the route actually
 * changes, so slow pages feel responsive even before they arrive.
 */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [visible, setVisible] = React.useState(false);
  const [width, setWidth] = React.useState(0);
  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([]);

  const clear = React.useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  // Finish whenever the route settles.
  React.useEffect(() => {
    clear();
    setWidth(100);
    const t = setTimeout(() => { setVisible(false); setWidth(0); }, 220);
    timers.current.push(t);
    return clear;
  }, [pathname, search, clear]);

  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as HTMLElement)?.closest?.('a');
      if (!link) return;

      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || link.target === '_blank' || link.hasAttribute('download')) return;
      // External links leave the app; the browser shows its own progress.
      if (/^https?:\/\//i.test(href) && !href.startsWith(window.location.origin)) return;
      // Already here — no navigation will happen, so no bar.
      if (href === window.location.pathname + window.location.search) return;

      clear();
      setVisible(true);
      setWidth(8);
      // Creep forward so it never looks stuck, but never reach the end until
      // the page actually arrives.
      [[90, 18], [220, 38], [500, 58], [1000, 72], [2000, 84], [4000, 92]].forEach(([ms, w]) => {
        timers.current.push(setTimeout(() => setWidth(w as number), ms as number));
      });
    };

    document.addEventListener('click', onClick, { capture: true });
    return () => {
      document.removeEventListener('click', onClick, { capture: true });
      clear();
    };
  }, [clear]);

  if (!visible && width === 0) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div
        className="h-full bg-gradient-to-r from-[#8C6E2C] via-[#E4C878] to-[#A07D34] shadow-[0_0_8px_rgba(160,125,52,0.6)]"
        style={{
          width: `${width}%`,
          opacity: visible ? 1 : 0,
          transition: 'width 300ms ease-out, opacity 200ms ease-out',
        }}
      />
    </div>
  );
}
