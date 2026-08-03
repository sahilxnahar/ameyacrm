'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, Check, X, Pencil, Paperclip, FileDown, ExternalLink } from 'lucide-react';
import { createInvoice, createPurchaseOrder, createVendorBill, createVendor, decidePurchaseOrder, issueInvoice, settleVendorBill, updateVendorBill, voidVendorBill, deleteInvoice } from '@/server/actions/billing';
import { UniversalUploader } from '@/components/shared/universal-uploader';
import { VendorPortalLink } from './vendor-portal-link';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Button } from '@/components/ui/button';
import { AiBillImport } from './ai-bill-import';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Monogram, statusAccent, RecordList } from '@/components/shared/record-row';
import { cn } from '@/lib/utils/cn';
import { formatCurrency, formatDate, titleCase } from '@/lib/utils/format';

interface Opt { id: string; name: string }
interface Vendor {
  id: string; name: string; gstin: string | null; pan: string | null;
  email: string | null; phone: string | null; address: string | null;
  bankAccountName: string | null; bankAccountNumber: string | null; bankIfsc: string | null;
  bankName: string | null; bankBranch: string | null; upiId: string | null; paymentNotes: string | null;
}
export interface Bill {
  id: string; number: string; vendor: string; status: string; amount: number;
  vendorId: string | null; gstAmount: number; billDate: string | null; dueDate: string | null;
  attachmentUrl: string | null; attachmentName: string | null; notes: string | null;
  /** The payment raised against this bill, if there is one. */
  paidVoucher: string | null; paidOn: string | null; paidStatus: string | null;
}
const selectCls = 'flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm';
function statusVariant(s: string) { return s === 'PAID' || s === 'APPROVED' ? 'success' : ['OVERDUE', 'VOID', 'CANCELLED', 'REJECTED'].includes(s) ? 'destructive' : s === 'DRAFT' ? 'secondary' : s === 'PENDING_APPROVAL' ? 'warning' : 'default'; }

type DialogKind = 'invoice' | 'po' | 'bill' | 'vendor' | 'void' | 'killInvoice' | null;

