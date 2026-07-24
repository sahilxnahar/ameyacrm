'use client';
import * as React from 'react';
import { HelpCircle, ChevronDown, ChevronRight, ArrowRight } from 'lucide-react';
import { screenHelp } from '@/config/screen-help';
import { cn } from '@/lib/utils/cn';

const KEY = 'amh:screen-help-collapsed';

/**
 * A collapsible "How this works" note for a screen a newcomer might find
 * unfamiliar. Open by default the first time; once someone folds it, that choice
 * is remembered per device, so it never nags an experienced user.
 */
export function ScreenHelp({ id }: { id: string }) {
  const help = screenHelp(id);
  const [open, setOpen] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    let collapsed: Record<string, boolean> = {};
    try { collapsed = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { collapsed = {}; }
    setOpen(!collapsed[id]);
  }, [id]);

  if (!help) return null;
  const isOpen = open ?? true;

  const toggle = () => {
    const next = !isOpen;
    setOpen(next);
    try {
      const collapsed = JSON.parse(localStorage.getItem(KEY) || '{}');
      collapsed[id] = !next;
      localStorage.setItem(KEY, JSON.stringify(collapsed));
    } catch { /* ignore */ }
  };

  return (
    <div className="mb-5 rounded-lg border bg-secondary/30">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={isOpen}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium"
      >
        <HelpCircle className="h-4 w-4 shrink-0 text-[#A07D34]" />
        {help.title ?? 'How this works'}
        {isOpen ? <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" /> : <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />}
      </button>
      {isOpen && (
        <div className={cn('px-3 pb-3 pl-9 text-sm text-muted-foreground')}>
          <ul className="space-y-1.5">
            {help.points.map((p, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
          {help.firstAction && (
            <p className="mt-2 flex items-center gap-1.5 font-medium text-foreground">
              <ArrowRight className="h-3.5 w-3.5 text-[#A07D34]" /> {help.firstAction}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
