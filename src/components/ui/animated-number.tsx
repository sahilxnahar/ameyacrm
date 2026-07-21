'use client';
import * as React from 'react';

/**
 * A number that counts up to its value when it first appears (V3). A small touch
 * that makes a KPI feel alive. Honours reduced-motion by showing the final value
 * at once. Pass a `format` to render currency, percentages, etc.
 */
export function AnimatedNumber({
  value, durationMs = 650, format = (n) => Math.round(n).toLocaleString('en-IN'), className,
}: {
  value: number;
  durationMs?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const [display, setDisplay] = React.useState(value);
  const raf = React.useRef<number | null>(null);

  React.useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !Number.isFinite(value)) { setDisplay(value); return; }
    const from = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (value - from) * eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [value, durationMs]);

  return <span className={className}>{format(display)}</span>;
}
