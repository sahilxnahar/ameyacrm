'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Package, Download, Upload, Trash2, Check, FileJson } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { packageSummary, type AppPackage } from '@/config/app-packages';
import { installAppPackage, uninstallAppPackage, exportAppPackage, importAppPackage } from '@/server/actions/app-packages';

const KIND_LABEL: Record<string, string> = { automation: 'automation', fields: 'field', view: 'view', template: 'template', connector: 'connector' };

function pluralise(n: number, w: string) { return `${n} ${w}${n === 1 ? '' : 's'}`; }

export function AppPackagesView({ packages, installed: initial }: { packages: AppPackage[]; installed: Array<{ packageId: string; source: string }> }) {
  // AMH-029 — router.refresh() re-runs the server components and swaps the
  // new HTML in. router.refresh() threw the whole document away: scroll
  // position, open filters, a half-typed field in another panel, and a
  // second of white screen. The server action already calls revalidatePath,
  // so the data is fresh either way.
  const router = useRouter();
  const [installed, setInstalled] = React.useState(new Set(initial.map((i) => i.packageId)));
  const [importOpen, setImportOpen] = React.useState(false);
  const [importText, setImportText] = React.useState('');
  const [, start] = React.useTransition();

  function act(msg: string, fn: () => Promise<{ ok: true; message?: string } | { error: string }>, after?: () => void) {
    start(async () => {
      const r = await fn();
      if ('error' in r) { toast.error(r.error); return; }
      toast.success(r.message || msg); after?.();
    });
  }

  const install = (p: AppPackage) => act('Installed', () => installAppPackage(p.id), () => setInstalled((s) => new Set(s).add(p.id)));
  const remove = (p: AppPackage) => act('Removed', () => uninstallAppPackage(p.id), () => setInstalled((s) => { const n = new Set(s); n.delete(p.id); return n; }));

  function download(name: string, json: string) {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${name}.package.json`; a.click(); URL.revokeObjectURL(url);
  }
  const doExport = (id: string, name: string) => start(async () => {
    const r = await exportAppPackage(id);
    if ('error' in r || !r.json) { toast.error('error' in r ? r.error : 'Nothing to export'); return; }
    download(name, r.json); toast.success('Exported');
  });
  const doImport = () => act('Imported', () => importAppPackage(importText), () => { setImportOpen(false); setImportText(''); router.refresh(); });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => doExport('__current__', 'my-crm-setup')} className="gap-1"><Download className="h-4 w-4" /> Export my setup</Button>
        <Button variant="outline" onClick={() => setImportOpen((v) => !v)} className="gap-1"><Upload className="h-4 w-4" /> Import a package</Button>
      </div>

      {importOpen && (
        <Card className="p-4">
          <div className="mb-1 flex items-center gap-2 text-sm font-medium"><FileJson className="h-4 w-4" /> Paste package JSON</div>
          <p className="mb-2 text-xs text-muted-foreground">Paste a package exported from Ameya (or authored by hand). Automations arrive switched off so you can review them before enabling.</p>
          <Textarea value={importText} onChange={(e) => setImportText(e.target.value)} rows={8} placeholder='{ "id": "...", "name": "...", "items": [ ... ] }' className="font-mono text-xs" />
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setImportOpen(false)}>Cancel</Button>
            <Button onClick={doImport} disabled={!importText.trim()} className="gap-1"><Upload className="h-4 w-4" /> Import &amp; install</Button>
          </div>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {packages.map((p) => {
          const isIn = installed.has(p.id);
          const summary = packageSummary(p);
          return (
            <Card key={p.id} className="flex flex-col p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Package className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><span className="font-medium">{p.name}</span>{isIn && <Badge className="gap-1"><Check className="h-3 w-3" /> Installed</Badge>}</div>
                  <div className="text-xs text-muted-foreground">{p.publisher} · {p.category}</div>
                </div>
              </div>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">{p.description}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {Object.entries(summary).map(([kind, n]) => (
                  <span key={kind} className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{pluralise(n, KIND_LABEL[kind] ?? kind)}</span>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2">
                {isIn
                  ? <Button size="sm" variant="outline" onClick={() => remove(p)} className="gap-1 text-destructive"><Trash2 className="h-3.5 w-3.5" /> Remove</Button>
                  : <Button size="sm" onClick={() => install(p)} className="gap-1"><Package className="h-3.5 w-3.5" /> Install</Button>}
                <Button size="sm" variant="ghost" onClick={() => doExport(p.id, p.id)} className="gap-1"><Download className="h-3.5 w-3.5" /> Export</Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
