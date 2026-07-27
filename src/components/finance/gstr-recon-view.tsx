'use client';
import * as React from 'react';
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
import { importGstr2b, runGstrReconcile } from '@/server/actions/gstr';

interface Row { id: string; supplierGstin: string; invoiceNo: string; period: string; taxableValue: number; tax: number; status: string; invoiceDate: string | null }
const TONE: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = {
  MATCHED: 'success', UNMATCHED: 'secondary', MISMATCH_AMOUNT: 'destructive', MISSING_IN_2B: 'destructive', MISSING_IN_BOOKS: 'warning',
};
function thisMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }

export function GstrReconView({ summary, rows }: { summary: { matched: number; unmatched: number; mismatch: number; missing: number }; rows: Row[] }) {
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
      location.reload();
    } catch { toast.error('Could not read that file.'); } finally { setBusy(false); }
  }
  function reconcile() {
    setBusy(true);
    runGstrReconcile().then((r) => {
      setBusy(false);
      if ('error' in r) { toast.error(r.error); return; }
      toast.success(`Matched ${r.result.matched}, ${r.result.mismatched} mismatch, ${r.result.missing} missing`);
      location.reload();
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
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

      <ImportDropzone onFile={onFile} disabled={busy} title="Drop the GSTR-2B export (CSV / Excel)" hint="or click to browse — we match each invoice against your vendor bills automatically" />

      <RecordList empty="No GSTR-2B lines yet. Upload the export for a period to reconcile.">
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
