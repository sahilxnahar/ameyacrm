'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, Check, X } from 'lucide-react';
import { createInvoice, createPurchaseOrder, createVendorBill, createVendor, decidePurchaseOrder } from '@/server/actions/billing';
import { Button } from '@/components/ui/button';
import { AiBillImport } from './ai-bill-import';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatDate, titleCase } from '@/lib/utils/format';

interface Opt { id: string; name: string }
interface Vendor { id: string; name: string; gstin: string | null; email: string | null; phone: string | null }
const selectCls = 'flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm';
function statusVariant(s: string) { return s === 'PAID' || s === 'APPROVED' ? 'success' : ['OVERDUE', 'VOID', 'CANCELLED', 'REJECTED'].includes(s) ? 'destructive' : s === 'DRAFT' ? 'secondary' : s === 'PENDING_APPROVAL' ? 'warning' : 'default'; }

type DialogKind = 'invoice' | 'po' | 'bill' | 'vendor' | null;

export function BillingView({ invoices, pos, bills, vendors, projects, approvers, canApprove, geminiEnabled }: {
  invoices: { id: string; number: string; client: string; status: string; total: number; project: string | null; dueDate: string | null }[];
  pos: { id: string; number: string; vendor: string; status: string; total: number; needsMyApproval: boolean }[];
  bills: { id: string; number: string; vendor: string; status: string; amount: number }[];
  vendors: Vendor[]; projects: Opt[]; approvers: Opt[]; canApprove: boolean; geminiEnabled: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState<DialogKind>(null);
  const [pending, start] = React.useTransition();
  const [invItems, setInvItems] = React.useState([{ description: '', quantity: '1', rate: '', gstRate: '18' }]);
  const [poItems, setPoItems] = React.useState([{ description: '', quantity: '1', unit: 'nos', rate: '', gstRate: '18' }]);
  const [approverIds, setApproverIds] = React.useState<string[]>([]);
  const close = () => setOpen(null);

  const run = (fn: () => Promise<{ ok: true; id: string } | { error: string }>, ok: string) =>
    start(async () => { const r = await fn(); if ('error' in r) return toast.error(r.error); toast.success(ok); close(); router.refresh(); });
  const decide = (id: string, decision: 'APPROVED' | 'REJECTED') =>
    start(async () => { const r = await decidePurchaseOrder(id, decision); if ('error' in r) return toast.error(r.error); toast.success(`PO ${decision.toLowerCase()}`); router.refresh(); });

  const submitInvoice = (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); const fd = new FormData(e.currentTarget);
    run(() => createInvoice({ clientName: fd.get('clientName'), clientGstin: fd.get('clientGstin'), projectId: fd.get('projectId') || null, dueDate: fd.get('dueDate') || null, notes: fd.get('notes'), intraState: fd.get('intraState') === 'on', items: invItems.filter((i) => i.description).map((i) => ({ description: i.description, quantity: Number(i.quantity), rate: Number(i.rate), gstRate: Number(i.gstRate) })) }), 'Invoice created'); };
  const submitPO = (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); const fd = new FormData(e.currentTarget);
    run(() => createPurchaseOrder({ vendorId: fd.get('vendorId') || null, projectId: fd.get('projectId') || null, expectedAt: fd.get('expectedAt') || null, notes: fd.get('notes'), approverIds, items: poItems.filter((i) => i.description).map((i) => ({ description: i.description, quantity: Number(i.quantity), unit: i.unit, rate: Number(i.rate), gstRate: Number(i.gstRate) })) }), 'PO created'); };
  const submitBill = (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); const fd = new FormData(e.currentTarget);
    run(() => createVendorBill({ number: fd.get('number'), vendorId: fd.get('vendorId') || null, amount: fd.get('amount'), gstAmount: fd.get('gstAmount') || 0, billDate: fd.get('billDate') || null, dueDate: fd.get('dueDate') || null }), 'Vendor bill recorded'); };
  const submitVendor = (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); const fd = new FormData(e.currentTarget);
    run(() => createVendor({ name: fd.get('name'), gstin: fd.get('gstin'), email: fd.get('email'), phone: fd.get('phone'), address: fd.get('address') }), 'Vendor added'); };

  return (
    <Tabs defaultValue="invoices">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <TabsList><TabsTrigger value="invoices">Invoices</TabsTrigger><TabsTrigger value="pos">Purchase Orders</TabsTrigger><TabsTrigger value="bills">Vendor Bills</TabsTrigger><TabsTrigger value="vendors">Vendors</TabsTrigger></TabsList>
        <div className="flex gap-2">
          <AiBillImport geminiEnabled={geminiEnabled} projects={projects} />
          <Button size="sm" variant="outline" onClick={() => setOpen('vendor')}><Plus className="h-4 w-4" /> Vendor</Button>
          <Button size="sm" variant="outline" onClick={() => setOpen('bill')}><Plus className="h-4 w-4" /> Bill</Button>
          <Button size="sm" variant="outline" onClick={() => setOpen('po')}><Plus className="h-4 w-4" /> PO</Button>
          <Button size="sm" onClick={() => setOpen('invoice')}><Plus className="h-4 w-4" /> Invoice</Button>
        </div>
      </div>

      <TabsContent value="invoices">
        <Card><Table>
          <TableHeader><TableRow><TableHead>Number</TableHead><TableHead>Client</TableHead><TableHead>Project</TableHead><TableHead>Due</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
          <TableBody>
            {invoices.length === 0 && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No invoices yet.</TableCell></TableRow>}
            {invoices.map((i) => (<TableRow key={i.id}><TableCell><a href={`/api/billing/invoices/${i.id}/pdf`} target="_blank" rel="noreferrer" className="font-mono text-xs text-primary underline-offset-2 hover:underline">{i.number}</a></TableCell><TableCell className="font-medium">{i.client}</TableCell><TableCell className="text-sm text-muted-foreground">{i.project ?? '—'}</TableCell><TableCell className="text-sm">{formatDate(i.dueDate)}</TableCell><TableCell><Badge variant={statusVariant(i.status) as never}>{titleCase(i.status)}</Badge></TableCell><TableCell className="text-right font-medium tabular-nums">{formatCurrency(i.total)}</TableCell></TableRow>))}
          </TableBody>
        </Table></Card>
      </TabsContent>

      <TabsContent value="pos">
        <Card><Table>
          <TableHeader><TableRow><TableHead>Number</TableHead><TableHead>Vendor</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {pos.length === 0 && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No purchase orders yet.</TableCell></TableRow>}
            {pos.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">{p.number}</TableCell><TableCell>{p.vendor}</TableCell>
                <TableCell><Badge variant={statusVariant(p.status) as never}>{titleCase(p.status)}</Badge></TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(p.total)}</TableCell>
                <TableCell>{canApprove && p.needsMyApproval && (<div className="flex gap-1"><Button size="icon" variant="ghost" className="h-7 w-7 text-success" onClick={() => decide(p.id, 'APPROVED')}><Check className="h-4 w-4" /></Button><Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => decide(p.id, 'REJECTED')}><X className="h-4 w-4" /></Button></div>)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table></Card>
      </TabsContent>

      <TabsContent value="bills">
        <Card><Table>
          <TableHeader><TableRow><TableHead>Number</TableHead><TableHead>Vendor</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
          <TableBody>
            {bills.length === 0 && <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No vendor bills yet.</TableCell></TableRow>}
            {bills.map((b) => (<TableRow key={b.id}><TableCell className="font-mono text-xs">{b.number}</TableCell><TableCell>{b.vendor}</TableCell><TableCell><Badge variant={statusVariant(b.status) as never}>{titleCase(b.status)}</Badge></TableCell><TableCell className="text-right tabular-nums">{formatCurrency(b.amount)}</TableCell></TableRow>))}
          </TableBody>
        </Table></Card>
      </TabsContent>

      <TabsContent value="vendors">
        <Card><Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>GSTIN</TableHead><TableHead>Email</TableHead><TableHead>Phone</TableHead></TableRow></TableHeader>
          <TableBody>
            {vendors.length === 0 && <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No vendors yet.</TableCell></TableRow>}
            {vendors.map((v) => (<TableRow key={v.id}><TableCell className="font-medium">{v.name}</TableCell><TableCell className="font-mono text-xs text-muted-foreground">{v.gstin ?? '—'}</TableCell><TableCell className="text-sm">{v.email ?? '—'}</TableCell><TableCell className="text-sm">{v.phone ?? '—'}</TableCell></TableRow>))}
          </TableBody>
        </Table></Card>
      </TabsContent>

      {/* Invoice dialog */}
      <Dialog open={open === 'invoice'} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>New invoice</DialogTitle></DialogHeader>
          <form onSubmit={submitInvoice} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="clientName">Client</Label><Input id="clientName" name="clientName" required /></div>
              <div className="space-y-2"><Label htmlFor="clientGstin">Client GSTIN</Label><Input id="clientGstin" name="clientGstin" /></div>
              <div className="space-y-2"><Label htmlFor="projectId">Project</Label><select id="projectId" name="projectId" className={selectCls} defaultValue=""><option value="">—</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              <div className="space-y-2"><Label htmlFor="dueDate">Due date</Label><Input id="dueDate" name="dueDate" type="date" /></div>
            </div>
            <div className="space-y-2"><Label>Line items</Label>
              {invItems.map((it, idx) => (<div key={idx} className="flex gap-2">
                <Input className="flex-[3]" placeholder="Description" value={it.description} onChange={(e) => setInvItems((p) => p.map((x, i) => i === idx ? { ...x, description: e.target.value } : x))} />
                <Input className="w-16" placeholder="Qty" type="number" value={it.quantity} onChange={(e) => setInvItems((p) => p.map((x, i) => i === idx ? { ...x, quantity: e.target.value } : x))} />
                <Input className="w-24" placeholder="Rate" type="number" value={it.rate} onChange={(e) => setInvItems((p) => p.map((x, i) => i === idx ? { ...x, rate: e.target.value } : x))} />
                <Input className="w-16" placeholder="GST%" type="number" value={it.gstRate} onChange={(e) => setInvItems((p) => p.map((x, i) => i === idx ? { ...x, gstRate: e.target.value } : x))} />
                <Button type="button" variant="ghost" size="icon" onClick={() => setInvItems((p) => p.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></Button>
              </div>))}
              <Button type="button" variant="outline" size="sm" onClick={() => setInvItems((p) => [...p, { description: '', quantity: '1', rate: '', gstRate: '18' }])}><Plus className="h-4 w-4" /> Add line</Button>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="intraState" defaultChecked className="accent-[hsl(var(--primary))]" /> Intra-state (CGST + SGST)</label>
            <div className="space-y-2"><Label htmlFor="notes">Notes</Label><Input id="notes" name="notes" /></div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={close}>Cancel</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Create invoice</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      {/* PO dialog */}
      <Dialog open={open === 'po'} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>New purchase order</DialogTitle></DialogHeader>
          <form onSubmit={submitPO} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="povendor">Vendor</Label><select id="povendor" name="vendorId" className={selectCls} defaultValue=""><option value="">—</option>{vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></div>
              <div className="space-y-2"><Label htmlFor="poproject">Project</Label><select id="poproject" name="projectId" className={selectCls} defaultValue=""><option value="">—</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              <div className="space-y-2"><Label htmlFor="expectedAt">Expected</Label><Input id="expectedAt" name="expectedAt" type="date" /></div>
            </div>
            <div className="space-y-2"><Label>Line items</Label>
              {poItems.map((it, idx) => (<div key={idx} className="flex gap-2">
                <Input className="flex-[3]" placeholder="Description" value={it.description} onChange={(e) => setPoItems((p) => p.map((x, i) => i === idx ? { ...x, description: e.target.value } : x))} />
                <Input className="w-14" placeholder="Qty" type="number" value={it.quantity} onChange={(e) => setPoItems((p) => p.map((x, i) => i === idx ? { ...x, quantity: e.target.value } : x))} />
                <Input className="w-16" placeholder="Unit" value={it.unit} onChange={(e) => setPoItems((p) => p.map((x, i) => i === idx ? { ...x, unit: e.target.value } : x))} />
                <Input className="w-24" placeholder="Rate" type="number" value={it.rate} onChange={(e) => setPoItems((p) => p.map((x, i) => i === idx ? { ...x, rate: e.target.value } : x))} />
                <Input className="w-14" placeholder="GST%" type="number" value={it.gstRate} onChange={(e) => setPoItems((p) => p.map((x, i) => i === idx ? { ...x, gstRate: e.target.value } : x))} />
                <Button type="button" variant="ghost" size="icon" onClick={() => setPoItems((p) => p.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></Button>
              </div>))}
              <Button type="button" variant="outline" size="sm" onClick={() => setPoItems((p) => [...p, { description: '', quantity: '1', unit: 'nos', rate: '', gstRate: '18' }])}><Plus className="h-4 w-4" /> Add line</Button>
            </div>
            <div className="space-y-2"><Label>Approvers (optional)</Label>
              <div className="flex flex-wrap gap-2">{approvers.map((a) => (<label key={a.id} className={`cursor-pointer rounded-full border px-3 py-1 text-xs ${approverIds.includes(a.id) ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground'}`}><input type="checkbox" className="hidden" checked={approverIds.includes(a.id)} onChange={(e) => setApproverIds((p) => e.target.checked ? [...p, a.id] : p.filter((id) => id !== a.id))} />{a.name}</label>))}</div>
            </div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={close}>Cancel</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Create PO</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Vendor bill dialog */}
      <Dialog open={open === 'bill'} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Record vendor bill</DialogTitle></DialogHeader>
          <form onSubmit={submitBill} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="bnumber">Bill number</Label><Input id="bnumber" name="number" required /></div>
              <div className="space-y-2"><Label htmlFor="bvendor">Vendor</Label><select id="bvendor" name="vendorId" className={selectCls} defaultValue=""><option value="">—</option>{vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></div>
              <div className="space-y-2"><Label htmlFor="bamount">Amount (₹)</Label><Input id="bamount" name="amount" type="number" required /></div>
              <div className="space-y-2"><Label htmlFor="bgst">GST (₹)</Label><Input id="bgst" name="gstAmount" type="number" /></div>
              <div className="space-y-2"><Label htmlFor="bbilldate">Bill date</Label><Input id="bbilldate" name="billDate" type="date" /></div>
              <div className="space-y-2"><Label htmlFor="bdue">Due date</Label><Input id="bdue" name="dueDate" type="date" /></div>
            </div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={close}>Cancel</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Record</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Vendor dialog */}
      <Dialog open={open === 'vendor'} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>New vendor</DialogTitle></DialogHeader>
          <form onSubmit={submitVendor} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="vname">Name</Label><Input id="vname" name="name" required /></div>
              <div className="space-y-2"><Label htmlFor="vgstin">GSTIN</Label><Input id="vgstin" name="gstin" /></div>
              <div className="space-y-2"><Label htmlFor="vemail">Email</Label><Input id="vemail" name="email" type="email" /></div>
              <div className="space-y-2"><Label htmlFor="vphone">Phone</Label><Input id="vphone" name="phone" /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="vaddress">Address</Label><Input id="vaddress" name="address" /></div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={close}>Cancel</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Add vendor</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