export function BillingView({ invoices, pos, bills, vendors, projects, approvers, canApprove, canManage, geminiEnabled }: {
  invoices: { id: string; number: string; client: string; status: string; total: number; project: string | null; dueDate: string | null }[];
  pos: { id: string; number: string; vendor: string; status: string; total: number; needsMyApproval: boolean }[];
  bills: Bill[];
  vendors: Vendor[]; projects: Opt[]; approvers: Opt[]; canApprove: boolean; canManage: boolean; geminiEnabled: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState<DialogKind>(null);
  const [pending, start] = React.useTransition();
  // Which row is working. A single shared `pending` put a spinner on every
  // Issue and every Pay button on the screen when one of them was clicked.
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [payTarget, setPayTarget] = React.useState<{ id: string; number: string; vendor: string; amount: number } | null>(null);
  const [invItems, setInvItems] = React.useState([{ description: '', quantity: '1', rate: '', gstRate: '18' }]);
  const [poItems, setPoItems] = React.useState([{ description: '', quantity: '1', unit: 'nos', rate: '', gstRate: '18' }]);
  const [approverIds, setApproverIds] = React.useState<string[]>([]);
  // One dialog serves both "record a new bill" and "correct this one", so closing
  // has to clear the row being worked on too. Leaving `editingBill` set after a
  // save meant the next "+ Bill" opened pre-filled with the bill you just
  // corrected, and saving that silently overwrote it a second time.
  const [editingBill, setEditingBill] = React.useState<Bill | null>(null);
  const [voidTarget, setVoidTarget] = React.useState<Bill | null>(null);
  // The supplier's own paperwork, carried on the bill so an approval is never
  // made against a figure nobody can check.
  const [attach, setAttach] = React.useState<{ url: string; name: string } | null>(null);
  const [killTarget, setKillTarget] = React.useState<{ id: string; number: string; client: string; status: string } | null>(null);
  const close = () => { setOpen(null); setEditingBill(null); setVoidTarget(null); setKillTarget(null); setAttach(null); };

  const run = (fn: () => Promise<{ ok: true; id: string } | { error: string }>, ok: string) =>
    start(async () => { const r = await fn(); if ('error' in r) { toast.error(r.error); return; } toast.success(ok); close(); router.refresh(); });
  // Issuing is what puts the sale in the books, so it is a deliberate second
  // step rather than something that happens quietly when the invoice is saved.
  const issue = (id: string, number: string) => {
    setBusyId(id);
    start(async () => {
      const r = await issueInvoice(id);
      setBusyId(null);
      if ('error' in r) { toast.error(r.error); return; }
      toast.success(`${number} issued — posted to the ledger`); router.refresh();
    });
  };
  // Paying a bill from here is what clears the payable. Recording the same
  // payment as a loose expense voucher instead books the cost a second time and
  // leaves the creditor standing.
  const payBill = (id: string, number: string) => {
    setBusyId(id);
    start(async () => {
      const r = await settleVendorBill({ billId: id, mode: 'BANK_TRANSFER' });
      setBusyId(null); setPayTarget(null);
      if ('error' in r) { toast.error(r.error); return; }
      toast.success(`${number} settled`); router.refresh();
    });
  };
  const decide = (id: string, decision: 'APPROVED' | 'REJECTED') =>
    start(async () => { const r = await decidePurchaseOrder(id, decision); if ('error' in r) { toast.error(r.error); return; } toast.success(`PO ${decision.toLowerCase()}`); router.refresh(); });

  const submitInvoice = (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); const fd = new FormData(e.currentTarget);
    run(() => createInvoice({ clientName: fd.get('clientName'), clientGstin: fd.get('clientGstin'), projectId: fd.get('projectId') || null, dueDate: fd.get('dueDate') || null, notes: fd.get('notes'), intraState: fd.get('intraState') === 'on', items: invItems.filter((i) => i.description).map((i) => ({ description: i.description, quantity: Number(i.quantity), rate: Number(i.rate), gstRate: Number(i.gstRate) })) }), 'Invoice created'); };
  const submitPO = (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); const fd = new FormData(e.currentTarget);
    run(() => createPurchaseOrder({ vendorId: fd.get('vendorId') || null, projectId: fd.get('projectId') || null, expectedAt: fd.get('expectedAt') || null, notes: fd.get('notes'), approverIds, items: poItems.filter((i) => i.description).map((i) => ({ description: i.description, quantity: Number(i.quantity), unit: i.unit, rate: Number(i.rate), gstRate: Number(i.gstRate) })) }), 'PO created'); };
  // A bill typed with the wrong figure used to be permanent: there was no edit and
  // no void, so the only way out was a second bill to cancel the first, which
  // leaves two wrong numbers in the payables ledger instead of one.
  const submitBill = (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); const fd = new FormData(e.currentTarget);
    const d = {
      number: fd.get('number'), vendorId: fd.get('vendorId') || null,
      amount: fd.get('amount'), gstAmount: fd.get('gstAmount') || 0,
      billDate: fd.get('billDate') || null, dueDate: fd.get('dueDate') || null,
      notes: fd.get('notes') || null,
      attachmentUrl: attach?.url ?? editingBill?.attachmentUrl ?? null,
      attachmentName: attach?.name ?? editingBill?.attachmentName ?? null,
    };
    run(
      () => editingBill ? updateVendorBill({ ...d, billId: editingBill.id }) : createVendorBill(d),
      editingBill ? 'Bill corrected — the ledger has been re-posted' : 'Vendor bill recorded',
    ); };
  const submitKillInvoice = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const reason = String(new FormData(e.currentTarget).get('reason') ?? '');
    if (!killTarget) return;
    const id = killTarget.id;
    const wasDraft = killTarget.status === 'DRAFT';
    run(() => deleteInvoice(id, reason), wasDraft ? 'Draft invoice deleted' : 'Invoice voided and the ledger reversed');
  };
  const submitVoid = (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); const fd = new FormData(e.currentTarget);
    const reason = String(fd.get('reason') ?? '');
    if (!voidTarget) return;
    const id = voidTarget.id;
    run(() => voidVendorBill(id, reason), 'Bill voided'); };
  const [editingVendor, setEditingVendor] = React.useState<Vendor | null>(null);
  const submitVendor = (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); const fd = new FormData(e.currentTarget);
    run(() => createVendor({
      id: editingVendor?.id ?? '',
      name: fd.get('name'), gstin: fd.get('gstin'), pan: fd.get('pan'),
      email: fd.get('email'), phone: fd.get('phone'), address: fd.get('address'),
      bankAccountName: fd.get('bankAccountName'), bankAccountNumber: fd.get('bankAccountNumber'),
      bankIfsc: fd.get('bankIfsc'), bankName: fd.get('bankName'), bankBranch: fd.get('bankBranch'),
      upiId: fd.get('upiId'), paymentNotes: fd.get('paymentNotes'),
    }), editingVendor ? 'Vendor updated' : 'Vendor added'); };

  return (
    <>
    <ConfirmDialog
      open={payTarget !== null}
      title={`Pay ${payTarget?.number ?? ''}?`}
      body={payTarget ? `This records a bank payment of ${formatCurrency(payTarget.amount)} to ${payTarget.vendor}, clears what you owe on this bill, and posts it to the ledger. Every other money action asks first; so does this one.` : ''}
      confirmLabel="Record the payment"
      pending={pending}
      onCancel={() => setPayTarget(null)}
      onConfirm={() => { if (payTarget) payBill(payTarget.id, payTarget.number); }}
    />
    <Tabs defaultValue="invoices">
      <div className="mb-4 toolbar items-center gap-2">
        <TabsList><TabsTrigger value="invoices">Invoices</TabsTrigger><TabsTrigger value="pos">Purchase Orders</TabsTrigger><TabsTrigger value="bills">Vendor Bills</TabsTrigger><TabsTrigger value="vendors">Vendors</TabsTrigger></TabsList>
        {/* Shown only to somebody who can actually save. These were rendered
            unconditionally, so a Department Head or Manager filled in the whole
            dialog and was told "You do not have permission to do that" at the
            end — the worst possible moment to find out. */}
        {canManage ? (
          <div className="flex gap-2">
            <AiBillImport geminiEnabled={geminiEnabled} projects={projects} />
            <Button size="sm" variant="outline" onClick={() => { setEditingVendor(null); setOpen('vendor'); }}><Plus className="h-4 w-4" /> Vendor</Button>
            <Button size="sm" variant="outline" onClick={() => setOpen('bill')}><Plus className="h-4 w-4" /> Bill</Button>
            <Button size="sm" variant="outline" onClick={() => setOpen('po')}><Plus className="h-4 w-4" /> PO</Button>
            <Button size="sm" onClick={() => setOpen('invoice')}><Plus className="h-4 w-4" /> Invoice</Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">You can see billing but not raise anything here — ask an administrator for billing rights.</p>
        )}
      </div>

      <TabsContent value="invoices">
        <RecordList empty="No invoices yet.">
          {invoices.map((i) => (
            <div
              key={i.id}
              className={cn('flex items-center gap-3 border-b border-l-2 px-3 py-2.5 transition-colors last:border-b-0 hover:bg-muted/40', statusAccent(i.status))}
            >
              <a
                href={`/api/billing/invoices/${i.id}/pdf`}
                target="_blank"
                rel="noreferrer"
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <Monogram name={i.client} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{i.client}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    <span className="font-mono">{i.number}</span>{i.project ? ` · ${i.project}` : ''}{i.dueDate ? ` · due ${formatDate(i.dueDate)}` : ''}
                  </div>
                </div>
              </a>
              {i.status === 'DRAFT' && (
                <Button size="sm" variant="outline" className="h-7 shrink-0 px-2 text-xs" disabled={pending && busyId === i.id} onClick={() => issue(i.id, i.number)}>
                  {pending && busyId === i.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Issue'}
                </Button>
              )}
              {canManage && i.status !== 'VOID' && (
                <Button
                  size="sm" variant="ghost" className="h-7 shrink-0 px-2 text-xs text-destructive"
                  title={i.status === 'DRAFT' ? 'Delete this draft' : 'Void this invoice and reverse the ledger'}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setKillTarget({ id: i.id, number: i.number, client: i.client, status: i.status }); setOpen('killInvoice'); }}
                >
                  <Trash2 className="h-3 w-3" /> {i.status === 'DRAFT' ? 'Delete' : 'Void'}
                </Button>
              )}
              <Badge variant={statusVariant(i.status) as never} className="shrink-0">{titleCase(i.status)}</Badge>
              <div className="w-24 shrink-0 text-right font-medium tabular-nums">{formatCurrency(i.total)}</div>
            </div>
          ))}
        </RecordList>
      </TabsContent>

      <TabsContent value="pos">
        <RecordList empty="No purchase orders yet.">
          {pos.map((p) => (
            <div key={p.id} className={cn('flex items-center gap-3 border-b border-l-2 px-3 py-2.5 last:border-b-0', statusAccent(p.status), p.needsMyApproval && 'bg-amber-500/5')}>
              <Monogram name={p.vendor} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{p.vendor}</div>
                <div className="truncate font-mono text-xs text-muted-foreground">{p.number}</div>
              </div>
              <Badge variant={statusVariant(p.status) as never} className="shrink-0">{titleCase(p.status)}</Badge>
              <div className="w-24 shrink-0 text-right tabular-nums">{formatCurrency(p.total)}</div>
              <div className="w-16 shrink-0">
                {canApprove && p.needsMyApproval && (
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-success" onClick={() => decide(p.id, 'APPROVED')}><Check className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => decide(p.id, 'REJECTED')}><X className="h-4 w-4" /></Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </RecordList>
      </TabsContent>

      <TabsContent value="bills">
        <RecordList empty="No vendor bills yet.">
          {bills.map((b) => (
            <div key={b.id} className={cn('flex items-center gap-3 border-b border-l-2 px-3 py-2.5 last:border-b-0', statusAccent(b.status))}>
              <Monogram name={b.vendor} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{b.vendor}</div>
                <div className="truncate text-xs text-muted-foreground">
                  <span className="font-mono">{b.number}</span>
                  {b.notes ? ` · ${b.notes}` : ''}
                  {b.paidVoucher
                    ? <span className="ml-1 text-success">· paid {b.paidOn ? formatDate(b.paidOn) : ''} ({b.paidVoucher})</span>
                    : <span className="ml-1">· not yet paid</span>}
                </div>
              </div>
              {b.attachmentUrl && (
                <a href={b.attachmentUrl} target="_blank" rel="noreferrer" title={b.attachmentName ?? "The supplier's own bill"}
                   className="focus-ring inline-flex h-7 shrink-0 items-center gap-1 rounded border px-2 text-xs text-muted-foreground hover:bg-secondary">
                  <Paperclip className="h-3 w-3" /> Their bill
                </a>
              )}
              <a href={`/api/billing/bills/${b.id}/pdf`} target="_blank" rel="noreferrer" title="Download this bill as a PDF"
                 className="focus-ring inline-flex h-7 shrink-0 items-center gap-1 rounded border px-2 text-xs text-muted-foreground hover:bg-secondary">
                <FileDown className="h-3 w-3" /> PDF
              </a>
              {canManage && b.status !== 'PAID' && b.status !== 'VOID' && (
                <>
                  <Button size="sm" variant="ghost" className="h-7 shrink-0 px-2 text-xs" onClick={() => { setEditingBill(b); setAttach(null); setOpen('bill'); }}>
                    <Pencil className="h-3 w-3" /> Edit
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 shrink-0 px-2 text-xs text-destructive" onClick={() => { setVoidTarget(b); setOpen('void'); }}>
                    Void
                  </Button>
                </>
              )}
              {b.status !== 'PAID' && b.status !== 'VOID' && (
                <Button size="sm" variant="outline" className="h-7 shrink-0 px-2 text-xs" disabled={pending && busyId === b.id} onClick={() => setPayTarget({ id: b.id, number: b.number, vendor: b.vendor, amount: b.amount })}>
                  {pending && busyId === b.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Pay'}
                </Button>
              )}
              <Badge variant={statusVariant(b.status) as never} className="shrink-0">{titleCase(b.status)}</Badge>
              <div className="w-24 shrink-0 text-right tabular-nums">{formatCurrency(b.amount)}</div>
            </div>
          ))}
        </RecordList>
      </TabsContent>

      <TabsContent value="vendors">
        <Card><Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>GSTIN</TableHead><TableHead>Email</TableHead><TableHead>Where you pay them</TableHead><TableHead>Portal</TableHead></TableRow></TableHeader>
          <TableBody>
            {vendors.length === 0 && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No vendors yet.</TableCell></TableRow>}
            {vendors.map((v) => (
              <TableRow key={v.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setEditingVendor(v); setOpen('vendor'); }}>
                <TableCell className="font-medium">{v.name}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{v.gstin ?? '—'}</TableCell>
                <TableCell className="text-sm">{v.email ?? '—'}</TableCell>
                <TableCell className="text-sm">
                  {v.bankAccountNumber
                    ? <span className="font-mono text-xs">{v.bankName ?? 'Bank'} ••{v.bankAccountNumber.slice(-4)} · {v.bankIfsc}</span>
                    : v.upiId
                      ? <span className="font-mono text-xs">{v.upiId}</span>
                      : <span className="text-xs text-amber-700 dark:text-amber-500">No bank details</span>}
                </TableCell>
                <TableCell><VendorPortalLink vendorId={v.id} /></TableCell>
              </TableRow>
            ))}
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
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingBill ? `Correct ${editingBill.number}` : 'Record vendor bill'}</DialogTitle></DialogHeader>
          <form onSubmit={submitBill} className="space-y-4" key={editingBill?.id ?? 'new'}>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="bnumber">Bill number</Label><Input id="bnumber" name="number" required defaultValue={editingBill?.number ?? ''} /></div>
              <div className="space-y-2"><Label htmlFor="bvendor">Vendor</Label><select id="bvendor" name="vendorId" className={selectCls} defaultValue={editingBill?.vendorId ?? ''}><option value="">—</option>{vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></div>
              <div className="space-y-2"><Label htmlFor="bamount">Amount (₹)</Label><Input id="bamount" name="amount" type="number" required defaultValue={editingBill?.amount ?? ''} /></div>
              <div className="space-y-2"><Label htmlFor="bgst">GST (₹)</Label><Input id="bgst" name="gstAmount" type="number" defaultValue={editingBill?.gstAmount ?? ''} /></div>
              <div className="space-y-2"><Label htmlFor="bbilldate">Bill date</Label><Input id="bbilldate" name="billDate" type="date" defaultValue={editingBill?.billDate ?? ''} /></div>
              <div className="space-y-2"><Label htmlFor="bdue">Due date</Label><Input id="bdue" name="dueDate" type="date" defaultValue={editingBill?.dueDate ?? ''} /></div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bnotes">What it is for</Label>
              <Input id="bnotes" name="notes" placeholder="Borewell pump — Tower B" defaultValue={editingBill?.notes ?? ''} />
            </div>
            <div className="space-y-2">
              <Label>The supplier&rsquo;s own bill</Label>
              <p className="text-xs text-muted-foreground">
                Attach the PDF or a photograph. Anyone approving the payment can then see the paperwork
                the figure came from, instead of taking it on trust.
              </p>
              {(attach || editingBill?.attachmentUrl) && (
                <p className="flex items-center gap-2 rounded-md border bg-muted/40 p-2 text-xs">
                  <Paperclip className="h-3.5 w-3.5 shrink-0 text-brass" />
                  <span className="min-w-0 flex-1 truncate">{attach?.name ?? editingBill?.attachmentName ?? 'Attached'}</span>
                  <a href={attach?.url ?? editingBill?.attachmentUrl ?? '#'} target="_blank" rel="noreferrer"
                     className="inline-flex items-center gap-1 text-brass hover:underline">
                    <ExternalLink className="h-3 w-3" /> Open
                  </a>
                </p>
              )}
              <UniversalUploader
                compact
                preview={false}
                label="Drop the bill here, or click to browse"
                hint="PDF, JPEG or PNG"
                onUploaded={(f) => setAttach({ url: f.url, name: f.name })}
              />
            </div>
            {editingBill && (
              <p className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                Saving reverses what this bill posted to the ledger and posts the corrected figure. The old entry stays
                visible with its reversal, because a journal entry is never edited in place. If a payment has already been
                raised against it, withdraw that first.
              </p>
            )}
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={close}>Cancel</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}{editingBill ? 'Save correction' : 'Record'}</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Removing an invoice.
          A draft that was never issued is deleted outright. One that HAS been
          issued is voided instead: it keeps its number, is marked void and its
          ledger entry is reversed. Deleting an issued invoice would leave a hole
          in a numbered series, which is exactly what a GST audit looks for. */}
      <Dialog open={open === 'killInvoice'} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {killTarget?.status === 'DRAFT' ? `Delete draft ${killTarget?.number}?` : `Void ${killTarget?.number}?`}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={submitKillInvoice} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {killTarget?.status === 'DRAFT'
                ? `This draft was never issued, so it is removed completely. ${killTarget?.client ?? ''} will see nothing.`
                : `${killTarget?.number} has been issued, so it keeps its number and is marked Void — deleting it outright would leave a gap in the invoice series. Whatever it posted to the ledger is reversed.`}
            </p>
            <div className="space-y-2">
              <Label htmlFor="killreason">Why</Label>
              <Input id="killreason" name="reason" required minLength={3} placeholder="Raised against the wrong client" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={close}>Cancel</Button>
              <Button type="submit" variant="destructive" disabled={pending}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                {killTarget?.status === 'DRAFT' ? 'Delete it' : 'Void it'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Void a bill — a reason is required, because "why is this bill gone" is the
          first question an auditor asks and the answer has to be in the record. */}
      <Dialog open={open === 'void'} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Void {voidTarget?.number ?? 'bill'}?</DialogTitle></DialogHeader>
          <form onSubmit={submitVoid} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The bill stays on file marked Void and what it posted to the ledger is reversed, so it stops counting as
              money you owe. Nothing is deleted.
            </p>
            <div className="space-y-2">
              <Label htmlFor="voidreason">Why</Label>
              <Input id="voidreason" name="reason" required minLength={3} placeholder="Duplicate of AH/24-25/119" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={close}>Cancel</Button>
              <Button type="submit" variant="destructive" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Void this bill</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Vendor dialog */}
      <Dialog open={open === 'vendor'} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editingVendor ? editingVendor.name : 'New vendor'}</DialogTitle></DialogHeader>
          <form onSubmit={submitVendor} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="vname">Name</Label><Input id="vname" name="name" required defaultValue={editingVendor?.name ?? ''} /></div>
              <div className="space-y-2"><Label htmlFor="vgstin">GSTIN</Label><Input id="vgstin" name="gstin" defaultValue={editingVendor?.gstin ?? ''} /></div>
              <div className="space-y-2"><Label htmlFor="vpan">PAN</Label><Input id="vpan" name="pan" defaultValue={editingVendor?.pan ?? ''} /></div>
              <div className="space-y-2"><Label htmlFor="vphone">Phone</Label><Input id="vphone" name="phone" defaultValue={editingVendor?.phone ?? ''} /></div>
              <div className="space-y-2"><Label htmlFor="vemail">Email</Label><Input id="vemail" name="email" type="email" defaultValue={editingVendor?.email ?? ''} /></div>
              <div className="space-y-2"><Label htmlFor="vaddress">Address</Label><Input id="vaddress" name="address" defaultValue={editingVendor?.address ?? ''} /></div>
            </div>

            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-sm font-medium">Bank details</p>
              <p className="mb-3 text-xs text-muted-foreground">
                Entered once here, so paying them later never means hunting for an account number again.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label htmlFor="vacname">Account name</Label><Input id="vacname" name="bankAccountName" placeholder="As printed on the cheque" defaultValue={editingVendor?.bankAccountName ?? ''} /></div>
                <div className="space-y-2"><Label htmlFor="vacno">Account number</Label><Input id="vacno" name="bankAccountNumber" inputMode="numeric" defaultValue={editingVendor?.bankAccountNumber ?? ''} /></div>
                <div className="space-y-2"><Label htmlFor="vifsc">IFSC</Label><Input id="vifsc" name="bankIfsc" placeholder="KKBK0000123" maxLength={11} className="font-mono uppercase" defaultValue={editingVendor?.bankIfsc ?? ''} /></div>
                <div className="space-y-2"><Label htmlFor="vbank">Bank</Label><Input id="vbank" name="bankName" placeholder="Kotak Mahindra Bank" defaultValue={editingVendor?.bankName ?? ''} /></div>
                <div className="space-y-2"><Label htmlFor="vbranch">Branch</Label><Input id="vbranch" name="bankBranch" defaultValue={editingVendor?.bankBranch ?? ''} /></div>
                <div className="space-y-2"><Label htmlFor="vupi">UPI ID</Label><Input id="vupi" name="upiId" placeholder="name@bank" defaultValue={editingVendor?.upiId ?? ''} /></div>
              </div>
              <div className="mt-4 space-y-2">
                <Label htmlFor="vpaynotes">Payment notes</Label>
                <Input id="vpaynotes" name="paymentNotes" placeholder="Pays against proforma only · always quote the PO number" defaultValue={editingVendor?.paymentNotes ?? ''} />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={close}>Cancel</Button>
              <Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}{editingVendor ? 'Save changes' : 'Add vendor'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Tabs>
    </>
  );
}
