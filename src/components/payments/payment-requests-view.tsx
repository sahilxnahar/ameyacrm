'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Loader2, Link2, MessageCircle, Send, Check, Ban, Settings2 } from 'lucide-react';
import { createPaymentRequest, resendPaymentRequest, setPaymentRequestStatus, savePaymentInstructions } from '@/server/actions/payment-requests';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Req { id: string; reference: string; token: string; payeeName: string; payeeEmail: string | null; payeePhone: string | null; amount: number; description: string; status: string; dueDate: string | null; payerReference: string | null; emailSentAt: string | null; createdAt: string }
interface Opt { id: string; name: string }
const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const money = (n: number) => `₹${inr.format(n)}`;
const tone = (s: string) => (s === 'PAID' ? 'success' : s === 'CANCELLED' ? 'secondary' : s === 'CONFIRMED' ? 'warning' : 'secondary') as 'success' | 'secondary' | 'warning';

export function PaymentRequestsView({ requests, customers, instructions, appUrl }: { requests: Req[]; customers: Opt[]; instructions: string; appUrl: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [cfg, setCfg] = React.useState(false);
  const [pending, start] = React.useTransition();
  const [fresh, setFresh] = React.useState<string | null>(null);

  const link = (t: string) => `${appUrl || (typeof window !== 'undefined' ? window.location.origin : '')}/pay/${t}`;
  const act = (fn: () => Promise<{ ok: true } | { error: string } | { ok: true; link?: string; emailed?: boolean }>, ok: string) =>
    start(async () => { const r = await fn(); if ('error' in r) return toast.error(r.error); toast.success(ok); router.refresh(); });

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const form = e.currentTarget; const fd = new FormData(form);
    start(async () => {
      const r = await createPaymentRequest({
        payeeName: fd.get('payeeName'), payeeEmail: fd.get('payeeEmail') || '', payeePhone: fd.get('payeePhone') || undefined,
        amount: fd.get('amount'), description: fd.get('description'), dueDate: fd.get('dueDate') || null,
        customerId: fd.get('customerId') || null,
      });
      if ('error' in r) return toast.error(r.error);
      setFresh(r.link ?? null); form.reset(); setOpen(false); router.refresh();
      toast.success(r.emailed ? 'Request created and emailed' : 'Request created — email not configured, share the link');
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="outline" onClick={() => setCfg(true)}><Settings2 className="h-4 w-4" /> Payment details</Button>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New request</Button>
      </div>

      {fresh && (
        <Card className="border-emerald-500/40 bg-emerald-500/10 p-4">
          <p className="mb-1 text-sm font-semibold">Share this payment link</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all rounded bg-background/70 p-2 font-mono text-xs">{fresh}</code>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(fresh); toast.success('Copied'); }}><Link2 className="h-4 w-4" /></Button>
          </div>
        </Card>
      )}

      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Request</TableHead><TableHead>Payee</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {requests.length === 0 && <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">No payment requests yet.</TableCell></TableRow>}
            {requests.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <p className="font-mono text-xs text-muted-foreground">{r.reference}</p>
                  <p className="max-w-xs truncate text-sm">{r.description}</p>
                  {r.payerReference && <p className="text-[11px] text-amber-700">Payer ref: {r.payerReference}</p>}
                </TableCell>
                <TableCell className="text-sm">{r.payeeName}<p className="text-xs text-muted-foreground">{r.payeeEmail ?? r.payeePhone ?? '—'}</p></TableCell>
                <TableCell className="text-right font-medium">{money(r.amount)}</TableCell>
                <TableCell><Badge variant={tone(r.status)}>{r.status}</Badge></TableCell>
                <TableCell className="text-right">
                  <span className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" title="Copy link" onClick={() => { navigator.clipboard?.writeText(link(r.token)); toast.success('Link copied'); }}><Link2 className="h-4 w-4" /></Button>
                    {r.payeePhone && (
                      <Button asChild size="icon" variant="ghost" className="h-7 w-7" title="WhatsApp">
                        <a target="_blank" rel="noreferrer" href={`https://wa.me/${r.payeePhone.replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}?text=${encodeURIComponent(`Payment request ${r.reference} for ${money(r.amount)} — ${r.description}. Pay here: ${link(r.token)}`)}`}><MessageCircle className="h-4 w-4 text-emerald-600" /></a>
                      </Button>
                    )}
                    {r.payeeEmail && <Button size="icon" variant="ghost" className="h-7 w-7" title="Resend email" disabled={pending} onClick={() => act(() => resendPaymentRequest(r.id), 'Email sent')}><Send className="h-4 w-4" /></Button>}
                    {r.status !== 'PAID' && <Button size="icon" variant="ghost" className="h-7 w-7 text-success" title="Mark paid" disabled={pending} onClick={() => act(() => setPaymentRequestStatus(r.id, 'PAID'), 'Marked paid')}><Check className="h-4 w-4" /></Button>}
                    {r.status !== 'CANCELLED' && <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="Cancel" disabled={pending} onClick={() => act(() => setPaymentRequestStatus(r.id, 'CANCELLED'), 'Cancelled')}><Ban className="h-4 w-4" /></Button>}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
          <DialogHeader><DialogTitle>Request a payment</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label htmlFor="payeeName">Payee name *</Label><Input id="payeeName" name="payeeName" required /></div>
              <div className="space-y-1"><Label htmlFor="amount">Amount (₹) *</Label><Input id="amount" name="amount" type="number" min="1" step="0.01" required placeholder="1000000" /></div>
              <div className="space-y-1"><Label htmlFor="payeeEmail">Email</Label><Input id="payeeEmail" name="payeeEmail" type="email" placeholder="they get the notification here" /></div>
              <div className="space-y-1"><Label htmlFor="payeePhone">Phone</Label><Input id="payeePhone" name="payeePhone" placeholder="for WhatsApp" /></div>
              <div className="space-y-1"><Label htmlFor="dueDate">Due date</Label><Input id="dueDate" name="dueDate" type="date" /></div>
              <div className="space-y-1"><Label htmlFor="customerId">Link to buyer</Label>
                <select id="customerId" name="customerId" defaultValue="" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">—</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            </div>
            <div className="space-y-1"><Label htmlFor="description">What is this payment for? *</Label><Textarea id="description" name="description" rows={3} required placeholder="e.g. Interior fit-out work — Phase 1 milestone" /></div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Create &amp; send</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={cfg} onOpenChange={setCfg}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Payment details</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); start(async () => { const r = await savePaymentInstructions(String(fd.get('text') || '')); if ('error' in r) return toast.error(r.error); toast.success('Saved'); setCfg(false); router.refresh(); }); }} className="space-y-3">
            <p className="text-xs text-muted-foreground">Shown on every payment page and included in the email — bank account, IFSC, UPI ID, etc.</p>
            <Textarea name="text" rows={7} defaultValue={instructions} placeholder={'Account: Ameya Heights LLP\nBank: ...\nA/c No: ...\nIFSC: ...\nUPI: ameyaheights@upi'} />
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setCfg(false)}>Cancel</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Save</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
