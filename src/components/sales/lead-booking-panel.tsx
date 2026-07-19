'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, CheckCircle2, IndianRupee } from 'lucide-react';
import { createBooking, markMilestonePaid, cancelBooking } from '@/server/actions/sales';
import { generateBookingLetter } from '@/server/actions/letters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatCurrency, formatDate, titleCase } from '@/lib/utils/format';

const selectCls = 'flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm';
interface Milestone { id: string; label: string; amount: number; dueDate: string | null; status: string }
interface Booking { id: string; reference: string; status: string; paymentStatus: string; agreementValue: number | null; milestones: Milestone[] }

export function LeadBookingPanel({ leadId, units, bookings }: { leadId: string; units: { id: string; name: string }[]; bookings: Booking[] }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [open, setOpen] = React.useState(false);
  const [rows, setRows] = React.useState([{ label: 'Booking amount', amount: '', dueDate: '' }]);
  const [cancelId, setCancelId] = React.useState<string | null>(null);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await createBooking({
        leadId, unitId: fd.get('unitId') || null, agreementValue: fd.get('agreementValue') || undefined,
        milestones: rows.filter((m) => m.label && m.amount).map((m) => ({ label: m.label, amount: Number(m.amount), dueDate: m.dueDate || null })),
      });
      if ('error' in r) return toast.error(r.error);
      toast.success('Booking created'); setOpen(false); setRows([{ label: 'Booking amount', amount: '', dueDate: '' }]); router.refresh();
    });
  };
  const pay = (id: string) => start(async () => { const r = await markMilestonePaid(id); if ('error' in r) return toast.error(r.error); toast.success('Marked paid'); router.refresh(); });
  const letter = (id: string, kind: 'DEMAND' | 'ALLOTMENT') => start(async () => { const r = await generateBookingLetter(id, kind); if ('error' in r) return toast.error(r.error); const a = document.createElement('a'); a.href = `data:application/pdf;base64,${r.pdfBase64}`; a.download = r.filename; a.click(); toast.success('Letter downloaded'); });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Bookings</p>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New booking</Button>
      </div>
      {bookings.length === 0 && <p className="text-sm text-muted-foreground">No bookings yet.</p>}
      {bookings.map((b) => (
        <div key={b.id} className="rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs">{b.reference}</span>
            <div className="flex gap-2">
              <Badge variant="secondary">{titleCase(b.status)}</Badge>
              <Badge variant={b.paymentStatus === 'PAID' ? 'success' : b.paymentStatus === 'PARTIAL' ? 'warning' : 'secondary'}>{titleCase(b.paymentStatus)}</Badge>
              {b.status !== 'CANCELLED' && <Button size="sm" variant="ghost" className="h-6 text-xs text-destructive" onClick={() => setCancelId(b.id)}>Cancel</Button>}
            </div>
          </div>
          {b.agreementValue != null && <p className="mt-1 text-sm">Agreement value: {formatCurrency(b.agreementValue)}</p>}
          <div className="mt-2 space-y-1">
            {b.milestones.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded border px-2 py-1 text-sm">
                <span>{m.label} · {formatCurrency(m.amount)}{m.dueDate ? ` · due ${formatDate(m.dueDate, 'dd MMM')}` : ''}</span>
                {m.status === 'PAID'
                  ? <Badge variant="success" className="gap-1"><CheckCircle2 className="h-3 w-3" />Paid</Badge>
                  : <Button size="sm" variant="ghost" className="h-6" disabled={pending} onClick={() => pay(m.id)}><IndianRupee className="h-3 w-3" /> Mark paid</Button>}
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => letter(b.id, 'DEMAND')}>Demand letter</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => letter(b.id, 'ALLOTMENT')}>Allotment letter</Button>
          </div>
        </div>
      ))}

      <Dialog open={!!cancelId} onOpenChange={(o) => !o && setCancelId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Cancel booking</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); const id = cancelId!; start(async () => { const r = await cancelBooking({ bookingId: id, forfeitAmount: fd.get('forfeitAmount') || 0, reason: fd.get('reason') || undefined }); if ('error' in r) return toast.error(r.error); toast.success('Booking cancelled, unit released'); setCancelId(null); router.refresh(); }); }} className="space-y-3">
            <p className="text-sm text-muted-foreground">The unit returns to available inventory. Refund is auto-computed as amount paid minus forfeiture.</p>
            <div className="space-y-1"><Label htmlFor="forfeitAmount">Forfeiture amount (₹)</Label><Input id="forfeitAmount" name="forfeitAmount" type="number" min="0" defaultValue="0" /></div>
            <div className="space-y-1"><Label htmlFor="reason">Reason</Label><Input id="reason" name="reason" placeholder="Buyer withdrew, financing fell through…" /></div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setCancelId(null)}>Keep booking</Button><Button type="submit" variant="destructive" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Cancel booking</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader><DialogTitle>New booking</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="unitId">Unit</Label><select id="unitId" name="unitId" className={selectCls} defaultValue=""><option value="">—</option>{units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
              <div className="space-y-2"><Label htmlFor="agreementValue">Agreement value (₹)</Label><Input id="agreementValue" name="agreementValue" type="number" /></div>
            </div>
            <div className="space-y-2">
              <Label>Payment plan</Label>
              {rows.map((m, i) => (
                <div key={i} className="flex gap-2">
                  <Input className="flex-[2]" placeholder="Label" value={m.label} onChange={(e) => setRows((p) => p.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
                  <Input className="w-28" type="number" placeholder="Amount" value={m.amount} onChange={(e) => setRows((p) => p.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))} />
                  <Input className="w-36" type="date" value={m.dueDate} onChange={(e) => setRows((p) => p.map((x, j) => j === i ? { ...x, dueDate: e.target.value } : x))} />
                  <Button type="button" variant="ghost" size="icon" onClick={() => setRows((p) => p.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setRows((p) => [...p, { label: '', amount: '', dueDate: '' }])}><Plus className="h-4 w-4" /> Add milestone</Button>
            </div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Create booking</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
