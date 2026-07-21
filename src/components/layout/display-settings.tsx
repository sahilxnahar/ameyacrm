'use client';
import * as React from 'react';
import { SlidersHorizontal, Type, Rows3, Palette } from 'lucide-react';
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
const ACCENT_KEY = 'amh:accent';
const SCALES = ['s', 'm', 'l'] as const;
type Scale = (typeof SCALES)[number];
const ACCENTS = [
  { key: 'brass', label: 'Gold', swatch: 'hsl(40 51% 42%)' },
  { key: 'emerald', label: 'Emerald', swatch: 'hsl(160 52% 33%)' },
  { key: 'indigo', label: 'Indigo', swatch: 'hsl(234 46% 50%)' },
  { key: 'teal', label: 'Teal', swatch: 'hsl(190 60% 32%)' },
  { key: 'rose', label: 'Rose', swatch: 'hsl(342 56% 45%)' },
] as const;
type Accent = (typeof ACCENTS)[number]['key'];

function apply(scale: Scale, density: 'comfortable' | 'compact', accent: Accent) {
  const el = document.documentElement;
  el.setAttribute('data-text-scale', scale);
  el.setAttribute('data-density', density);
  el.setAttribute('data-accent', accent);
}

export function DisplaySettings() {
  const [open, setOpen] = React.useState(false);
  const [scale, setScale] = React.useState<Scale>('m');
  const [density, setDensity] = React.useState<'comfortable' | 'compact'>('comfortable');
  const [accent, setAccent] = React.useState<Accent>('brass');
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const s = (localStorage.getItem(TEXT_KEY) as Scale) || 'm';
    const d = (localStorage.getItem(DENSITY_KEY) as 'comfortable' | 'compact') || 'comfortable';
    const a = (localStorage.getItem(ACCENT_KEY) as Accent) || 'brass';
    setScale(SCALES.includes(s) ? s : 'm');
    setDensity(d === 'compact' ? 'compact' : 'comfortable');
    setAccent(ACCENTS.some((x) => x.key === a) ? a : 'brass');
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const setTextScale = (s: Scale) => { setScale(s); localStorage.setItem(TEXT_KEY, s); apply(s, density, accent); };
  const setDens = (d: 'comfortable' | 'compact') => { setDensity(d); localStorage.setItem(DENSITY_KEY, d); apply(scale, d, accent); };
  const setAccentColor = (a: Accent) => { setAccent(a); localStorage.setItem(ACCENT_KEY, a); apply(scale, density, a); };

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

          <p className="mb-1.5 mt-3 flex items-center gap-1.5 text-xs font-semibold"><Palette className="h-3.5 w-3.5" /> Accent</p>
          <div className="flex items-center gap-2">
            {ACCENTS.map((a) => (
              <button key={a.key} onClick={() => setAccentColor(a.key)} title={a.label} aria-label={a.label}
                className={cn('h-6 w-6 rounded-full ring-offset-2 ring-offset-popover transition-transform hover:scale-110', accent === a.key ? 'ring-2 ring-foreground' : '')}
                style={{ backgroundColor: a.swatch }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
