'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Loader2, Check } from 'lucide-react';
import { createTenant, createLease, createMaintenanceRequest, updateMaintenanceStatus } from '@/server/actions/lease';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatCurrency, formatDate, titleCase } from '@/lib/utils/format';

const selectCls = 'flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm';
const MSTATUS = ['OPEN', 'IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'CLOSED'];
interface Opt { id: string; name: string }
interface Lease { id: string; reference: string; tenant: string; unit: string | null; project: string | null; status: string; rent: number; startDate: string; endDate: string }
interface Tenant { id: string; name: string; email: string | null; phone: string | null; company: string | null; leases: number }
interface Maint { id: string; reference: string; title: string; priority: string; status: string; assignedTo: string | null; lease: string | null }
function lVariant(s: string) { return s === 'ACTIVE' ? 'success' : s === 'EXPIRING' ? 'warning' : s === 'TERMINATED' || s === 'EXPIRED' ? 'destructive' : 'secondary'; }

export function LeaseView({ leases, tenants, maintenance, tenantOptions, units, users }: {
  leases: Lease[]; tenants: Tenant[]; maintenance: Maint[]; tenantOptions: Opt[]; units: Opt[]; users: Opt[];
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [d, setD] = React.useState<null | 'tenant' | 'lease' | 'maint'>(null);
  const close = () => setD(null);

  const run = (fn: () => Promise<{ ok: true; id: string } | { error: string }>, ok: string, e?: React.FormEvent) => {
    e?.preventDefault();
    start(async () => { const r = await fn(); if ('error' in r) { toast.error(r.error); return; } toast.success(ok); close(); router.refresh(); });
  };
  const setStatus = (id: string, status: string) => start(async () => {
    const r = await updateMaintenanceStatus(id, status as never); if ('error' in r) { toast.error(r.error); return; } toast.success('Updated'); router.refresh();
  });

  return (
    <Tabs defaultValue="leases">
      <div className="mb-4 flex items-center justify-between">
        <TabsList><TabsTrigger value="leases">Leases</TabsTrigger><TabsTrigger value="tenants">Tenants</TabsTrigger><TabsTrigger value="maintenance">Maintenance</TabsTrigger></TabsList>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setD('tenant')}><Plus className="h-4 w-4" /> Tenant</Button>
          <Button size="sm" variant="outline" onClick={() => setD('maint')}><Plus className="h-4 w-4" /> Maintenance</Button>
          <Button size="sm" onClick={() => setD('lease')}><Plus className="h-4 w-4" /> New lease</Button>
        </div>
      </div>

      <TabsContent value="leases">
        <Card><Table>
          <TableHeader><TableRow><TableHead>Ref</TableHead><TableHead>Tenant</TableHead><TableHead>Unit</TableHead><TableHead>Term</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Rent</TableHead></TableRow></TableHeader>
          <TableBody>
            {leases.length === 0 && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No leases yet.</TableCell></TableRow>}
            {leases.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-mono text-xs">{l.reference}</TableCell>
                <TableCell className="font-medium">{l.tenant}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{l.unit ?? '—'}{l.project ? ` · ${l.project}` : ''}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(l.startDate, 'dd MMM yy')} – {formatDate(l.endDate, 'dd MMM yy')}</TableCell>
                <TableCell><Badge variant={lVariant(l.status) as never}>{titleCase(l.status)}</Badge></TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(l.rent)}/mo</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table></Card>
      </TabsContent>

      <TabsContent value="tenants">
        <Card><Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Contact</TableHead><TableHead>Company</TableHead><TableHead>Leases</TableHead></TableRow></TableHeader>
          <TableBody>
            {tenants.length === 0 && <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No tenants yet.</TableCell></TableRow>}
            {tenants.map((t) => (<TableRow key={t.id}><TableCell className="font-medium">{t.name}</TableCell><TableCell className="text-sm text-muted-foreground">{t.email ?? '—'} · {t.phone ?? '—'}</TableCell><TableCell className="text-sm">{t.company ?? '—'}</TableCell><TableCell>{t.leases}</TableCell></TableRow>))}
          </TableBody>
        </Table></Card>
      </TabsContent>

      <TabsContent value="maintenance">
        <Card><Table>
          <TableHeader><TableRow><TableHead>Ref</TableHead><TableHead>Title</TableHead><TableHead>Priority</TableHead><TableHead>Assignee</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {maintenance.length === 0 && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No maintenance requests.</TableCell></TableRow>}
            {maintenance.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-mono text-xs">{m.reference}</TableCell>
                <TableCell><p className="font-medium">{m.title}</p>{m.lease && <p className="text-xs text-muted-foreground">{m.lease}</p>}</TableCell>
                <TableCell><Badge variant={m.priority === 'URGENT' ? 'destructive' : m.priority === 'HIGH' ? 'warning' : 'secondary'}>{titleCase(m.priority)}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">{m.assignedTo ?? '—'}</TableCell>
                <TableCell><Badge variant={m.status === 'RESOLVED' || m.status === 'CLOSED' ? 'success' : m.status === 'OPEN' ? 'secondary' : 'default'}>{titleCase(m.status)}</Badge></TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="sm">⋯</Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {MSTATUS.map((s) => <DropdownMenuItem key={s} onClick={() => setStatus(m.id, s)}><Check className="h-4 w-4" /> {titleCase(s)}</DropdownMenuItem>)}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table></Card>
      </TabsContent>

      {/* Tenant dialog */}
      <Dialog open={d === 'tenant'} onOpenChange={(o) => !o && close()}>
        <DialogContent><DialogHeader><DialogTitle>New tenant</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { const fd = new FormData(e.currentTarget); run(() => createTenant({ name: fd.get('name'), email: fd.get('email'), phone: fd.get('phone'), company: fd.get('company') }), 'Tenant added', e); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="tname">Name</Label><Input id="tname" name="name" required /></div>
              <div className="space-y-2"><Label htmlFor="tcompany">Company</Label><Input id="tcompany" name="company" /></div>
              <div className="space-y-2"><Label htmlFor="temail">Email</Label><Input id="temail" name="email" type="email" /></div>
              <div className="space-y-2"><Label htmlFor="tphone">Phone</Label><Input id="tphone" name="phone" /></div>
            </div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={close}>Cancel</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Add</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Lease dialog */}
      <Dialog open={d === 'lease'} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>New lease</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { const fd = new FormData(e.currentTarget); run(() => createLease({ tenantId: fd.get('tenantId'), unitId: fd.get('unitId') || null, startDate: fd.get('startDate'), endDate: fd.get('endDate'), rentAmount: fd.get('rentAmount'), deposit: fd.get('deposit') || undefined, escalationPct: fd.get('escalationPct') || undefined, noticePeriodDays: fd.get('noticePeriodDays') || undefined }), 'Lease created', e); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="tenantId">Tenant</Label><select id="tenantId" name="tenantId" required className={selectCls} defaultValue=""><option value="" disabled>Select…</option>{tenantOptions.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
              <div className="space-y-2"><Label htmlFor="unitId">Unit</Label><select id="unitId" name="unitId" className={selectCls} defaultValue=""><option value="">—</option>{units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
              <div className="space-y-2"><Label htmlFor="startDate">Start</Label><Input id="startDate" name="startDate" type="date" required /></div>
              <div className="space-y-2"><Label htmlFor="endDate">End</Label><Input id="endDate" name="endDate" type="date" required /></div>
              <div className="space-y-2"><Label htmlFor="rentAmount">Monthly rent (₹)</Label><Input id="rentAmount" name="rentAmount" type="number" required /></div>
              <div className="space-y-2"><Label htmlFor="deposit">Deposit (₹)</Label><Input id="deposit" name="deposit" type="number" /></div>
              <div className="space-y-2"><Label htmlFor="escalationPct">Escalation %</Label><Input id="escalationPct" name="escalationPct" type="number" step="0.1" /></div>
              <div className="space-y-2"><Label htmlFor="noticePeriodDays">Notice (days)</Label><Input id="noticePeriodDays" name="noticePeriodDays" type="number" /></div>
            </div>
            <p className="text-xs text-muted-foreground">A monthly rent schedule is generated automatically for the lease term.</p>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={close}>Cancel</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Create lease</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Maintenance dialog */}
      <Dialog open={d === 'maint'} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-w-xl"><DialogHeader><DialogTitle>New maintenance request</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { const fd = new FormData(e.currentTarget); run(() => createMaintenanceRequest({ title: fd.get('title'), description: fd.get('description'), leaseId: fd.get('leaseId') || null, priority: fd.get('priority'), assignedToId: fd.get('assignedToId') || null }), 'Request raised', e); }} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="mtitle">Title</Label><Input id="mtitle" name="title" required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="leaseId">Lease</Label><select id="leaseId" name="leaseId" className={selectCls} defaultValue=""><option value="">—</option>{leases.map((l) => <option key={l.id} value={l.id}>{l.reference} · {l.tenant}</option>)}</select></div>
              <div className="space-y-2"><Label htmlFor="mpriority">Priority</Label><select id="mpriority" name="priority" className={selectCls} defaultValue="MEDIUM">{['LOW','MEDIUM','HIGH','URGENT'].map((p) => <option key={p} value={p}>{titleCase(p)}</option>)}</select></div>
              <div className="space-y-2"><Label htmlFor="assignedToId">Assign to</Label><select id="assignedToId" name="assignedToId" className={selectCls} defaultValue=""><option value="">—</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
            </div>
            <div className="space-y-2"><Label htmlFor="mdesc">Description</Label><Textarea id="mdesc" name="description" /></div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={close}>Cancel</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Raise</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
