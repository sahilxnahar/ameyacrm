'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, X, ArrowLeft, GitMerge, Landmark, FileSpreadsheet, Search, Plus, Paperclip, Upload, Pencil, ListChecks, Download, BadgeCheck, ShieldAlert } from 'lucide-react';
import { upload } from '@vercel/blob/client';
import { importVendorPayments, mergeVendors, saveVendorBank, addVendorPayment, attachPaymentProof, renameVendor, mergeVendorsMany, setPaymentCategory, approveVendorPayment, setPaymentApprovalLimit, settleAdvance, releaseRetention } from '@/server/actions/vendor-ledger';
import { EXPENSE_CATEGORIES } from '@/config/expense-categories';
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

export function LedgerView({ ledgers, activeId, detail, canManage, approvalLimit = 0 }: { ledgers: LedgerRow[]; activeId: string | null; detail: LedgerDetail | null; canManage: boolean; approvalLimit?: number }) {
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

  const [dupWarn, setDupWarn] = React.useState<{ msg: string; input: Parameters<typeof addVendorPayment>[0] } | null>(null);

  const doAdd = (input: Parameters<typeof addVendorPayment>[0], reset?: () => void) => {
    start(async () => {
      const r = await addVendorPayment(input);
      if ('duplicate' in r) { setDupWarn({ msg: r.duplicate, input }); return; }
      if ('error' in r) { toast.error(r.error); return; }
      toast.success(r.flagged ? 'Payment recorded — flagged for review (over the limit)' : 'Payment added');
      setDupWarn(null); reset?.(); setShowAdd(false); router.refresh();
    });
  };

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
      const input = {
        vendorId: detail.vendor.id,
        amount: String(fd.get('amount') ?? ''),
        date: String(fd.get('date') ?? ''),
        mode: String(fd.get('mode') ?? ''),
        reference: String(fd.get('reference') ?? ''),
        utr: String(fd.get('utr') ?? ''),
        note: String(fd.get('note') ?? ''),
        category: String(fd.get('category') ?? ''),
        notifyWhatsApp: fd.get('notifyWhatsApp') === 'on',
        isAdvance: fd.get('isAdvance') === 'on',
        retentionAmount: String(fd.get('retentionAmount') ?? ''),
        tdsRate: String(fd.get('tdsRate') ?? ''),
        proofUrl,
      };
      const r = await addVendorPayment(input);
      if ('duplicate' in r) { setDupWarn({ msg: r.duplicate, input }); return; }
      if ('error' in r) { toast.error(r.error); return; }
      toast.success(r.flagged ? 'Payment recorded — flagged for review (over the limit)' : 'Payment added');
      form.reset(); setShowAdd(false); router.refresh();
    });
  };

  const [renaming, setRenaming] = React.useState(false);
  const doRename = (id: string, name: string) => {
    start(async () => {
      const r = await renameVendor(id, name);
      if ('error' in r) { toast.error(r.error); return; }
      toast.success('Payee renamed'); setRenaming(false); router.refresh();
    });
  };

  // Tidy-up (multi-merge) on the list
  const [tidy, setTidy] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [keepId, setKeepId] = React.useState('');
  const toggleSel = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const doMultiMerge = () => {
    const ids = [...selected];
    const keep = keepId || ids[0];
    if (!keep || ids.length < 2) { toast.error('Pick at least two payees, and which name to keep.'); return; }
    start(async () => {
      const r = await mergeVendorsMany(keep, ids.filter((i) => i !== keep));
      if ('error' in r) { toast.error(r.error); return; }
      toast.success('Payees merged'); setSelected(new Set()); setKeepId(''); setTidy(false); router.refresh();
    });
  };

  const approve = (voucherId: string) => {
    start(async () => {
      const r = await approveVendorPayment(voucherId);
      if ('error' in r) { toast.error(r.error); return; }
      toast.success('Payment approved'); router.refresh();
    });
  };

  const downloadPassbook = () => {
    if (!detail) return;
    const rows = [['Voucher', 'Date', 'Amount', 'Mode', 'UTR/Ref', 'Category', 'Note', 'Status']];
    for (const p of detail.payments) {
      rows.push([p.number, new Date(p.paidOn ?? p.date).toLocaleDateString('en-IN'), String(p.amount), p.mode, p.utr ?? p.reference ?? '', EXPENSE_CATEGORIES.find((c) => c.code === p.category)?.label ?? '', (p.narration ?? '').replace(/"/g, '""'), p.status]);
    }
    const csv = [`Statement for ${detail.vendor.name}`, `Total paid,${detail.totalPaid}`, '', ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
    const a = document.createElement('a');
    a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
    a.download = `passbook-${detail.vendor.name.replace(/[^a-z0-9]+/gi, '-')}.csv`;
    a.click();
  };

  const saveLimit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await setPaymentApprovalLimit(Number(fd.get('limit') ?? 0));
      if ('error' in r) { toast.error(r.error); return; }
      toast.success('Review threshold saved'); router.refresh();
    });
  };

  const changeCategory = (voucherId: string, code: string) => {
    start(async () => {
      const r = await setPaymentCategory(voucherId, code);
      if ('error' in r) { toast.error(r.error); return; }
      router.refresh();
    });
  };

  const doSettle = (voucherId: string) => start(async () => {
    const r = await settleAdvance(voucherId);
    if ('error' in r) { toast.error(r.error); return; }
    toast.success('Advance settled'); router.refresh();
  });
  const doRelease = (voucherId: string) => start(async () => {
    const r = await releaseRetention(voucherId);
    if ('error' in r) { toast.error(r.error); return; }
    toast.success('Retention released'); router.refresh();
  });

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
      <div className="space-y-4 pb-24 sm:pb-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button onClick={() => router.push('/ledgers')} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> All ledgers</button>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={downloadPassbook}><Download className="h-4 w-4" /> Passbook (CSV)</Button>
            {canManage && !renaming && (
              <Button size="sm" variant="ghost" onClick={() => setRenaming(true)}><Pencil className="h-4 w-4" /> Rename payee</Button>
            )}
          </div>
        </div>
        {canManage && renaming && (
          <form
            onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); doRename(d.vendor.id, String(fd.get('name') ?? '')); }}
            className="flex items-center gap-2 rounded-md border bg-muted/20 p-2"
          >
            <Input name="name" defaultValue={d.vendor.name} className="max-w-xs" autoFocus />
            <Button type="submit" size="sm" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />} Save</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setRenaming(false)}>Cancel</Button>
          </form>
        )}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <StatTileRow cols={3}>
              <StatTile label="Total paid" value={formatCompactCurrency(d.totalPaid)} />
              <StatTile label="Payments" value={String(d.payments.length)} />
              <StatTile label="Bank on file" value={d.vendor.bankAccountNumber || d.vendor.upiId ? 'Yes' : 'No'} tone={d.vendor.bankAccountNumber || d.vendor.upiId ? 'good' : 'bad'} />
            </StatTileRow>
            {(d.advancesOutstanding > 0 || d.retentionHeld > 0) && (
              <div className="grid grid-cols-2 gap-3">
                <StatTile label="Unsettled advances" value={formatCompactCurrency(d.advancesOutstanding)} tone={d.advancesOutstanding > 0 ? 'bad' : 'good'} />
                <StatTile label="Retention held" value={formatCompactCurrency(d.retentionHeld)} tone={d.retentionHeld > 0 ? 'bad' : 'good'} />
              </div>
            )}
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
                  <Field label="Category">
                    <select name="category" defaultValue="" className="focus-ring w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm">
                      <option value="">Auto (from the note)</option>
                      {EXPENSE_CATEGORIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Retention held (₹)"><Input name="retentionAmount" type="number" step="1" placeholder="0" /></Field>
                  <Field label="TDS deducted (%)"><Input name="tdsRate" type="number" step="0.1" placeholder="0" /></Field>
                  <label className="flex items-center gap-2 text-sm sm:col-span-2">
                    <input type="checkbox" name="isAdvance" /> This is an advance (adjust against a later bill)
                  </label>
                  <div className="sm:col-span-2"><Field label="What was it for? (note)"><Input name="note" placeholder="e.g. Construction advance" /></Field></div>
                  <div className="sm:col-span-2">
                    <Field label="Payment proof (screenshot / bank PDF)"><Input name="proof" type="file" accept="image/*,.pdf" className="py-1" /></Field>
                  </div>
                  {d.vendor.phone && (
                    <label className="flex items-center gap-2 text-sm sm:col-span-2">
                      <input type="checkbox" name="notifyWhatsApp" /> WhatsApp the vendor a receipt ({d.vendor.phone})
                    </label>
                  )}
                  <input type="hidden" name="reference" value="" />
                  {dupWarn && (
                    <div className="sm:col-span-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-2 text-xs">
                      <p className="mb-2 font-medium text-amber-700">⚠ {dupWarn.msg}</p>
                      <div className="flex gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => doAdd({ ...dupWarn.input, force: true })} disabled={pending}>Save anyway</Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setDupWarn(null)}>Cancel</Button>
                      </div>
                    </div>
                  )}
                  <div className="sm:col-span-2"><Button type="submit" size="sm" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />} Save payment</Button></div>
                </form>
              )}
              {/* Mobile: each payment as a stacked card instead of a sideways-scrolling table. */}
              <div className="divide-y sm:hidden">
                {d.payments.length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">No payments yet.</p>
                ) : d.payments.map((p) => (
                  <div key={p.id} className="space-y-2 p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold tabular-nums">{formatCurrency(p.amount)}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(p.paidOn ?? p.date)}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      <span className="capitalize">{p.mode.replace(/_/g, ' ').toLowerCase()}</span>
                      {(p.utr ?? p.reference) && <span className="font-mono">· {p.utr ?? p.reference}</span>}
                      <span>· {p.number}</span>
                    </div>
                    {p.narration && <p className="text-xs text-muted-foreground">{p.narration}</p>}
                    {p.tdsAmount ? <p className="text-[11px] text-amber-600">TDS {formatCurrency(p.tdsAmount)}</p> : null}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {p.status === 'DRAFT' && (
                        <><Badge variant="warning" className="gap-1 text-[10px]"><ShieldAlert className="h-3 w-3" /> Review</Badge>{canManage && <button onClick={() => approve(p.id)} disabled={pending} className="text-[11px] text-primary hover:underline disabled:opacity-60">Approve</button>}</>
                      )}
                      {p.isAdvance && (
                        <><Badge variant={p.advanceSettled ? 'secondary' : 'warning'} className="text-[10px]">{p.advanceSettled ? 'Advance · settled' : 'Advance'}</Badge>{canManage && !p.advanceSettled && <button onClick={() => doSettle(p.id)} disabled={pending} className="text-[11px] text-primary hover:underline disabled:opacity-60">Settle</button>}</>
                      )}
                      {p.retentionAmount ? (
                        <><Badge variant={p.retentionReleased ? 'secondary' : 'warning'} className="text-[10px]">Retention {formatCompactCurrency(p.retentionAmount)}{p.retentionReleased ? ' · released' : ''}</Badge>{canManage && !p.retentionReleased && <button onClick={() => doRelease(p.id)} disabled={pending} className="text-[11px] text-primary hover:underline disabled:opacity-60">Release</button>}</>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {canManage ? (
                        <select value={p.category ?? ''} onChange={(e) => changeCategory(p.id, e.target.value)} disabled={pending} className="focus-ring rounded-md border border-input bg-background px-2 py-1 text-xs">
                          <option value="">— uncategorised —</option>
                          {EXPENSE_CATEGORIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                        </select>
                      ) : <span className="text-xs text-muted-foreground">{EXPENSE_CATEGORIES.find((c) => c.code === p.category)?.label ?? ''}</span>}
                      {p.proofUrl ? (
                        <a href={p.proofUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><Paperclip className="h-3.5 w-3.5" /> View proof</a>
                      ) : canManage ? (
                        <button onClick={() => pickProof(p.id)} disabled={uploadingId === p.id} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-60">{uploadingId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Add proof</button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden max-h-[26rem] overflow-auto sm:block">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground"><tr className="text-left"><th className="p-2">Voucher</th><th className="p-2">Date</th><th className="p-2 text-right">Amount</th><th className="p-2">Mode</th><th className="p-2">UTR / Ref</th><th className="p-2">Category</th><th className="p-2">Note</th><th className="p-2">Proof</th></tr></thead>
                  <tbody>
                    {d.payments.length === 0 ? <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No payments yet.</td></tr> : d.payments.map((p) => (
                      <tr key={p.id} className="border-t align-top">
                        <td className="p-2 font-medium">
                          {p.number}
                          {p.status === 'DRAFT' && (
                            <span className="mt-1 flex items-center gap-1">
                              <Badge variant="warning" className="gap-1 text-[10px]"><ShieldAlert className="h-3 w-3" /> Review</Badge>
                              {canManage && <button onClick={() => approve(p.id)} disabled={pending} className="inline-flex items-center gap-0.5 text-[11px] text-primary hover:underline disabled:opacity-60"><BadgeCheck className="h-3 w-3" /> Approve</button>}
                            </span>
                          )}
                          {p.isAdvance && (
                            <span className="mt-1 flex items-center gap-1">
                              <Badge variant={p.advanceSettled ? 'secondary' : 'warning'} className="text-[10px]">{p.advanceSettled ? 'Advance · settled' : 'Advance'}</Badge>
                              {canManage && !p.advanceSettled && <button onClick={() => doSettle(p.id)} disabled={pending} className="text-[11px] text-primary hover:underline disabled:opacity-60">Settle</button>}
                            </span>
                          )}
                          {p.retentionAmount ? (
                            <span className="mt-1 flex items-center gap-1">
                              <Badge variant={p.retentionReleased ? 'secondary' : 'warning'} className="text-[10px]">Retention {formatCompactCurrency(p.retentionAmount)}{p.retentionReleased ? ' · released' : ''}</Badge>
                              {canManage && !p.retentionReleased && <button onClick={() => doRelease(p.id)} disabled={pending} className="text-[11px] text-primary hover:underline disabled:opacity-60">Release</button>}
                            </span>
                          ) : null}
                        </td>
                        <td className="p-2 whitespace-nowrap">{formatDate(p.paidOn ?? p.date)}</td>
                        <td className="p-2 text-right tabular-nums">{formatCurrency(p.amount)}</td>
                        <td className="p-2">{p.mode.replace(/_/g, ' ').toLowerCase()}</td>
                        <td className="p-2 font-mono text-xs">{p.utr ?? p.reference ?? '—'}</td>
                        <td className="p-2">
                          {canManage ? (
                            <select value={p.category ?? ''} onChange={(e) => changeCategory(p.id, e.target.value)} disabled={pending} className="focus-ring rounded-md border border-input bg-background px-1.5 py-1 text-xs">
                              <option value="">— uncategorised —</option>
                              {EXPENSE_CATEGORIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                            </select>
                          ) : (
                            <span className="text-xs text-muted-foreground">{EXPENSE_CATEGORIES.find((c) => c.code === p.category)?.label ?? '—'}</span>
                          )}
                        </td>
                        <td className="p-2 text-xs text-muted-foreground">{p.narration ?? '—'}{p.tdsAmount ? <span className="mt-0.5 block text-[10px] text-amber-600">TDS {formatCurrency(p.tdsAmount)}</span> : null}</td>
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

        {/* Mobile: a sticky action bar so the primary action is always in thumb reach. */}
        {canManage && (
          <div className="fixed inset-x-0 z-30 flex gap-2 border-t bg-background/95 p-3 backdrop-blur sm:hidden" style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom))' }}>
            <Button className="flex-1" onClick={() => { setShowAdd(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><Plus className="h-4 w-4" /> Add a payment</Button>
            <Button variant="outline" onClick={downloadPassbook}><Download className="h-4 w-4" /> Passbook</Button>
          </div>
        )}
      </div>
    );
  }

  // List view
  const shown = query.trim() ? ledgers.filter((l) => l.name.toLowerCase().includes(query.toLowerCase())) : ledgers;
  return (
    <div className="space-y-4">
      <StatTileRow cols={4}>
        <StatTile label="Payees" value={String(ledgers.length)} />
        <StatTile label="Total paid out" value={formatCompactCurrency(total)} />
        <StatTile label="Still owed (unpaid bills)" value={formatCompactCurrency(ledgers.reduce((s, l) => s + l.owed, 0))} tone={ledgers.some((l) => l.owed > 0) ? 'bad' : 'good'} />
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
          <form onSubmit={saveLimit} className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3 text-sm">
            <span className="text-muted-foreground">Flag payments above ₹</span>
            <Input name="limit" type="number" step="1" defaultValue={approvalLimit || ''} placeholder="0 = off" className="h-8 w-32" />
            <span className="text-muted-foreground">for review before they count as approved.</span>
            <Button type="submit" size="sm" variant="outline" disabled={pending}>Save</Button>
          </form>
        </Card>
      )}

      {ledgers.length === 0 ? (
        <EmptyState icon={FileSpreadsheet} title="No payees yet" body="Import your payments (as a CSV) to build a ledger for each person you pay." />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="relative max-w-xs flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search payees" className="pl-9" />
            </div>
            {canManage && (
              <Button size="sm" variant={tidy ? 'default' : 'outline'} onClick={() => { setTidy((v) => !v); setSelected(new Set()); setKeepId(''); }}>
                <ListChecks className="h-4 w-4" /> {tidy ? 'Done tidying' : 'Tidy up payees'}
              </Button>
            )}
          </div>

          {tidy && (
            <div className="rounded-md border border-[#A07D34]/40 bg-[#A07D34]/5 p-3 text-sm">
              <p className="mb-2 text-muted-foreground">Tick every row that is really the <b>same payee</b> (e.g. all the “Arun” lines), choose which name to keep, then merge — their payments combine into one ledger.</p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{selected.size} selected</span>
                {selected.size >= 2 && (
                  <>
                    <span className="text-muted-foreground">→ keep as</span>
                    <select value={keepId || [...selected][0]} onChange={(e) => setKeepId(e.target.value)} className="focus-ring rounded-md border border-input bg-background px-2 py-1 text-sm">
                      {[...selected].map((id) => { const l = ledgers.find((x) => x.id === id); return <option key={id} value={id}>{l?.name}</option>; })}
                    </select>
                    <Button size="sm" onClick={doMultiMerge} disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />} Merge {selected.size} into one</Button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Mobile: payee cards instead of a wide table. */}
          <div className="divide-y overflow-hidden rounded-lg border sm:hidden">
            {shown.map((l) => (
              <button
                key={l.id}
                onClick={() => (tidy ? toggleSel(l.id) : router.push(`/ledgers?v=${l.id}`))}
                className={cn('flex w-full items-center gap-3 p-3 text-left active:bg-secondary/60', tidy && selected.has(l.id) && 'bg-[#A07D34]/10')}
              >
                {tidy && <input type="checkbox" checked={selected.has(l.id)} readOnly className="pointer-events-none h-4 w-4 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{l.name}</p>
                  <p className="text-xs text-muted-foreground">{l.count} payment{l.count === 1 ? '' : 's'}{l.owed > 0 && <span className="text-amber-600"> · owed {formatCompactCurrency(l.owed)}</span>}{!l.hasBank && <span className="text-amber-600"> · no bank</span>}</p>
                </div>
                <span className="shrink-0 font-semibold tabular-nums">{formatCompactCurrency(l.totalPaid)}</span>
              </button>
            ))}
          </div>
          <div className="hidden overflow-x-auto rounded-lg border sm:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground"><tr className="text-left">{tidy && <th className="w-8 p-2" />}<th className="p-2">Payee</th><th className="p-2 text-right">Total paid</th><th className="p-2 text-right">Still owed</th><th className="p-2 text-right">Payments</th><th className="p-2">Bank</th></tr></thead>
              <tbody>
                {shown.map((l) => (
                  <tr
                    key={l.id}
                    className={cn('border-t hover:bg-secondary/50', tidy ? 'cursor-pointer' : 'cursor-pointer', tidy && selected.has(l.id) && 'bg-[#A07D34]/10')}
                    onClick={() => (tidy ? toggleSel(l.id) : router.push(`/ledgers?v=${l.id}`))}
                  >
                    {tidy && <td className="p-2"><input type="checkbox" checked={selected.has(l.id)} onChange={() => toggleSel(l.id)} onClick={(e) => e.stopPropagation()} /></td>}
                    <td className="p-2 font-medium">{l.name}</td>
                    <td className="p-2 text-right tabular-nums">{formatCurrency(l.totalPaid)}</td>
                    <td className="p-2 text-right tabular-nums">{l.owed > 0 ? <span className="text-amber-600">{formatCurrency(l.owed)}</span> : '—'}</td>
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
