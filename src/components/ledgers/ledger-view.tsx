'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, X, ArrowLeft, GitMerge, Landmark, FileSpreadsheet, Search, Plus, Paperclip, Upload } from 'lucide-react';
import { upload } from '@vercel/blob/client';
import { importVendorPayments, mergeVendors, saveVendorBank, addVendorPayment, attachPaymentProof } from '@/server/actions/vendor-ledger';
import { readSpreadsheetAsCsv } from '@/lib/import/read-spreadsheet';
import { ImportDropzone } from '@/components/import/import-dropzone';
import type { LedgerRow, LedgerDetail } from '@/server/services/vendor-ledger-service';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FormGrid } from '@/components/ui/field';
import { StatTile, StatTileRow } from '@/components/ui/stat-tile';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { formatCurrency, formatCompactCurrency, formatDate } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

const TEMPLATE = 'Payee,Amount,Date,Mode,Reference,UTR,Note\nArun,50000,01/07/2026,Bank,NEFT001,UTR12345,Slab work\nOctos Infra,25000,05/07/2026,UPI,,,Steel supply\n';

export function LedgerView({ ledgers, activeId, detail, canManage }: { ledgers: LedgerRow[]; activeId: string | null; detail: LedgerDetail | null; canManage: boolean }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [importOpen, setImportOpen] = React.useState(false);
  const [text, setText] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [mergeInto, setMergeInto] = React.useState('');

  const total = ledgers.reduce((s, l) => s + l.totalPaid, 0);

  const runImport = (csv: string) => {
    if (!csv.trim()) { toast.error('Paste or choose a CSV first.'); return; }
    start(async () => {
      const r = await importVendorPayments(csv);
      if ('error' in r) { toast.error(r.error); return; }
      const parts = [`Imported ${r.created ?? 0} payment${r.created === 1 ? '' : 's'}`];
      if (r.vendorsCreated) parts.push(`${r.vendorsCreated} new payee${r.vendorsCreated === 1 ? '' : 's'}`);
      if (r.skipped) parts.push(`${r.skipped} skipped`);
      if (r.failed) parts.push(`${r.failed} failed`);
      toast.success(parts.join(' · '));
      // Show the first few row-level problems so bad rows aren't silently dropped.
      if (r.issues && r.issues.length > 0) {
        toast(`Some rows need a look:\n${r.issues.slice(0, 4).join('\n')}${r.issues.length > 4 ? `\n…and ${r.issues.length - 4} more` : ''}`, { duration: 10000 });
      }
      setImportOpen(false); setText(''); router.refresh();
    });
  };
  const onFile = (f: File) => {
    readSpreadsheetAsCsv(f)
      .then((text) => runImport(text))
      .catch(() => toast.error('Could not read that file. Try a .csv or .xlsx.'));
  };

  const merge = () => {
    if (!detail || !mergeInto) return;
    start(async () => {
      const r = await mergeVendors(detail.vendor.id, mergeInto);
      if ('error' in r) { toast.error(r.error); return; }
      toast.success('Ledgers merged'); setMergeInto(''); router.refresh();
    });
  };

  const saveBank = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!detail) return;
    const fd = new FormData(e.currentTarget);
    const v = Object.fromEntries([...fd.entries()].map(([k, val]) => [k, String(val)])) as Record<string, string>;
    start(async () => {
      const r = await saveVendorBank(detail.vendor.id, v);
      if ('error' in r) { toast.error(r.error); return; }
      toast.success('Saved'); router.refresh();
    });
  };

  // Detail view
  const [showAdd, setShowAdd] = React.useState(false);
  const proofInputRef = React.useRef<HTMLInputElement>(null);
  const [proofTarget, setProofTarget] = React.useState<string | null>(null);
  const [uploadingId, setUploadingId] = React.useState<string | null>(null);

  const submitPayment = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!detail) return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = (fd.get('proof') as File) || null;
    start(async () => {
      let proofUrl: string | undefined;
      if (file && file.size) {
        try {
          const blob = await upload(file.name, file, { access: 'public', handleUploadUrl: '/api/upload' });
          proofUrl = blob.url;
        } catch { toast.error('Could not upload the screenshot — saving the payment without it.'); }
      }
      const r = await addVendorPayment({
        vendorId: detail.vendor.id,
        amount: String(fd.get('amount') ?? ''),
        date: String(fd.get('date') ?? ''),
        mode: String(fd.get('mode') ?? ''),
        reference: String(fd.get('reference') ?? ''),
        utr: String(fd.get('utr') ?? ''),
        note: String(fd.get('note') ?? ''),
        proofUrl,
      });
      if ('error' in r) { toast.error(r.error); return; }
      toast.success('Payment added'); form.reset(); setShowAdd(false); router.refresh();
    });
  };

  const pickProof = (voucherId: string) => { setProofTarget(voucherId); proofInputRef.current?.click(); };
  const onProofChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; const vid = proofTarget; e.target.value = '';
    if (!file || !vid) return;
    setUploadingId(vid);
    try {
      const blob = await upload(file.name, file, { access: 'public', handleUploadUrl: '/api/upload' });
      const r = await attachPaymentProof(vid, blob.url);
      if ('error' in r) toast.error(r.error); else { toast.success('Proof attached'); router.refresh(); }
    } catch { toast.error('Upload failed — try again.'); }
    setUploadingId(null); setProofTarget(null);
  };

  if (detail) {
    const d = detail;
    return (
      <div className="space-y-4">
        <button onClick={() => router.push('/ledgers')} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> All ledgers</button>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <StatTileRow cols={3}>
              <StatTile label="Total paid" value={formatCompactCurrency(d.totalPaid)} />
              <StatTile label="Payments" value={String(d.payments.length)} />
              <StatTile label="Bank on file" value={d.vendor.bankAccountNumber || d.vendor.upiId ? 'Yes' : 'No'} tone={d.vendor.bankAccountNumber || d.vendor.upiId ? 'good' : 'bad'} />
            </StatTileRow>
            <input ref={proofInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={onProofChosen} />
            <Card className="p-0">
              <div className="flex items-center justify-between border-b p-3">
                <span className="font-medium">{d.vendor.name} — payments</span>
                {canManage && (
                  <Button size="sm" variant={showAdd ? 'ghost' : 'outline'} onClick={() => setShowAdd((v) => !v)}>
                    {showAdd ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {showAdd ? 'Close' : 'Add a payment'}
                  </Button>
                )}
              </div>
              {showAdd && canManage && (
                <form onSubmit={submitPayment} className="grid gap-2 border-b bg-muted/20 p-3 sm:grid-cols-2">
                  <Field label="Amount (₹) *"><Input name="amount" type="number" step="1" required placeholder="100000" /></Field>
                  <Field label="Date paid"><Input name="date" type="date" /></Field>
                  <Field label="Mode">
                    <select name="mode" defaultValue="Bank" className="focus-ring w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm">
                      <option>Bank</option><option>UPI</option><option>Cash</option><option>Cheque</option>
                    </select>
                  </Field>
                  <Field label="UTR / reference"><Input name="utr" placeholder="UTR or cheque no." /></Field>
                  <div className="sm:col-span-2"><Field label="What was it for? (note)"><Input name="note" placeholder="e.g. Construction advance" /></Field></div>
                  <div className="sm:col-span-2">
                    <Field label="Payment proof (screenshot / bank PDF)"><Input name="proof" type="file" accept="image/*,.pdf" className="py-1" /></Field>
                  </div>
                  <input type="hidden" name="reference" value="" />
                  <div className="sm:col-span-2"><Button type="submit" size="sm" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />} Save payment</Button></div>
                </form>
              )}
              <div className="max-h-[26rem] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground"><tr className="text-left"><th className="p-2">Voucher</th><th className="p-2">Date</th><th className="p-2 text-right">Amount</th><th className="p-2">Mode</th><th className="p-2">UTR / Ref</th><th className="p-2">Note</th><th className="p-2">Proof</th></tr></thead>
                  <tbody>
                    {d.payments.length === 0 ? <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No payments yet.</td></tr> : d.payments.map((p) => (
                      <tr key={p.id} className="border-t align-top">
                        <td className="p-2 font-medium">{p.number}</td>
                        <td className="p-2 whitespace-nowrap">{formatDate(p.paidOn ?? p.date)}</td>
                        <td className="p-2 text-right tabular-nums">{formatCurrency(p.amount)}</td>
                        <td className="p-2">{p.mode.replace(/_/g, ' ').toLowerCase()}</td>
                        <td className="p-2 font-mono text-xs">{p.utr ?? p.reference ?? '—'}</td>
                        <td className="p-2 text-xs text-muted-foreground">{p.narration ?? '—'}</td>
                        <td className="p-2">
                          {p.proofUrl ? (
                            <a href={p.proofUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><Paperclip className="h-3.5 w-3.5" /> View</a>
                          ) : canManage ? (
                            <button onClick={() => pickProof(p.id)} disabled={uploadingId === p.id} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-60">
                              {uploadingId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Add
                            </button>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
          <div className="space-y-4">
            <Card className="p-4">
              <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold"><Landmark className="h-4 w-4 text-[#A07D34]" /> Bank details</p>
              <form onSubmit={saveBank} className="space-y-2">
                <Field label="Account name"><Input name="bankAccountName" defaultValue={d.vendor.bankAccountName ?? ''} /></Field>
                <Field label="Account number"><Input name="bankAccountNumber" defaultValue={d.vendor.bankAccountNumber ?? ''} /></Field>
                <Field label="IFSC"><Input name="bankIfsc" defaultValue={d.vendor.bankIfsc ?? ''} /></Field>
                <Field label="Bank"><Input name="bankName" defaultValue={d.vendor.bankName ?? ''} /></Field>
                <Field label="UPI ID"><Input name="upiId" defaultValue={d.vendor.upiId ?? ''} /></Field>
                <Field label="GSTIN"><Input name="gstin" defaultValue={d.vendor.gstin ?? ''} /></Field>
                {canManage && <Button type="submit" size="sm" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />} Save</Button>}
              </form>
            </Card>
            {canManage && (
              <Card className="p-4">
                <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><GitMerge className="h-4 w-4 text-[#A07D34]" /> Same person?</p>
                <p className="mb-2 text-xs text-muted-foreground">If another payee is really <span className="font-medium">{d.vendor.name}</span>, merge them — their payments move here and the other name is removed.</p>
                <select value={mergeInto} onChange={(e) => setMergeInto(e.target.value)} className="focus-ring mb-2 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm">
                  <option value="">Choose a payee to merge in…</option>
                  {ledgers.filter((l) => l.id !== d.vendor.id).map((l) => <option key={l.id} value={l.id}>{l.name} ({formatCompactCurrency(l.totalPaid)})</option>)}
                </select>
                <Button size="sm" variant="outline" onClick={merge} disabled={pending || !mergeInto}>Merge into {d.vendor.name}</Button>
              </Card>
            )}
          </div>
        </div>
      </div>
    );
  }

  // List view
  const shown = query.trim() ? ledgers.filter((l) => l.name.toLowerCase().includes(query.toLowerCase())) : ledgers;
  return (
    <div className="space-y-4">
      <StatTileRow cols={3}>
        <StatTile label="Payees" value={String(ledgers.length)} />
        <StatTile label="Total paid out" value={formatCompactCurrency(total)} />
        <StatTile label="Missing bank details" value={String(ledgers.filter((l) => !l.hasBank).length)} tone={ledgers.some((l) => !l.hasBank) ? 'bad' : 'good'} />
      </StatTileRow>

      {canManage && (
        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-semibold"><FileSpreadsheet className="h-4 w-4 text-[#A07D34]" /> Import payments</p>
              <p className="text-xs text-muted-foreground">Export your Google Sheet / Excel as CSV, then upload or paste it. A ledger is built per payee automatically.</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setImportOpen((v) => !v)}>{importOpen ? 'Close' : 'Or paste'}</Button>
              <Button size="sm" variant="ghost" onClick={() => { const a = document.createElement('a'); a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`; a.download = 'payments-template.csv'; a.click(); }}>Template</Button>
            </div>
          </div>
          <ImportDropzone onFile={onFile} disabled={pending} className="mt-3" hint="or click to browse — a ledger is built for each payee automatically" />
          {importOpen && (
            <div className="mt-3">
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder="Paste rows with a header like: Payee, Amount, Date, Mode, Reference, UTR, Note" className="focus-ring w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              <Button size="sm" className="mt-2" onClick={() => runImport(text)} disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />} Import</Button>
            </div>
          )}
        </Card>
      )}

      {ledgers.length === 0 ? (
        <EmptyState icon={FileSpreadsheet} title="No payees yet" body="Import your payments (as a CSV) to build a ledger for each person you pay." />
      ) : (
        <>
          <div className="relative max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search payees" className="pl-9" />
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground"><tr className="text-left"><th className="p-2">Payee</th><th className="p-2 text-right">Total paid</th><th className="p-2 text-right">Payments</th><th className="p-2">Bank</th></tr></thead>
              <tbody>
                {shown.map((l) => (
                  <tr key={l.id} className="cursor-pointer border-t hover:bg-secondary/50" onClick={() => router.push(`/ledgers?v=${l.id}`)}>
                    <td className="p-2 font-medium">{l.name}</td>
                    <td className="p-2 text-right tabular-nums">{formatCurrency(l.totalPaid)}</td>
                    <td className="p-2 text-right tabular-nums">{l.count}</td>
                    <td className="p-2">{l.hasBank ? <Badge variant="success">On file</Badge> : <Badge variant="warning">Missing</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
