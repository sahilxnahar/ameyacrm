'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Sparkles, Loader2, Upload, Trash2, Plus } from 'lucide-react';
import { extractBill, createInvoice } from '@/server/actions/billing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Item { description: string; quantity: string; rate: string; gstRate: string }
const nf = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

export function AiBillImport({ geminiEnabled, projects }: { geminiEnabled: boolean; projects: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [stage, setStage] = React.useState<'upload' | 'review'>('upload');
  const [pending, start] = React.useTransition();
  const [head, setHead] = React.useState({ clientName: '', clientGstin: '', issueDate: '', projectId: '', intraState: true, notes: '' });
  const [items, setItems] = React.useState<Item[]>([]);

  const reset = () => { setStage('upload'); setItems([]); setHead({ clientName: '', clientGstin: '', issueDate: '', projectId: '', intraState: true, notes: '' }); };
  const close = () => { setOpen(false); reset(); };
  const patch = (i: number, k: keyof Item, v: string) => setItems((arr) => arr.map((x, idx) => (idx === i ? { ...x, [k]: v } : x)));

  const doExtract = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const fd = new FormData(e.currentTarget); const file = fd.get('file');
    if (!(file instanceof File) || !file.size) return toast.error('Choose a file first.');
    start(async () => {
      const r = await extractBill(fd);
      if ('error' in r) return toast.error(r.error);
      const d = r.draft;
      setHead({ clientName: d.clientName, clientGstin: d.clientGstin ?? '', issueDate: d.invoiceDate ?? '', projectId: '', intraState: true, notes: `AI-imported from ${file.name}${d.invoiceNumber ? ` · vendor inv ${d.invoiceNumber}` : ''}` });
      setItems(d.items.length ? d.items.map((i) => ({ description: i.description, quantity: String(i.quantity), rate: String(i.rate), gstRate: String(i.gstRate) })) : [{ description: '', quantity: '1', rate: '', gstRate: '18' }]);
      setStage('review'); toast.success('Bill read — review & save');
    });
  };

  const save = () => start(async () => {
    const r = await createInvoice({ clientName: head.clientName, clientGstin: head.clientGstin, projectId: head.projectId || null, issueDate: head.issueDate || undefined, notes: head.notes, intraState: head.intraState, items: items.filter((i) => i.description).map((i) => ({ description: i.description, quantity: Number(i.quantity), rate: Number(i.rate), gstRate: Number(i.gstRate) })) });
    if ('error' in r) return toast.error(r.error);
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
              <Input name="file" type="file" required accept=".pdf,image/*,.txt,.csv" />
              <div className="flex justify-end"><Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}<Upload className="h-4 w-4" /> Read with AI</Button></div>
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
