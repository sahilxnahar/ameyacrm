'use client';

import { useState, useTransition } from 'react';
import { Sparkles, Check, Loader2, ChevronDown, Star } from 'lucide-react';
import { installStarterAutomations } from '@/server/actions/starter-automations';
import { STARTER_AUTOMATIONS, STARTER_DEPARTMENTS } from '@/config/starter-automations';

export function StarterAutomationsPanel({ existingNames }: { existingNames: string[] }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>(STARTER_AUTOMATIONS.filter((a) => a.startHere).map((a) => a.key));
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const already = new Set(existingNames);
  const toggle = (k: string) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  const install = () =>
    start(async () => {
      const res = await installStarterAutomations(picked);
      setMsg('error' in res ? res.error : res.message);
    });

  return (
    <div className="card-elevated mb-5 overflow-hidden">
      <button
        type="button" onClick={() => setOpen((v) => !v)}
        className="focus-ring flex w-full items-center gap-3 p-4 text-left hover:bg-muted/50"
      >
        <Sparkles className="h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">Start from a ready-made automation</p>
          <p className="text-sm text-muted-foreground">
            {STARTER_AUTOMATIONS.length} written for you across {STARTER_DEPARTMENTS.length} departments. Three are marked to start with.
          </p>
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="space-y-4 border-t p-4">
          <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
            Anything you add arrives <strong className="text-foreground">switched off</strong>. Open it, read what it does,
            then turn it on. That way nothing starts acting on real records by surprise.
          </p>

          {STARTER_DEPARTMENTS.map((dept) => (
            <div key={dept}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{dept}</p>
              <div className="mt-1 space-y-1.5">
                {STARTER_AUTOMATIONS.filter((a) => a.department === dept).map((a) => {
                  const have = already.has(a.name);
                  return (
                    <label
                      key={a.key}
                      className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${have ? 'opacity-50' : 'hover:bg-muted/50'}`}
                    >
                      <input
                        type="checkbox" disabled={have} checked={have || picked.includes(a.key)}
                        onChange={() => toggle(a.key)}
                        className="focus-ring mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                          {a.name}
                          {a.startHere && <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary"><Star className="h-2.5 w-2.5" />start here</span>}
                          {have && <span className="text-xs font-normal text-muted-foreground">— already added</span>}
                        </p>
                        <p className="mt-0.5 text-sm text-muted-foreground">{a.what}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground/80">{a.why}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}

          {msg && <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">{msg}</p>}

          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <button
              type="button" onClick={install} disabled={pending || picked.length === 0}
              className="focus-ring inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Add {picked.length} selected
            </button>
            <button type="button" onClick={() => setPicked(STARTER_AUTOMATIONS.map((a) => a.key))} className="focus-ring rounded-md border px-3 py-2 text-sm hover:bg-muted">Select all</button>
            <button type="button" onClick={() => setPicked([])} className="focus-ring rounded-md border px-3 py-2 text-sm hover:bg-muted">Clear</button>
          </div>
        </div>
      )}
    </div>
  );
}
