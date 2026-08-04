'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Sparkles, Loader2, Upload, Trash2, Plus, FileSpreadsheet, ArrowRight, PencilLine } from 'lucide-react';
import { extractBill, createVendorBillFromImport } from '@/server/actions/billing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DocumentPreview } from '@/components/shared/document-preview';

interface Item { description: string; quantity: string; rate: string; gstRate: string }
const nf = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** A spreadsheet of many rows isn't a single bill — it belongs in Vendor Ledgers. */
const looksLikeSpreadsheet = (name: string) => /\.(csv|xlsx|xls|xlsm|xlsb|ods|tsv)$/i.test(name);

export function AiBillImport({ geminiEnabled, projects }: { geminiEnabled: boolean; projects: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [stage, setStage] = React.useState<'upload' | 'review'>('upload');
  const [pending, start] = React.useTransition();
  const [head, setHead] = React.useState({ clientName: '', clientGstin: '', issueDate: '', projectId: '', intraState: true, notes: '' });
  const [items, setItems] = React.useState<Item[]>([]);
  // The supplier's own bill number — what you quote back to them, and what
  // stops the same bill being recorded twice.
  const [billNumber, setBillNumber] = React.useState('');
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [dropName, setDropName] = React.useState('');
  const [over, setOver] = React.useState(false);
  // A local object-URL of the chosen bill so it previews inline next to the
  // extracted fields — the source and the reading sit side by side. Revoked on
  // reset so we never leak blob URLs.
  const [src, setSrc] = React.useState<{ url: string; name: string; mime: string } | null>(null);

  const clearSrc = () => setSrc((s) => { if (s) URL.revokeObjectURL(s.url); return null; });
  const reset = () => { setStage('upload'); setItems([]); setDropName(''); clearSrc(); setBillNumber(''); setHead({ clientName: '', clientGstin: '', issueDate: '', projectId: '', intraState: true, notes: '' }); };
  const close = () => { setOpen(false); reset(); };
  const patch = (i: number, k: keyof Item, v: string) => setItems((arr) => arr.map((x, idx) => (idx === i ? { ...x, [k]: v } : x)));

  const doExtract = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const fd = new FormData(e.currentTarget); const file = fd.get('file');
    if (!(file instanceof File) || !file.size) { toast.error('Choose a file first.'); return; }
    if (looksLikeSpreadsheet(file.name)) { toast.error('That is a spreadsheet — import it in Vendor Ledgers, not here.'); return; }
    clearSrc();
    setSrc({ url: URL.createObjectURL(file), name: file.name, mime: file.type || 'application/octet-stream' });
    start(async () => {
      const r = await extractBill(fd);
      if ('error' in r) { toast.error(r.error); return; }
      const d = r.draft;
      setHead({ clientName: d.clientName, clientGstin: d.clientGstin ?? '', issueDate: d.invoiceDate ?? '', projectId: '', intraState: true, notes: `AI-imported from ${file.name}` });
      setBillNumber(d.invoiceNumber ?? '');
      setItems(d.items.length ? d.items.map((i) => ({ description: i.description, quantity: String(i.quantity), rate: String(i.rate), gstRate: String(i.gstRate) })) : [{ description: '', quantity: '1', rate: '', gstRate: '18' }]);
      setStage('review'); toast.success('Bill read — review & save');
    });
  };

  const save = () => start(async () => {
    // A bill you RECEIVED is a payable. This used to call `createInvoice`,
    // which booked the supplier's bill as one of YOUR sales invoices — money
    // owed to you instead of by you, wrong on the balance sheet and wrong in
    // GSTR-1.
    const lines = items.filter((i) => i.description);
    const net = lines.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.rate) || 0), 0);
    const gst = lines.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.rate) || 0) * ((Number(i.gstRate) || 0) / 100), 0);
    const r = await createVendorBillFromImport({
      vendorName: head.clientName,
      number: billNumber || `BILL-${new Date().toISOString().slice(0, 10)}`,
      amount: Math.round(net * 100) / 100,
      gstAmount: Math.round(gst * 100) / 100,
      billDate: head.issueDate || null,
      notes: head.notes,
    });
    if ('error' in r) { toast.error(r.error); return; }
    toast.success('Bill recorded — it now shows as money you owe'); close(); router.refresh();
  });

  // The no-AI path: skip extraction entirely and go straight to a blank bill
  // form. Always available — so a dead AI key, no credit, or an offline provider
  // never stops someone entering a bill by hand.
  const manual = () => {
    setHead({ clientName: '', clientGstin: '', issueDate: '', projectId: '', intraState: true, notes: '' });
    setBillNumber('');
    setItems([{ description: '', quantity: '1', rate: '', gstRate: '18' }]);
    setStage('review');
  };

  const total = items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.rate) || 0) * (1 + (Number(i.gstRate) || 0) / 100), 0);

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} title="Read a bill with AI, or enter one by hand"><Sparkles className="h-4 w-4" /> Import bill</Button>
      <Dialog open={open} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Import a bill</DialogTitle></DialogHeader>
          {stage === 'upload' && (
            <form onSubmit={doExtract} className="space-y-4">
              <p className="text-sm text-muted-foreground">Upload a bill / invoice (PDF, image, or scan). {geminiEnabled ? 'The AI reads it and fills in the vendor, GST number, date, and line items for you to review before saving.' : 'AI reading is off right now — use “Enter the bill by hand” below to add it directly.'}</p>
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileRef.current?.click()}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click(); } }}
                onDragOver={(e) => { e.preventDefault(); setOver(true); }}
                onDragLeave={(e) => { e.preventDefault(); setOver(false); }}
                onDrop={(e) => {
                  e.preventDefault(); setOver(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f && fileRef.current) { fileRef.current.files = e.dataTransfer.files; setDropName(f.name); }
                }}
                className={`focus-ring flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-input px-4 py-6 text-center transition-colors hover:border-primary/60 hover:bg-secondary/40 ${over ? 'border-primary bg-primary/10' : ''}`}
              >
                <Upload className={`h-6 w-6 ${over ? 'text-primary' : 'text-muted-foreground'}`} />
                <p className="text-sm font-medium">{dropName ? `Selected: ${dropName}` : 'Drag & drop a bill here'}</p>
                <p className="text-xs text-muted-foreground">or click to browse — PDF, image or scan</p>
                <input
                  ref={fileRef}
                  name="file"
                  type="file"
                  required
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.gif,.bmp,.tiff,image/*"
                  className="hidden"
                  onChange={(e) => setDropName(e.target.files?.[0]?.name ?? '')}
                />
              </div>
              {looksLikeSpreadsheet(dropName) ? (
                <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                  <p className="flex items-center gap-2 font-medium"><FileSpreadsheet className="h-4 w-4 text-amber-600" /> That looks like a spreadsheet, not a single bill.</p>
                  <p className="text-muted-foreground">This AI reader is for one scanned bill or invoice (a PDF or photo). To import a whole list of expenses or payments from Excel/CSV, use Vendor Ledgers — it builds a running ledger for each payee automatically.</p>
                  <Link href="/ledgers" onClick={close} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
                    Go to Vendor Ledgers → Import <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              ) : (
                <div className="flex justify-end"><Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}<Upload className="h-4 w-4" /> Read with AI</Button></div>
              )}
              <div className="flex items-center gap-3 pt-1">
                <span className="h-px flex-1 bg-border" />
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">or</span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <button
                type="button"
                onClick={manual}
                className="focus-ring flex w-full items-center justify-center gap-2 rounded-md border border-input px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary"
              >
                <PencilLine className="h-4 w-4" /> Enter the bill by hand — no AI needed
              </button>
              <p className="text-center text-xs text-muted-foreground">Works even when the AI is down or out of credit. You type the vendor, GST, date and lines yourself.</p>
            </form>
          )}
          {stage === 'review' && (
            <div className="space-y-4">
              {src ? (
                <div className="space-y-1">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Source bill</span>
                  <DocumentPreview url={src.url} name={src.name} mime={src.mime} heightClass="h-56" />
                  <p className="text-[11px] text-muted-foreground">Check the reading below against the original above before saving.</p>
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Supplier who sent the bill</Label><Input value={head.clientName} onChange={(e) => setHead({ ...head, clientName: e.target.value })} placeholder="Cement Corporation" /></div>
                <div className="space-y-1"><Label>Their bill number</Label><Input value={billNumber} onChange={(e) => setBillNumber(e.target.value)} placeholder="INV/2026/4471" /></div>
                <div className="space-y-1"><Label>GST number</Label><Input value={head.clientGstin} onChange={(e) => setHead({ ...head, clientGstin: e.target.value })} /></div>
                <div className="space-y-1"><Label>Bill date</Label><Input type="date" value={head.issueDate} onChange={(e) => setHead({ ...head, issueDate: e.target.value })} /></div>
                <div className="space-y-1"><Label>Project</Label><select value={head.projectId} onChange={(e) => setHead({ ...head, projectId: e.target.value })} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">—</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              </div>
              <div className="space-y-2">
                <div className="hidden grid-cols-[1fr_60px_84px_58px_32px] gap-2 text-[11px] font-medium text-muted-foreground sm:grid"><span>Description</span><span>Qty</span><span>Price</span><span>GST%</span><span /></div>
                {items.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_60px_84px_58px_32px]">
                    <Input className="col-span-2 sm:col-span-1" value={it.description} onChange={(e) => patch(idx, 'description', e.target.value)} placeholder="Description" />
                    <Input value={it.quantity} onChange={(e) => patch(idx, 'quantity', e.target.value)} placeholder="Qty" />
                    <Input value={it.rate} onChange={(e) => patch(idx, 'rate', e.target.value)} placeholder="Price" />
                    <Input value={it.gstRate} onChange={(e) => patch(idx, 'gstRate', e.target.value)} placeholder="GST %" />
                    <Button type="button" variant="ghost" size="icon" onClick={() => setItems(items.filter((_, i) => i !== idx))} aria-label="Remove this line"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => setItems([...items, { description: '', quantity: '1', rate: '', gstRate: '18' }])}><Plus className="h-4 w-4" /> Add line</Button>
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={head.intraState} onChange={(e) => setHead({ ...head, intraState: e.target.checked })} /> Intra-state (CGST + SGST)</label>
              <div className="space-y-1"><Label>Notes</Label><Input value={head.notes} onChange={(e) => setHead({ ...head, notes: e.target.value })} /></div>
              <div className="flex items-center justify-between border-t pt-3"><span className="text-sm text-muted-foreground">Est. total incl GST</span><span className="font-semibold">₹{nf.format(total)}</span></div>
              <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setStage('upload')}>Back</Button><Button onClick={save} disabled={pending || !head.clientName}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Record this bill</Button></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
