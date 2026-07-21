'use client';
import * as React from 'react';
import { SlidersHorizontal, Type, Rows3 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * Personal display controls: text size (an accessibility need — some people
 * cannot read the default) and density (comfortable vs compact, for people who
 * want more on screen). Both are per-device, stored in localStorage and applied
 * as attributes on <html> that the global CSS reads. Kept out of the server so
 * changing them is instant and needs no round-trip.
 */
const TEXT_KEY = 'amh:text-scale';
const DENSITY_KEY = 'amh:density';
const SCALES = ['s', 'm', 'l'] as const;
type Scale = (typeof SCALES)[number];

function apply(scale: Scale, density: 'comfortable' | 'compact') {
  const el = document.documentElement;
  el.setAttribute('data-text-scale', scale);
  el.setAttribute('data-density', density);
}

export function DisplaySettings() {
  const [open, setOpen] = React.useState(false);
  const [scale, setScale] = React.useState<Scale>('m');
  const [density, setDensity] = React.useState<'comfortable' | 'compact'>('comfortable');
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const s = (localStorage.getItem(TEXT_KEY) as Scale) || 'm';
    const d = (localStorage.getItem(DENSITY_KEY) as 'comfortable' | 'compact') || 'comfortable';
    setScale(SCALES.includes(s) ? s : 'm');
    setDensity(d === 'compact' ? 'compact' : 'comfortable');
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const setTextScale = (s: Scale) => { setScale(s); localStorage.setItem(TEXT_KEY, s); apply(s, density); };
  const setDens = (d: 'comfortable' | 'compact') => { setDensity(d); localStorage.setItem(DENSITY_KEY, d); apply(scale, d); };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Display settings"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <SlidersHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-60 rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold"><Type className="h-3.5 w-3.5" /> Text size</p>
          <div className="grid grid-cols-3 gap-1">
            {([['s', 'Small'], ['m', 'Default'], ['l', 'Large']] as const).map(([v, lbl]) => (
              <button key={v} onClick={() => setTextScale(v)}
                className={cn('rounded-md border px-2 py-1.5 text-sm', scale === v ? 'border-primary bg-primary/10 font-medium' : 'hover:bg-secondary')}>
                {lbl}
              </button>
            ))}
          </div>
          <p className="mb-1.5 mt-3 flex items-center gap-1.5 text-xs font-semibold"><Rows3 className="h-3.5 w-3.5" /> Density</p>
          <div className="grid grid-cols-2 gap-1">
            {([['comfortable', 'Comfortable'], ['compact', 'Compact']] as const).map(([v, lbl]) => (
              <button key={v} onClick={() => setDens(v)}
                className={cn('rounded-md border px-2 py-1.5 text-sm', density === v ? 'border-primary bg-primary/10 font-medium' : 'hover:bg-secondary')}>
                {lbl}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
