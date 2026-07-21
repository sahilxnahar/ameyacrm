'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Building2, Check, ChevronDown, Loader2 } from 'lucide-react';
import { setActiveProject } from '@/server/actions/active-project';
import { cn } from '@/lib/utils/cn';

export interface ProjectOption { id: string; name: string; code: string | null }

/**
 * The project this person is looking at.
 *
 * Sits in the header because it changes what almost every screen shows. Picking
 * one filters leads, units, bookings, collections and reports to it; "All
 * projects" puts everything back.
 */
export function ProjectSwitcher({ projects, activeId, activeName }: { projects: ProjectOption[]; activeId: string | null; activeName: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const away = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  const pick = (id: string) => {
    setOpen(false);
    start(async () => {
      const r = await setActiveProject(id);
      if ('error' in r) { toast.error(r.error); return; }
      toast.success(id ? `Showing ${projects.find((p) => p.id === id)?.name}` : 'Showing all projects');
      router.refresh();
    });
  };

  if (projects.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        title="Choose which project you are working on"
        className={cn(
          'flex h-9 max-w-[11rem] items-center gap-1.5 rounded-md border px-2.5 text-sm transition-colors sm:max-w-[14rem]',
          activeId ? 'border-primary/50 bg-primary/10 font-medium' : 'hover:bg-secondary',
        )}
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <Building2 className="h-3.5 w-3.5 shrink-0 text-brass" />}
        <span className="truncate">{activeName}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-1 w-64 overflow-hidden rounded-lg border bg-card shadow-lg">
          <p className="border-b px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Working on
          </p>
          <button
            onClick={() => pick('')}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-secondary"
          >
            <span className="w-4 shrink-0">{!activeId && <Check className="h-4 w-4 text-primary" />}</span>
            <span>All projects</span>
          </button>
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => pick(p.id)}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-secondary"
            >
              <span className="w-4 shrink-0">{activeId === p.id && <Check className="h-4 w-4 text-primary" />}</span>
              <span className="min-w-0">
                <span className="block truncate">{p.name}</span>
                {p.code && <span className="block text-[11px] text-muted-foreground">{p.code}</span>}
              </span>
            </button>
          ))}
          <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">
            Filters leads, inventory, bookings and collections. Anything not tied to a project stays visible.
          </p>
        </div>
      )}
    </div>
  );
}
