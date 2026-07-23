'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

/**
 * Native-style pull-to-refresh for phones. Only engages at the very top of the
 * page and only for a downward drag, so it never fights normal scrolling or the
 * edge-swipe menu. Refreshes the current route's server data.
 */
export function PullToRefresh() {
  const router = useRouter();
  const [pull, setPull] = React.useState(0);
  const [refreshing, setRefreshing] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    // Touch devices only.
    if (!window.matchMedia('(pointer: coarse)').matches) return;

    let startY = 0;
    let active = false;
    const THRESHOLD = 70;
    const MAX = 110;

    const onStart = (e: TouchEvent) => {
      if (window.scrollY > 0 || refreshing) { active = false; return; }
      const t = e.touches[0];
      if (!t) return;
      startY = t.clientY;
      active = true;
    };
    const onMove = (e: TouchEvent) => {
      if (!active) return;
      const t = e.touches[0];
      if (!t) return;
      const dy = t.clientY - startY;
      if (dy <= 0) { setPull(0); return; }
      if (window.scrollY > 0) { active = false; setPull(0); return; }
      // Resist: the further you pull, the slower it moves.
      setPull(Math.min(MAX, dy * 0.5));
    };
    const onEnd = () => {
      if (!active) return;
      active = false;
      setPull((p) => {
        if (p >= THRESHOLD) {
          setRefreshing(true);
          router.refresh();
          window.setTimeout(() => { setRefreshing(false); setPull(0); }, 900);
          return THRESHOLD;
        }
        return 0;
      });
    };

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    };
  }, [router, refreshing]);

  if (pull <= 0 && !refreshing) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center lg:hidden"
      style={{ transform: `translateY(${Math.max(8, pull)}px)`, opacity: Math.min(1, pull / 60) }}
      aria-hidden
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full border bg-card shadow-md">
        <RefreshCw className={`h-4 w-4 text-primary ${refreshing ? 'animate-spin' : ''}`} style={{ transform: refreshing ? undefined : `rotate(${pull * 3}deg)` }} />
      </span>
    </div>
  );
}
