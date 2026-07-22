'use client';
import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * A dashboard segment you can minimise. Click the heading to fold it away; the
 * choice is remembered per person (per device), so everyone can shape their Home
 * to show only the parts they care about (#2).
 */
export function CollapsibleSection({
  id, title, action, children, defaultOpen = true,
}: {
  id: string;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const key = `amh:dash:${id}`;
  const [open, setOpen] = React.useState(defaultOpen);

  React.useEffect(() => {
    try { const v = localStorage.getItem(key); if (v === '0') setOpen(false); else if (v === '1') setOpen(true); } catch { /* ignore */ }
  }, [key]);

  const toggle = () =>
    setOpen((o) => {
      const n = !o;
      try { localStorage.setItem(key, n ? '1' : '0'); } catch { /* ignore */ }
      return n;
    });

  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="flex items-center gap-1.5 rounded px-1 py-0.5 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground"
          title={open ? 'Minimise this section' : 'Show this section'}
        >
          <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 transition-transform', !open && '-rotate-90')} />
          {title}
        </button>
        {action}
      </div>
      {open && <div className="animate-in">{children}</div>}
    </section>
  );
}
