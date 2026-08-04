'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CheckCircle2, AlertTriangle, HelpCircle, RefreshCw, FileSpreadsheet } from 'lucide-react';
import { StatCard } from '@/components/layout/stat-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RecordList } from '@/components/shared/record-row';
import { ImportDropzone } from '@/components/import/import-dropzone';
import { readSpreadsheetAsCsv } from '@/lib/import/read-spreadsheet';
import { formatCurrency } from '@/lib/utils/format';
import { importGstr2b, runGstrReconcile, addGstr2bLine } from '@/server/actions/gstr';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface Row { id: string; supplierGstin: string; invoiceNo: string; period: string; taxableValue: number; tax: number; status: string; invoiceDate: string | null }
const TONE: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = {
  MATCHED: 'success', UNMATCHED: 'secondary', MISMATCH_AMOUNT: 'destructive', MISSING_IN_2B: 'destructive', MISSING_IN_BOOKS: 'warning',
};
function thisMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }

export function GstrReconView({ summary, rows }: { summary: { matched: number; unmatched: number; mismatch: number; missing: number }; rows: Row[] }) {
  // AMH-029 — router.refresh() re-runs the server components and swaps the
  // new HTML in. router.refresh() threw the whole document away: scroll
  // position, open filters, a half-typed field in another panel, and a
  // second of white screen. The server action already calls revalidatePath,
  // so the data is fresh either way.
  const router = useRouter();
  const [period, setPeriod] = React.useState(thisMonth());
  const [busy, setBusy] = React.useState(false);

  async function onFile(file: File) {
    if (!/^\d{4}-\d{2}$/.test(period)) { toast.error('Set the period as YYYY-MM first.'); return; }
    setBusy(true);
    try {
      const csv = await readSpreadsheetAsCsv(file);
      const r = await importGstr2b(csv, period);
      if ('error' in r) { toast.error(r.error); return; }
      toast.success(`Imported ${r.imported} lines & reconciled`);
      router.refresh();
    } catch { toast.error('Could not read that file.'); } finally { setBusy(false); }
  }
  function reconcile() {
    setBusy(true);
    runGstrReconcile().then((r) => {
      setBusy(false);
      if ('error' in r) { toast.error(r.error); return; }
      toast.success(`Matched ${r.result.matched}, ${r.result.mismatched} mismatch, ${r.result.missing} missing`);
      router.refresh();
    })
      .catch(() => {
        // A rejected server action never reaches .then, so the flag the
        // success path clears was never cleared: the button stayed disabled
        // with a spinner until someone reloaded the page.
        setBusy(false);
        toast.error('Could not reach the server. Nothing was saved — check your connection and try again.');
      });
  }

  return (
    <div className="space-y-6">
      <div className="stat-grid">
        <StatCard label="Matched" value={summary.matched} icon={CheckCircle2} tone="success" />
        <StatCard label="Amount mismatch" value={summary.mismatch} icon={AlertTriangle} tone={summary.mismatch ? 'destructive' : 'default'} />
        <StatCard label="Missing" value={summary.missing} icon={HelpCircle} tone={summary.missing ? 'warning' : 'default'} />
        <StatCard label="Unmatched" value={summary.unmatched} icon={FileSpreadsheet} tone={summary.unmatched ? 'warning' : 'default'} />
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <Label>Period (the GSTR-2B month)</Label>
          <div className="flex gap-2">
            <Input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="YYYY-MM" className="max-w-[10rem]" />
            <Button variant="outline" onClick={reconcile} disabled={busy} className="gap-1"><RefreshCw className="h-4 w-4" /> Re-reconcile</Button>
          </div>
        </div>
      </div>

      {/*
        Upload is right for a monthly 2B with four hundred rows; it is wrong for
        the case that actually comes up between filings, which is two invoices
        somebody wants to check today. Making a person build a CSV to reconcile
        two lines is how a reconciliation screen stops being used at all.
      */}
      <ManualOrUpload period={period} busy={busy} onFile={onFile} />

      <RecordList empty="Nothing to reconcile for this period yet. Upload the GSTR-2B export, or add a line by hand to check a single invoice against your books.">
        {rows.map((l) => (
          <div key={l.id} className="flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium"><span className="font-mono">{l.invoiceNo}</span> <span className="text-xs text-muted-foreground">{l.supplierGstin}</span></div>
              <div className="truncate text-xs text-muted-foreground">{l.period} · taxable {formatCurrency(l.taxableValue)} · tax {formatCurrency(l.tax)}</div>
            </div>
            <Badge variant={TONE[l.status] ?? 'secondary'} className="shrink-0">{l.status.replace(/_/g, ' ')}</Badge>
          </div>
        ))}
      </RecordList>
    </div>
  );
}

