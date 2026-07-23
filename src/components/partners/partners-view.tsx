'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Loader2, ShieldCheck, UserPlus, Wallet, Globe, Copy, ChevronDown } from 'lucide-react';
import { createChannelPartner, setPartnerStatus, setPartnerKyc, addBrokeragePayout, setPayoutStatus, registerCpLead, regenCpPortalToken } from '@/server/actions/partners';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface CP { id: string; code: string; firmName: string; contactName: string; phone: string; email: string | null; reraNumber: string | null; panNumber: string | null; gstin: string | null; commissionPct: number; kycStatus: string; status: string }
interface Payout { id: string; channelPartnerId: string; grossValue: number; ratePercent: number; amount: number; stage: string | null; status: string; dueDate: string | null }
interface Opt { id: string; name: string }
const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const money = (n: number) => `₹${inr.format(n)}`;
const kycTone = (s: string) => (s === 'VERIFIED' ? 'success' : s === 'REJECTED' ? 'destructive' : 'secondary') as 'success' | 'destructive' | 'secondary';
const stTone = (s: string) => (s === 'APPROVED' ? 'success' : s === 'SUSPENDED' ? 'destructive' : 'warning') as 'success' | 'destructive' | 'warning';

export function PartnersView({ partners, payouts, projects, canManage }: { partners: CP[]; payouts: Payout[]; projects: Opt[]; canManage: boolean }) {
  const router = useRouter();
  const [add, setAdd] = React.useState(false);
  const [sel, setSel] = React.useState<CP | null>(null);
  const [pending, start] = React.useTransition();
  const act = (fn: () => Promise<{ ok: true; id?: string } | { error: string }>, ok: string) =>
    start(async () => { const r = await fn(); if ('error' in r) { toast.error(r.error); return; } toast.success(ok); router.refresh(); });

  const submitAdd = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await createChannelPartner(Object.fromEntries(fd));
      if ('error' in r) { toast.error(r.error); return; } toast.success('Partner onboarded'); setAdd(false); router.refresh();
    });
  };
  const submitLead = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); if (!sel) return; const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await registerCpLead({ channelPartnerId: sel.id, name: fd.get('name'), phone: fd.get('phone'), email: fd.get('email') || '', projectId: fd.get('projectId') || null, requirement: fd.get('requirement') || undefined });
      if ('error' in r) { toast.error(r.error); return; } toast.success('Lead registered & locked for 60 days'); (e.target as HTMLFormElement).reset(); router.refresh();
    });
  };
  const submitPayout = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); if (!sel) return; const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await addBrokeragePayout({ channelPartnerId: sel.id, grossValue: fd.get('grossValue'), ratePercent: fd.get('ratePercent') || sel.commissionPct, stage: fd.get('stage') || undefined, dueDate: fd.get('dueDate') || null });
      if ('error' in r) { toast.error(r.error); return; } toast.success('Brokerage recorded'); (e.target as HTMLFormElement).reset(); router.refresh();
    });
  };

  const selPayouts = sel ? payouts.filter((p) => p.channelPartnerId === sel.id) : [];

  const [connectOpen, setConnectOpen] = React.useState(false);
  const hookUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://crm.ameyaheights.com'}/api/ingest/partner?key=YOUR_INGEST_SECRET`;
  const copyHook = () => { navigator.clipboard?.writeText(hookUrl); toast.success('Webhook URL copied — swap in your INGEST_SECRET'); };

  return (
    <div>
      {canManage && (
        <Card className="mb-3 p-3">
          <button onClick={() => setConnectOpen((v) => !v)} className="flex w-full items-center gap-2 text-left text-sm font-medium">
            <Globe className="h-4 w-4 text-[#A07D34]" /> Get website registrations here automatically
            <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${connectOpen ? 'rotate-180' : ''}`} />
          </button>
          {connectOpen && (
            <div className="mt-3 space-y-2 text-sm">
              <p className="text-muted-foreground">Point your website&apos;s &ldquo;Become a channel partner&rdquo; form at the URL below. Each registration then lands here as a <b>Pending</b> partner for you to approve — no more copying details out of an email.</p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-md border bg-muted/40 px-2 py-1.5 text-xs">{hookUrl}</code>
                <Button size="sm" variant="outline" onClick={copyHook}><Copy className="h-4 w-4" /> Copy</Button>
              </div>
              <p className="text-xs text-muted-foreground">Send a POST with JSON like <code className="rounded bg-muted/40 px-1">{'{ "name": "...", "phone": "...", "email": "...", "company": "..." }'}</code>. Replace <code className="rounded bg-muted/40 px-1">YOUR_INGEST_SECRET</code> with the INGEST_SECRET from your CRM settings. Duplicates (same phone/email) are skipped automatically.</p>
            </div>
          )}
        </Card>
      )}
      <div className="mb-3 flex justify-end">{canManage && <Button size="sm" onClick={() => setAdd(true)}><Plus className="h-4 w-4" /> Onboard partner</Button>}</div>
      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Firm</TableHead><TableHead>RERA</TableHead><TableHead>Comm %</TableHead><TableHead>KYC</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {partners.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground">No channel partners yet.</TableCell></TableRow>}
            {partners.map((p) => (
              <TableRow key={p.id}>
                <TableCell><p className="font-medium">{p.firmName}</p><p className="text-xs text-muted-foreground">{p.code} · {p.contactName} · {p.phone}</p></TableCell>
                <TableCell className="text-xs">{p.reraNumber ?? '—'}</TableCell>
                <TableCell>{p.commissionPct}%</TableCell>
                <TableCell><Badge variant={kycTone(p.kycStatus)}>{p.kycStatus}</Badge></TableCell>
                <TableCell><Badge variant={stTone(p.status)}>{p.status}</Badge></TableCell>
                <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => setSel(p)}>Manage</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Onboard dialog */}
      <Dialog open={add} onOpenChange={setAdd}>
        <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
          <DialogHeader><DialogTitle>Onboard channel partner</DialogTitle></DialogHeader>
          <form onSubmit={submitAdd} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label htmlFor="firmName">Firm name *</Label><Input id="firmName" name="firmName" required /></div>
              <div className="space-y-1"><Label htmlFor="contactName">Contact person *</Label><Input id="contactName" name="contactName" required /></div>
              <div className="space-y-1"><Label htmlFor="phone">Phone *</Label><Input id="phone" name="phone" required /></div>
              <div className="space-y-1"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" /></div>
              <div className="space-y-1"><Label htmlFor="reraNumber">RERA number</Label><Input id="reraNumber" name="reraNumber" /></div>
              <div className="space-y-1"><Label htmlFor="commissionPct">Commission %</Label><Input id="commissionPct" name="commissionPct" type="number" step="0.1" defaultValue="2" /></div>
              <div className="space-y-1"><Label htmlFor="panNumber">PAN</Label><Input id="panNumber" name="panNumber" /></div>
              <div className="space-y-1"><Label htmlFor="gstin">GSTIN</Label><Input id="gstin" name="gstin" /></div>
            </div>
            <div className="space-y-1"><Label htmlFor="bankDetails">Bank details</Label><Input id="bankDetails" name="bankDetails" placeholder="A/c no · IFSC" /></div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setAdd(false)}>Cancel</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Onboard</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Manage dialog */}
      <Dialog open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          {sel && (
            <>
              <DialogHeader><DialogTitle className="flex items-center gap-2">{sel.firmName} <Badge variant={stTone(sel.status)}>{sel.status}</Badge> <Badge variant={kycTone(sel.kycStatus)}>KYC {sel.kycStatus}</Badge></DialogTitle></DialogHeader>
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
                  {[['Code', sel.code], ['Contact', sel.contactName], ['Phone', sel.phone], ['Email', sel.email], ['RERA', sel.reraNumber], ['PAN', sel.panNumber], ['GSTIN', sel.gstin], ['Commission', `${sel.commissionPct}%`]].map(([k, v]) => <div key={k as string}><p className="text-[10px] uppercase text-muted-foreground">{k}</p><p className="font-medium">{(v as string) || '—'}</p></div>)}
                </div>

                {canManage && (
                  <div className="flex flex-wrap gap-2 border-t pt-3">
                    <span className="text-xs font-medium text-muted-foreground">KYC:</span>
                    <Button size="sm" variant="outline" className="h-7 text-xs" disabled={pending} onClick={() => act(() => setPartnerKyc(sel.id, 'VERIFIED'), 'KYC verified')}><ShieldCheck className="h-3 w-3" /> Verify</Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" disabled={pending} onClick={() => act(() => setPartnerKyc(sel.id, 'REJECTED'), 'KYC rejected')}>Reject</Button>
                    <span className="ml-3 text-xs font-medium text-muted-foreground">Status:</span>
                    <Button size="sm" variant="outline" className="h-7 text-xs" disabled={pending} onClick={() => act(() => setPartnerStatus(sel.id, 'APPROVED'), 'Approved')}>Approve</Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" disabled={pending} onClick={() => act(() => setPartnerStatus(sel.id, 'SUSPENDED'), 'Suspended')}>Suspend</Button>
                  </div>
                )}

                {canManage && (
                  <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                    <span className="text-xs font-medium text-muted-foreground">Partner portal:</span>
                    <Button size="sm" variant="outline" className="h-7 text-xs" disabled={pending} onClick={() => start(async () => {
                      const r = await regenCpPortalToken(sel.id);
                      if ('error' in r) { toast.error(r.error); return; }
                      const url = `${window.location.origin}/cp/${r.token}`;
                      navigator.clipboard?.writeText(url);
                      toast.success('Partner portal link copied — share it with them');
                    })}><Copy className="h-3 w-3" /> Copy portal link</Button>
                    <span className="text-[11px] text-muted-foreground">They register clients &amp; track commission themselves.</span>
                  </div>
                )}

                {canManage && (
                  <div className="rounded-md border p-3">
                    <p className="mb-2 flex items-center gap-2 text-sm font-medium"><UserPlus className="h-4 w-4" /> Register a client (locks 60 days)</p>
                    <form onSubmit={submitLead} className="grid grid-cols-2 gap-2">
                      <Input name="name" placeholder="Client name *" required />
                      <Input name="phone" placeholder="Phone *" required />
                      <Input name="email" placeholder="Email" type="email" />
                      <select name="projectId" defaultValue="" className="h-9 rounded-md border border-input bg-background px-3 text-sm"><option value="">Project —</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                      <Input name="requirement" placeholder="Requirement" className="col-span-2" />
                      <div className="col-span-2 flex justify-end"><Button type="submit" size="sm" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Register & lock</Button></div>
                    </form>
                  </div>
                )}

                <div className="rounded-md border p-3">
                  <p className="mb-2 flex items-center gap-2 text-sm font-medium"><Wallet className="h-4 w-4" /> Brokerage payouts</p>
                  {selPayouts.length === 0 && <p className="text-xs text-muted-foreground">No payouts recorded.</p>}
                  {selPayouts.map((p) => (
                    <div key={p.id} className="flex items-center justify-between border-b py-1.5 text-sm last:border-0">
                      <span>{money(p.amount)} <span className="text-xs text-muted-foreground">({p.ratePercent}% of {money(p.grossValue)}{p.stage ? ` · ${p.stage}` : ''})</span></span>
                      <span className="flex items-center gap-2"><Badge variant={p.status === 'PAID' ? 'success' : p.status === 'INVOICED' ? 'secondary' : 'warning'}>{p.status}</Badge>
                        {canManage && p.status !== 'PAID' && <Button size="sm" variant="ghost" className="h-6 text-xs" disabled={pending} onClick={() => act(() => setPayoutStatus(p.id, p.status === 'PENDING' ? 'INVOICED' : 'PAID'), 'Updated')}>{p.status === 'PENDING' ? 'Mark invoiced' : 'Mark paid'}</Button>}
                      </span>
                    </div>
                  ))}
                  {canManage && (
                    <form onSubmit={submitPayout} className="mt-3 grid grid-cols-4 gap-2">
                      <Input name="grossValue" type="number" placeholder="Deal value ₹" required className="col-span-2" />
                      <Input name="ratePercent" type="number" step="0.1" placeholder={`${sel.commissionPct}%`} />
                      <Input name="dueDate" type="date" />
                      <Input name="stage" placeholder="Stage e.g. On agreement" className="col-span-3" />
                      <Button type="submit" size="sm" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Add</Button>
                    </form>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
