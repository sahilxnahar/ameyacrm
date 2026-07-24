'use client';
import * as React from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * A thin bar across the top while a page is loading.
 *
 * Server-rendered pages can take a beat to arrive, and without this the app
 * looks frozen after a click — the single most common reason people press a
 * button twice.
 */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [visible, setVisible] = React.useState(false);
  const [width, setWidth] = React.useState(0);

  React.useEffect(() => {
    // A navigation just completed.
    setWidth(100);
    const done = setTimeout(() => { setVisible(false); setWidth(0); }, 220);
    return () => clearTimeout(done);
  }, [pathname, search]);

  React.useEffect(() => {
    const start = () => {
      setVisible(true);
      setWidth(12);
      // Creep towards 90% so it always feels like progress, never completion.
      let w = 12;
      const t = setInterval(() => {
        w = Math.min(90, w + (90 - w) * 0.12);
        setWidth(w);
      }, 180);
      return t;
    };

    let timer: ReturnType<typeof setInterval> | null = null;
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.('a');
      if (!a) return;
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || a.getAttribute('target') === '_blank') return;
      if (href.startsWith('http') && !href.includes(window.location.host)) return;
      if (href === window.location.pathname + window.location.search) return;
      if (timer) clearInterval(timer);
      timer = start();
    };

    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      if (timer) clearInterval(timer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5" aria-hidden>
      <div
        className="h-full bg-primary transition-[width] duration-200 ease-out"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