/** Two ways to get a line in: the portal's export, or typed. */
function ManualOrUpload({ period, busy, onFile }: { period: string; busy: boolean; onFile: (f: File) => void }) {
  const [mode, setMode] = React.useState<'upload' | 'manual'>('upload');
  return (
    <div>
      <div className="mb-3 inline-flex rounded-lg border p-0.5">
        {([['upload', 'Upload the 2B export'], ['manual', 'Add a line by hand']] as const).map(([m, label]) => (
          <button
            key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m}
            className={cn('focus-ring rounded-md px-3 py-1.5 text-sm font-medium transition',
              mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary')}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === 'upload'
        ? <ImportDropzone onFile={onFile} disabled={busy} title="Drop the GSTR-2B export (CSV / Excel)" hint="or click to browse — we match each invoice against your vendor bills automatically" />
        : <ManualGstrLine period={period} />}
    </div>
  );
}

/**
 * One line, typed.
 *
 * Written through the same upsert and the same unique key as the import, so
 * when the real 2B is uploaded later it overwrites anything typed here. The
 * portal's figures always win over a hand-keyed line, which is the only correct
 * precedence for a government return.
 */
function ManualGstrLine({ period }: { period: string }) {
  // AMH-029 — router.refresh() re-runs the server components and swaps the
  // new HTML in. router.refresh() threw the whole document away: scroll
  // position, open filters, a half-typed field in another panel, and a
  // second of white screen. The server action already calls revalidatePath,
  // so the data is fresh either way.
  const router = useRouter();
  const [gstin, setGstin] = React.useState('');
  const [invoiceNo, setInvoiceNo] = React.useState('');
  const [invoiceDate, setInvoiceDate] = React.useState('');
  const [taxable, setTaxable] = React.useState('');
  const [igst, setIgst] = React.useState('');
  const [cgst, setCgst] = React.useState('');
  const [sgst, setSgst] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded-lg border bg-muted/30 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        addGstr2bLine({
          period, supplierGstin: gstin, invoiceNo, invoiceDate: invoiceDate || null,
          taxableValue: Number(taxable), igst: Number(igst || 0), cgst: Number(cgst || 0), sgst: Number(sgst || 0),
        }).then((r) => {
          setBusy(false);
          if ('error' in r) { toast.error(r.error); return; }
          toast.success(`${r.invoiceNo} added and reconciled`);
          router.refresh();
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
      <div className="space-y-1">
        <Label htmlFor="gg">Supplier GSTIN</Label>
        <Input id="gg" required value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} placeholder="29ABCDE1234F1Z5" className="w-[11.5rem] font-mono" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="gi">Invoice no.</Label>
        <Input id="gi" required value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="INV-2291" className="w-32 font-mono" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="gd">Invoice date</Label>
        <Input id="gd" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="w-[9.5rem]" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="gt">Taxable (₹)</Label>
        <Input id="gt" required type="number" step="0.01" inputMode="decimal" value={taxable} onChange={(e) => setTaxable(e.target.value)} className="w-28 text-right tabular-nums" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="g1">IGST</Label>
        <Input id="g1" type="number" step="0.01" inputMode="decimal" value={igst} onChange={(e) => setIgst(e.target.value)} className="w-24 text-right tabular-nums" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="g2">CGST</Label>
        <Input id="g2" type="number" step="0.01" inputMode="decimal" value={cgst} onChange={(e) => setCgst(e.target.value)} className="w-24 text-right tabular-nums" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="g3">SGST</Label>
        <Input id="g3" type="number" step="0.01" inputMode="decimal" value={sgst} onChange={(e) => setSgst(e.target.value)} className="w-24 text-right tabular-nums" />
      </div>
      <Button type="submit" disabled={busy} className="gap-1"><Plus className="h-4 w-4" /> {busy ? 'Adding…' : 'Add & reconcile'}</Button>
      <p className="w-full text-xs text-muted-foreground">
        Goes into period <strong>{period}</strong>. Uploading the real GSTR-2B later overwrites this line — the portal&rsquo;s figures always win.
      </p>
    </form>
  );
}
