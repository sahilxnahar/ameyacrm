'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Download, Check, Trash2, Zap, Mail, Filter, ListPlus, Wallet, Search } from 'lucide-react';
import { installExtra, uninstallExtra } from '@/server/actions/marketplace';
import type { Extra, ExtraKind } from '@/config/marketplace';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';

const KIND: Record<ExtraKind, { icon: React.ElementType; label: string }> = {
  automation: { icon: Zap, label: 'Automation' },
  template: { icon: Mail, label: 'Email template' },
  view: { icon: Filter, label: 'Saved view' },
  fields: { icon: ListPlus, label: 'Custom fields' },
  incentive: { icon: Wallet, label: 'Commission slabs' },
};

export function MarketplaceView({
  extras, categories, installed,
}: {
  extras: Extra[];
  categories: string[];
  installed: string[];
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [cat, setCat] = React.useState<string>('all');
  const [q, setQ] = React.useState('');

  const has = new Set(installed);
  const shown = extras.filter((e) =>
    (cat === 'all' || e.category === cat) &&
    (!q || `${e.name} ${e.what} ${e.category}`.toLowerCase().includes(q.toLowerCase())));

  const act = (id: string, install: boolean) => {
    setBusy(id);
    start(async () => {
      const r = install ? await installExtra(id) : await uninstallExtra(id);
      setBusy(null);
      if ('error' in r) return toast.error(r.error);
      toast.success(r.message ?? (install ? 'Installed' : 'Removed'), { duration: 6000 });
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-2 p-3">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <Input className="h-8 min-w-40 flex-1" placeholder="Search the extras…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Badge variant="secondary">{installed.length} of {extras.length} installed</Badge>
      </Card>

      <div className="chip-row">
        <button onClick={() => setCat('all')}
          className={cn('rounded-full border px-3 py-1 text-xs', cat === 'all' && 'border-primary bg-primary text-primary-foreground')}>
          Everything
        </button>
        {categories.map((c) => (
          <button key={c} onClick={() => setCat(c)}
            className={cn('rounded-full border px-3 py-1 text-xs', cat === c && 'border-primary bg-primary text-primary-foreground')}>
            {c}
          </button>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {shown.map((e) => {
          const K = KIND[e.kind];
          const Icon = K.icon;
          const on = has.has(e.id);
          return (
            <Card key={e.id} className={cn('lift flex flex-col p-4', on && 'border-success/40 bg-success/[0.03]')}>
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{e.name}</p>
                {on && <Badge variant="success" className="shrink-0 gap-1"><Check className="h-3 w-3" /> Installed</Badge>}
              </div>
              <p className="mt-1 flex-1 text-sm text-muted-foreground">{e.what}</p>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon className="h-3.5 w-3.5" /> {K.label} · {e.creates}
              </p>
              <div className="mt-3">
                {on ? (
                  <Button size="sm" variant="outline" className="text-destructive" disabled={pending}
                    title="Take this back out" onClick={() => act(e.id, false)}>
                    {busy === e.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Remove
                  </Button>
                ) : (
                  <Button size="sm" disabled={pending} onClick={() => act(e.id, true)}>
                    {busy === e.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Install
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {shown.length === 0 && (
        <Card className="p-10 text-center text-sm text-muted-foreground">Nothing matches that search.</Card>
      )}

      <Card className="p-4 text-sm">
        <p className="font-medium">How this works</p>
        <p className="mt-1 text-muted-foreground">
          Each extra is built from things the CRM already does — a rule, a template, a saved list, a set of fields.
          Installing writes them into your system, where you can edit them like anything else.
          <strong className="text-foreground"> Automations arrive switched off</strong> so you can read them before they touch a real lead.
          Removing a field set hides it from forms but keeps whatever was already recorded.
        </p>
      </Card>
    </div>
  );
}
