'use client';
import * as React from 'react';
import { toast } from 'sonner';
import { UploadCloud, Loader2, CheckCircle2, AlertTriangle, FileText, Building2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { previewTallyImport, commitTallyImport, type ImportPreview } from '@/server/actions/tally-import';

const MAX_MB = 30;

export function TallyImportView({ companies }: { companies: { id: string; name: string; ledgers: number; vouchers: number }[] }) {
  const [file, setFile] = React.useState<File | null>(null);
  const [companyName, setCompanyName] = React.useState('');
  const [busy, setBusy] = React.useState<null | 'preview' | 'commit'>(null);
  const [preview, setPreview] = React.useState<ImportPreview | null>(null);
  const [done, setDone] = React.useState<{ created: number; skipped: number; ledgers: number; stockItems: number; costCentres: number } | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  function pick(f: File | undefined) {
    if (!f) return;
    if (f.size > MAX_MB * 1024 * 1024) { toast.error(`That file is larger than ${MAX_MB} MB. Export a shorter date range from Tally.`); return; }
    setFile(f); setPreview(null); setDone(null);
  }

  async function runPreview() {
    if (!file) { toast.error('Choose a Tally export file first.'); return; }
    setBusy('preview'); setDone(null);
    try {
      const content = await file.text();
      const r = await previewTallyImport({ fileName: file.name, content, companyName });
      if ('error' in r) { toast.error(r.error); return; }
      setPreview(r);
      toast.success('File read. Review the summary, then import.');
    } catch {
      toast.error('Could not read that file.');
    } finally { setBusy(null); }
  }

  async function runCommit() {
    if (!preview) return;
    setBusy('commit');
    const r = await commitTallyImport(preview.batchId);
    setBusy(null);
    if ('error' in r) { toast.error(r.error); return; }
    setDone(r); setPreview(null); setFile(null);
    toast.success(`Imported ${r.created} vouchers into ${preview.company}.`);
  }

  return (
    <div className="space-y-6">
      {/* Existing books */}
      {companies.length > 0 && (
        <div className="rounded-lg border p-4">
          <div className="mb-2 text-sm font-semibold">Companies already in Ameya Tally</div>
          <div className="flex flex-wrap gap-2">
            {companies.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{c.name}</span>
                <span className="text-muted-foreground">· {c.ledgers} ledgers · {c.vouchers} vouchers</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Step 1 — file */}
      <div className="space-y-4 rounded-lg border p-4">
        <div className="text-sm font-semibold">1 · Choose your Tally export</div>
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files?.[0]); }}
          className="focus-ring flex min-h-[7rem] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed p-4 text-center text-sm text-muted-foreground hover:border-muted-foreground/40 hover:bg-muted/30"
        >
          {file ? (
            <>
              <FileText className="h-5 w-5 text-emerald-500" />
              <span className="font-medium text-foreground">{file.name}</span>
              <span className="text-xs">{(file.size / 1024 / 1024).toFixed(2)} MB · click to choose another</span>
            </>
          ) : (
            <>
              <UploadCloud className="h-5 w-5" />
              <span className="font-medium text-foreground">Drop your Tally .xml (or .csv) here</span>
              <span className="text-xs">Gateway of Tally → Export → Masters / Day Book → Format: XML</span>
            </>
          )}
          <input ref={inputRef} type="file" accept=".xml,.csv,text/xml,application/xml,text/csv" className="hidden"
            onChange={(e) => { pick(e.target.files?.[0]); e.currentTarget.value = ''; }} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Company name (optional)</Label>
            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Leave blank to use the name inside the file" />
            <p className="mt-1 text-xs text-muted-foreground">Each Tally company becomes its own set of books here, so names never clash.</p>
          </div>
          <div className="flex items-end">
            <Button onClick={runPreview} disabled={!file || busy !== null} className="gap-2">
              {busy === 'preview' ? <><Loader2 className="h-4 w-4 animate-spin" /> Reading…</> : <>Preview import <ArrowRight className="h-4 w-4" /></>}
            </Button>
          </div>
        </div>
      </div>

      {/* Step 2 — preview */}
      {preview && (
        <div className="space-y-4 rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold">2 · Review — nothing has been written yet</div>
            <Badge variant={preview.companyExisted ? 'secondary' : 'success'}>
              {preview.companyExisted ? `Adding to “${preview.company}”` : `New company “${preview.company}”`}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Vouchers to import" value={preview.vouchersNew} tone="good" />
            <Stat label="New ledgers" value={preview.ledgersNew} />
            <Stat label="Already present" value={preview.vouchersDuplicate} hint="skipped — no double posting" />
            <Stat label="Unbalanced" value={preview.vouchersUnbalanced} tone={preview.vouchersUnbalanced ? 'warn' : undefined} hint="not imported" />
            <Stat label="Stock items" value={preview.stockItems} />
            <Stat label="Inventory lines" value={preview.inventoryLines} />
            <Stat label="Cost centres" value={preview.costCentres} />
            <Stat label="Ledger entries" value={preview.lines} />
          </div>

          {(preview.from || preview.to) && (
            <p className="text-xs text-muted-foreground">
              Period: <b>{preview.from?.slice(0, 10) ?? '—'}</b> to <b>{preview.to?.slice(0, 10) ?? '—'}</b> · {preview.lines} ledger entries
            </p>
          )}

          {preview.warnings.length > 0 && (
            <div className="space-y-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
              {preview.warnings.map((w, i) => (
                <p key={i} className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{w}
                </p>
              ))}
            </div>
          )}

          {preview.sample.length > 0 && (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-xs">
                <thead className="bg-muted/40"><tr>
                  <th className="px-2 py-1.5 text-left font-medium">Date</th>
                  <th className="px-2 py-1.5 text-left font-medium">Type</th>
                  <th className="px-2 py-1.5 text-left font-medium">No.</th>
                  <th className="px-2 py-1.5 text-right font-medium">Entries</th>
                  <th className="px-2 py-1.5 text-right font-medium">Amount</th>
                </tr></thead>
                <tbody>
                  {preview.sample.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-2 py-1.5">{r.date}</td>
                      <td className="px-2 py-1.5">{r.type}</td>
                      <td className="px-2 py-1.5">{r.number ?? '—'}</td>
                      <td className="px-2 py-1.5 text-right">{r.lines}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">₹{r.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t bg-muted/20 px-2 py-1 text-[11px] text-muted-foreground">First few vouchers — check these look right before importing.</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={runCommit} disabled={busy !== null || preview.vouchersNew + preview.ledgersNew === 0} className="gap-2">
              {busy === 'commit' ? <><Loader2 className="h-4 w-4 animate-spin" /> Importing…</> : <><CheckCircle2 className="h-4 w-4" /> Import into Ameya Tally</>}
            </Button>
            <Button variant="ghost" onClick={() => setPreview(null)} disabled={busy !== null}>Cancel</Button>
          </div>
        </div>
      )}

      {done && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" /> Imported {done.created} vouchers, {done.ledgers} ledgers, {done.stockItems} stock items and {done.costCentres} cost centres.
            {done.skipped > 0 && <span className="font-normal"> {done.skipped} skipped (already present or unbalanced).</span>}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Open Ameya Tally to see the Day Book, Trial Balance and P&amp;L built from this data.</p>
        </div>
      )}

      <div className="rounded-lg border bg-muted/20 p-4 text-xs text-muted-foreground">
        <p className="mb-1 font-medium text-foreground">How to export from Tally</p>
        <p><b>Masters (chart of accounts):</b> Gateway of Tally → Export → <i>All Masters</i> → Format: <b>XML</b>.</p>
        <p><b>Transactions:</b> Gateway of Tally → Display → <i>Day Book</i> → Export (Alt+E) → set the period → Format: <b>XML</b>.</p>
        <p className="mt-1">Import Masters first, then the Day Book, so every voucher lands under the right account group. Repeat per company and per financial year — re-importing the same period is safe, duplicates are skipped automatically.</p>
      </div>
    </div>
  );
}

function Stat({ label, value, tone, hint }: { label: string; value: number; tone?: 'good' | 'warn'; hint?: string }) {
  const color = tone === 'good' ? 'text-emerald-600' : tone === 'warn' ? 'text-amber-600' : 'text-foreground';
  return (
    <div className="rounded-md border bg-card p-3">
      <div className={`text-xl font-semibold tabular-nums ${color}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
