'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Sparkles, Loader2, Upload, Trash2, Plus, FileSpreadsheet, ArrowRight } from 'lucide-react';
import { extractBill, createInvoice } from '@/server/actions/billing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [dropName, setDropName] = React.useState('');
  const [over, setOver] = React.useState(false);

  const reset = () => { setStage('upload'); setItems([]); setDropName(''); setHead({ clientName: '', clientGstin: '', issueDate: '', projectId: '', intraState: true, notes: '' }); };
  const close = () => { setOpen(false); reset(); };
  const patch = (i: number, k: keyof Item, v: string) => setItems((arr) => arr.map((x, idx) => (idx === i ? { ...x, [k]: v } : x)));

  const doExtract = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const fd = new FormData(e.currentTarget); const file = fd.get('file');
    if (!(file instanceof File) || !file.size) { toast.error('Choose a file first.'); return; }
    if (looksLikeSpreadsheet(file.name)) { toast.error('That is a spreadsheet — import it in Vendor Ledgers, not here.'); return; }
    start(async () => {
      const r = await extractBill(fd);
      if ('error' in r) { toast.error(r.error); return; }
      const d = r.draft;
      setHead({ clientName: d.clientName, clientGstin: d.clientGstin ?? '', issueDate: d.invoiceDate ?? '', projectId: '', intraState: true, notes: `AI-imported from ${file.name}${d.invoiceNumber ? ` · vendor inv ${d.invoiceNumber}` : ''}` });
      setItems(d.items.length ? d.items.map((i) => ({ description: i.description, quantity: String(i.quantity), rate: String(i.rate), gstRate: String(i.gstRate) })) : [{ description: '', quantity: '1', rate: '', gstRate: '18' }]);
      setStage('review'); toast.success('Bill read — review & save');
    });
  };

  const save = () => start(async () => {
    const r = await createInvoice({ clientName: head.clientName, clientGstin: head.clientGstin, projectId: head.projectId || null, issueDate: head.issueDate || undefined, notes: head.notes, intraState: head.intraState, items: items.filter((i) => i.description).map((i) => ({ description: i.description, quantity: Number(i.quantity), rate: Number(i.rate), gstRate: Number(i.gstRate) })) });
    if ('error' in r) { toast.error(r.error); return; }
    toast.success('Invoice created from bill'); close(); router.refresh();
  });

  const total = items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.rate) || 0) * (1 + (Number(i.gstRate) || 0) / 100), 0);

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} disabled={!geminiEnabled} title={geminiEnabled ? 'Extract a bill with AI' : 'Set GEMINI_API_KEY to enable'}><Sparkles className="h-4 w-4" /> Import bill (AI)</Button>
      <Dialog open={open} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Import bill with AI</DialogTitle></DialogHeader>
          {stage === 'upload' && (
            <form onSubmit={doExtract} className="space-y-4">
              <p className="text-sm text-muted-foreground">Upload a bill / invoice (PDF, image, or scan). Gemini reads it and fills in the vendor, GST number, date, and line items for you to review before saving.</p>
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
            </form>
          )}
          {stage === 'review' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Company / vendor</Label><Input value={head.clientName} onChange={(e) => setHead({ ...head, clientName: e.target.value })} /></div>
                <div className="space-y-1"><Label>GST number</Label><Input value={head.clientGstin} onChange={(e) => setHead({ ...head, clientGstin: e.target.value })} /></div>
                <div className="space-y-1"><Label>Bill date</Label><Input type="date" value={head.issueDate} onChange={(e) => setHead({ ...head, issueDate: e.target.value })} /></div>
                <div className="space-y-1"><Label>Project</Label><select value={head.projectId} onChange={(e) => setHead({ ...head, projectId: e.target.value })} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">—</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              </div>
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_60px_84px_58px_32px] gap-2 text-[11px] font-medium text-muted-foreground"><span>Description</span><span>Qty</span><span>Price</span><span>GST%</span><span /></div>
                {items.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_60px_84px_58px_32px] gap-2">
                    <Input value={it.description} onChange={(e) => patch(idx, 'description', e.target.value)} />
                    <Input value={it.quantity} onChange={(e) => patch(idx, 'quantity', e.target.value)} />
                    <Input value={it.rate} onChange={(e) => patch(idx, 'rate', e.target.value)} />
                    <Input value={it.gstRate} onChange={(e) => patch(idx, 'gstRate', e.target.value)} />
                    <Button type="button" variant="ghost" size="icon" onClick={() => setItems(items.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => setItems([...items, { description: '', quantity: '1', rate: '', gstRate: '18' }])}><Plus className="h-4 w-4" /> Add line</Button>
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={head.intraState} onChange={(e) => setHead({ ...head, intraState: e.target.checked })} /> Intra-state (CGST + SGST)</label>
              <div className="space-y-1"><Label>Notes</Label><Input value={head.notes} onChange={(e) => setHead({ ...head, notes: e.target.value })} /></div>
              <div className="flex items-center justify-between border-t pt-3"><span className="text-sm text-muted-foreground">Est. total incl GST</span><span className="font-semibold">₹{nf.format(total)}</span></div>
              <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setStage('upload')}>Back</Button><Button onClick={save} disabled={pending || !head.clientName}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Create invoice</Button></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
