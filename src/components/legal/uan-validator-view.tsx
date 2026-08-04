'use client';
import * as React from 'react';
import { toast } from 'sonner';
import { BadgeCheck, ShieldX, Users, ClipboardPaste } from 'lucide-react';
import { StatCard } from '@/components/layout/stat-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RecordList } from '@/components/shared/record-row';
import { ImportDropzone } from '@/components/import/import-dropzone';
import { readSpreadsheetAsCsv } from '@/lib/import/read-spreadsheet';
import { bulkImportUans, addUan } from '@/server/actions/uan';

interface Row { id: string; workerName: string; uan: string; status: string; vendor: string | null }
const TONE: Record<string, 'success' | 'destructive' | 'warning'> = { VALID: 'success', INVALID: 'destructive', PENDING: 'warning' };

export function UanValidatorView({ counts, rows, vendors }: { counts: { valid: number; invalid: number; total: number }; rows: Row[]; vendors: { id: string; name: string }[] }) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [text, setText] = React.useState('');
  const [vendorId, setVendorId] = React.useState('');

  function run() {
    if (!text.trim()) { toast.error('Paste some UANs first.'); return; }
    submit(text);
  }
  function submit(block: string) {
    setBusy(true);
    bulkImportUans(block, vendorId || null).then((r) => {
      setBusy(false);
      if ('error' in r) { toast.error(r.error); return; }
      toast.success(`Validated ${r.imported} — ${r.invalid} invalid`);
      setOpen(false); location.reload();
    })
      .catch(() => {
        // A rejected server action never reaches .then, so the flag the
        // success path clears was never cleared: the button stayed disabled
        // with a spinner until someone reloaded the page.
        setBusy(false);
        toast.error('Could not reach the server. Nothing was saved — check your connection and try again.');
      });
  }
  async function onFile(file: File) {
    setBusy(true);
    try {
      const csv = await readSpreadsheetAsCsv(file);
      submit(csv);
    } catch { setBusy(false); toast.error('Could not read that file.'); }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label="Valid" value={counts.valid} icon={BadgeCheck} tone="success" />
        <StatCard label="Invalid — blocked" value={counts.invalid} icon={ShieldX} tone={counts.invalid ? 'destructive' : 'default'} />
        <StatCard label="Total workers" value={counts.total} icon={Users} />
      </div>
      {/* One worker at a time.
          `addUan` existed and nothing called it: the only way in was a bulk paste,
          so a single labourer turning up at the gate meant typing a one-line
          "roster" into a bulk-import box to get him checked. */}
      <form
        className="flex flex-wrap items-end gap-2 rounded-lg border bg-muted/30 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const name = String(fd.get('workerName') ?? '').trim();
          const uan = String(fd.get('uan') ?? '').trim();
          if (!name || !uan) { toast.error('Both the name and the UAN are needed.'); return; }
          setBusy(true);
          addUan(name, uan, vendorId || null).then((r) => {
            setBusy(false);
            if ('error' in r) { toast.error(r.error); return; }
            toast.success(`${name} checked`);
            location.reload();
          })
            .catch(() => {
              // A rejected server action never reaches .then, so the flag the
              // success path clears was never cleared: the button stayed disabled
              // with a spinner until someone reloaded the page.
              setBusy(false);
              toast.error('Could not reach the server. Nothing was saved — check your connection and try again.');
            });
        }}
      >
        <div className="min-w-0 flex-1 space-y-1 sm:flex-none">
          <Label htmlFor="uworker">Worker</Label>
          <input id="uworker" name="workerName" className="h-9 w-full max-w-full sm:w-48 rounded-md border bg-background px-2 text-sm" placeholder="Ramesh Kumar" />
        </div>
        <div className="min-w-0 flex-1 space-y-1 sm:flex-none">
          <Label htmlFor="uuan">UAN</Label>
          <input id="uuan" name="uan" inputMode="numeric" maxLength={14} className="h-9 w-full max-w-full sm:w-44 rounded-md border bg-background px-2 font-mono text-sm" placeholder="123456789012" />
        </div>
        <div className="min-w-0 flex-1 space-y-1 sm:flex-none">
          <Label htmlFor="uvendor">Sub-contractor</Label>
          <select id="uvendor" className="h-9 w-full max-w-full sm:w-52 rounded-md border bg-background px-2 text-sm" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
            <option value="">—</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <Button type="submit" variant="outline" disabled={busy}>{busy ? 'Checking…' : 'Check this one'}</Button>
      </form>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Paste one worker per line as “Name, 123456789012”. Format-checking is instant; a live EPFO check can be layered on later.</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-1"><ClipboardPaste className="h-4 w-4" /> Bulk validate</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Bulk-validate UANs</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Sub-contractor (optional)</Label>
                <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={vendorId} onChange={(e) => setVendorId(e.target.value)}><option value="">—</option>{vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select>
              </div>
              <ImportDropzone onFile={onFile} disabled={busy} title="Drop a UAN CSV / Excel file" hint="columns: Name, UAN — or one UAN per line" />
              <div>
                <Label>…or paste the roster</Label>
                <Textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Ramesh, 123456789012\nSuresh, 100200300400'} />
              </div>
            </div>
            <div className="mt-2 flex justify-end"><Button onClick={run} disabled={busy}>{busy ? 'Validating…' : 'Validate pasted roster'}</Button></div>
          </DialogContent>
        </Dialog>
      </div>
      <RecordList empty="No UANs validated yet. Paste a contractor's roster to check them at the gate.">
        {rows.map((u) => (
          <div key={u.id} className="flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{u.workerName}</div>
              <div className="truncate text-xs text-muted-foreground"><span className="font-mono">{u.uan}</span>{u.vendor ? ` · ${u.vendor}` : ''}</div>
            </div>
            <Badge variant={TONE[u.status] ?? 'warning'} className="shrink-0">{u.status}</Badge>
          </div>
        ))}
      </RecordList>
    </div>
  );
}
